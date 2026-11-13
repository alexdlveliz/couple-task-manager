import { test, expect } from "./fixtures";

test("reopens a previously verified complete board offline and refreshes after reconnect", async ({
  partnerA,
}) => {
  let page = await partnerA.newPage();
  await page.goto("http://127.0.0.1:8787");
  await page.getByLabel("Correo electrónico").fill("partner-a@example.test");
  await page.getByLabel("Contraseña").fill("local-demo-password-a");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByText("Actualizado", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Nueva tarea" }).click();
  const title = `Sin conexión ${String(Date.now())} ${Math.random().toString(36).slice(2)}`;
  await page.getByLabel("Título").fill(title);
  await page.getByLabel("Responsable").selectOption({ label: "Persona A" });
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(page.getByText(title)).toBeVisible();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await expect
    .poll(() =>
      page.evaluate(
        (expectedTitle) =>
          new Promise<boolean>((resolve) => {
            const open = indexedDB.open("shared-task-board");
            open.onsuccess = () => {
              const db = open.result;
              const tx = db.transaction("snapshots");
              const request = tx.objectStore("snapshots").getAll();
              request.onsuccess = () => {
                resolve(
                  request.result.some(
                    (record: {
                      snapshot?: { tasks: Array<{ title: string }> };
                    }) =>
                      record.snapshot?.tasks.some(
                        (task) => task.title === expectedTitle,
                      ) ?? false,
                  ),
                );
              };
              request.onerror = () => {
                resolve(false);
              };
            };
            open.onerror = () => {
              resolve(false);
            };
          }),
        title,
      ),
    )
    .toBe(true);
  await partnerA.setOffline(true);
  await page.close();
  page = await partnerA.newPage();
  await page.goto("http://127.0.0.1:8787");
  await expect(page.getByText(title)).toBeVisible({ timeout: 20_000 });
  await expect(
    page.getByText("Sin conexión. Los datos pueden estar desactualizados."),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Nueva tarea" }),
  ).toBeDisabled();
  await partnerA.setOffline(false);
  await expect(page.getByText("Actualizado", { exact: true })).toBeVisible();
});

test("offline snapshot includes completed tasks and reconnect fetches the other partner’s changes", async ({
  partnerA,
  partnerB,
}) => {
  const a = await partnerA.newPage();
  const b = await partnerB.newPage();
  async function login(page: typeof a, email: string, password: string) {
    await page.goto("http://127.0.0.1:8787");
    await page.getByLabel("Correo electrónico").fill(email);
    await page.getByLabel("Contraseña").fill(password);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByText("Actualizado", { exact: true })).toBeVisible();
  }
  await login(a, "partner-a@example.test", "local-demo-password-a");
  await login(b, "partner-b@example.test", "local-demo-password-b");
  const oldTitle = `Finalizada ${String(Date.now())} ${Math.random().toString(36).slice(2)}`;
  await a.getByRole("button", { name: "Nueva tarea" }).click();
  await a.getByLabel("Título").fill(oldTitle);
  await a.getByLabel("Responsable").selectOption({ label: "Persona A" });
  await a.getByLabel("Fecha límite").fill("2026-11-02");
  await a.getByLabel("Hora límite").fill("09:00");
  await a.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(a.getByText(oldTitle)).toBeVisible();
  await a.getByRole("button", { name: `Editar tarea: ${oldTitle}` }).click();
  await a.getByLabel("Estado", { exact: true }).selectOption("completed");
  await a.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(
    a.getByRole("region", { name: /Completada/ }).getByText(oldTitle),
  ).toBeVisible();
  await a.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await expect
    .poll(() =>
      a.evaluate(
        (title) =>
          new Promise<boolean>((resolve) => {
            const open = indexedDB.open("shared-task-board");
            open.onsuccess = () => {
              const q = open.result
                .transaction("snapshots")
                .objectStore("snapshots")
                .getAll();
              q.onsuccess = () => {
                resolve(
                  q.result.some(
                    (v: {
                      snapshot?: {
                        tasks: Array<{
                          title: string;
                          status: string;
                          deadline: string | null;
                        }>;
                      };
                    }) =>
                      v.snapshot?.tasks.some(
                        (t) =>
                          t.title === title &&
                          t.status === "completed" &&
                          !!t.deadline,
                      ),
                  ),
                );
              };
              q.onerror = () => {
                resolve(false);
              };
            };
            open.onerror = () => {
              resolve(false);
            };
          }),
        oldTitle,
      ),
    )
    .toBe(true);
  await partnerA.setOffline(true);
  await a.reload();
  const oldCard = a.getByRole("article").filter({ hasText: oldTitle });
  await expect(oldCard).toBeVisible({ timeout: 20_000 });
  await expect(
    a.getByRole("region", { name: /Completada/ }).getByText(oldTitle),
  ).toBeVisible();
  await expect(oldCard).not.toContainText("Sin fecha límite");
  await expect(a.getByText(/Última sincronización:/)).toBeVisible();
  await expect(a.getByRole("button", { name: "Nueva tarea" })).toBeDisabled();
  const newTitle = `Reencuentro ${String(Date.now())} ${Math.random().toString(36).slice(2)}`;
  await b.getByRole("button", { name: "Nueva tarea" }).click();
  await b.getByLabel("Título").fill(newTitle);
  await b.getByLabel("Responsable").selectOption({ label: "Persona A" });
  await b.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(b.getByText(newTitle)).toBeVisible();
  await partnerA.setOffline(false);
  await expect(a.getByText(newTitle)).toBeVisible({ timeout: 20_000 });
});

