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
