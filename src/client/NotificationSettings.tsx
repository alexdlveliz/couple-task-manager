import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { createApi } from "./api";
import {
  cleanupNotifications,
  enableNotifications,
  notificationBinding,
  prepareNotificationAccount,
} from "./notifications";

export function NotificationSettings({ user }: { user: User }) {
  const [message, setMessage] = useState("Comprobando notificaciones…");
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [active, setActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const supported =
    typeof Notification !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window;
  useEffect(() => {
    let alive = true;
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
        setPublicKey(config.publicKey);
        if (!config.available || !config.publicKey) {
          setMessage(
            config.problem ??
              "El servicio de notificaciones no está disponible.",
          );
          return;
        }
        if (Notification.permission === "denied") {
          setMessage(
            "El permiso está bloqueado. Cambia la configuración de notificaciones del navegador.",
          );
          return;
        }
        const id = notificationBinding(user.uid);
        if (id) {
          const status = await api.notificationStatus(id);
          // Async cleanup can change this flag while the request is in flight.
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
          if (!alive) return;
          setActive(status.active);
          setMessage(
            status.lastOutcome && status.lastOutcome !== "accepted"
              ? "Hay un problema conocido con el servicio de notificaciones. Revisa este dispositivo."
              : status.active
                ? "Notificaciones activas en este dispositivo."
                : "Notificaciones desactivadas en este dispositivo.",
          );
        } else setMessage("Notificaciones desactivadas en este dispositivo.");
      } catch {
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (alive)
          setMessage(
            "No se pudo consultar el estado de notificaciones. Inténtalo de nuevo.",
          );
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
    <section
      className="notification-settings"
      aria-labelledby="notification-heading"
    >
      <h2 id="notification-heading">Notificaciones</h2>
      <p role="status" aria-live="polite">
        {message}
      </p>
      <p>La entrega depende del navegador y del servicio de notificaciones.</p>
      {supported && publicKey && Notification.permission !== "denied" && (
        <button
          className="secondary"
          type="button"
          disabled={busy}
          onClick={() => void toggle()}
        >
          {active ? "Desactivar notificaciones" : "Activar notificaciones"}
        </button>
      )}
    </section>
  );
}
