import { beforeEach, describe, expect, it, vi } from 'vitest';
import { STORAGE_KEYS, createMemoryStorage, createSparkStore } from '../src/features/spark/sparkStore';

const wait = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));

function fakeAdapter({ fail = null, delayMs = 0 } = {}) {
  return {
    isDemo: true,
    async generate(input, { signal } = {}) {
      if (delayMs) {
        await new Promise((resolve, reject) => {
          const timer = setTimeout(resolve, delayMs);
          signal?.addEventListener('abort', () => { clearTimeout(timer); reject(Object.assign(new Error('cancelled'), { code: 'aborted' })); });
        });
      }
      if (fail) throw Object.assign(new Error(fail.message || 'boom'), { code: fail.code || 'network' });
      return { provenance: 'demo', imageSvg: '<svg xmlns="http://www.w3.org/2000/svg"/>', imageUrl: null, description: 'desc', composition: 'comp', palette: ['#fff'], tags: ['blue', 'door'], prompt: input.prompt, style: input.style };
    },
  };
}

function fakeRepo(overrides = {}) {
  const rows = new Map();
  return {
    rows,
    list: vi.fn(async () => ({ ok: true, data: [...rows.values()] })),
    save: vi.fn(async (row) => { rows.set(row.id, row); return { ok: true, data: { id: row.id } }; }),
    remove: vi.fn(async (id) => { rows.delete(id); return { ok: true }; }),
    removeAll: vi.fn(async () => { rows.clear(); return { ok: true }; }),
    upload: vi.fn(async (userId, id) => ({ ok: true, path: `${userId}/${id}.svg` })),
    assetUrl: vi.fn(async () => ({ ok: true, url: 'https://signed.example/x' })),
    removeAssets: vi.fn(async () => ({ ok: true })),
    ...overrides,
  };
}

let tick = 0;
const clock = () => new Date(Date.UTC(2026, 10, 15, 0, 0, tick++)).toISOString();
let ids = 0;
const uuid = () => `00000000-0000-4000-8000-${String(++ids).padStart(12, '0')}`;

function make(opts = {}) {
  const storage = opts.storage || createMemoryStorage();
  const repo = opts.repo || fakeRepo();
  const store = createSparkStore({ storage, repo, adapterFactory: () => opts.adapter || fakeAdapter(), now: clock, uuid });
  return { store, storage, repo };
}

async function capture(store, text = 'a blue corridor at dusk') {
  store.start();
  store.beginCapture();
  store.setDraft({ text });
  return store.generate({ language: 'en' });
}

beforeEach(() => { tick = 0; ids = 0; });

describe('Spark capture flow', () => {
  it('goes idle → guide → capture → result and keeps the generated card', async () => {
    const { store } = make();
    expect(store.state.phase).toBe('idle');
    expect(store.start()).toBe(true);
    expect(store.state.phase).toBe('guide');
    expect(store.beginCapture()).toBe(true);
    expect(store.state.phase).toBe('capture');
    store.setDraft({ text: 'a blue corridor' });
    const result = await store.generate({ language: 'en' });
    expect(store.state.phase).toBe('result');
    expect(result.provenance).toBe('demo');
    expect(result.title).toBe('blue');
    expect(store.state.error).toBeNull();
  });

  it('requires at least one cue but does not demand every field', async () => {
    const { store } = make();
    store.start(); store.beginCapture();
    expect(store.canSubmit()).toBe(false);
    expect(await store.generate({ language: 'en' })).toBeNull();
    expect(store.state.phase).toBe('capture');
    expect(store.state.error.code).toBe('empty_input');
    store.setDraft({ fragments: { color: 'blue' } });
    expect(store.canSubmit()).toBe(true);
  });

  it('returns to capture with a real error when generation fails', async () => {
    const { store } = make({ adapter: fakeAdapter({ fail: { code: 'network', message: 'offline' } }) });
    expect(await capture(store)).toBeNull();
    expect(store.state.phase).toBe('capture');
    expect(store.state.error).toEqual({ code: 'network', message: 'offline' });
  });

  it('can cancel an in-flight generation and ignores its late result', async () => {
    const { store } = make({ adapter: fakeAdapter({ delayMs: 40 }) });
    store.start(); store.beginCapture(); store.setDraft({ text: 'x cue' });
    const pending = store.generate({ language: 'en' });
    expect(store.state.phase).toBe('reconstructing');
    expect(store.cancelGeneration()).toBe(true);
    expect(store.state.phase).toBe('capture');
    expect(await pending).toBeNull();
    await wait(60);
    expect(store.state.result).toBeNull();
    expect(store.state.phase).toBe('capture');
  });

  it('regenerates from a result and falls back to the old result on failure', async () => {
    let fail = false;
    const adapter = { isDemo: true, async generate(input) { if (fail) throw Object.assign(new Error('down'), { code: 'timeout' }); return fakeAdapter().generate(input); } };
    const { store } = make({ adapter });
    await capture(store);
    const first = store.state.result;
    expect(first.generationCount).toBe(1);
    fail = true;
    await store.generate({ language: 'en' });
    expect(store.state.phase).toBe('result');
    expect(store.state.result.title).toBe(first.title);
    expect(store.state.error.code).toBe('timeout');
    fail = false;
    await store.generate({ language: 'en' });
    expect(store.state.result.generationCount).toBe(2);
  });

  it('lets the user edit the result before saving', async () => {
    const { store } = make();
    await capture(store);
    store.updateResult({ title: 'Blue door', tags: ['a', 'b'], prompt: 'new prompt' });
    const idea = store.saveResult();
    expect(idea).toMatchObject({ title: 'Blue door', tags: ['a', 'b'], generationPrompt: 'new prompt', syncState: 'local', inCloud: false });
  });

  it('starts over cleanly', async () => {
    const { store } = make();
    await capture(store);
    store.newSpark();
    expect(store.state.phase).toBe('idle');
    expect(store.state.result).toBeNull();
    expect(store.state.draft.text).toBe('');
  });
});

