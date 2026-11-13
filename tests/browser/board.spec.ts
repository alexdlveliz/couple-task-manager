import { test, expect } from "./fixtures";
import type { BrowserContext } from "@playwright/test";

async function login(context: BrowserContext, email: string, password: string) {
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:8787");
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("button", { name: "Nueva tarea" })).toBeVisible();
  return page;
}

test("displays and refreshes a board served with weak ETags", async ({
  partnerA,
}) => {
  const page = await partnerA.newPage();
  await page.route("**/api/tasks", async (route) => {
    if (route.request().headers()["if-none-match"] === '"board-r2"') {
      await route.fulfill({ status: 304, headers: { ETag: 'W/"board-r2"' } });
      return;
    }
    await route.fulfill({
      json: {
        revision: 2,
        tasks: [
          {
            id: "weak-etag-task",
            title: "Tarea con ETag débil",
            assigneeUid: "fixture",
            status: "todo",
            deadline: null,
            createdAt: "2026-01-01T00:00:00Z",
            updatedAt: "2026-01-01T00:00:00Z",
          },
        ],
      },
      headers: { ETag: 'W/"board-r2"' },
    });
  });
  await page.goto("http://127.0.0.1:8787");
  await page.getByLabel("Correo electrónico").fill("partner-a@example.test");
  await page.getByLabel("Contraseña").fill("local-demo-password-a");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByText("Tarea con ETag débil")).toBeVisible();
  await page.getByRole("button", { name: "Actualizar" }).click();
  await expect(page.getByText("Actualizado", { exact: true })).toBeVisible();
  await expect(page.getByText("Tarea con ETag débil")).toBeVisible();
});

test("both partners can create, reassign and complete the same task", async ({
  partnerA,
  partnerB,
}) => {
  const a = await login(
    partnerA,
    "partner-a@example.test",
    "local-demo-password-a",
  );
  const b = await login(
    partnerB,
    "partner-b@example.test",
    "local-demo-password-b",
  );
  const title = `Compra ${String(Date.now())} ${Math.random().toString(36).slice(2)}`;
  await a.getByRole("button", { name: "Nueva tarea" }).click();
  await a.getByLabel("Título").fill(title);
  await a.getByLabel("Responsable").selectOption({ label: "Persona B" });
  await a.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(a.getByText("Cambios guardados.")).toBeVisible();
  await b.getByRole("button", { name: "Actualizar" }).click();
  await expect(b.getByText(title)).toBeVisible();
  await b.getByRole("button", { name: `Editar tarea: ${title}` }).click();
  await b.getByLabel("Responsable").selectOption({ label: "Persona A" });
  await b.getByLabel("Estado", { exact: true }).selectOption("completed");
  await b.getByRole("button", { name: "Guardar", exact: true }).click();
  await a.getByRole("button", { name: "Actualizar" }).click();
  await expect(
    a.getByRole("region", { name: /Completada/ }).getByText(title),
  ).toBeVisible();
});

test("preserves the draft and does not retry an uncertain save", async ({
  browser,
}, testInfo) => {
  const { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch } =
    testInfo.project.use;
  const partnerA = await browser.newContext({
    serviceWorkers: "block",
    viewport,
    userAgent,
    deviceScaleFactor,
    isMobile,
    hasTouch,
  });
  const page = await login(
    partnerA,
    "partner-a@example.test",
    "local-demo-password-a",
  );
  await page.getByRole("button", { name: "Nueva tarea" }).click();
  await page.getByLabel("Título").fill("Borrador conservado");
  await page.getByLabel("Responsable").selectOption({ label: "Persona B" });
  let posts = 0;
  await page.route("**/api/tasks", async (route) => {
    if (route.request().method() === "POST") {
      posts++;
      await route.fulfill({
        status: 503,
        contentType: "text/html",
        body: "Unavailable",
      });
    } else await route.continue();
  });
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(
    page
      .getByRole("dialog")
      .getByText(
        "No se pudo confirmar el guardado. Actualiza el tablero antes de intentarlo de nuevo.",
      ),
  ).toBeVisible();
  await expect(page.getByLabel("Título")).toHaveValue("Borrador conservado");
  expect(posts).toBe(1);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Actualizar" })
    .click();
  await expect(page.getByLabel("Título")).toHaveValue("Borrador conservado");
  expect(posts).toBe(1);
  await partnerA.close();
});

test("either partner can reassign and move a task through every state", async ({
  partnerA,
  partnerB,
}) => {
  const a = await login(
    partnerA,
    "partner-a@example.test",
    "local-demo-password-a",
  );
  const b = await login(
    partnerB,
    "partner-b@example.test",
    "local-demo-password-b",
  );
  const title = `Estados ${String(Date.now())} ${Math.random().toString(36).slice(2)}`;
  await b.getByRole("button", { name: "Nueva tarea" }).click();
  await b.getByLabel("Título").fill(title);
  await b.getByLabel("Responsable").selectOption({ label: "Persona A" });
  await b.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(b.getByText("Cambios guardados.")).toBeVisible();
  await a.getByRole("button", { name: "Actualizar" }).click();
  await expect(a.getByText(title)).toBeVisible();
  for (const [status, label] of [
    ["in_progress", "En progreso"],
    ["blocked", "Bloqueada"],
    ["completed", "Completada"],
    ["todo", "Por hacer"],
  ] as const) {
    await a.getByRole("button", { name: `Editar tarea: ${title}` }).click();
    await a.getByLabel("Estado", { exact: true }).selectOption(status);
    await a.getByLabel("Responsable").selectOption({ label: "Persona B" });
    await a.getByRole("button", { name: "Guardar", exact: true }).click();
    await expect(
      a.getByRole("region", { name: new RegExp(label) }).getByText(title),
    ).toBeVisible();
  }
  await b.getByRole("button", { name: "Actualizar" }).click();
  await expect(
    b.getByRole("region", { name: /Por hacer/ }).getByText(title),
  ).toBeVisible();
});
