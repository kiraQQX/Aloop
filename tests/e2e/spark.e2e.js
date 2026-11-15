import { expect, test } from '@playwright/test';

// Spark (瞬间) end-to-end checks. The signed-in path is covered by the Vitest
// component tests with an injected repository, because the shell's Supabase
// client is configured by build-time env vars that CI does not set.

async function openSpark(page, hash = '#/spark') {
  await page.goto(`/${hash}`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('spark-view')).toBeVisible({ timeout: 20_000 });
}

async function runCapture(page, text = 'a blue corridor at dusk with a slowly turning light') {
  await page.getByTestId('spark-capture-start').click();
  await expect(page.getByTestId('spark-guide')).toBeVisible();
  await page.getByTestId('spark-guide-skip').click();
  await expect(page.getByTestId('spark-form')).toBeVisible();
  await page.getByTestId('spark-text').fill(text);
  await page.getByTestId('spark-submit').click();
  await expect(page.getByTestId('spark-result')).toBeVisible({ timeout: 15_000 });
}

test('opens Spark from the Products dropdown', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.locator('[data-shell-route="products"]').click();
  const item = page.getByRole('menuitem', { name: /Spark/ });
  await expect(item).toBeVisible();
  await item.click();
  await expect(page.getByTestId('spark-view')).toBeVisible({ timeout: 20_000 });
  await expect.poll(() => new URL(page.url()).hash).toBe('#/spark');
});

test('supports a direct visit, reload, back and forward', async ({ page }) => {
  await openSpark(page);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('spark-view')).toBeVisible({ timeout: 20_000 });

  await page.locator('[data-shell-route="products"]').click();
  await page.getByRole('menuitem', { name: 'EasySci' }).click();
  await expect(page.getByTestId('spark-view')).toHaveCount(0);
  await expect(page.locator('iframe.legacy-runtime')).toBeVisible();

  await page.goBack();
  await expect(page.getByTestId('spark-view')).toBeVisible();
  await page.goForward();
  await expect(page.getByTestId('spark-view')).toHaveCount(0);
});

test('switching to Spark and back does not reload the legacy runtime', async ({ page }) => {
  await page.goto('/#/smart-brain', { waitUntil: 'domcontentloaded' });
  const legacy = () => page.frames().find((frame) => frame.url().includes('legacy.html'));
  await expect.poll(() => Boolean(legacy())).toBe(true);
  await legacy().evaluate(() => { window.__sparkMarker = 'still-here'; });

  await page.locator('[data-shell-route="products"]').click();
  await page.getByRole('menuitem', { name: /Spark/ }).click();
  await expect(page.getByTestId('spark-view')).toBeVisible({ timeout: 20_000 });

  await page.locator('[data-shell-route="products"]').click();
  await page.getByRole('menuitem', { name: 'Smart Brain' }).click();
  await expect(page.getByTestId('spark-view')).toHaveCount(0);
  await expect(page.locator('iframe.legacy-runtime')).toBeVisible();
  await expect.poll(() => legacy().evaluate(() => window.__sparkMarker)).toBe('still-here');
});

test('switches between Chinese and English', async ({ page }) => {
  await openSpark(page);
  await expect(page.getByTestId('spark-capture-start')).toContainText('捕获一个瞬间');
  await page.locator('[data-shell-language="en"]').click();
  await expect(page.getByTestId('spark-capture-start')).toContainText('Capture a Spark');
  await expect(page.getByTestId('spark-hero')).toContainText('Before the thought fades, make it visible.');
  await page.locator('[data-shell-language="zh"]').click();
  await expect(page.getByTestId('spark-hero')).toContainText('在灵感消散之前，让它显现。');
});

test('always labels the signal as simulated and the result as a demo when no AI service is configured', async ({ page }) => {
  await openSpark(page);
  await expect(page.getByTestId('spark-sim-mode')).toHaveText('SIMULATION MODE');
  await expect(page.getByTestId('spark-sim-signal')).toContainText('SIMULATED NEURAL SIGNAL');
  await expect(page.getByTestId('spark-sim-signal')).toContainText('演示信号，不代表真实脑电采集');
  await expect(page.getByTestId('spark-generation-mode')).toContainText('未配置');

  await runCapture(page);
  await expect(page.getByTestId('spark-provenance')).toContainText('演示结果');
  await expect(page.getByTestId('spark-provenance-note')).toContainText('并非 AI 绘制');
  await expect(page.getByTestId('spark-visual')).toBeVisible();
});

