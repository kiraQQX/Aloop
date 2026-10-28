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
    expect(frame.getAttribute('src')).toBe('./legacy.html');
    expect(frame.getAttribute('title')).toBe('Aloop legacy research environment');
  });
});
