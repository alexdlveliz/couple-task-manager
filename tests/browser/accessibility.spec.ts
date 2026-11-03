import { test, expect } from '@playwright/test';

test('keyboard opens the editor, focuses validation and returns focus', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Correo electrónico').fill('partner-a@example.test');
  await page.getByLabel('Contraseña').fill('local-demo-password-a');
  await page.getByRole('button', { name:'Entrar' }).click();
  const create = page.getByRole('button', { name:'Nueva tarea' });
  await create.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByLabel('Título')).toBeFocused();
  await page.getByRole('button', { name:'Guardar', exact:true }).click();
  await expect(page.getByRole('alert')).toHaveText('Escribe un título.');
  await expect(page.getByLabel('Título')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(create).toBeFocused();
});

test('primary actions remain visible at a 320px viewport', async ({ page }) => {
  await page.setViewportSize({ width:320, height:700 });
  await page.goto('/');
  await page.getByLabel('Correo electrónico').fill('partner-a@example.test');
  await page.getByLabel('Contraseña').fill('local-demo-password-a');
  await page.getByRole('button', { name:'Entrar' }).click();
  await expect(page.getByRole('button', { name:'Nueva tarea' })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBe(false);
});

test('board remains usable at 200% zoom', async ({ page }) => {
  await page.setViewportSize({ width:640, height:900 });
  await page.goto('/');
  await page.getByLabel('Correo electrónico').fill('partner-a@example.test');
  await page.getByLabel('Contraseña').fill('local-demo-password-a');
  await page.getByRole('button', { name:'Entrar' }).click();
  await page.evaluate(() => { document.body.style.zoom = '2'; });
  await expect(page.getByRole('button', { name:'Nueva tarea' })).toBeVisible();
  await page.getByRole('button', { name:'Nueva tarea' }).click();
  await expect(page.getByLabel('Título')).toBeVisible();
});

test('deadline inputs can be reached and edited by keyboard', async ({page}) => {
  await page.goto('/');
  await page.getByLabel('Correo electrónico').fill('partner-a@example.test');
  await page.getByLabel('Contraseña').fill('local-demo-password-a');
  await page.getByRole('button',{name:'Entrar'}).click();
  await page.getByRole('button',{name:'Nueva tarea'}).click();
  await page.getByLabel('Título').fill('Revisión de fecha');
  await page.getByLabel('Responsable').selectOption({label:'Persona A'});
  const date = page.getByLabel('Fecha límite');
  const time = page.getByLabel('Hora límite');
  await date.focus();
  await date.fill('2020-01-01');
  for (let index=0; index<6 && !(await time.evaluate(element => element === document.activeElement)); index++) await page.keyboard.press('Tab');
  await expect(time).toBeFocused();
  await time.fill('09:00');
  await page.getByRole('button',{name:'Guardar',exact:true}).click();
  await expect(page.getByText('Cambios guardados.')).toBeVisible();
});
