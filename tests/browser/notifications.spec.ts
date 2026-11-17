import { test, expect } from "@playwright/test";

test.use({ serviceWorkers: "block" });

async function login(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.getByLabel("Correo electrónico").fill("partner-a@example.test");
  await page.getByLabel("Contraseña").fill("local-demo-password-a");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("button", { name: "Nueva tarea" })).toBeVisible();
}

test("opens notification settings from the header and closes with Escape", async ({
  page,
}) => {
  await login(page);
  const bell = page.getByRole("button", {
    name: "Notificaciones",
    exact: true,
  });
  await expect(bell).toBeVisible();
  await expect(
    page.getByRole("dialog", { name: "Notificaciones" }),
  ).toBeHidden();
  await bell.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("dialog", { name: "Notificaciones" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("dialog", { name: "Notificaciones" }),
  ).toBeHidden();
  await expect(bell).toBeFocused();
  await bell.click();
  await page.getByRole("button", { name: "Cerrar", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Notificaciones" }),
  ).toBeHidden();
  await expect(bell).toBeFocused();
});

test("notification permission is requested only by an explicit keyboard action", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "Notification", {
      configurable: true,
      value: {
        permission: "default",
        requestPermission() {
          (window as unknown as { permissionRequests: number })
            .permissionRequests++;
          return Promise.resolve("denied");
        },
      },
    });
    Object.defineProperty(window, "PushManager", {
      configurable: true,
      value: function PushManagerMock() {},
    });
    (window as unknown as { permissionRequests: number }).permissionRequests =
      0;
  });
  await page.route("**/api/notifications/config", (route) =>
    route.fulfill({
      json: { available: true, publicKey: "test", problem: null },
    }),
  );
  await login(page);
  await page
    .getByRole("button", { name: "Notificaciones", exact: true })
    .click();
  await expect(
    page.getByText("Permiso del navegador: aún no concedido."),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { permissionRequests: number })
          .permissionRequests,
    ),
  ).toBe(0);
  const button = page.getByRole("button", { name: "Activar notificaciones" });
  await button.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText(/configuración.*navegador/i)).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { permissionRequests: number })
          .permissionRequests,
    ),
  ).toBe(1);
});

test("explains unavailable notification service", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "Notification", {
      configurable: true,
      value: { permission: "default" },
    });
    Object.defineProperty(window, "PushManager", {
      configurable: true,
      value: function PushManagerMock() {},
    });
  });
  await page.route("**/api/notifications/config", (route) =>
    route.fulfill({
      json: {
        available: false,
        publicKey: null,
        problem: "El servicio de notificaciones no está disponible.",
      },
    }),
  );
  await login(page);
  await page
    .getByRole("button", { name: "Notificaciones", exact: true })
    .click();
  await expect(
    page.getByText("El servicio de notificaciones no está disponible."),
  ).toBeVisible();
});

test("explains unsupported browsers and iPhone installation", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "Notification", { value: undefined });
  });
  await login(page);
  await page
    .getByRole("button", { name: "Notificaciones", exact: true })
    .click();
  await expect(page.getByText(/no admite notificaciones/i)).toBeVisible();
  await expect(page.getByText(/iPhone.*pantalla de inicio/i)).toBeVisible();
});

