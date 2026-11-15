import { test, expect } from "./fixtures";
import type { BrowserContext } from "@playwright/test";

async function login(context: BrowserContext, email: string, password: string) {
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:8787");
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("button", { name: "Nueva tarea" })).toBeVisible();
  const pending = page.getByRole("button", { name: /^Pendientes/ });
  if (await pending.count()) await pending.click();
  return page;
}

test("displays and refreshes a board served with weak ETags", async ({
  browser,
  browserName,
}) => {
  const context = await browser.newContext({ serviceWorkers: "block" });
  const page = await context.newPage();
  await page.route("**/api/tasks", async (route) => {
    // WebKit cannot fulfill a 304 through Playwright routing.
    if (
      browserName !== "webkit" &&
      route.request().headers()["if-none-match"] === '"board-r2"'
    ) {
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
  await page.getByRole("button", { name: /^Pendientes/ }).click();
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
  await a
    .getByLabel("Responsable", { exact: true })
    .selectOption({ label: "Persona B" });
  await a.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(a.getByText("Cambios guardados.")).toBeVisible();
  await b.getByRole("button", { name: "Actualizar" }).click();
  await expect(b.getByText(title)).toBeVisible();
  await b.getByRole("button", { name: `Editar tarea: ${title}` }).click();
  await b
    .getByLabel("Responsable", { exact: true })
    .selectOption({ label: "Persona A" });
  await b.getByLabel("Estado", { exact: true }).selectOption("completed");
  await b.getByRole("button", { name: "Guardar", exact: true }).click();
  await a.getByRole("button", { name: "Actualizar" }).click();
  await a.getByRole("button", { name: /^Completadas/ }).click();
  await expect(a.getByLabel(`Cambiar estado: ${title}`)).toHaveValue(
    "completed",
  );
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
  await page
    .getByLabel("Responsable", { exact: true })
    .selectOption({ label: "Persona B" });
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
  await b
    .getByLabel("Responsable", { exact: true })
    .selectOption({ label: "Persona A" });
  await b.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(b.getByText("Cambios guardados.")).toBeVisible();
  await a.getByRole("button", { name: "Actualizar" }).click();
  await expect(a.getByText(title)).toBeVisible();
  for (const [status] of [
    ["in_progress", "En progreso"],
    ["blocked", "Bloqueada"],
    ["completed", "Completada"],
    ["todo", "Por hacer"],
  ] as const) {
    await a.getByRole("button", { name: `Editar tarea: ${title}` }).click();
    await a.getByLabel("Estado", { exact: true }).selectOption(status);
    await a
      .getByLabel("Responsable", { exact: true })
      .selectOption({ label: "Persona B" });
    await a.getByRole("button", { name: "Guardar", exact: true }).click();
    const section = a.getByRole("button", {
      name: new RegExp(
        `^${({ todo: "Pendientes", in_progress: "En progreso", blocked: "Bloqueadas", completed: "Completadas" } as const)[status]}`,
      ),
    });
    if ((await section.getAttribute("aria-expanded")) === "false")
      await section.click();
    await expect(a.getByLabel(`Cambiar estado: ${title}`)).toHaveValue(status);
  }
  await b.getByRole("button", { name: "Actualizar" }).click();
  await expect(b.getByLabel(`Cambiar estado: ${title}`)).toHaveValue("todo");
});

test("filters the list and changes status directly", async ({ partnerA }) => {
  const page = await login(
    partnerA,
    "partner-a@example.test",
    "local-demo-password-a",
  );
  const title = `Lista ${String(Date.now())}`;
  await page.getByRole("button", { name: "Nueva tarea" }).click();
  await page.getByLabel("Título").fill(title);
  await page
    .getByLabel("Responsable", { exact: true })
    .selectOption({ label: "Persona A" });
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(page.getByLabel(`Cambiar estado: ${title}`)).toBeEnabled();
  await page.getByLabel(`Cambiar estado: ${title}`).selectOption("blocked");
  await expect(page.getByLabel(`Cambiar estado: ${title}`)).toHaveValue(
    "blocked",
  );
  await page.getByRole("button", { name: /^Bloqueadas/ }).click();
  await expect(page.getByText(title)).toHaveCount(0);
  await page.getByRole("button", { name: /^Bloqueadas/ }).click();
  await page
    .getByRole("group", { name: "Responsable" })
    .getByRole("button", { name: "Persona A" })
    .click();
  await expect(page.getByText(title)).toBeVisible();
});

test("an uncertain direct status save keeps the authoritative value and requires refresh", async ({
  browser,
}) => {
  const context = await browser.newContext({ serviceWorkers: "block" });
  const page = await login(
    context,
    "partner-a@example.test",
    "local-demo-password-a",
  );
  const title = `Cambio incierto ${String(Date.now())}`;
  await page.getByRole("button", { name: "Nueva tarea" }).click();
  await page.getByLabel("Título").fill(title);
  await page
    .getByLabel("Responsable", { exact: true })
    .selectOption({ label: "Persona A" });
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  const control = page.getByLabel(`Cambiar estado: ${title}`);
  await expect(control).toBeEnabled();
  await page.route("**/api/tasks/**", async (route) => {
    if (route.request().method() === "PUT")
      await route.fulfill({
        status: 500,
        json: { error: { message: "Error" } },
      });
    else await route.continue();
  });
  await page.route("**/api/tasks", async (route) => {
    if (route.request().method() === "GET")
      await route.fulfill({
        status: 503,
        json: { error: { message: "Error" } },
      });
    else await route.continue();
  });
  await control.selectOption("completed");
  await expect(
    page.getByText(
      "No se pudo confirmar el guardado. Actualiza el tablero antes de intentarlo de nuevo.",
    ),
  ).toBeVisible();
  await expect(control).toHaveValue("todo");
  await expect(control).toBeDisabled();
});

test("groups the board and combines and resets filters", async ({
  browser,
}) => {
  const context = await browser.newContext({
    serviceWorkers: "block",
    timezoneId: "UTC",
  });
  const page = await context.newPage();
  const now = new Date();
  const date = (offset: number) =>
    new Date(now.getTime() + offset * 86400000).toISOString();
  const makeTask = (
    id: string,
    deadline: string | null,
    status: string,
    assigneeUid: string,
  ) => ({
    id,
    title: id,
    deadline,
    status,
    assigneeUid,
    createdAt: date(-10),
    updatedAt: date(-10),
  });
  const tasks = [
    makeTask("Vencida ejemplo", date(-2), "blocked", "a"),
    makeTask("Hoy ejemplo", date(0), "todo", "b"),
    makeTask("Próxima ejemplo", date(2), "in_progress", "a"),
    makeTask("Sin fecha ejemplo", null, "todo", "a"),
    makeTask("Completada ejemplo", date(-2), "completed", "b"),
  ];
  await page.route("**/api/partners", (route) =>
    route.fulfill({
      json: {
        partners: [
          { uid: "a", displayName: "Persona A" },
          { uid: "b", displayName: "Persona B" },
        ],
      },
    }),
  );
  let revision = 1;
  await page.route("**/api/tasks/**", async (route) => {
    if (route.request().method() !== "PUT") return route.continue();
    const changed = tasks[0];
    changed.status = "completed";
    revision++;
    await route.fulfill({ json: { task: changed, revision } });
  });
  await page.route("**/api/tasks", (route) =>
    route.fulfill({
      json: { revision, tasks },
      headers: { ETag: `"board-r${String(revision)}"` },
    }),
  );
  await page.goto("/");
  await page.getByLabel("Correo electrónico").fill("partner-a@example.test");
  await page.getByLabel("Contraseña").fill("local-demo-password-a");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByText("5 tareas", { exact: true })).toBeVisible();
  await expect(page.locator(".task-groups h3")).toHaveText([
    "Pendientes 2",
    "En progreso 1",
    "Bloqueadas 1",
    "Completadas 1",
  ]);
  await expect(
    page.getByRole("button", { name: /^En progreso/ }),
  ).toHaveAttribute("aria-expanded", "true");
  await expect(
    page.getByRole("button", { name: /^Pendientes/ }),
  ).toHaveAttribute("aria-expanded", "false");
  await page
    .getByRole("group", { name: "Responsable" })
    .getByRole("button", { name: "Persona B" })
    .click();
  await expect(page.getByText("2 tareas", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Limpiar filtros" }).click();
  await page.getByRole("button", { name: /^Bloqueadas/ }).click();
  await page
    .getByLabel("Cambiar estado: Vencida ejemplo")
    .selectOption("completed");
  await expect(
    page
      .getByRole("region", { name: /Completadas/ })
      .getByText("Vencida ejemplo"),
  ).toBeVisible();
  await context.close();
});

test("does not steal focus after a delayed status save", async ({
  partnerA,
}) => {
  const page = await login(
    partnerA,
    "partner-a@example.test",
    "local-demo-password-a",
  );
  const title = `Foco ${String(Date.now())}`;
  await page.getByRole("button", { name: "Nueva tarea" }).click();
  await page.getByLabel("Título").fill(title);
  await page
    .getByLabel("Responsable", { exact: true })
    .selectOption({ label: "Persona A" });
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  const status = page.getByLabel(`Cambiar estado: ${title}`);
  await expect(status).toBeEnabled();
  let release!: () => void;
  const hold = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/tasks/**", async (route) => {
    if (route.request().method() === "PUT") await hold;
    await route.continue();
  });
  await status.selectOption("completed");
  const reset = page.getByRole("button", { name: "Limpiar filtros" });
  await reset.focus();
  release();
  await expect(page.getByText("Cambios guardados.")).toBeVisible();
  await expect(reset).toBeFocused();
});

test("switches views with the keyboard and preserves the responsible filter", async ({
  partnerA,
}) => {
  const page = await login(
    partnerA,
    "partner-a@example.test",
    "local-demo-password-a",
  );
  const filter = page
    .getByRole("group", { name: "Responsable" })
    .getByRole("button", { name: "Persona A" });
  await filter.click();
  const list = page.getByRole("tab", { name: "Lista" });
  await expect(list).toHaveAttribute("aria-selected", "true");
  await list.focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "Kanban" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(filter).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("tabpanel")).toBeVisible();
  await expect(page.locator(".kanban-column")).toHaveCount(4);
  await page.reload();
  await expect(page.getByRole("tab", { name: "Lista" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
});

test("moves a Kanban card by dragging and by its status control", async ({
  partnerA,
}) => {
  const page = await login(
    partnerA,
    "partner-a@example.test",
    "local-demo-password-a",
  );
  const title = `Kanban ${String(Date.now())}`;
  await page.getByRole("button", { name: "Nueva tarea" }).click();
  await page.getByLabel("Título").fill(title);
  await page
    .getByLabel("Responsable", { exact: true })
    .selectOption({ label: "Persona A" });
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await page.getByRole("tab", { name: "Kanban" }).click();
  const card = page.locator(".kanban-card").filter({ hasText: title });
  const target = page.locator("#column-blocked");
  await expect(
    card.getByRole("button", { name: /Arrastrar tarea|Mover/ }),
  ).toHaveCount(0);
  await card.scrollIntoViewIfNeeded();
  const from = await card.getByRole("heading", { name: title }).boundingBox();
  let to = await target.boundingBox();
  if (!from || !to) throw new Error("Missing drag bounds");
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  if (to.x + to.width / 2 > (page.viewportSize()?.width ?? 1280)) {
    await page.mouse.move(
      (page.viewportSize()?.width ?? 400) - 25,
      from.y + from.height / 2,
    );
    await expect
      .poll(async () => (await target.boundingBox())?.x ?? 9999)
      .toBeLessThan((page.viewportSize()?.width ?? 400) - 100);
    to = await target.boundingBox();
    if (!to) throw new Error("Missing target bounds");
  }
  await page.mouse.move(to.x + to.width / 2, Math.max(10, to.y + 30), {
    steps: 8,
  });
  await page.mouse.up();
  await expect(
    target.locator(".kanban-card").filter({ hasText: title }),
  ).toBeVisible();
  await expect(card.getByLabel(`Cambiar estado: ${title}`)).toHaveValue(
    "blocked",
  );
  await card.getByLabel(`Cambiar estado: ${title}`).selectOption("completed");
  await expect(
    page
      .locator("#column-completed")
      .locator(".kanban-card")
      .filter({ hasText: title }),
  ).toBeVisible();
  await expect(
    page.locator('[aria-live="polite"]').filter({ hasText: "Tarea movida" }),
  ).toContainText("Completada");
});
