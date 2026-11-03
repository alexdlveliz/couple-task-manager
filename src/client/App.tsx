import { useEffect, useRef, useState } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { auth, authReady, updateAuthGeneration } from './auth';
import { createApi } from './api';
import { Board } from './Board';
import { RefreshCoordinator } from './sync';
import { SignIn } from './SignIn';
import { activateSnapshot, currentGeneration, readSnapshot, writeSnapshot, type StoredSnapshot } from './snapshot-store';
import { invalidatePrivateData, listenForInvalidation, restorationAllowed } from './session-invalidation';
import { TaskForm } from './TaskForm';
import type { BoardSnapshot, CreateTask, Partner, ReplaceTask, Task } from '../shared/contracts';

type Editor = { task?: Task } | null;
export function App() {
  const [user, setUser] = useState<User | null | undefined>();
  const [board, setBoard] = useState<BoardSnapshot | null>(null);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [editor, setEditor] = useState<Editor>(null);
  const [notice, setNotice] = useState('Cargando tareas…');
  const [saved, setSaved] = useState('');
  const [busy, setBusy] = useState(false);
  const [reconciling, setReconciling] = useState(false);
  const [rejection, setRejection] = useState('');
  const [storageError, setStorageError] = useState('');
  const [lastSync, setLastSync] = useState('');
  const previousUid = useRef<string | null>(null);
  const [online, setOnline] = useState(navigator.onLine);
  const onlineRef = useRef(navigator.onLine);
  const coordinator = useRef<RefreshCoordinator | null>(null);
  const requestController = useRef<AbortController | null>(null);
  const session = useRef(0);
  useEffect(() => {
    let unsubscribe = () => {};
    let active = true;
    void authReady.then(() => { if (active) unsubscribe = onAuthStateChanged(auth, next => {
      const oldUid = previousUid.current; previousUid.current = next?.uid ?? null;
      if (oldUid && oldUid !== next?.uid) void invalidatePrivateData(oldUid).catch(() => setStorageError('No se pudieron borrar los datos locales. No se mostrará la copia guardada.'));
      updateAuthGeneration(next); session.current++;
      coordinator.current?.stop(); requestController.current?.abort(); setBoard(null); setPartners([]); setEditor(null); setSaved(''); setLastSync(''); setBusy(false); setReconciling(false); if (next) setRejection(''); setUser(next);
    }); });
    const unlisten = listenForInvalidation(uid => { if (previousUid.current === uid) { session.current++; coordinator.current?.stop(); requestController.current?.abort(); setBoard(null); setPartners([]); setEditor(null); void invalidatePrivateData(uid, false).catch(() => setStorageError('No se pudieron borrar los datos locales. No se mostrará la copia guardada.')); void signOut(auth); } });
    const updateOnline = () => { const next = navigator.onLine; if (onlineRef.current !== next) { onlineRef.current = next; setOnline(next); if (next) void coordinator.current?.refresh(); } };
    const onlineTimer = setInterval(updateOnline, 1000);
    window.addEventListener('online', updateOnline); window.addEventListener('offline', updateOnline);
    return () => { active = false; clearInterval(onlineTimer); unlisten(); unsubscribe(); window.removeEventListener('online', updateOnline); window.removeEventListener('offline', updateOnline); coordinator.current?.stop(); };
  }, []);
  useEffect(() => {
    if (!user) return;
    const generation = session.current;
    const requests = new AbortController();
    requestController.current = requests;
    const api = createApi(user, (status) => { if (session.current === generation) { session.current++; coordinator.current?.stop(); requestController.current?.abort(); setBoard(null); setPartners([]); setEditor(null); setRejection(status === 403 ? 'Esta cuenta no tiene acceso al tablero.' : 'Tu sesión ya no es válida. Inicia sesión de nuevo.'); void signOut(auth); } }, requests.signal);
    const project = import.meta.env.VITE_FIREBASE_PROJECT_ID || 'demo-shared-task-board';
    let storageGeneration: number | undefined;
    let complete: StoredSnapshot | null = null;
    let persistenceRequested = false;
    let stopped = false;
    const persist = async () => {
      if (!complete || storageGeneration === undefined || stopped || session.current !== generation) return;
      try {
        if (!await activateSnapshot(project, user.uid, storageGeneration)) return;
        if (stopped || session.current !== generation) return;
        await writeSnapshot(project, complete, storageGeneration);
      } catch { if (!stopped) setStorageError('No se pudieron guardar los datos en este dispositivo. La consulta sin conexión puede no estar disponible.'); }
    };
    const sync = new RefreshCoordinator({ uid: user.uid, load: api.board, partners: api.partners,
      accept: (snapshot, people) => { if (session.current === generation) { setBoard(snapshot); setPartners(people); complete = { uid: user.uid, schemaVersion: 1, tasks: snapshot.tasks, partners: people, revision: snapshot.revision, lastSyncAt: new Date().toISOString() }; } },
      refreshing: () => { if (session.current === generation) setNotice('Actualizando…'); },
      verified: () => { if (session.current === generation) { const now = new Date().toISOString(); setLastSync(now); setNotice('Actualizado'); setReconciling(false); if (complete) { complete = { ...complete, lastSyncAt: now }; if (!persistenceRequested) { persistenceRequested = true; void navigator.storage?.persist?.().catch(() => {}); } void persist(); } } },
      error: () => { if (session.current === generation) setNotice('No se pudo actualizar. Los datos pueden estar desactualizados.'); },
    });
    coordinator.current = sync; setNotice('Cargando tareas…');
    void (async () => {
      let cleanupRequired = false;
      try {
        if (!restorationAllowed(user.uid)) { cleanupRequired = true; }
        if (cleanupRequired) {
          await invalidatePrivateData(user.uid, false);
          if (!restorationAllowed(user.uid)) throw new Error('Cleanup marker unavailable');
        }
        storageGeneration = await currentGeneration(project, user.uid);
        const cached = await readSnapshot(project, user.uid);
        if (cached && !stopped && session.current === generation) { complete = cached; const restored = { tasks: cached.tasks, revision: cached.revision }; sync.restore(restored, cached.partners); setBoard(restored); setPartners(cached.partners); setLastSync(cached.lastSyncAt); setNotice('No se pudo actualizar. Los datos pueden estar desactualizados.'); }
      } catch { if (!stopped) setStorageError(cleanupRequired ? 'No se pudieron borrar los datos locales. No se mostrará la copia guardada.' : 'No se pudieron guardar los datos en este dispositivo. La consulta sin conexión puede no estar disponible.'); }
      if (!stopped) { sync.start(); if (navigator.onLine) void sync.refresh(); }
    })();
    return () => { stopped = true; requests.abort(); sync.stop(); };
  }, [user]);
  async function save(data: CreateTask | ReplaceTask) {
    if (!user || !editor || busy || !online) return;
    const generation = session.current;
    setBusy(true); setSaved('');
    const api = createApi(user, (status) => { if (session.current === generation) { session.current++; coordinator.current?.stop(); requestController.current?.abort(); setBoard(null); setPartners([]); setEditor(null); setRejection(status === 403 ? 'Esta cuenta no tiene acceso al tablero.' : 'Tu sesión ya no es válida. Inicia sesión de nuevo.'); void signOut(auth); } }, requestController.current?.signal);
    try {
      const result = editor.task ? await api.replace(editor.task.id, data as ReplaceTask) : await api.create(data);
      if (session.current !== generation) return;
      setSaved('Cambios guardados.'); setEditor(null); coordinator.current?.saved(result.revision);
    } catch {
      if (session.current === generation) { setSaved('No se pudo confirmar el guardado. Actualiza el tablero antes de intentarlo de nuevo.'); setReconciling(true); void coordinator.current?.refresh(); }
    } finally { if (session.current === generation) setBusy(false); }
  }
  if (user === undefined) return <main><p>Cargando tareas…</p></main>;
  if (!user) return <SignIn notice={rejection} />;
  return <main className="app-shell"><header className="app-header"><h1>Tablero compartido</h1><button className="secondary" type="button" onClick={() => void signOut(auth)}>Cerrar sesión</button></header>
    <div className="sync-bar" role="status" aria-live={!online || notice.startsWith('No se pudo') ? 'polite' : 'off'}><span>{online ? notice : 'Sin conexión. Los datos pueden estar desactualizados.'}</span><button className="text-button" onClick={() => void coordinator.current?.refresh()} disabled={!online}>Actualizar</button></div>
    {lastSync && <p>Última sincronización: {new Date(lastSync).toLocaleString('es')}</p>}
    {storageError && <p role="alert">{storageError}</p>}
    {saved && <p role="status">{saved}</p>}
    {board ? <Board tasks={board.tasks} partners={partners} offline={!online} onCreate={() => { setSaved(''); setEditor({}); }} onEdit={task => { setSaved(''); setEditor({ task }); }} /> : <p>{!online ? 'No hay tareas guardadas en este dispositivo. Conéctate para cargar el tablero.' : notice.startsWith('No se pudo') ? 'No se pudieron cargar las tareas. Pulsa Actualizar para intentarlo de nuevo.' : 'Cargando tareas…'}</p>}
    {editor && <TaskForm task={editor.task} partners={partners} busy={busy} offline={!online} reconciling={reconciling} saveError={saved.startsWith('No se pudo') ? saved : ''} onRefresh={() => void coordinator.current?.refresh()} onClose={() => setEditor(null)} onSave={save} />}
  </main>;
}
