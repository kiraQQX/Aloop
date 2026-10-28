import { expect, test } from '@playwright/test';

test('the About page route resolves in the Vite development server', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });

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
  await expect(page.getByRole('button', { name: 'Smart Brain' })).toHaveAttribute('aria-current', 'page');

  await page.getByRole('button', { name: 'EasySci' }).click();
  await expect(page).toHaveURL(/#\/easysci$/);
  await expect(frame).toHaveAttribute('src', /legacy\.html\?embed=1#\/easysci/);

  await page.goBack();
  await expect(page).toHaveURL(/#\/smart-brain\/atlas$/);
  await expect(frame).toHaveAttribute('src', /legacy\.html\?embed=1#\/smart-brain\/atlas/);
});
