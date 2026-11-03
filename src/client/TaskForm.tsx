import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Temporal } from '@js-temporal/polyfill';
import { convertDeadline, currentZone, deadlineFields } from './deadline';
import { STATUSES, STATUS_LABELS, type CreateTask, type Partner, type ReplaceTask, type Task, type TaskStatus } from '../shared/contracts';

interface Props { task?: Task; partners: Partner[]; busy: boolean; offline: boolean; reconciling: boolean; saveError: string; onRefresh: () => void; onClose: () => void; onSave: (data: CreateTask | ReplaceTask) => Promise<void> }
export function TaskForm({ task, partners, busy, offline, reconciling, saveError, onRefresh, onClose, onSave }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const assigneeRef = useRef<HTMLSelectElement>(null);
  const dateRef = useRef<HTMLInputElement>(null);
  const timeRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState(task?.title ?? '');
  const [assignee, setAssignee] = useState(task?.assigneeUid ?? '');
  const [status, setStatus] = useState<TaskStatus>(task?.status ?? 'todo');
  const [zone, setZone] = useState(currentZone);
  const [date, setDate] = useState(() => task?.deadline ? deadlineFields(task.deadline, currentZone()).date : '');
  const [time, setTime] = useState(() => task?.deadline ? deadlineFields(task.deadline, currentZone()).time : '');
  const [changed, setChanged] = useState(false);
  const [zoneWarning, setZoneWarning] = useState('');
  const [foldNotice, setFoldNotice] = useState('');
  const [error, setError] = useState('');
  const titleInvalid = error === 'Escribe un título.';
  const assigneeInvalid = error === 'Selecciona una persona autorizada.';
  const deadlineInvalid = !!error && !titleInvalid && !assigneeInvalid;
  useEffect(() => {
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const current = dialog.current;
    current?.showModal(); titleRef.current?.focus();
    return () => { if (current?.open) current.close(); if (trigger?.isConnected) trigger.focus(); };
  }, []);
  let offset = Temporal.Now.zonedDateTimeISO(zone).offset;
  try {
    if (!changed && task?.deadline) offset = deadlineFields(task.deadline, zone).offset;
    else if (date && time) offset = convertDeadline(date, time, zone).offset;
  } catch { /* Input feedback is presented on save. */ }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) { setError('Escribe un título.'); titleRef.current?.focus(); return; }
    if (!partners.some(partner => partner.uid === assignee)) { setError('Selecciona una persona autorizada.'); assigneeRef.current?.focus(); return; }
    setError('');
    const zoneNow = currentZone();
    if (zoneNow !== zone && changed) { setZone(zoneNow); setZoneWarning('La zona horaria del dispositivo cambió. Revisa la fecha y la hora antes de guardar.'); return; }
    let deadline = task?.deadline ?? null;
    if (changed) {
      if (!date && !time) deadline = null;
      else if (!date || !time) { setError('Escribe la fecha y la hora límite.'); (date ? timeRef : dateRef).current?.focus(); return; }
      else { try { const value = convertDeadline(date, time, zoneNow); deadline = value.instant; if (value.ambiguous && !foldNotice) { setFoldNotice(`Esta hora ocurre dos veces. Se usará la primera, con desfase UTC${value.offset.replace('-', '−')}.`); return; } } catch (failure) { setError(failure instanceof Error && failure.message.startsWith('Esta hora no existe') ? failure.message : 'Escribe una fecha y hora válidas.'); timeRef.current?.focus(); return; } }
    }
    await onSave(task ? { title: title.trim(), assigneeUid: assignee, status, deadline } : { title: title.trim(), assigneeUid: assignee, deadline });
  }
  return <dialog ref={dialog} onCancel={event => { event.preventDefault(); if (!busy) onClose(); }} aria-labelledby="form-title">
    <form onSubmit={event => void submit(event)} noValidate>
      <h2 id="form-title">{task ? 'Editar tarea' : 'Nueva tarea'}</h2>
      {error && <p role="alert" id="form-error">{error}</p>}
      <label htmlFor="title">Título</label><input id="title" ref={titleRef} required aria-invalid={titleInvalid} value={title} onChange={event => setTitle(event.target.value)} aria-describedby={titleInvalid ? 'form-error' : undefined} />
      <label htmlFor="assignee">Responsable</label><select id="assignee" ref={assigneeRef} required aria-invalid={assigneeInvalid} aria-describedby={assigneeInvalid ? "form-error" : undefined} value={assignee} onChange={event => setAssignee(event.target.value)}><option value="">Selecciona una persona</option>{partners.map(partner => <option key={partner.uid} value={partner.uid}>{partner.displayName}</option>)}</select>
      {task && <><label htmlFor="status">Estado</label><select id="status" value={status} onChange={event => setStatus(event.target.value as TaskStatus)}>{STATUSES.map(item => <option key={item} value={item}>{STATUS_LABELS[item]}</option>)}</select></>}
      <label htmlFor="deadline-date">Fecha límite</label><input id="deadline-date" ref={dateRef} aria-invalid={deadlineInvalid} aria-describedby={deadlineInvalid ? "form-error" : undefined} type="date" value={date} onChange={event => { setDate(event.target.value); setChanged(true); setFoldNotice(''); setZoneWarning(''); }} />
      <label htmlFor="deadline-time">Hora límite</label><input id="deadline-time" ref={timeRef} aria-invalid={deadlineInvalid} aria-describedby={deadlineInvalid ? "form-error" : undefined} type="time" value={time} onChange={event => { setTime(event.target.value); setChanged(true); setFoldNotice(''); setZoneWarning(''); }} />
      <p>{zone} (UTC{offset.replace('-', '−')})</p>
      <button type="button" className="secondary" onClick={() => { setDate(''); setTime(''); setChanged(true); setFoldNotice(''); }}>Quitar fecha límite</button>
      {zoneWarning && <p role="alert">{zoneWarning}</p>}{foldNotice && <p role="status">{foldNotice}</p>}
      {offline && <p>Necesitas conexión para guardar cambios.</p>}
      {saveError && <><p role="alert">{saveError}</p><button type="button" className="secondary" onClick={onRefresh} disabled={offline}>Actualizar</button></>}
      <div className="actions"><button type="button" className="secondary" onClick={onClose} disabled={busy}>Cancelar</button><button type="submit" disabled={busy || offline || reconciling}>{busy ? 'Guardando…' : 'Guardar'}</button></div>
    </form>
  </dialog>;
}
