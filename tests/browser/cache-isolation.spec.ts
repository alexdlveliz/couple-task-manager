import { test, expect } from './fixtures';

test('sign-out clears cached access across tabs before another partner signs in', async ({ partnerA }) => {
  const first = await partnerA.newPage();
  await first.goto('http://127.0.0.1:8787');
  await first.getByLabel('Correo electrónico').fill('partner-a@example.test');
  await first.getByLabel('Contraseña').fill('local-demo-password-a');
  await first.getByRole('button', { name:'Entrar' }).click();
  await expect(first.getByText('Actualizado', { exact:true })).toBeVisible();
  const second = await partnerA.newPage();
  await second.goto('http://127.0.0.1:8787');
  await expect(second.getByRole('button', { name:'Nueva tarea' })).toBeVisible();
  await first.getByRole('button', { name:'Cerrar sesión' }).click();
  await expect(second.getByRole('heading', { name:'Iniciar sesión' })).toBeVisible();
  await partnerA.setOffline(true);
  await second.reload();
  await expect(second.getByRole('button', { name:'Nueva tarea' })).not.toBeVisible();
});

test('service worker caches only the public shell', async ({ partnerA }) => {
  const page = await partnerA.newPage();
  await page.goto('http://127.0.0.1:8787');
  await page.getByLabel('Correo electrónico').fill('partner-a@example.test');
  await page.getByLabel('Contraseña').fill('local-demo-password-a');
  await page.getByRole('button', { name:'Entrar' }).click();
  await expect(page.getByText('Actualizado', { exact:true })).toBeVisible();
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  const urls = await page.evaluate(async () => (await Promise.all((await caches.keys()).map(async key => (await (await caches.open(key)).keys()).map(request => request.url)))).flat());
  expect(urls.length).toBeGreaterThan(0);
  expect(urls.some(url => new URL(url).pathname.startsWith('/api'))).toBe(false);
  expect(urls.some(url => /identitytoolkit|securetoken|\/__\/auth/.test(url))).toBe(false);
});

test('keeps online viewing available when local board storage fails', async ({ partnerA }) => {
  await partnerA.addInitScript(() => { Object.defineProperty(window, 'indexedDB', { configurable:true, get() { throw new Error('Storage blocked'); } }); });
  const page = await partnerA.newPage();
  await page.goto('http://127.0.0.1:8787');
  await page.getByLabel('Correo electrónico').fill('partner-a@example.test');
  await page.getByLabel('Contraseña').fill('local-demo-password-a');
  await page.getByRole('button', { name:'Entrar' }).click();
  await expect(page.getByText('No se pudieron guardar los datos en este dispositivo. La consulta sin conexión puede no estar disponible.')).toBeVisible();
  await expect(page.getByRole('button', { name:'Nueva tarea' })).toBeEnabled();
});

for (const status of [401,403]) test(`a ${status} rejection clears the active session in all tabs`, async ({ browser }, testInfo) => {
  const {viewport, userAgent, deviceScaleFactor, isMobile, hasTouch} = testInfo.project.use;
  const context = await browser.newContext({serviceWorkers:'block', viewport, userAgent, deviceScaleFactor, isMobile, hasTouch});
  try {
    const first = await context.newPage();
    await first.goto('http://127.0.0.1:8787');
    await first.getByLabel('Correo electrónico').fill('partner-a@example.test');
    await first.getByLabel('Contraseña').fill('local-demo-password-a');
    await first.getByRole('button', {name:'Entrar'}).click();
    await expect(first.getByText('Actualizado', {exact:true})).toBeVisible();
    const second = await context.newPage();
    await second.goto('http://127.0.0.1:8787');
    await expect(second.getByRole('button', {name:'Nueva tarea'})).toBeVisible();
    await first.route('**/api/tasks', route => route.fulfill({status, contentType:'application/json', body:JSON.stringify({error:{code:'PARTNER_FORBIDDEN',message:'Esta cuenta no tiene acceso al tablero.'}})}));
    await first.getByRole('button', {name:'Actualizar'}).click();
    await expect(first.getByRole('heading', {name:'Iniciar sesión'})).toBeVisible();
    await expect(second.getByRole('heading', {name:'Iniciar sesión'})).toBeVisible();
    await expect(second.getByRole('button', {name:'Nueva tarea'})).not.toBeVisible();
  } finally { await context.close(); }
});

