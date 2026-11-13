import { STATUSES, type Partner, type Task } from "../shared/contracts";
export interface StoredSnapshot {
  uid: string;
  schemaVersion: 1;
  partners: Partner[];
  tasks: Task[];
  revision: number;
  lastSyncAt: string;
}
interface RecordValue {
  generation: number;
  blocked: boolean;
  snapshot?: StoredSnapshot;
}
const storeName = "snapshots";
const keyFor = (project: string, uid: string) => `${project}:${uid}:1`;
const empty = (): RecordValue => ({ generation: 0, blocked: false });
const isObject = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
function isCompleteSnapshot(
  value: unknown,
  uid: string,
): value is StoredSnapshot {
  if (
    !isObject(value) ||
    value.uid !== uid ||
    !uid ||
    value.schemaVersion !== 1 ||
    !Number.isSafeInteger(value.revision) ||
    (value.revision as number) < 0 ||
    typeof value.lastSyncAt !== "string" ||
    !Number.isFinite(Date.parse(value.lastSyncAt)) ||
    !Array.isArray(value.partners) ||
    !Array.isArray(value.tasks)
  )
    return false;
  return (
    value.partners.every(
      (partner) =>
        isObject(partner) &&
        typeof partner.uid === "string" &&
        !!partner.uid &&
        typeof partner.displayName === "string" &&
        !!partner.displayName,
    ) &&
    value.tasks.every(
      (task) =>
        isObject(task) &&
        typeof task.id === "string" &&
        typeof task.title === "string" &&
        typeof task.assigneeUid === "string" &&
        typeof task.status === "string" &&
        STATUSES.includes(task.status as Task["status"]) &&
        (task.deadline === null || typeof task.deadline === "string") &&
        typeof task.createdAt === "string" &&
        typeof task.updatedAt === "string",
    )
  );
}
function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("Storage unavailable"));
      return;
    }
    const request = indexedDB.open("shared-task-board", 1);
    request.onupgradeneeded = () => request.result.createObjectStore(storeName);
    request.onsuccess = () => {
      resolve(request.result);
    };
    request.onerror = () => {
      reject(request.error ?? new Error("Storage request failed"));
    };
    request.onblocked = () => {
      reject(new Error("Storage blocked"));
    };
  });
}
async function transact<T>(
  project: string,
  uid: string,
  mode: IDBTransactionMode,
  action: (value: RecordValue, store: IDBObjectStore, key: string) => T,
): Promise<T> {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = db.transaction(storeName, mode);
      const store = transaction.objectStore(storeName);
      const key = keyFor(project, uid);
      const request = store.get(key);
      let output: T;
      request.onsuccess = () => {
        try {
          output = action(
            (request.result as RecordValue | undefined) ?? empty(),
            store,
            key,
          );
        } catch (error) {
          transaction.abort();
          reject(
            error instanceof Error
              ? error
              : new Error("Storage request failed", { cause: error }),
          );
        }
      };
      transaction.oncomplete = () => {
        resolve(output);
      };
      transaction.onerror = () => {
        reject(transaction.error ?? new Error("Storage request failed"));
      };
      transaction.onabort = () => {
        reject(transaction.error ?? new Error("Storage request failed"));
      };
    });
  } finally {
    db.close();
  }
}
export function readSnapshot(
  project: string,
  uid: string,
): Promise<StoredSnapshot | null> {
  return transact(project, uid, "readonly", (value) => {
    if (value.blocked || !value.snapshot) return null;
    if (!isCompleteSnapshot(value.snapshot, uid))
      throw new Error("Incomplete stored snapshot");
    return value.snapshot;
  });
}
export function currentGeneration(
  project: string,
  uid: string,
): Promise<number> {
  return transact(project, uid, "readonly", (value) => value.generation);
}
export function activateSnapshot(
  project: string,
  uid: string,
  generation: number,
): Promise<boolean> {
  return transact(project, uid, "readwrite", (value, store, key) => {
    if (value.generation !== generation) return false;
    store.put({ ...value, blocked: false }, key);
    return true;
  });
}
export function writeSnapshot(
  project: string,
  snapshot: StoredSnapshot,
  generation?: number,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Async cleanup or external input can invalidate static assumptions.
  if (!snapshot || !isCompleteSnapshot(snapshot, snapshot.uid))
    return Promise.reject(new Error("Incomplete snapshot"));
  return transact(project, snapshot.uid, "readwrite", (value, store, key) => {
    if (
      !value.blocked &&
      (generation === undefined || value.generation === generation) &&
      (!value.snapshot ||
        !isCompleteSnapshot(value.snapshot, snapshot.uid) ||
        value.snapshot.revision < snapshot.revision ||
        (value.snapshot.revision === snapshot.revision &&
          value.snapshot.lastSyncAt <= snapshot.lastSyncAt))
    )
      store.put({ ...value, snapshot }, key);
  });
}
export function invalidateSnapshot(
  project: string,
  uid: string,
): Promise<void> {
  return transact(project, uid, "readwrite", (value, store, key) => {
    store.put({ generation: value.generation + 1, blocked: true }, key);
  });
}
export const deleteSnapshot = invalidateSnapshot;
