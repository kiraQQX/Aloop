import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, h, nextTick, reactive } from 'vue';
import SparkView from './SparkView.vue';
import { createMemoryStorage, createSparkStore, resetSparkStoreForTests, setSparkStoreForTests } from './sparkStore';

const flush = async (rounds = 6) => {
  for (let i = 0; i < rounds; i += 1) {
    await Promise.resolve();
    await nextTick();
  }
};

const quickAdapter = () => ({
  isDemo: true,
  async generate(input) {
    return { provenance: 'demo', imageSvg: '<svg xmlns="http://www.w3.org/2000/svg"/>', imageUrl: null, description: 'a blue corridor', composition: 'centre-weighted', palette: ['#477EAE'], tags: ['blue'], prompt: input.prompt, style: input.style };
  },
});

function fakeRepo() {
  const rows = new Map();
  return {
    rows,
    list: async () => ({ ok: true, data: [...rows.values()] }),
    save: async (row) => { rows.set(row.id, row); return { ok: true, data: { id: row.id } }; },
    remove: async (id) => { rows.delete(id); return { ok: true }; },
    removeAll: async () => { rows.clear(); return { ok: true }; },
    upload: async (userId, id) => ({ ok: true, path: `${userId}/${id}.svg` }),
    assetUrl: async () => ({ ok: true, url: null }),
    removeAssets: async () => ({ ok: true }),
  };
}

