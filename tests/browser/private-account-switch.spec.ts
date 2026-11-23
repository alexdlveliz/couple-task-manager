import { test, expect } from "./fixtures";

test("private snapshots stay isolated when switching partners on one device", async ({
  partnerA,
}) => {
  const page = await partnerA.newPage();
  const titleA = `Privada A ${Date.now()}`;
  const titleB = `Privada B ${Date.now()}`;
  await page.goto("http://127.0.0.1:8787");
  async function login(email: string, password: string) {
    await page.getByLabel("Correo electrónico").fill(email);
    await page.getByLabel("Contraseña").fill(password);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByText("Actualizado", { exact: true })).toBeVisible();
  }
  async function createPrivate(title: string) {
    await page.getByRole("button", { name: "Nueva tarea" }).click();
    await page.getByLabel("Título").fill(title);
    await page.getByRole("radio", { name: "Privada" }).check();
    await page.getByRole("button", { name: "Guardar", exact: true }).click();
    await page.getByRole("button", { name: /^Pendientes/ }).click();
    await expect(page.getByText(title, { exact: true })).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(
          (expected) =>
            new Promise<boolean>((resolve) => {
              const open = indexedDB.open("shared-task-board");
              open.onsuccess = () => {
                const db = open.result;
                const request = db
                  .transaction("snapshots")
                  .objectStore("snapshots")
                  .getAll();
                request.onsuccess = () => {
                  resolve(
                    request.result.some(
                      (entry: { snapshot?: { tasks: { title: string }[] } }) =>
                        entry.snapshot?.tasks.some(
                          (task) => task.title === expected,
                        ),
                    ),
                  );
                  db.close();
                };
                request.onerror = () => {
                  resolve(false);
                  db.close();
                };
              };
              open.onerror = () => resolve(false);
            }),
          title,
        ),
      )
      .toBe(true);
  }
  await login("partner-a@example.test", "local-demo-password-a");
  await createPrivate(titleA);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await partnerA.setOffline(true);
  await page.reload();
  await page.getByRole("button", { name: /^Pendientes/ }).click();
  await expect(page.getByText(titleA, { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Nueva tarea" }),
  ).toBeDisabled();
  await partnerA.setOffline(false);
  await expect(page.getByText("Actualizado", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await login("partner-b@example.test", "local-demo-password-b");
  await createPrivate(titleB);
  await expect(page.getByText(titleA, { exact: true })).toHaveCount(0);
  await partnerA.setOffline(true);
  await page.reload();
  await page.getByRole("button", { name: /^Pendientes/ }).click();
  await expect(page.getByText(titleB, { exact: true })).toBeVisible();
  await expect(page.getByText(titleA, { exact: true })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Nueva tarea" }),
  ).toBeDisabled();
});