describe('Idea Capsule CRUD and local persistence', () => {
  it('creates, edits, searches, and deletes ideas', async () => {
    const { store } = make();
    const a = store.createIdea({ title: 'Blue door', tags: ['door'], inputMode: 'voice', rawInput: 'a door of blue light' });
    const b = store.createIdea({ title: 'Red stair', tags: ['stair'], inputMode: 'imagery' });
    expect(store.state.ideas).toHaveLength(2);
    expect(store.listIdeas({ query: 'blue' }).map((i) => i.id)).toEqual([a.id]);
    expect(store.listIdeas({ tag: 'stair' }).map((i) => i.id)).toEqual([b.id]);
    expect(store.listIdeas({ mode: 'voice' }).map((i) => i.id)).toEqual([a.id]);
    store.updateIdea(a.id, { title: 'Blue gate', generationPrompt: 'v2' });
    expect(store.getIdea(a.id).title).toBe('Blue gate');
    expect(store.getIdea(a.id).history).toHaveLength(1);
    expect(await store.deleteIdea(b.id)).toEqual({ ok: true });
    expect(store.state.ideas).toHaveLength(1);
  });

  it('survives a reload through local storage', () => {
    const shared = createMemoryStorage();
    const first = make({ storage: shared });
    first.store.createIdea({ title: 'Kept', tags: ['x'] });
    first.store.setDraft({ text: 'draft text', fragments: { color: 'teal' } });
    first.store.saveProfile({ visual: 5, auditory: 2 });
    const second = make({ storage: shared });
    expect(second.store.state.ideas.map((i) => i.title)).toEqual(['Kept']);
    expect(second.store.state.draft.text).toBe('draft text');
    expect(second.store.state.draft.fragments).toEqual({ color: 'teal' });
    expect(second.store.state.profile.dims.visual).toBe(5);
  });

  it('tolerates corrupt storage', () => {
    const storage = createMemoryStorage();
    storage.setItem(STORAGE_KEYS.ideas, '{not json');
    storage.setItem(STORAGE_KEYS.draft, '???');
    const { store } = make({ storage });
    expect(store.state.ideas).toEqual([]);
    expect(store.state.draft.text).toBe('');
  });

  it('reports a real error when storage is full instead of pretending to save', () => {
    const storage = { getItem: () => null, setItem: () => { throw new Error('QuotaExceededError'); }, removeItem() {} };
    const { store } = make({ storage });
    store.createIdea({ title: 'Too big' });
    expect(store.state.storageError.message).toContain('QuotaExceededError');
  });

  it('reopens a saved idea as an editable result', () => {
    const { store } = make();
    const idea = store.createIdea({ title: 'T', rawInput: 'raw', visualDescription: 'd', generationPrompt: 'p', tags: ['t'], visualSvg: '<svg/>' });
    expect(store.reopenIdea(idea.id)).toBe(true);
    expect(store.state.phase).toBe('result');
    expect(store.state.result.savedIdeaId).toBe(idea.id);
    expect(store.state.draft.text).toBe('raw');
  });

  it('saving the same result twice updates the same idea', async () => {
    const { store } = make();
    await capture(store);
    const first = store.saveResult();
    store.updateResult({ title: 'Renamed' });
    const second = store.saveResult();
    expect(second.id).toBe(first.id);
    expect(store.state.ideas).toHaveLength(1);
    expect(store.getIdea(first.id).title).toBe('Renamed');
  });
});