test("granted permission activates this device on entry and remains active on refresh", async ({
  page,
}) => {
  await page.addInitScript(() => {
    let subscription: {
      unsubscribe(): Promise<boolean>;
      toJSON(): object;
    } | null = null;
    const makeSubscription = () => ({
      unsubscribe: () => {
        subscription = null;
        sessionStorage.removeItem("test-subscription");
        return Promise.resolve(true);
      },
      toJSON: () => ({
        endpoint: "https://fcm.googleapis.com/test",
        keys: { p256dh: "key", auth: "secret" },
      }),
    });
    if (sessionStorage.getItem("test-subscription"))
      subscription = makeSubscription();
    const manager = {
      getSubscription: () => Promise.resolve(subscription),
      subscribe: () => {
        subscription = makeSubscription();
        sessionStorage.setItem("test-subscription", "yes");
        return Promise.resolve(subscription);
      },
    };
    Object.defineProperty(window, "Notification", {
      configurable: true,
      value: {
        permission: "granted",
        requestPermission: () => {
          throw new Error("Unexpected permission request");
        },
      },
    });
    Object.defineProperty(window, "PushManager", {
      configurable: true,
      value: function PushManagerMock() {},
    });
    Object.defineProperty(navigator.serviceWorker, "ready", {
      configurable: true,
      get: () => Promise.resolve({ pushManager: manager }),
    });
    navigator.serviceWorker.getRegistration = () =>
      Promise.resolve({ pushManager: manager } as ServiceWorkerRegistration);
  });
  let registrations = 0;
  let active = true;
  let failRegistration = false;
  await page.route("**/api/notifications/config", (route) =>
    route.fulfill({
      json: { available: true, publicKey: "BA", problem: null },
    }),
  );
  await page.route("**/api/notifications/subscriptions", (route) => {
    registrations++;
    return route.fulfill({
      status: failRegistration ? 503 : 201,
      json: failRegistration
        ? { error: { message: "No disponible" } }
        : { id: "registration", active: true },
    });
  });
  await page.route("**/api/notifications/subscriptions/registration", (route) =>
    route.fulfill({
      json: { id: "registration", active, lastOutcome: null },
    }),
  );
  await login(page);
  await page
    .getByRole("button", { name: "Notificaciones", exact: true })
    .click();
  await expect(
    page.getByText("Notificaciones activas en este dispositivo."),
  ).toBeVisible();
  expect(registrations).toBe(1);
  await page.reload();
  await page
    .getByRole("button", { name: "Notificaciones", exact: true })
    .click();
  await expect(
    page.getByText("Notificaciones activas en este dispositivo."),
  ).toBeVisible();
  expect(registrations).toBe(1);
  active = false;
  await page.reload();
  await page
    .getByRole("button", { name: "Notificaciones", exact: true })
    .click();
  await expect(
    page.getByText("Notificaciones activas en este dispositivo."),
  ).toBeVisible();
  expect(registrations).toBe(2);
  failRegistration = true;
  await page.reload();
  await page
    .getByRole("button", { name: "Notificaciones", exact: true })
    .click();
  await expect(
    page.getByText(
      "No se pudo comprobar la configuración de notificaciones de la app. Inténtalo de nuevo.",
    ),
  ).toBeVisible();
  await expect(
    page.getByText("Notificaciones activas en este dispositivo."),
  ).toHaveCount(0);
});

test("shows a blocked browser permission independently of app configuration", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "Notification", {
      configurable: true,
      value: { permission: "denied" },
    });
    Object.defineProperty(window, "PushManager", {
      configurable: true,
      value: function PushManagerMock() {},
    });
  });
  await page.route("**/api/notifications/config", (route) =>
    route.fulfill({
      status: 503,
      json: { error: { message: "No disponible" } },
    }),
  );
  await login(page);
  await page
    .getByRole("button", { name: "Notificaciones", exact: true })
    .click();
  await expect(
    page.getByText("Permiso del navegador: bloqueado."),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Activar notificaciones" }),
  ).toHaveCount(0);
});

test("shows granted browser permission while the app subscription is still being checked", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "Notification", {
      configurable: true,
      value: { permission: "granted" },
    });
    Object.defineProperty(window, "PushManager", {
      configurable: true,
      value: function PushManagerMock() {},
    });
    Object.defineProperty(navigator.serviceWorker, "ready", {
      configurable: true,
      get: () => new Promise(() => {}),
    });
    navigator.serviceWorker.getRegistration = () => Promise.resolve(undefined);
  });
  await page.route("**/api/notifications/config", (route) =>
    route.fulfill({
      json: { available: true, publicKey: "BA", problem: null },
    }),
  );
  await login(page);
  await page
    .getByRole("button", { name: "Notificaciones", exact: true })
    .click();
  await expect(
    page.getByText("Permiso del navegador: concedido."),
  ).toBeVisible();
});

