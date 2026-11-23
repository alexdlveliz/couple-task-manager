import type { User } from "firebase/auth";
import { createApi } from "./api";
import { getAuthGeneration } from "./auth";

const key = "shared-board-notification-binding";
type Binding = { uid: string; id: string };
function readBinding(): Binding | null {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) ?? "null");
    if (
      value &&
      typeof value === "object" &&
      "uid" in value &&
      typeof value.uid === "string" &&
      "id" in value &&
      typeof value.id === "string"
    )
      return { uid: value.uid, id: value.id };
  } catch {
    /* Treat unavailable storage as unbound. */
  }
  return null;
}
export function notificationBinding(uid: string): string | null {
  const binding = readBinding();
  return binding?.uid === uid ? binding.id : null;
}
async function unsubscribe(): Promise<void> {
  if (!("serviceWorker" in navigator)) return;
  let expired = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      expired = true;
      reject(new Error("No se pudo desactivar este dispositivo."));
    }, 2_000);
  });
  const remove = async () => {
    const registration = await navigator.serviceWorker.getRegistration();
    if (expired) return;
    const subscription = await registration?.pushManager.getSubscription();
    if (expired) return;
    if (subscription && !(await subscription.unsubscribe()))
      throw new Error("No se pudo desactivar este dispositivo.");
  };
  try {
    await Promise.race([remove(), timeout]);
  } finally {
    expired = true;
    clearTimeout(timer);
  }
}

let sequence: Promise<void> = Promise.resolve();
function serial(action: () => Promise<void>): Promise<void> {
  const next = sequence.then(action, action);
  sequence = next.catch(() => {});
  return next;
}
async function cleanup(user?: User | null): Promise<void> {
  const binding = readBinding();
  // Keep a marker when local cleanup fails so another account cannot reuse the endpoint.
  if (binding && user && binding.uid !== user.uid) return;
  if (!binding) {
    if (
      typeof Notification !== "undefined" &&
      Notification.permission !== "granted"
    )
      return;
    await unsubscribe();
    return;
  }
  let serverFailed = false;
  try {
    if (user?.uid === binding.uid)
      await createApi(user, () => {}).removeNotification(binding.id);
  } catch {
    serverFailed = true; // Local unsubscribe still prevents reuse of this endpoint.
  }
  await unsubscribe();
  localStorage.removeItem(key);
  if (serverFailed)
    throw new Error("No se pudo confirmar la desactivación en el servidor.");
}
export function cleanupNotifications(user?: User | null): Promise<void> {
  return serial(() => cleanup(user));
}
export function prepareNotificationAccount(uid: string): Promise<void> {
  return serial(async () => {
    const binding = readBinding();
    if (binding && binding.uid !== uid) await cleanup();
  });
}
export async function enableNotifications(
  user: User,
  publicKey: string,
  options?: { automatic: boolean; isCurrent: () => boolean },
): Promise<void> {
  const generation = getAuthGeneration();
  const permission =
    Notification.permission === "granted"
      ? "granted"
      : options?.automatic
        ? Notification.permission
        : await Notification.requestPermission();
  if (permission !== "granted")
    throw new Error(
      "Permiso denegado. Cambia la configuración de notificaciones del navegador.",
    );
  await serial(async () => {
    if (getAuthGeneration() !== generation || (options && !options.isCurrent()))
      throw new Error("La sesión cambió.");
    const binding = readBinding();
    if (binding && binding.uid !== user.uid) await cleanup();
    if (!notificationBinding(user.uid)) await unsubscribe();
    // Refuse activation if a durable account binding cannot be stored.
    localStorage.setItem(key, JSON.stringify({ uid: user.uid, id: "pending" }));
    // `ready` can remain pending forever when registration fails or is absent.
    let readyTimer: ReturnType<typeof setTimeout> | undefined;
    const readyTimeout = new Promise<never>((_, reject) => {
      readyTimer = setTimeout(() => {
        reject(new Error("El servicio de notificaciones no está listo."));
      }, 5_000);
    });
    let registration: ServiceWorkerRegistration;
    try {
      registration = await Promise.race([
        navigator.serviceWorker.ready,
        readyTimeout,
      ]);
    } finally {
      clearTimeout(readyTimer);
    }
    if (getAuthGeneration() !== generation || (options && !options.isCurrent()))
      throw new Error("La sesión cambió.");
    const bytes = Uint8Array.from(
      atob(publicKey.replace(/-/g, "+").replace(/_/g, "/")),
      (c) => c.charCodeAt(0),
    );
    const subscription =
      (await registration.pushManager.getSubscription()) ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: bytes,
      }));
    try {
      const result = await createApi(user, () => {}).registerNotification(
        subscription.toJSON(),
      );
      localStorage.setItem(
        key,
        JSON.stringify({ uid: user.uid, id: result.id }),
      );
      if (getAuthGeneration() !== generation) {
        await cleanup(user);
        throw new Error("La sesión cambió.");
      }
    } catch (error) {
      await subscription.unsubscribe();
      throw error;
    }
  });
}
