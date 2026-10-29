import { afterEach, describe, expect, it } from 'vitest';
import { createApp, nextTick } from 'vue';
import App from './App.vue';

describe('Vue migration shell', () => {
  let app;
  afterEach(() => {
    app?.unmount();
    document.body.innerHTML = '';
    app = undefined;
  });

  it('mounts the legacy research environment in an iframe', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    app = createApp(App);
    app.mount(host);
    await nextTick();
    const frame = host.querySelector('iframe');
    expect(frame).not.toBeNull();
    expect(frame.getAttribute('src')).toContain('./legacy.html?embed=1');
    expect(frame.getAttribute('title')).toBe('Aloop legacy research environment');
  });
});


describe('Vue-owned navigation and language controls', () => {
  let host;
  let app;

  afterEach(() => {
    app?.unmount();
    document.body.innerHTML = '';
    app = undefined;
    host = undefined;
  });

  async function mountShell() {
    host = document.createElement('div');
    document.body.appendChild(host);
    app = createApp(App);
    app.mount(host);
    await nextTick();
    return host;
  }

  it('renders a Vue navigation shell outside the legacy iframe', async () => {
    const root = await mountShell();
    expect(root.querySelector('[data-testid="vue-shell-nav"]')).not.toBeNull();
    expect(root.querySelector('[data-shell-route="home"]')).not.toBeNull();
    expect(root.querySelector('[data-shell-route="easysci"]')).not.toBeNull();
    expect(root.querySelector('[data-shell-route="smart-brain"]')).not.toBeNull();
    expect(root.querySelector('[data-shell-route="about"]')).not.toBeNull();
    expect(root.querySelector('iframe').getAttribute('src')).toContain('embed=1');
  });

  it('routes EasySci and Smart Brain through the legacy hash router', async () => {
    const root = await mountShell();
    const frame = root.querySelector('iframe');
    root.querySelector('[data-shell-route="easysci"]').click();
    await nextTick();
    expect(frame.getAttribute('src')).toContain('#/easysci');
    expect(window.location.hash).toBe('#/easysci');
    expect(root.querySelector('[data-shell-route="easysci"]').getAttribute('aria-current')).toBe('page');
    root.querySelector('[data-shell-route="smart-brain"]').click();
    await nextTick();
    expect(frame.getAttribute('src')).toContain('#/smart-brain');
    expect(window.location.hash).toBe('#/smart-brain');
    expect(root.querySelector('[data-shell-route="smart-brain"]').getAttribute('aria-current')).toBe('page');
  });

  it('keeps the shell language selection state and aria state synchronized', async () => {
    const root = await mountShell();
    const english = root.querySelector('[data-shell-language="en"]');
    english.click();
    await nextTick();
    expect(english.getAttribute('aria-pressed')).toBe('true');
    expect(root.querySelector('[data-shell-language="zh"]').getAttribute('aria-pressed')).toBe('false');
  });
});


describe('Vue experiment menu compatibility', () => {
  let app;
  let host;
  afterEach(() => {
    app?.unmount();
    document.body.innerHTML = '';
    window.location.hash = '';
    app = undefined;
    host = undefined;
  });

  it('keeps the beLieve experiment reachable from the Vue-owned experiments menu', async () => {
    host = document.createElement('div');
    document.body.appendChild(host);
    app = createApp(App);
    app.mount(host);
    await nextTick();
    host.querySelector('[data-shell-route="experiments"]').click();
    await nextTick();
    const item = host.querySelector('[data-shell-experiment="believe"]');
    expect(item).not.toBeNull();
    item.click();
    await nextTick();
    expect(host.querySelector('iframe').getAttribute('src')).toContain('#/e/believe');
    expect(window.location.hash).toBe('#/e/believe');
  });
});


describe('Vue shell routing regression cases', () => {
  let app;
  let host;

  afterEach(() => {
    app?.unmount();
    document.body.innerHTML = '';
    window.location.hash = '';
    app = undefined;
    host = undefined;
  });

  async function mount() {
    host = document.createElement('div');
    document.body.appendChild(host);
    app = createApp(App);
    app.mount(host);
    await nextTick();
    return host;
  }

  it('maps the nested experiment route to the experiments navigation state without losing its URL', async () => {
    window.location.hash = '#/e/believe/run';
    const root = await mount();
    await nextTick();
    expect(root.querySelector('[data-shell-route="experiments"]').getAttribute('aria-current')).toBe('page');
    expect(window.location.hash).toBe('#/e/believe/run');
    expect(root.querySelector('iframe').getAttribute('src')).toContain('#/e/believe/run');
  });

  it('maps direct Smart Brain deep links to the matching shell state', async () => {
    window.location.hash = '#/smart-brain/atlas';
    const root = await mount();
    await nextTick();
    expect(root.querySelector('[data-shell-route="smart-brain"]').getAttribute('aria-current')).toBe('page');
    expect(root.querySelector('iframe').getAttribute('src')).toContain('#/smart-brain/atlas');
  });

  it('preserves direct EasySci category deep links in the Vue shell and iframe', async () => {
    window.location.hash = '#/easysci/analysis';
    const root = await mount();
    await nextTick();
    expect(root.querySelector('[data-shell-route="easysci"]').getAttribute('aria-current')).toBe('page');
    expect(window.location.hash).toBe('#/easysci/analysis');
    expect(root.querySelector('iframe').getAttribute('src')).toContain('#/easysci/analysis');
  });

});


describe('P0 legacy compatibility regressions', () => {
  it('does not globally hide the legacy authentication backdrop in embedded mode', async () => {
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const cssPath = resolve(process.cwd(), 'assets/css/vue-embed.css');
    const css = readFileSync(cssPath, 'utf8');
    expect(css).not.toMatch(/\.auth-backdrop\s*,?[^}]*display:\s*none\s*!important/s);
    expect(css).not.toMatch(/\.topbar\s*,\s*\.auth-backdrop/);
  });

  it('opens the About page using a URL that is available in development and production', async () => {
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const configPath = resolve(process.cwd(), 'vite.config.js');
    const config = readFileSync(configPath, 'utf8');
    expect(config).toContain('/说明.html');
    expect(config).toContain('configureServer');
  });
});
