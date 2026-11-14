import { test, expect } from "@playwright/test";

test("shows one saved instant in Guatemala and Madrid and permits removal", async ({
  browser,
}) => {
  const guatemala = await browser.newContext({
    timezoneId: "America/Guatemala",
  });
  const madrid = await browser.newContext({ timezoneId: "Europe/Madrid" });
  try {
    const a = await guatemala.newPage();
    const b = await madrid.newPage();
    async function signIn(page: typeof a, email: string, password: string) {
      await page.goto("http://127.0.0.1:8787");
      await page.getByLabel("Correo electrónico").fill(email);
      await page.getByLabel("Contraseña").fill(password);
      await page.getByRole("button", { name: "Entrar" }).click();
      await expect(
        page.getByText("Actualizado", { exact: true }),
      ).toBeVisible();
    }
    await signIn(a, "partner-a@example.test", "local-demo-password-a");
    await signIn(b, "partner-b@example.test", "local-demo-password-b");
    const title = `Fecha ${String(Date.now())} ${Math.random().toString(36).slice(2)}`;
    await a.getByRole("button", { name: "Nueva tarea" }).click();
    await a.getByLabel("Título").fill(title);
    await a
      .getByLabel("Responsable", { exact: true })
      .selectOption({ label: "Persona B" });
    await a.getByLabel("Fecha límite").fill("2026-11-02");
    await a.getByLabel("Hora límite").fill("09:00");
    await expect(a.getByRole("dialog")).toContainText(
      "America/Guatemala (UTC−06:00)",
    );
    await a.getByRole("button", { name: "Guardar", exact: true }).click();
    await expect(a.getByText(title)).toBeVisible();
    await b.getByRole("button", { name: "Actualizar" }).click();
    const card = b.getByRole("article").filter({ hasText: title });
    await expect(card).toContainText("16:00");
    await expect(card).toContainText("Europe/Madrid (UTC+01:00)");
    await card.getByRole("button").click();
    await b.getByRole("button", { name: "Quitar fecha límite" }).click();
    await b.getByRole("button", { name: "Guardar", exact: true }).click();
    await expect(card).toContainText("Sin fecha límite");
  } finally {
    await guatemala.close();
    await madrid.close();
  }
});

test("explains DST gaps and folds in the task editor", async ({ browser }) => {
  const context = await browser.newContext({ timezoneId: "America/New_York" });
  try {
    const page = await context.newPage();
    await page.goto("http://127.0.0.1:8787");
    await page.getByLabel("Correo electrónico").fill("partner-a@example.test");
    await page.getByLabel("Contraseña").fill("local-demo-password-a");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByText("Actualizado", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Nueva tarea" }).click();
    await page.getByLabel("Título").fill(`DST ${String(Date.now())}`);
    await page
      .getByLabel("Responsable", { exact: true })
      .selectOption({ label: "Persona A" });
    await page.getByLabel("Fecha límite").fill("2027-03-14");
    await page.getByLabel("Hora límite").fill("02:30");
    await page.getByRole("button", { name: "Guardar", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText("Esta hora no existe");
    await page.getByLabel("Fecha límite").fill("2027-11-07");
    await page.getByLabel("Hora límite").fill("01:30");
    await page.getByRole("button", { name: "Guardar", exact: true }).click();
    await expect(
      page
        .getByRole("status")
        .filter({ hasText: "Esta hora ocurre dos veces" }),
    ).toContainText("UTC−04:00");
    await page.getByRole("button", { name: "Guardar", exact: true }).click();
    await expect(page.getByText("Cambios guardados.")).toBeVisible();
  } finally {
    await context.close();
  }
});

test("requires review if the device zone changes while editing", async ({
  browser,
  browserName,
}) => {
  test.skip(
    browserName !== "chromium",
    "Changing a live device time zone requires Chromium DevTools.",
  );
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await page.goto("http://127.0.0.1:8787");
    await page.getByLabel("Correo electrónico").fill("partner-a@example.test");
    await page.getByLabel("Contraseña").fill("local-demo-password-a");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByText("Actualizado", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Nueva tarea" }).click();
    await page.getByLabel("Título").fill(`Zona ${String(Date.now())}`);
    await page
      .getByLabel("Responsable", { exact: true })
      .selectOption({ label: "Persona A" });
    await page.getByLabel("Fecha límite").fill("2026-11-02");
    await page.getByLabel("Hora límite").fill("09:00");
    const session = await context.newCDPSession(page);
    await session.send("Emulation.setTimezoneOverride", {
      timezoneId: "Europe/Madrid",
    });
    await page.getByRole("button", { name: "Guardar", exact: true }).click();
    await expect(page.getByRole("alert")).toHaveText(
      "La zona horaria del dispositivo cambió. Revisa la fecha y la hora antes de guardar.",
    );
    await page.getByRole("button", { name: "Guardar", exact: true }).click();
    await expect(page.getByText("Cambios guardados.")).toBeVisible();
  } finally {
    await context.close();
  }
});

test("editing an unrelated field preserves the exact original deadline instant", async ({
  browser,
}) => {
  const context = await browser.newContext({
    serviceWorkers: "block",
    timezoneId: "America/Guatemala",
  });
  try {
    const page = await context.newPage();
    await page.goto("http://127.0.0.1:8787");
    await page.getByLabel("Correo electrónico").fill("partner-a@example.test");
    await page.getByLabel("Contraseña").fill("local-demo-password-a");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByText("Actualizado", { exact: true })).toBeVisible();
    let injected = false;
    await page.route("**/api/tasks", async (route) => {
      if (!injected && route.request().method() === "POST") {
        injected = true;
        const original: unknown = route.request().postDataJSON();
        if (
          !original ||
          typeof original !== "object" ||
          Array.isArray(original)
        )
          throw new Error("Expected a task object");
        const body = {
          ...original,
          deadline: "2026-11-02T15:00:00.123Z",
        };
        await route.continue({ postData: JSON.stringify(body) });
      } else await route.continue();
    });
    const title = `Precisión ${String(Date.now())} ${Math.random().toString(36).slice(2)}`;
    await page.getByRole("button", { name: "Nueva tarea" }).click();
    await page.getByLabel("Título").fill(title);
    await page
      .getByLabel("Responsable", { exact: true })
      .selectOption({ label: "Persona A" });
    await page.getByRole("button", { name: "Guardar", exact: true }).click();
    await expect(page.getByText(title)).toBeVisible();
    await page.getByRole("button", { name: `Editar tarea: ${title}` }).click();
    await page.getByLabel("Título").fill(`${title} editada`);
    const saved = page.waitForResponse(
      (response) =>
        response.request().method() === "PUT" &&
        response.url().includes("/api/tasks/"),
    );
    await page.getByRole("button", { name: "Guardar", exact: true }).click();
    const body = (await (await saved).json()) as { task: { deadline: string } };
    expect(body.task.deadline).toBe("2026-11-02T15:00:00.123Z");
  } finally {
    await context.close();
  }
});