test("a signed-in session with no saved snapshot explains first offline use", async ({
  partnerA,
}) => {
  await partnerA.addInitScript(() => {
    const original = window.fetch.bind(window);
    window.fetch = (input, init) => {
      const raw = input instanceof Request ? input.url : String(input);
      if (new URL(raw, location.origin).pathname.startsWith("/api/"))
        return Promise.resolve(new Response("Unavailable", { status: 503 }));
      return original(input, init);
    };
  });
  const page = await partnerA.newPage();
  await page.goto("http://127.0.0.1:8787");
  await page.getByLabel("Correo electrónico").fill("partner-a@example.test");
  await page.getByLabel("Contraseña").fill("local-demo-password-a");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(
    page.getByText(
      "No se pudo actualizar. Los datos pueden estar desactualizados.",
    ),
  ).toBeVisible();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await partnerA.setOffline(true);
  await page.reload();
  await expect(
    page.getByText(
      "No hay tareas guardadas en este dispositivo. Conéctate para cargar el tablero.",
    ),
  ).toBeVisible({ timeout: 20_000 });
});

test("storage eviction shows a clear no-snapshot message when reopened offline", async ({
  partnerA,
}) => {
  const page = await partnerA.newPage();
  await page.goto("http://127.0.0.1:8787");
  await page.getByLabel("Correo electrónico").fill("partner-a@example.test");
  await page.getByLabel("Contraseña").fill("local-demo-password-a");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByText("Actualizado", { exact: true })).toBeVisible();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          new Promise<boolean>((resolve) => {
            const open = indexedDB.open("shared-task-board");
            open.onsuccess = () => {
              const request = open.result
                .transaction("snapshots")
                .objectStore("snapshots")
                .getAll();
              request.onsuccess = () => {
                resolve(
                  request.result.some(
                    (v: { snapshot?: unknown }) => !!v.snapshot,
                  ),
                );
              };
              request.onerror = () => {
                resolve(false);
              };
            };
            open.onerror = () => {
              resolve(false);
            };
          }),
      ),
    )
    .toBe(true);
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open("shared-task-board");
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction("snapshots", "readwrite");
          tx.objectStore("snapshots").clear();
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => {
            reject(tx.error ?? new Error("Storage request failed"));
          };
        };
        open.onerror = () => {
          reject(open.error ?? new Error("Storage request failed"));
        };
      }),
  );
  await partnerA.setOffline(true);
  await page.reload();
  await expect(
    page.getByText(
      "No hay tareas guardadas en este dispositivo. Conéctate para cargar el tablero.",
    ),
  ).toBeVisible({ timeout: 20_000 });
});
