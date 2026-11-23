import { test, expect } from "./fixtures";

test("creates and edits a private task through the Spanish form", async ({
  partnerA,
}) => {
  const page = await partnerA.newPage();
  await page.goto("http://127.0.0.1:8787");
  await page.getByLabel("Correo electrónico").fill("partner-a@example.test");
  await page.getByLabel("Contraseña").fill("local-demo-password-a");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByText("Actualizado", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Nueva tarea" }).click();
  await expect(page.getByRole("radio", { name: "Compartida" })).toBeChecked();
  await page.getByRole("radio", { name: "Privada" }).check();
  await expect(page.getByLabel("Responsable", { exact: true })).toBeDisabled();
  await expect(page.getByLabel("Responsable", { exact: true })).toHaveValue(
    /.+/,
  );
  const title = `Personal ${Date.now()}`;
  await page.getByLabel("Título").fill(title);
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await page.getByRole("button", { name: /^Pendientes/ }).click();
  const card = page.getByRole("article").filter({ hasText: title });
  await expect(card.getByText("Privada", { exact: true })).toBeVisible();
  await card.getByRole("button", { name: `Editar tarea: ${title}` }).click();
  await expect(page.getByLabel("Responsable", { exact: true })).toBeDisabled();
  await page.getByLabel("Título").fill(`${title} editada`);
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(
    page.getByText(`${title} editada`, { exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Kanban" }).click();
  const kanbanCard = page
    .getByRole("article")
    .filter({ hasText: `${title} editada` });
  await expect(kanbanCard.getByText("Privada", { exact: true })).toBeVisible();
});