test("a service worker that never becomes ready does not leave notifications checking forever", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "Notification", {
      configurable: true,
      value: { permission: "granted" },
    });
    Object.defineProperty(window, "PushManager", {
      configurable: true,
      value: function PushManagerMock() {},
    });
    Object.defineProperty(navigator.serviceWorker, "ready", {
      configurable: true,
      get: () => new Promise(() => {}),
    });
    navigator.serviceWorker.getRegistration = () => Promise.resolve(undefined);
  });
  await page.route("**/api/notifications/config", (route) =>
    route.fulfill({
      json: { available: true, publicKey: "BA", problem: null },
    }),
  );
  await login(page);
  await page
    .getByRole("button", { name: "Notificaciones", exact: true })
    .click();
  await expect(
    page.getByText(
      "No se pudo comprobar la configuración de notificaciones de la app. Inténtalo de nuevo.",
    ),
  ).toBeVisible({ timeout: 8000 });
  const retry = page.getByRole("button", { name: "Activar notificaciones" });
  await expect(retry).toBeEnabled();
  await retry.click();
  await expect(
    page.getByText(
      "No se pudieron actualizar las notificaciones. Inténtalo de nuevo.",
    ),
  ).toBeVisible({ timeout: 8000 });
  await expect(retry).toBeEnabled();
});

test("failed server removal unsubscribes locally before another account enables", async ({
  page,
}) => {
  await page.addInitScript(() => {
    let current: { unsubscribe(): Promise<boolean>; toJSON(): object } | null =
      null;
    const state = window as unknown as {
      subscriptions: number;
      removals: number;
    };
    state.subscriptions = 0;
    state.removals = 0;
    const manager = {
      getSubscription: () => Promise.resolve(current),
      subscribe: () => {
        state.subscriptions++;
        current = {
          unsubscribe: () => {
            state.removals++;
            current = null;
            return Promise.resolve(true);
          },
          toJSON: () => ({
            endpoint: `https://fcm.googleapis.com/${String(state.subscriptions)}`,
            expirationTime: null,
            keys: { p256dh: "key", auth: "secret" },
          }),
        };
        return Promise.resolve(current);
      },
    };
    Object.defineProperty(window, "Notification", {
      configurable: true,
      value: { permission: "granted" },
    });
    Object.defineProperty(window, "PushManager", {
      configurable: true,
      value: function PushManagerMock() {},
    });
    Object.defineProperty(navigator.serviceWorker, "ready", {
      configurable: true,
      get: () => Promise.resolve({ pushManager: manager }),
    });
    navigator.serviceWorker.getRegistration = () =>
      Promise.resolve({ pushManager: manager } as ServiceWorkerRegistration);
  });
  await page.route("**/api/notifications/config", (route) =>
    route.fulfill({
      json: { available: true, publicKey: "BA", problem: null },
    }),
  );
  await page.route("**/api/notifications/subscriptions", (route) =>
    route.fulfill({ status: 201, json: { id: "registration", active: true } }),
  );
  await page.route(
    "**/api/notifications/subscriptions/registration",
    (route) =>
      route.request().method() === "DELETE"
        ? route.fulfill({
            status: 503,
            json: { error: { message: "No disponible" } },
          })
        : route.fulfill({
            json: { id: "registration", active: true, lastOutcome: null },
          }),
  );
  await login(page);
  await page
    .getByRole("button", { name: "Notificaciones", exact: true })
    .click();
  await expect(
    page.getByText("Notificaciones activas en este dispositivo."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cerrar", exact: true }).click();
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await expect(page.getByRole("button", { name: "Entrar" })).toBeVisible();
  expect(
    await page.evaluate(
      () => (window as unknown as { removals: number }).removals,
    ),
  ).toBe(1);
  await page.getByLabel("Correo electrónico").fill("partner-b@example.test");
  await page.getByLabel("Contraseña").fill("local-demo-password-b");
  await page.getByRole("button", { name: "Entrar" }).click();
  await page
    .getByRole("button", { name: "Notificaciones", exact: true })
    .click();
  await expect(
    page.getByText("Notificaciones activas en este dispositivo."),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => (window as unknown as { subscriptions: number }).subscriptions,
    ),
  ).toBe(2);
});
