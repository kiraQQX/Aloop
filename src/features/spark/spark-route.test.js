import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp, nextTick } from 'vue';
import App from '../../App.vue';
import { createMemoryStorage, createSparkStore, resetSparkStoreForTests, setSparkStoreForTests } from './sparkStore';

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('#/spark in the Vue shell', () => {
  let app;
  let host;

  async function mount() {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    setSparkStoreForTests(createSparkStore({ storage: createMemoryStorage(), repo: {}, adapterFactory: () => ({ isDemo: true, generate: async () => ({}) }) }));
    host = document.createElement('div');
    document.body.appendChild(host);
    app = createApp(App);
    app.mount(host);
    await nextTick();
    return host;
  }

  afterEach(() => {
    app?.unmount();
    host?.remove();
    window.localStorage.clear();
    window.location.hash = '';
    resetSparkStoreForTests();
    app = undefined;
    host = undefined;
  });

  it('lists Spark as the third product with its bilingual description', async () => {
    const root = await mount();
    root.querySelector('[data-shell-route="products"]').click();
    await nextTick();
    const item = root.querySelector('[data-shell-route="spark"]');
    expect(item.getAttribute('role')).toBe('menuitem');
    expect(item.textContent).toContain('瞬间 / Spark');
    expect(item.textContent).toContain('想象捕获与视觉重构');
    root.querySelector('[data-shell-language="en"]').click();
    await nextTick();
    expect(root.querySelector('[data-shell-route="spark"]').textContent).toContain('Imagination Capture & Visual Reconstruction');
  });

  it('opens Spark from the menu without loading it into the legacy iframe', async () => {
    const root = await mount();
    const frame = root.querySelector('iframe');
    const before = frame.getAttribute('src');
    root.querySelector('[data-shell-route="products"]').click();
    await nextTick();
    root.querySelector('[data-shell-route="spark"]').click();
    await vi.waitFor(() => expect(root.querySelector('[data-testid="spark-view"]')).not.toBeNull());
    expect(window.location.hash).toBe('#/spark');
    expect(root.querySelector('[data-shell-route="spark"]').getAttribute('aria-current')).toBe('true');
    expect(frame.getAttribute('src')).toBe(before);
    expect(frame.getAttribute('src') || '').not.toContain('spark');
    expect(frame.closest('section').style.display).toBe('none');
  });

  it('supports a direct #/spark visit and the library sub-route', async () => {
    window.location.hash = '#/spark/library';
    const root = await mount();
    await vi.waitFor(() => expect(root.querySelector('[data-testid="spark-view"]')).not.toBeNull());
    expect(root.querySelector('[data-testid="spark-view"]').getAttribute('data-sub')).toBe('library');
    expect(root.querySelector('[data-testid="spark-library"]')).not.toBeNull();
    expect(root.querySelector('[data-shell-route="spark"]').getAttribute('aria-current')).toBe('true');
  });

  it('follows the Spark language and tab navigation through the hash', async () => {
    window.location.hash = '#/spark';
    const root = await mount();
    await vi.waitFor(() => expect(root.querySelector('[data-testid="spark-view"]')).not.toBeNull());
    root.querySelector('[data-shell-language="en"]').click();
    await nextTick();
    expect(root.querySelector('[data-testid="spark-capture-start"]').textContent).toContain('Capture a Spark');
    root.querySelector('[data-testid="spark-tab-library"]').click();
    await vi.waitFor(() => expect(window.location.hash).toBe('#/spark/library'));
    await vi.waitFor(() => expect(root.querySelector('[data-testid="spark-library"]')).not.toBeNull());
  });

  it('restores the same legacy iframe, without reloading it, when leaving Spark', async () => {
    window.location.hash = '#/easysci';
    const root = await mount();
    const frame = root.querySelector('iframe');
    const src = frame.getAttribute('src');
    expect(src).toContain('#/easysci');

    root.querySelector('[data-shell-route="products"]').click();
    await nextTick();
    root.querySelector('[data-shell-route="spark"]').click();
    await vi.waitFor(() => expect(root.querySelector('[data-testid="spark-view"]')).not.toBeNull());
    expect(root.querySelector('iframe')).toBe(frame);
    expect(frame.getAttribute('src')).toBe(src);

    root.querySelector('[data-shell-route="products"]').click();
    await nextTick();
    root.querySelector('[data-shell-route="easysci"]').click();
    await settle();
    await nextTick();
    expect(root.querySelector('[data-testid="spark-view"]')).toBeNull();
    expect(root.querySelector('iframe')).toBe(frame);
    expect(frame.getAttribute('src')).toBe(src);
    expect(frame.closest('section').style.display).not.toBe('none');
    expect(root.querySelector('[data-shell-route="easysci"]').getAttribute('aria-current')).toBe('true');
  });

  it('brings the legacy runtime back from a direct Spark visit when navigating home', async () => {
    window.location.hash = '#/spark';
    const root = await mount();
    const frame = root.querySelector('iframe');
    expect(frame.getAttribute('src')).toBeNull();
    await vi.waitFor(() => expect(root.querySelector('[data-testid="spark-view"]')).not.toBeNull());
    window.location.hash = '#/smart-brain';
    await vi.waitFor(() => expect(root.querySelector('[data-testid="spark-view"]')).toBeNull());
    expect(frame.getAttribute('src')).toContain('./legacy.html?embed=1#/smart-brain');
  });
});