test('failed private-cache cleanup blocks offline restoration until cleanup succeeds', async ({ partnerA }) => {
  await partnerA.addInitScript(() => {
    const original = IDBDatabase.prototype.transaction;
    IDBDatabase.prototype.transaction = function(storeNames, mode, options) {
      if (this.name === 'shared-task-board' && mode === 'readwrite' && localStorage.getItem('test-fail-cleanup') === 'yes') throw new DOMException('Simulated failure','QuotaExceededError');
      return original.call(this, storeNames, mode, options);
    };
  });
  const page = await partnerA.newPage();
  await page.goto('http://127.0.0.1:8787');
  async function signIn() {
    await page.getByLabel('Correo electrónico').fill('partner-a@example.test');
    await page.getByLabel('Contraseña').fill('local-demo-password-a');
    await page.getByRole('button', {name:'Entrar'}).click();
    await expect(page.getByText('Actualizado', {exact:true})).toBeVisible();
  }
  await signIn();
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await expect.poll(() => page.evaluate(() => new Promise<boolean>(resolve => {
    const request = indexedDB.open('shared-task-board');
    request.onsuccess = () => { const query = request.result.transaction('snapshots').objectStore('snapshots').getAll(); query.onsuccess = () => resolve(query.result.some((v: {snapshot?:unknown}) => !!v.snapshot)); query.onerror = () => resolve(false); };
    request.onerror = () => resolve(false);
  }))).toBe(true);
  await page.evaluate(() => localStorage.setItem('test-fail-cleanup','yes'));
  await page.getByRole('button', {name:'Cerrar sesión'}).click();
  await expect(page.getByRole('heading', {name:'Iniciar sesión'})).toBeVisible();
  await expect.poll(() => page.evaluate(() => Object.keys(localStorage).some(key => key.startsWith('shared-board-cleanup:') && localStorage.getItem(key)==='pending'))).toBe(true);
  await signIn();
  await expect(page.getByText('No se pudieron borrar los datos locales. No se mostrará la copia guardada.')).toBeVisible();
  await partnerA.setOffline(true);
  await page.reload();
  await expect(page.getByText('No se pudieron borrar los datos locales. No se mostrará la copia guardada.')).toBeVisible({timeout:20_000});
  await expect(page.getByRole('button', {name:'Nueva tarea'})).not.toBeVisible();
  await expect(page.getByText('No hay tareas guardadas en este dispositivo. Conéctate para cargar el tablero.')).toBeVisible();
  await partnerA.setOffline(false);
  await page.evaluate(() => localStorage.removeItem('test-fail-cleanup'));
  await page.reload();
  await expect(page.getByText('Actualizado', {exact:true})).toBeVisible();
  await expect.poll(() => page.evaluate(() => Object.keys(localStorage).some(key => key.startsWith('shared-board-cleanup:') && localStorage.getItem(key)==='pending'))).toBe(false);
});

test('a delayed board response cannot reappear after switching accounts', async ({ browser }, testInfo) => {
  const {viewport, userAgent, deviceScaleFactor, isMobile, hasTouch} = testInfo.project.use;
  const context = await browser.newContext({serviceWorkers:'block', viewport, userAgent, deviceScaleFactor, isMobile, hasTouch});
  let release!: () => void;
  let observed!: () => void;
  const gate = new Promise<void>(resolve => {release=resolve;});
  const hit = new Promise<void>(resolve => {observed=resolve;});
  try {
    const page = await context.newPage();
    await page.goto('http://127.0.0.1:8787');
    await page.getByLabel('Correo electrónico').fill('partner-a@example.test');
    await page.getByLabel('Contraseña').fill('local-demo-password-a');
    await page.getByRole('button',{name:'Entrar'}).click();
    await expect(page.getByText('Actualizado',{exact:true})).toBeVisible();
    let delayed = false;
    await page.route('**/api/tasks', async route => {
      if (!delayed && route.request().method()==='GET') {
        delayed=true; observed(); await gate;
        const fake = {revision:9000,tasks:[{id:'late',title:'Respuesta antigua privada',assigneeUid:'old',status:'todo',deadline:null,createdAt:'2026-01-01T00:00:00Z',updatedAt:'2026-01-01T00:00:00Z'}]};
        await route.fulfill({status:200,headers:{'Content-Type':'application/json','ETag':'"board-r9000"'},body:JSON.stringify(fake)}).catch(()=>{});
      } else await route.continue();
    });
    await page.getByRole('button',{name:'Actualizar'}).click();
    await hit;
    await page.getByRole('button',{name:'Cerrar sesión'}).click();
    await page.getByLabel('Correo electrónico').fill('partner-b@example.test');
    await page.getByLabel('Contraseña').fill('local-demo-password-b');
    await page.getByRole('button',{name:'Entrar'}).click();
    await expect(page.getByText('Actualizado',{exact:true})).toBeVisible();
    release();
    await expect(page.getByText('Respuesta antigua privada')).not.toBeVisible();
  } finally { release(); await context.close(); }
});