describe('cloud sync keeps local and cloud states distinct and honest', () => {
  const user = { id: 'user-1', label: 'tester' };

  it('refuses to sync when signed out or unconfigured, with real messages', async () => {
    const { store } = make();
    const idea = store.createIdea({ title: 'A' });
    expect((await store.syncIdea(idea.id)).reason).toBe('not_configured');
    store.setCloud({ configured: true });
    expect((await store.syncIdea(idea.id)).reason).toBe('not_signed_in');
    expect(store.getIdea(idea.id).syncState).toBe('error');
    expect(store.canSync).toBe(false);
  });

  it('syncs one idea, uploads its preview privately, and marks it synced', async () => {
    const { store, repo, storage } = make();
    store.setCloud({ configured: true });
    store.setUser(user);
    const idea = store.createIdea({ title: 'A', visualSvg: '<svg/>' });
    const outcome = await store.syncIdea(idea.id);
    expect(outcome.ok).toBe(true);
    expect(store.getIdea(idea.id)).toMatchObject({ syncState: 'synced', inCloud: true, assetPath: `user-1/${idea.id}.svg` });
    expect(repo.rows.get(idea.id).user_id).toBe('user-1');
    expect(JSON.parse(storage.getItem(STORAGE_KEYS.ideas)).ideas).toHaveLength(0);
  });

  it('shows a real failure and does not claim success', async () => {
    const repo = fakeRepo({ save: vi.fn(async () => ({ ok: false, reason: '42501', message: 'row-level security' })) });
    const { store } = make({ repo });
    store.setCloud({ configured: true });
    store.setUser(user);
    const idea = store.createIdea({ title: 'A' });
    const outcome = await store.syncIdea(idea.id);
    expect(outcome.ok).toBe(false);
    expect(store.getIdea(idea.id)).toMatchObject({ syncState: 'error', inCloud: false });
    expect(store.getIdea(idea.id).syncError).toContain('row-level security');
  });

  it('fails the sync when the preview upload fails', async () => {
    const repo = fakeRepo({ upload: vi.fn(async () => ({ ok: false, message: 'bucket missing' })) });
    const { store } = make({ repo });
    store.setCloud({ configured: true });
    store.setUser(user);
    const idea = store.createIdea({ title: 'A', visualSvg: '<svg/>' });
    expect((await store.syncIdea(idea.id)).ok).toBe(false);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('marks a synced idea dirty after an edit', async () => {
    const { store } = make();
    store.setCloud({ configured: true });
    store.setUser(user);
    const idea = store.createIdea({ title: 'A' });
    await store.syncIdea(idea.id);
    store.updateIdea(idea.id, { title: 'B' });
    expect(store.getIdea(idea.id).syncState).toBe('dirty');
  });

  it('merges cloud ideas on load and drops cloud copies when signing out', async () => {
    const repo = fakeRepo();
    repo.rows.set('cloud-1', { id: 'cloud-1', user_id: 'user-1', title: 'From cloud', raw_input: '', input_mode: 'voice', sensory_profile: {}, visual_description: '', generation_prompt: '', tags: ['c'], asset_path: null, result_meta: {}, created_at: '2026-11-01T00:00:00Z', updated_at: '2026-11-02T00:00:00Z' });
    const { store } = make({ repo });
    store.setCloud({ configured: true });
    store.setUser(user);
    store.createIdea({ title: 'Local only' });
    expect((await store.loadCloud()).ok).toBe(true);
    expect(store.state.ideas.map((i) => i.title).sort()).toEqual(['From cloud', 'Local only']);
    store.setUser(null);
    expect(store.state.ideas.map((i) => i.title)).toEqual(['Local only']);
  });

  it('reports a cloud load failure', async () => {
    const repo = fakeRepo({ list: vi.fn(async () => ({ ok: false, reason: 'PGRST', message: 'permission denied' })) });
    const { store } = make({ repo });
    store.setCloud({ configured: true });
    store.setUser(user);
    expect((await store.loadCloud()).ok).toBe(false);
    expect(store.state.cloud.error.message).toBe('permission denied');
  });

  it('keeps an idea when its cloud deletion fails', async () => {
    const repo = fakeRepo({ remove: vi.fn(async () => ({ ok: false, message: 'denied' })) });
    const { store } = make({ repo });
    store.setCloud({ configured: true });
    store.setUser(user);
    const idea = store.createIdea({ title: 'A' });
    await store.syncIdea(idea.id);
    const outcome = await store.deleteIdea(idea.id);
    expect(outcome.ok).toBe(false);
    expect(store.getIdea(idea.id)).not.toBeNull();
  });
});

describe('privacy controls', () => {
  it('exports only saved text/visuals and states that no EEG or audio is collected', () => {
    const { store } = make();
    store.createIdea({ title: 'A', rawInput: 'text' });
    const data = store.exportData();
    expect(data.app).toBe('aloop-spark');
    expect(data.note).toMatch(/No EEG data or audio/);
    expect(data.ideas).toHaveLength(1);
    expect(JSON.stringify(data)).not.toMatch(/eeg_|channel|accuracy/i);
  });

  it('deletes all local data, and cloud data when signed in', async () => {
    const { store, repo, storage } = make();
    store.setCloud({ configured: true });
    store.setUser({ id: 'user-1' });
    store.createIdea({ title: 'A' });
    store.saveProfile({ visual: 4 });
    const outcome = await store.deleteAllData();
    expect(outcome.ok).toBe(true);
    expect(repo.removeAll).toHaveBeenCalled();
    expect(store.state.ideas).toEqual([]);
    expect(store.state.profile).toBeNull();
    expect(storage.getItem(STORAGE_KEYS.ideas)).toBeNull();
  });

  it('keeps local data if the cloud deletion fails', async () => {
    const repo = fakeRepo({ removeAll: vi.fn(async () => ({ ok: false, message: 'nope' })) });
    const { store } = make({ repo });
    store.setCloud({ configured: true });
    store.setUser({ id: 'user-1' });
    store.createIdea({ title: 'A' });
    const outcome = await store.deleteAllData();
    expect(outcome.ok).toBe(false);
    expect(store.state.ideas).toHaveLength(1);
  });
});

describe('imagery profile (self-report, skippable, editable)', () => {
  it('saves clamped 0–5 ratings for the eight dimensions', () => {
    const { store } = make();
    const profile = store.saveProfile({ visual: 9, auditory: -2, olfactory: 3.4 });
    expect(Object.keys(profile.dims)).toHaveLength(8);
    expect(profile.dims.visual).toBe(5);
    expect(profile.dims.auditory).toBe(0);
    expect(profile.dims.olfactory).toBe(3);
  });

  it('can be skipped, recalibrated and cleared', () => {
    const { store } = make();
    store.skipCalibration();
    expect(store.state.profile).toMatchObject({ skipped: true, dims: null });
    store.saveProfile({ visual: 2 });
    expect(store.state.profile.skipped).toBe(false);
    store.clearProfile();
    expect(store.state.profile).toBeNull();
  });
});

describe('animation controls', () => {
  it('pauses and resumes, and remembers the choice', () => {
    const shared = createMemoryStorage();
    const { store } = make({ storage: shared });
    expect(store.shouldAnimate).toBe(true);
    expect(store.togglePause()).toBe(true);
    expect(store.shouldAnimate).toBe(false);
    expect(make({ storage: shared }).store.state.motion.paused).toBe(true);
    expect(store.togglePause()).toBe(false);
    expect(store.shouldAnimate).toBe(true);
  });

  it('never animates under reduced motion or while hidden', () => {
    const { store } = make();
    store.setReducedMotion(true);
    expect(store.shouldAnimate).toBe(false);
    store.setReducedMotion(false);
    store.setHidden(true);
    expect(store.shouldAnimate).toBe(false);
    store.setHidden(false);
    expect(store.shouldAnimate).toBe(true);
  });

  it('clamps animation speed', () => {
    const { store } = make();
    store.setSpeed(10);
    expect(store.state.motion.speed).toBe(2);
    store.setSpeed(0.01);
    expect(store.state.motion.speed).toBe(0.25);
  });
});
