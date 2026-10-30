import { expect, test } from '@playwright/test';

test('the About page route resolves in the Vite development server', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const legacy = page.frameLocator('iframe.legacy-runtime');
  await expect(legacy.locator('#home')).toHaveCount(1);
  await expect(legacy.locator('vite-error-overlay')).toHaveCount(0);

  const aboutResponsePromise = page.waitForResponse((response) => {
    try {
      return decodeURIComponent(new URL(response.url()).pathname) === '/说明.html';
    } catch {
      return false;
    }
  });

  await page.getByRole('button', { name: '说明', exact: true }).click();
  const aboutResponse = await aboutResponsePromise;

  expect(aboutResponse.status()).toBe(200);
  await expect(
    page.frameLocator('iframe.legacy-runtime').getByRole('heading', { name: '说明', exact: true }),
  ).toBeVisible();
});

test('the protected beLieve route shows login and permits the local debug flow', async ({ page }) => {
  await page.goto('/#/e/believe/run', { waitUntil: 'domcontentloaded' });

  const legacy = page.frameLocator('iframe.legacy-runtime');
  await expect(legacy.locator('#authBackdrop')).toBeVisible({ timeout: 25_000 });
  await expect(legacy.locator('#authModal')).toBeVisible();

  await legacy.locator('#authEmail').fill('wrong');
  await legacy.locator('#authPassword').fill('wrong');
  await legacy.locator('#authForm button[type="submit"]').click();
  await expect(legacy.locator('#authMessage')).not.toBeEmpty();

  await legacy.locator('#authEmail').fill('1');
  await legacy.locator('#authPassword').fill('1');
  await legacy.locator('#authForm button[type="submit"]').click();

  await expect(legacy.locator('#authBackdrop')).toBeHidden();
  await expect.poll(() => {
    const frame = page.frames().find((candidate) => {
      try {
        return new URL(candidate.url()).pathname.endsWith('/legacy.html');
      } catch {
        return false;
      }
    });
    return frame?.url() || '';
  }).toContain('#/e/believe/run');
});

test('direct deep links and browser back keep shell navigation synchronized', async ({ page }) => {
  await page.goto('/#/smart-brain/atlas', { waitUntil: 'domcontentloaded' });

  const frame = page.locator('iframe.legacy-runtime');
  await expect(frame).toHaveAttribute('src', /legacy\.html\?embed=1#\/smart-brain\/atlas/);
  await page.locator('[data-shell-route="products"]').click();
  await expect(page.getByRole('menuitem', { name: 'Smart Brain' })).toHaveAttribute('aria-current', 'true');
  await page.getByRole('menuitem', { name: 'EasySci' }).click();
  await expect(page).toHaveURL(/#\/easysci$/);
  await expect(frame).toHaveAttribute('src', /legacy\.html\?embed=1#\/easysci/);

  await page.goBack();
  await expect(page).toHaveURL(/#\/smart-brain\/atlas$/);
  await expect(frame).toHaveAttribute('src', /legacy\.html\?embed=1#\/smart-brain\/atlas/);
});

// ---------------------------------------------------------------------------
// Migration regression coverage: entry contract, Atlas WebGL, bilingual About.
// ---------------------------------------------------------------------------

function collectErrors(page) {
  const errors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  return errors;
}

test('the homepage renders the sampled cortical model without console errors', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  const legacy = page.frameLocator('iframe.legacy-runtime');
  const stage = legacy.locator('#particleCortexStage');
  await expect(stage).toHaveAttribute('data-source', 'cortex-glb', { timeout: 30_000 });
  await expect(stage).toHaveClass(/is-ready/, { timeout: 30_000 });
  await expect(legacy.locator('.particle-cortex-canvas')).toBeVisible();
  // The Vue shell owns the only navigation bar in embedded mode.
  await expect(legacy.locator('.topbar')).toBeHidden();
  expect(errors).toEqual([]);
});

test('EasySci lists the directory and filters by search', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/#/easysci', { waitUntil: 'domcontentloaded' });

  const legacy = page.frameLocator('iframe.legacy-runtime');
  await expect(legacy.locator('#easysciView')).toBeVisible({ timeout: 20_000 });
  const initial = await legacy.locator('.es-card').count();
  expect(initial).toBeGreaterThan(0);

  const search = legacy.locator('#easysciView input').first();
  await search.fill('zotero');
  await expect.poll(() => legacy.locator('.es-card').count()).toBeLessThan(initial);
  await expect(legacy.locator('#easysciView')).toContainText('Zotero');
  expect(errors).toEqual([]);
});

test('Smart Brain Atlas mounts a real WebGL surface', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/#/smart-brain/atlas', { waitUntil: 'domcontentloaded' });

  const legacy = page.frameLocator('iframe.legacy-runtime');
  const canvas = legacy.locator('.atlas-canvas');
  await expect(canvas).toBeVisible({ timeout: 30_000 });

  const box = await canvas.boundingBox();
  expect(box.width).toBeGreaterThan(200);
  expect(box.height).toBeGreaterThan(200);

  const context = await canvas.evaluate((element) => {
    const gl = element.getContext('webgl2') || element.getContext('webgl');
    return gl ? { ok: true } : { ok: false };
  });
  expect(context.ok).toBe(true);
  // The atlas layer list proves the manifest/mesh data loaded alongside WebGL.
  await expect(legacy.locator('#atlasRoot')).toContainText('大脑皮层');
  expect(errors).toEqual([]);
});

test('the About page is embedded, bilingual and returns to the shell home', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/#/about', { waitUntil: 'domcontentloaded' });

  const legacy = page.frameLocator('iframe.legacy-runtime');
  await expect(legacy.locator('.about-top')).toBeHidden();
  await expect(legacy.locator('.lang-zh h1')).toHaveText('说明');

  await page.getByRole('button', { name: 'EN' }).click();
  await expect(legacy.locator('.lang-en h1')).toHaveText('About');

  await page.getByRole('button', { name: 'Home', exact: true }).click();
  await expect(page).toHaveURL(/#\/$/);
  await expect(legacy.locator('#home')).toHaveCount(1);
  expect(errors).toEqual([]);
});

test('standalone.html is a development-only reference, not a production entry', async ({ page, request }) => {
  const response = await request.get('/standalone.html');
  expect(response.status()).toBe(200);
  expect(response.headers()['x-robots-tag']).toContain('noindex');

  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const links = await page.locator('a[href*="standalone"]').count();
  expect(links).toBe(0);
});
