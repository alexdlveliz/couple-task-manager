import { test, expect } from '@playwright/test';

test('outsider is denied without displaying private tasks', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Correo electrónico').fill('outsider@example.test');
  await page.getByLabel('Contraseña').fill('local-demo-password-outsider');
  await page.getByRole('button', { name:'Entrar' }).click();
  await expect(page.getByRole('alert')).toHaveText('Esta cuenta no tiene acceso al tablero.');
  await expect(page.getByRole('button', { name:'Nueva tarea' })).not.toBeVisible();
});
