import { test, expect } from "@playwright/test";

async function login(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.getByLabel("Correo electrónico").fill("partner-a@example.test");
  await page.getByLabel("Contraseña").fill("local-demo-password-a");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("button", { name: "Nueva tarea" })).toBeVisible();
}

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
    (window as unknown as { permissionRequests: number }).permissionRequests =
      0;
  });
  await page.route("**/api/notifications/config", (route) =>
    route.fulfill({
      json: { available: true, publicKey: "test", problem: null },
    }),
  );
  await login(page);
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
  await expect(page.getByText(/no admite notificaciones/i)).toBeVisible();
  await expect(page.getByText(/iPhone.*pantalla de inicio/i)).toBeVisible();
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
  await page.getByRole("button", { name: "Activar notificaciones" }).click();
  await expect(
    page.getByText("Notificaciones activas en este dispositivo."),
  ).toBeVisible();
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
  await page.getByRole("button", { name: "Activar notificaciones" }).click();
  await expect(
    page.getByText("Notificaciones activas en este dispositivo."),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => (window as unknown as { subscriptions: number }).subscriptions,
    ),
  ).toBe(2);
});