test('captures, saves, and reopens an idea from the library', async ({ page }) => {
  await openSpark(page);
  await runCapture(page);
  await page.getByTestId('spark-title').fill('Blue corridor');
  await page.getByTestId('spark-save').click();
  await expect(page.getByTestId('spark-saved')).toContainText('仅本地');

  await page.getByTestId('spark-tab-library').click();
  await expect(page.getByTestId('spark-library')).toBeVisible();
  await expect(page.getByTestId('spark-capsule')).toHaveCount(1);
  await expect(page.getByTestId('spark-capsule-title')).toHaveText('Blue corridor');
  await expect(page.getByTestId('spark-sync-badge')).toHaveText('仅本地');
  await expect(page.getByTestId('spark-library-notice')).toContainText('未登录');

  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('spark-capsule-title')).toHaveText('Blue corridor');
  await page.getByTestId('spark-search').fill('no-such-thing');
  await expect(page.getByTestId('spark-capsule')).toHaveCount(0);
  await page.getByTestId('spark-search').fill('corridor');
  await expect(page.getByTestId('spark-capsule')).toHaveCount(1);

  await page.getByTestId('spark-open').click();
  await expect(page.getByTestId('spark-result')).toBeVisible();
  await expect(page.getByTestId('spark-title')).toHaveValue('Blue corridor');
});

test('library edit and delete work', async ({ page }) => {
  await openSpark(page);
  await runCapture(page);
  await page.getByTestId('spark-save').click();
  await page.getByTestId('spark-tab-library').click();
  await page.getByTestId('spark-edit').click();
  await page.getByTestId('spark-edit-title').fill('Renamed');
  await page.getByTestId('spark-edit-save').click();
  await expect(page.getByTestId('spark-capsule-title')).toHaveText('Renamed');
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByTestId('spark-delete').click();
  await expect(page.getByTestId('spark-empty')).toBeVisible();
});

test('pause and resume the neural field, and honour reduced motion', async ({ page }) => {
  await openSpark(page);
  await expect(page.getByTestId('spark-view')).toHaveAttribute('data-motion', 'running');
  await page.getByTestId('spark-pause').click();
  await expect(page.getByTestId('spark-view')).toHaveAttribute('data-motion', 'paused');
  await page.getByTestId('spark-pause').click();
  await expect(page.getByTestId('spark-view')).toHaveAttribute('data-motion', 'running');

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('spark-view')).toHaveAttribute('data-motion', 'reduced');
  await expect(page.getByTestId('spark-reduced-note')).toBeVisible();
});

test('falls back to typing when the microphone permission is denied', async ({ page }) => {
  await page.addInitScript(() => {
    window.SpeechRecognition = class {
      start() { setTimeout(() => this.onerror?.({ error: 'not-allowed' }), 0); }
      stop() {}
      abort() {}
    };
  });
  await openSpark(page);
  await page.getByTestId('spark-capture-start').click();
  await page.getByTestId('spark-guide-skip').click();
  await page.getByTestId('spark-voice').click();
  await expect(page.getByTestId('spark-voice-error')).toContainText('麦克风权限被拒绝');
  await page.getByTestId('spark-text').fill('typed after denial');
  await expect(page.getByTestId('spark-submit')).toBeEnabled();
});

test('optional calibration can be saved and cleared', async ({ page }) => {
  await openSpark(page, '#/spark/calibrate');
  await expect(page.getByTestId('spark-calibration-disclaimer')).toContainText('不是经过验证');
  await page.getByTestId('spark-dim-visual').fill('5');
  await page.getByTestId('spark-calibrate-save').click();
  await expect(page.getByTestId('spark-profile-state')).toContainText('视觉 5');
  await page.getByTestId('spark-calibrate-reset').click();
  await expect(page.getByTestId('spark-profile-state')).toContainText('尚未校准');
});

test('has no horizontal overflow on a 390px phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openSpark(page);
  const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(await overflow()).toBeLessThanOrEqual(1);
  await runCapture(page);
  expect(await overflow()).toBeLessThanOrEqual(1);
  await page.getByTestId('spark-save').click();
  await page.getByTestId('spark-tab-library').click();
  await expect(page.getByTestId('spark-library')).toBeVisible();
  expect(await overflow()).toBeLessThanOrEqual(1);
});

test('lays out cleanly at 1440px and 1280px', async ({ page }) => {
  for (const width of [1440, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await openSpark(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
    await expect(page.getByTestId('spark-field')).toBeVisible();
  }
});

test('raises no uncaught errors during a full session', async ({ page }) => {
  const problems = [];
  page.on('pageerror', (error) => problems.push(error.message));
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const text = message.text();
    if (/Failed to load resource|favicon|WebGL|net::ERR/i.test(text)) return;
    problems.push(text);
  });
  await openSpark(page);
  await runCapture(page);
  await page.getByTestId('spark-save').click();
  await page.getByTestId('spark-tab-library').click();
  await page.getByTestId('spark-tab-calibrate').click();
  expect(problems).toEqual([]);
});