describe('SparkView', () => {
  let app;
  let host;
  let props;
  let store;
  let navigate;

  function mount(overrides = {}) {
    props = reactive({ language: 'zh', sub: 'capture', user: null, cloudConfigured: false, ...overrides });
    navigate = vi.fn();
    host = document.createElement('div');
    document.body.appendChild(host);
    app = createApp({ setup: () => () => h(SparkView, { ...props, onNavigate: navigate }) });
    app.mount(host);
    return host;
  }

  const q = (selector) => host.querySelector(selector);
  const byTest = (id) => q(`[data-testid="${id}"]`);
  const click = async (id) => { byTest(id).click(); await flush(); };

  beforeEach(() => {
    // jsdom has no 2D canvas; the view must still work without one.
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    store = createSparkStore({ storage: createMemoryStorage(), repo: fakeRepo(), adapterFactory: quickAdapter });
    setSparkStoreForTests(store);
  });

  afterEach(() => {
    app?.unmount();
    host?.remove();
    app = undefined;
    host = undefined;
    resetSparkStoreForTests();
    delete window.matchMedia;
  });

  it('opens on the idle instrument with the simulation labels', async () => {
    mount();
    await flush();
    expect(byTest('spark-view').getAttribute('data-phase')).toBe('idle');
    expect(byTest('spark-hero').textContent).toContain('SPARK');
    expect(byTest('spark-hero').textContent).toContain('Ideas exist before words.');
    expect(byTest('spark-sim-mode').textContent).toBe('SIMULATION MODE');
    expect(byTest('spark-sim-signal').textContent).toContain('SIMULATED NEURAL SIGNAL');
    expect(byTest('spark-sim-signal').textContent).toContain('演示信号，不代表真实脑电采集');
    expect(byTest('spark-capture-start').textContent).toContain('捕获一个瞬间');
    expect(byTest('spark-generation-mode').textContent).toContain('未配置');
  });

  it('renders the English copy from the shell language prop', async () => {
    mount({ language: 'en' });
    await flush();
    expect(byTest('spark-capture-start').textContent).toContain('Capture a Spark');
    expect(byTest('spark-sim-signal').textContent).toContain('Demo signal');
    props.language = 'zh';
    await flush();
    expect(byTest('spark-capture-start').textContent).toContain('捕获一个瞬间');
  });

  it('runs the full capture → reconstruct → result flow', async () => {
    mount();
    await click('spark-capture-start');
    expect(byTest('spark-view').getAttribute('data-phase')).toBe('guide');
    await click('spark-guide-skip');
    expect(byTest('spark-view').getAttribute('data-phase')).toBe('capture');
    expect(byTest('spark-submit').disabled).toBe(true);

    const text = byTest('spark-text');
    text.value = 'a blue corridor at dusk';
    text.dispatchEvent(new Event('input'));
    await flush();
    expect(byTest('spark-submit').disabled).toBe(false);

    await click('spark-submit');
    await flush();
    expect(byTest('spark-view').getAttribute('data-phase')).toBe('result');
    expect(byTest('spark-provenance').textContent).toContain('演示结果');
    expect(byTest('spark-provenance-note').textContent).toContain('并非 AI 绘制');
    expect(byTest('spark-visual').getAttribute('src')).toContain('data:image/svg+xml');
    expect(byTest('spark-sync-note')).not.toBeNull();
  });

  it('saves a result to the local library and shows it as local-only', async () => {
    mount();
    await click('spark-capture-start');
    await click('spark-guide-skip');
    byTest('spark-text').value = 'door of light';
    byTest('spark-text').dispatchEvent(new Event('input'));
    await flush();
    await click('spark-submit');
    await flush();
    await click('spark-save');
    expect(byTest('spark-saved').textContent).toContain('仅本地');
    expect(store.state.ideas).toHaveLength(1);

    props.sub = 'library';
    await flush();
    expect(byTest('spark-library')).not.toBeNull();
    expect(host.querySelectorAll('[data-testid="spark-capsule"]')).toHaveLength(1);
    expect(byTest('spark-sync-badge').textContent).toBe('仅本地');
    expect(byTest('spark-library-notice').textContent).toContain('未登录');
  });

  it('offers cloud sync only when signed in and configured', async () => {
    mount({ user: { id: 'user-1', email: 'a@b.c', label: 'a' }, cloudConfigured: true });
    await flush();
    await click('spark-capture-start');
    await click('spark-guide-skip');
    byTest('spark-text').value = 'cue';
    byTest('spark-text').dispatchEvent(new Event('input'));
    await flush();
    await click('spark-submit');
    await flush();
    expect(byTest('spark-sync')).not.toBeNull();
    await click('spark-sync');
    await flush();
    expect(store.state.ideas[0].syncState).toBe('synced');
    expect(byTest('spark-saved').textContent).toContain('已同步');
  });

  it('shows the unconfigured-cloud note when signed in without Supabase', async () => {
    mount({ user: { id: 'user-1', email: 'a@b.c', label: 'a' }, cloudConfigured: false });
    await click('spark-capture-start');
    await click('spark-guide-skip');
    byTest('spark-text').value = 'cue';
    byTest('spark-text').dispatchEvent(new Event('input'));
    await flush();
    await click('spark-submit');
    await flush();
    expect(byTest('spark-sync')).toBeNull();
    expect(byTest('spark-sync-note').textContent).toContain('未配置云端同步');
  });

  it('pauses and resumes the animation from the visible control', async () => {
    mount();
    await flush();
    expect(byTest('spark-view').getAttribute('data-motion')).toBe('running');
    await click('spark-pause');
    expect(byTest('spark-view').getAttribute('data-motion')).toBe('paused');
    expect(byTest('spark-pause').getAttribute('aria-pressed')).toBe('true');
    await click('spark-pause');
    expect(byTest('spark-view').getAttribute('data-motion')).toBe('running');
  });

  it('holds the animation still under prefers-reduced-motion', async () => {
    window.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} });
    mount();
    await flush();
    expect(byTest('spark-view').getAttribute('data-motion')).toBe('reduced');
    expect(byTest('spark-pause').disabled).toBe(true);
    expect(byTest('spark-reduced-note')).not.toBeNull();
  });

  it('falls back to typing when speech recognition is unavailable', async () => {
    mount();
    await click('spark-capture-start');
    await click('spark-guide-skip');
    expect(byTest('spark-voice-unsupported')).not.toBeNull();
    await click('spark-voice');
    expect(byTest('spark-voice-error').textContent).toContain('不支持语音转文字');
    byTest('spark-text').value = 'typed instead';
    byTest('spark-text').dispatchEvent(new Event('input'));
    await flush();
    expect(byTest('spark-submit').disabled).toBe(false);
  });

  it('shows a real error when generation fails and lets the user retry', async () => {
    store = createSparkStore({
      storage: createMemoryStorage(),
      repo: fakeRepo(),
      adapterFactory: () => ({ isDemo: true, generate: async () => { throw Object.assign(new Error('down'), { code: 'network' }); } }),
    });
    setSparkStoreForTests(store);
    mount();
    await click('spark-capture-start');
    await click('spark-guide-skip');
    byTest('spark-text').value = 'cue';
    byTest('spark-text').dispatchEvent(new Event('input'));
    await flush();
    await click('spark-submit');
    await flush();
    expect(byTest('spark-view').getAttribute('data-phase')).toBe('capture');
    expect(byTest('spark-error').textContent).toContain('无法连接图像服务');
    expect(byTest('spark-submit').disabled).toBe(false);
  });

  it('asks the shell to navigate between Spark sections', async () => {
    mount();
    await click('spark-tab-library');
    expect(navigate).toHaveBeenCalledWith('library');
    await click('spark-tab-calibrate');
    expect(navigate).toHaveBeenCalledWith('calibrate');
  });

  it('calibrates the imagery profile, labelled as self-report, and allows clearing it', async () => {
    mount({ sub: 'calibrate' });
    await flush();
    expect(byTest('spark-calibration-disclaimer').textContent).toContain('不是经过验证的心理测量');
    expect(host.querySelectorAll('input[type="range"]')).toHaveLength(8);
    const visual = byTest('spark-dim-visual');
    visual.value = '5';
    visual.dispatchEvent(new Event('input'));
    await flush();
    await click('spark-calibrate-save');
    expect(store.state.profile.dims.visual).toBe(5);
    await click('spark-calibrate-reset');
    expect(store.state.profile).toBeNull();
  });
});
