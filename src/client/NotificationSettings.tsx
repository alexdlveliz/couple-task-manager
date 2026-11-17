import { useEffect, useRef, useState } from "react";
import type { User } from "firebase/auth";
import { ApiError, createApi } from "./api";
import {
  cleanupNotifications,
  enableNotifications,
  notificationBinding,
  prepareNotificationAccount,
} from "./notifications";

export function NotificationSettings({ user }: { user: User }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const bell = useRef<HTMLButtonElement>(null);
  const [message, setMessage] = useState("Comprobando notificaciones…");
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [active, setActive] = useState(false);
  const [busy, setBusy] = useState(true);
  const supported =
    typeof Notification !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window;
  useEffect(() => {
    let alive = true;
    // Reset controls when the signed-in user changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBusy(true);
    setPublicKey(null);
    setActive(false);
    setMessage("Comprobando notificaciones…");
    void (async () => {
      if (!supported) {
        setMessage(
          "Este navegador no admite notificaciones. En iPhone, agrega esta app a la pantalla de inicio y ábrela desde allí.",
        );
        return;
      }
      try {
        await prepareNotificationAccount(user.uid);
        const api = createApi(user, () => {});
        const config = await api.notificationConfig();
        // Async cleanup can change this flag while the request is in flight.
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (!alive) return;
        if (!config.available || !config.publicKey) {
          setMessage(
            config.problem ??
              "El servicio de notificaciones no está disponible.",
          );
          return;
        }
        setPublicKey(config.publicKey);
        if (Notification.permission === "denied") {
          setMessage(
            "El permiso está bloqueado. Cambia la configuración de notificaciones del navegador.",
          );
          return;
        }
        const id = notificationBinding(user.uid);
        if (id && id !== "pending") {
          const status = await api
            .notificationStatus(id)
            .catch((error: unknown) => {
              if (error instanceof ApiError && error.status === 404)
                return null;
              throw error;
            });
          // Async cleanup can change this flag while the request is in flight.
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
          if (!alive) return;
          if (
            status?.active &&
            status.lastOutcome &&
            status.lastOutcome !== "accepted"
          ) {
            setMessage(
              "Hay un problema conocido con el servicio de notificaciones. Revisa este dispositivo.",
            );
            setActive(status.active);
            return;
          }
          if (status?.active && Notification.permission === "granted") {
            const registration =
              await navigator.serviceWorker.getRegistration();
            const subscription =
              await registration?.pushManager.getSubscription();
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
            if (!alive) return;
            if (subscription) {
              setActive(true);
              setMessage("Notificaciones activas en este dispositivo.");
              return;
            }
          }
        }
        if (Notification.permission === "granted") {
          await enableNotifications(user, config.publicKey, {
            automatic: true,
            isCurrent: () => alive,
          });
          // The component may have unmounted during registration.
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
          if (!alive) return;
          setActive(true);
          setMessage("Notificaciones activas en este dispositivo.");
        } else {
          setMessage("Notificaciones desactivadas en este dispositivo.");
        }
      } catch {
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (alive)
          setMessage(
            "No se pudo comprobar la configuración de notificaciones de la app. Inténtalo de nuevo.",
          );
      } finally {
        // The component may have unmounted during an async operation.
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (alive) setBusy(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [user, supported]);
  async function toggle() {
    setBusy(true);
    try {
      if (active) {
        await cleanupNotifications(user);
        setActive(false);
        setMessage("Notificaciones desactivadas en este dispositivo.");
      } else if (publicKey) {
        await enableNotifications(user, publicKey);
        setActive(true);
        setMessage("Notificaciones activas en este dispositivo.");
      }
    } catch (error) {
      if (active) setActive(false);
      setMessage(
        error instanceof Error && error.message.startsWith("Permiso")
          ? error.message
          : "No se pudieron actualizar las notificaciones. Inténtalo de nuevo.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <button
        ref={bell}
        className="secondary notification-bell"
        type="button"
        aria-label="Notificaciones"
        aria-haspopup="dialog"
        onClick={() => dialog.current?.showModal()}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
          <path d="M10 21h4" />
        </svg>
      </button>
      <dialog
        ref={dialog}
        onClose={() => bell.current?.focus()}
        className="notification-dialog"
        aria-labelledby="notification-heading"
      >
        <section
          className="notification-settings"
          aria-labelledby="notification-heading"
        >
          <h2 id="notification-heading">Notificaciones</h2>
          {typeof Notification !== "undefined" && (
            <p role="status" aria-live="polite">
              {Notification.permission === "granted"
                ? "Permiso del navegador: concedido."
                : Notification.permission === "denied"
                  ? "Permiso del navegador: bloqueado."
                  : "Permiso del navegador: aún no concedido."}
            </p>
          )}
          <p role="status" aria-live="polite">
            {message}
          </p>
          <p>
            La entrega depende del navegador y del servicio de notificaciones.
          </p>
          {!busy &&
            supported &&
            publicKey &&
            Notification.permission !== "denied" && (
              <button
                className="secondary"
                type="button"
                disabled={busy}
                onClick={() => void toggle()}
              >
                {active
                  ? "Desactivar notificaciones"
                  : "Activar notificaciones"}
              </button>
            )}
          <div className="notification-dialog-actions">
            <button
              className="secondary"
              type="button"
              onClick={() => dialog.current?.close()}
            >
              Cerrar
            </button>
          </div>
        </section>
      </dialog>
    </>
  );
}
