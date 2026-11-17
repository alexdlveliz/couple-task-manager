import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
} from "workbox-precaching";
import { NavigationRoute, registerRoute } from "workbox-routing";

interface WorkerWindow {
  url: string;
  navigate(url: string): Promise<unknown>;
  focus(): Promise<unknown>;
}
interface PushMessage {
  data?: { json(): unknown };
  waitUntil(promise: Promise<unknown>): void;
}
interface ClickMessage {
  notification: { close(): void; data: unknown };
  waitUntil(promise: Promise<unknown>): void;
}
declare const self: {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>;
  location: { origin: string };
  registration: {
    showNotification(
      title: string,
      options: NotificationOptions,
    ): Promise<void>;
  };
  skipWaiting(): Promise<void>;
  clients: {
    claim(): Promise<void>;
    matchAll(options: {
      type: "window";
      includeUncontrolled: boolean;
    }): Promise<WorkerWindow[]>;
    openWindow(url: string): Promise<unknown>;
  };
  addEventListener(
    type: "install" | "activate",
    callback: (event: { waitUntil(p: Promise<unknown>): void }) => void,
  ): void;
  addEventListener(type: "push", callback: (event: PushMessage) => void): void;
  addEventListener(
    type: "notificationclick",
    callback: (event: ClickMessage) => void,
  ): void;
};
self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();
registerRoute(
  new NavigationRoute(createHandlerBoundToURL("/index.html"), {
    denylist: [/^\/api(?:\/|$)/, /^\/__\/auth(?:\/|$)/],
  }),
);
self.addEventListener("push", (event: PushMessage) => {
  let data: unknown;
  try {
    data = event.data?.json();
  } catch {
    return;
  }
  if (
    !data ||
    typeof data !== "object" ||
    !("version" in data) ||
    data.version !== 1 ||
    !("eventId" in data) ||
    typeof data.eventId !== "string" ||
    !("title" in data) ||
    typeof data.title !== "string" ||
    !("body" in data) ||
    typeof data.body !== "string"
  )
    return;
  const url = "url" in data && typeof data.url === "string" ? data.url : "/";
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      tag: data.eventId,
      data: { url },
    }),
  );
});
self.addEventListener("notificationclick", (event: ClickMessage) => {
  event.notification.close();
  let destination = new URL("/", self.location.origin);
  try {
    const candidate = new URL(
      (event.notification.data as { url?: string } | null)?.url ?? "/",
      self.location.origin,
    );
    if (
      candidate.origin === self.location.origin &&
      candidate.pathname === "/" &&
      /^https?:$/.test(candidate.protocol)
    )
      destination = candidate;
  } catch {
    /* Use the application root. */
  }
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      const existing = windows.find(
        (client) => new URL(client.url).origin === self.location.origin,
      );
      if (existing) {
        await existing.navigate(destination.href);
        await existing.focus();
      } else await self.clients.openWindow(destination.href);
    })(),
  );
});
