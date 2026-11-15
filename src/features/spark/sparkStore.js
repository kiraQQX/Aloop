// Spark state: capture state machine, Idea Capsule CRUD, local persistence,
// optional cloud sync, imagery profile, and animation controls.
//
// `createSparkStore(deps)` is a factory so tests get isolated instances;
// `useSparkStore()` returns the app-wide singleton.

import { reactive } from 'vue';
import { ideaToRow, rowToIdea } from '../../lib/spark/ideaMapper';
import { detectInputMode, hasCaptureContent, normalizeFragments, normalizeText } from '../../lib/spark/captureService';
import { buildGenerationInput, createGenerationAdapter } from '../../lib/spark/generationAdapter';

export const STORAGE_KEYS = Object.freeze({
  ideas: 'aloop_spark_ideas_v1',
  draft: 'aloop_spark_draft_v1',
  profile: 'aloop_spark_profile_v1',
  motion: 'aloop_spark_motion_v1',
});

export const IMAGERY_DIMENSIONS = Object.freeze(['visual', 'auditory', 'olfactory', 'gustatory', 'tactile', 'motor', 'somatic', 'emotional']);
const HISTORY_LIMIT = 20;

// ---- capture state machine -------------------------------------------------
const TRANSITIONS = {
  idle: { START: 'guide' },
  guide: { BEGIN: 'capture', CANCEL: 'idle' },
  capture: { SUBMIT: 'reconstructing', CANCEL: 'idle' },
  reconstructing: { DONE: 'result', FAIL: 'capture', CANCEL: 'capture', RESTORE_RESULT: 'result' },
  result: { REGENERATE: 'reconstructing', EDIT: 'capture', NEW: 'idle' },
};

/** Pure transition: returns the next phase, or null when the event is not allowed. */
export function transition(phase, event) {
  return TRANSITIONS[phase]?.[event] ?? null;
}

// ---- helpers ---------------------------------------------------------------
export function uuidv4() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const r = (Math.random() * 16) | 0;
    return (char === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export function createMemoryStorage() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => { map.set(key, String(value)); },
    removeItem: (key) => { map.delete(key); },
  };
}

function resolveStorage(storage) {
  if (storage) return storage;
  try {
    if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
  } catch { /* storage blocked */ }
  return createMemoryStorage();
}

function readJson(storage, key, fallback) {
  try {
    const raw = storage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function autoTitle(result, input) {
  const first = result?.tags?.[0] || input?.keywords?.[0] || (input?.text || '').slice(0, 24);
  return first || (input?.language === 'en' ? 'Untitled spark' : '未命名瞬间');
}

function defaultRepo() {
  const data = () => import('../../lib/data');
  return {
    list: async () => (await data()).listSparkIdeas(),
    save: async (row) => (await data()).saveSparkIdea(row),
    remove: async (id) => (await data()).deleteSparkIdea(id),
    removeAll: async () => (await data()).deleteAllSparkIdeas(),
    upload: async (...args) => (await data()).uploadSparkAsset(...args),
    assetUrl: async (path) => (await data()).getSparkAssetUrl(path),
    removeAssets: async (paths) => (await data()).removeSparkAssets(paths),
  };
}

function defaultAdapterFactory() {
  return createGenerationAdapter({
    getAccessToken: async () => {
      try {
        const { supabase } = await import('../../lib/supabase');
        const { data } = (await supabase?.auth.getSession()) || {};
        return data?.session?.access_token || null;
      } catch {
        return null;
      }
    },
  });
}

// ---- store -----------------------------------------------------------------
export function createSparkStore({ storage, repo, adapterFactory, now = () => new Date().toISOString(), uuid = uuidv4 } = {}) {
  const store = resolveStorage(storage);
  const cloudRepo = repo || defaultRepo();
  let adapter = null;
  const getAdapter = () => {
    if (!adapter) adapter = (adapterFactory || defaultAdapterFactory)();
    return adapter;
  };

  const savedDraft = readJson(store, STORAGE_KEYS.draft, {});
  const savedMotion = readJson(store, STORAGE_KEYS.motion, {});
  const savedProfile = readJson(store, STORAGE_KEYS.profile, null);
  const savedIdeas = readJson(store, STORAGE_KEYS.ideas, { ideas: [] });

  const state = reactive({
    phase: 'idle',
    draft: {
      text: typeof savedDraft.text === 'string' ? savedDraft.text : '',
      fragments: normalizeFragments(savedDraft.fragments || {}),
      style: typeof savedDraft.style === 'string' ? savedDraft.style : 'luminous',
      imageName: '',
      voiceUsed: false,
      guided: false,
    },
    result: null,
    error: null,
    ideas: Array.isArray(savedIdeas.ideas) ? savedIdeas.ideas.filter((idea) => idea && typeof idea.id === 'string') : [],
    profile: savedProfile && typeof savedProfile === 'object' ? savedProfile : null,
    user: null,
    cloud: { configured: false, loading: false, error: null },
    storageError: null,
    motion: {
      paused: Boolean(savedMotion.paused),
      speed: Math.min(2, Math.max(0.25, Number(savedMotion.speed) || 1)),
      reduced: false,
      hidden: false,
    },
  });

  let genToken = 0;
  let controller = null;

  const writeStorage = (key, value) => {
    try {
      store.setItem(key, JSON.stringify(value));
      state.storageError = null;
    } catch (error) {
      state.storageError = { code: 'storage_failed', message: error?.message || 'Local storage is unavailable.' };
    }
  };

  const persistIdeas = () => {
    // Synced ideas live in the account; the browser only keeps local-only work.
    const keep = state.ideas
      .filter((idea) => idea.syncState !== 'synced')
      .map(({ syncing, assetUrl, ...rest }) => rest);
    writeStorage(STORAGE_KEYS.ideas, { version: 1, ideas: keep });
  };
  const persistDraft = () => writeStorage(STORAGE_KEYS.draft, { text: state.draft.text, fragments: state.draft.fragments, style: state.draft.style });
  const persistMotion = () => writeStorage(STORAGE_KEYS.motion, { paused: state.motion.paused, speed: state.motion.speed });

  const api = {
    state,

    // -- state machine --
    dispatch(event) {
      const next = transition(state.phase, event);
      if (!next) return false;
      state.phase = next;
      return true;
    },
    start() {
      state.error = null;
      return api.dispatch('START');
    },
    beginCapture() {
      state.draft.guided = true;
      return api.dispatch('BEGIN');
    },
    cancelCapture() {
      return api.dispatch('CANCEL');
    },
    newSpark() {
      api.cancelGeneration();
      api.resetDraft();
      state.result = null;
      state.error = null;
      state.phase = 'idle';
    },
    editInputs() {
      return api.dispatch('EDIT');
    },

    // -- draft --
    setDraft(patch = {}) {
      if (typeof patch.text === 'string') state.draft.text = patch.text.slice(0, 4000);
      if (patch.fragments) state.draft.fragments = { ...state.draft.fragments, ...patch.fragments };
      if (typeof patch.style === 'string') state.draft.style = patch.style;
      if (typeof patch.imageName === 'string') state.draft.imageName = patch.imageName;
      if (typeof patch.voiceUsed === 'boolean') state.draft.voiceUsed = patch.voiceUsed;
      persistDraft();
    },
    resetDraft() {
      state.draft.text = '';
      state.draft.fragments = {};
      state.draft.imageName = '';
      state.draft.voiceUsed = false;
      state.draft.guided = false;
      persistDraft();
    },
    canSubmit() {
      return hasCaptureContent({ text: state.draft.text, fragments: state.draft.fragments, image: state.draft.imageName ? {} : null });
    },

    // -- generation --
    get generationMode() {
      try { return getAdapter().isDemo ? 'demo' : 'remote'; } catch { return 'demo'; }
    },
    async generate({ language = 'zh' } = {}) {
      const from = state.phase;
      if (from !== 'capture' && from !== 'result') return null;
      if (!api.canSubmit()) {
        state.error = { code: 'empty_input', message: language === 'en' ? 'Add at least one cue first.' : '请先留下至少一条线索。' };
        return null;
      }
      api.dispatch(from === 'capture' ? 'SUBMIT' : 'REGENERATE');
      state.error = null;
      const token = ++genToken;
      controller = new AbortController();
      const input = buildGenerationInput({
        text: state.draft.text,
        fragments: state.draft.fragments,
        profile: state.profile,
        style: state.draft.style,
        hasReferenceImage: Boolean(state.draft.imageName),
        language,
      });
      try {
        const out = await getAdapter().generate(input, { signal: controller.signal });
        if (token !== genToken) return null;
        const previous = state.result;
        state.result = {
          ...out,
          input,
          title: previous?.title || autoTitle(out, input),
          savedIdeaId: previous?.savedIdeaId || null,
          inputMode: detectInputMode({ text: state.draft.text, fragments: state.draft.fragments, image: state.draft.imageName ? {} : null, voiceUsed: state.draft.voiceUsed, guided: state.draft.guided }),
          generationCount: (previous?.generationCount || 0) + 1,
        };
        api.dispatch('DONE');
        return state.result;
      } catch (error) {
        if (token !== genToken) return null;
        if (error?.code === 'aborted') {
          api.dispatch(from === 'result' && state.result ? 'RESTORE_RESULT' : 'CANCEL');
          return null;
        }
        state.error = { code: error?.code || 'generation_failed', message: error?.message || 'Generation failed.' };
        api.dispatch(from === 'result' && state.result ? 'RESTORE_RESULT' : 'FAIL');
        return null;
      } finally {
        if (token === genToken) controller = null;
      }
    },
    cancelGeneration() {
      if (state.phase !== 'reconstructing') return false;
      genToken += 1; // any in-flight result is now stale
      controller?.abort();
      controller = null;
      api.dispatch(state.result ? 'RESTORE_RESULT' : 'CANCEL');
      return true;
    },
    updateResult(patch = {}) {
      if (!state.result) return;
      const allowed = ['title', 'description', 'composition', 'tags', 'prompt'];
      for (const key of allowed) {
        if (key in patch) state.result[key] = key === 'tags' ? (patch.tags || []).map(String).slice(0, 20) : String(patch[key] ?? '');
      }
    },

    // -- ideas (Idea Capsules) --
    createIdea(partial = {}) {
      const stamp = now();
      const idea = {
        id: uuid(),
        title: '',
        rawInput: '',
        inputMode: 'mixed',
        sensoryProfile: {},
        visualDescription: '',
        generationPrompt: '',
        tags: [],
        assetPath: null,
        provenance: 'demo',
        composition: '',
        palette: [],
        style: 'luminous',
        fragments: {},
        visualSvg: null,
        imageUrl: null,
        syncState: 'local',
        inCloud: false,
        syncError: null,
        history: [],
        ...partial,
        createdAt: stamp,
        updatedAt: stamp,
      };
      state.ideas.unshift(idea);
      persistIdeas();
      return idea;
    },
    getIdea(id) {
      return state.ideas.find((idea) => idea.id === id) || null;
    },
    updateIdea(id, patch = {}, note = 'edit') {
      const idea = api.getIdea(id);
      if (!idea) return null;
      const promptChanged = typeof patch.generationPrompt === 'string' && patch.generationPrompt !== idea.generationPrompt;
      Object.assign(idea, patch);
      idea.updatedAt = now();
      if (promptChanged || note !== 'edit') {
        idea.history = [{ at: idea.updatedAt, prompt: idea.generationPrompt, note }, ...(idea.history || [])].slice(0, HISTORY_LIMIT);
      }
      if (idea.syncState === 'synced') idea.syncState = 'dirty';
      persistIdeas();
      return idea;
    },
    async deleteIdea(id) {
      const idea = api.getIdea(id);
      if (!idea) return { ok: true };
      if (idea.inCloud && state.user && state.cloud.configured) {
        const result = await cloudRepo.remove(id);
        if (!result?.ok) {
          idea.syncState = 'error';
          idea.syncError = result?.message || 'Could not delete the cloud copy.';
          persistIdeas();
          return { ok: false, message: idea.syncError };
        }
        if (idea.assetPath) await cloudRepo.removeAssets([idea.assetPath]);
      } else if (idea.inCloud) {
        return { ok: false, message: 'Sign in to delete the cloud copy.' };
      }
      const index = state.ideas.findIndex((item) => item.id === id);
      if (index >= 0) state.ideas.splice(index, 1);
      persistIdeas();
      return { ok: true };
    },
    listIdeas({ query = '', tag = '', mode = '', sync = '' } = {}) {
      const q = query.trim().toLowerCase();
      return state.ideas
        .filter((idea) => {
          if (tag && !(idea.tags || []).includes(tag)) return false;
          if (mode && idea.inputMode !== mode) return false;
          if (sync === 'local' && idea.syncState === 'synced') return false;
          if (sync === 'synced' && idea.syncState !== 'synced') return false;
          if (!q) return true;
          return [idea.title, idea.rawInput, idea.visualDescription, ...(idea.tags || [])].join(' ').toLowerCase().includes(q);
        })
        .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
    },
    allTags() {
      return [...new Set(state.ideas.flatMap((idea) => idea.tags || []))].sort();
    },
    saveResult() {
      const result = state.result;
      if (!result) return null;
      const payload = {
        title: result.title,
        rawInput: normalizeText(state.draft.text),
        inputMode: result.inputMode,
        sensoryProfile: state.profile?.dims ? { ...state.profile.dims } : {},
        visualDescription: result.description,
        generationPrompt: result.prompt,
        tags: [...(result.tags || [])],
        provenance: result.provenance,
        composition: result.composition,
        palette: [...(result.palette || [])],
        style: result.style,
        fragments: { ...state.draft.fragments },
        visualSvg: result.imageSvg || null,
        imageUrl: result.imageUrl || null,
      };
      const existing = result.savedIdeaId ? api.getIdea(result.savedIdeaId) : null;
      const idea = existing ? api.updateIdea(existing.id, payload, 'resave') : api.createIdea(payload);
      result.savedIdeaId = idea.id;
      return idea;
    },
    reopenIdea(id) {
      const idea = api.getIdea(id);
      if (!idea) return false;
      state.draft.text = idea.rawInput || '';
      state.draft.fragments = { ...(idea.fragments || {}) };
      state.draft.style = idea.style || 'luminous';
      state.draft.imageName = '';
      state.draft.voiceUsed = false;
      state.draft.guided = true;
      state.result = {
        provenance: idea.provenance,
        adapter: idea.provenance === 'ai' ? 'remote' : 'demo',
        imageSvg: idea.visualSvg,
        imageUrl: idea.imageUrl || idea.assetUrl || null,
        description: idea.visualDescription,
        composition: idea.composition,
        palette: idea.palette || [],
        tags: [...(idea.tags || [])],
        prompt: idea.generationPrompt,
        style: idea.style,
        title: idea.title,
        savedIdeaId: idea.id,
        inputMode: idea.inputMode,
        generationCount: 0,
        input: null,
      };
      state.phase = 'result';
      return true;
    },

    // -- cloud --
    setCloud({ configured }) {
      state.cloud.configured = Boolean(configured);
    },
    setUser(user) {
      const previous = state.user;
      state.user = user ? { id: user.id, label: user.label || user.email || '' } : null;
      if (previous && !user) {
        // Cloud copies follow the account: do not leave them on a shared device.
        state.ideas = state.ideas.filter((idea) => idea.syncState !== 'synced');
        persistIdeas();
      }
    },
    get canSync() {
      return Boolean(state.user && state.cloud.configured);
    },
    async syncIdea(id) {
      const idea = api.getIdea(id);
      if (!idea) return { ok: false, message: 'Idea not found.' };
      if (!state.cloud.configured) return fail(idea, 'not_configured', 'Cloud sync is not configured for this build.');
      if (!state.user) return fail(idea, 'not_signed_in', 'Sign in to sync to the cloud.');
      idea.syncing = true;
      idea.syncError = null;
      try {
        let assetPath = idea.assetPath;
        if (idea.visualSvg) {
          const upload = await cloudRepo.upload(state.user.id, idea.id, new Blob([idea.visualSvg], { type: 'image/svg+xml' }), 'svg', 'image/svg+xml');
          if (!upload?.ok) return fail(idea, upload?.reason || 'upload_failed', upload?.message || 'Preview upload failed.');
          assetPath = upload.path;
        }
        const row = ideaToRow({ ...idea, assetPath }, state.user.id);
        const saved = await cloudRepo.save(row);
        if (!saved?.ok) return fail(idea, saved?.reason || 'write_failed', saved?.message || 'Cloud save failed.');
        idea.assetPath = assetPath;
        idea.inCloud = true;
        idea.syncState = 'synced';
        idea.syncError = null;
        persistIdeas();
        return { ok: true };
      } catch (error) {
        return fail(idea, 'sync_failed', error?.message || 'Cloud sync failed.');
      } finally {
        idea.syncing = false;
      }
    },
    async syncAll() {
      const pending = state.ideas.filter((idea) => idea.syncState !== 'synced').map((idea) => idea.id);
      const results = [];
      for (const id of pending) results.push(await api.syncIdea(id));
      return { ok: results.every((r) => r.ok), count: results.length };
    },
    async loadCloud() {
      if (!state.user || !state.cloud.configured) return { ok: false, message: 'not_available' };
      state.cloud.loading = true;
      state.cloud.error = null;
      try {
        const result = await cloudRepo.list();
        if (!result?.ok) {
          state.cloud.error = { code: result?.reason || 'query_failed', message: result?.message || 'Could not load cloud ideas.' };
          return { ok: false, message: state.cloud.error.message };
        }
        const cloudIds = new Set();
        for (const row of result.data) {
          const incoming = rowToIdea(row);
          cloudIds.add(incoming.id);
          const local = api.getIdea(incoming.id);
          if (!local) {
            state.ideas.push(incoming);
          } else if (local.syncState === 'synced' || String(incoming.updatedAt) >= String(local.updatedAt)) {
            Object.assign(local, { ...incoming, visualSvg: local.visualSvg || null, history: local.history || [] });
          } else {
            local.inCloud = true;
          }
        }
        state.ideas = state.ideas.filter((idea) => !(idea.syncState === 'synced' && !cloudIds.has(idea.id)));
        persistIdeas();
        return { ok: true, count: result.data.length };
      } finally {
        state.cloud.loading = false;
      }
    },
    async ensureAssetUrl(id) {
      const idea = api.getIdea(id);
      if (!idea || idea.visualSvg || idea.imageUrl || idea.assetUrl || !idea.assetPath) return null;
      const result = await cloudRepo.assetUrl(idea.assetPath);
      if (result?.ok && result.url) idea.assetUrl = result.url;
      return idea.assetUrl || null;
    },

    // -- privacy: export and delete --
    exportData() {
      return {
        app: 'aloop-spark',
        version: 1,
        exportedAt: now(),
        note: 'Spark exports contain only text and visuals you saved. No EEG data or audio is collected by Spark.',
        imageryProfile: state.profile,
        ideas: state.ideas.map(({ syncing, assetUrl, ...rest }) => rest),
      };
    },
    async deleteAllData() {
      const paths = state.ideas.map((idea) => idea.assetPath).filter(Boolean);
      let cloud = { attempted: false, ok: true, message: '' };
      if (state.user && state.cloud.configured) {
        cloud.attempted = true;
        const removed = await cloudRepo.removeAll();
        if (!removed?.ok) cloud = { attempted: true, ok: false, message: removed?.message || 'Cloud deletion failed.' };
        else if (paths.length) await cloudRepo.removeAssets(paths);
      }
      if (cloud.attempted && !cloud.ok) return { ok: false, local: false, cloud };
      state.ideas = [];
      state.profile = null;
      api.resetDraft();
      state.result = null;
      state.phase = 'idle';
      for (const key of Object.values(STORAGE_KEYS)) {
        try { store.removeItem(key); } catch { /* ignore */ }
      }
      return { ok: true, local: true, cloud };
    },

    // -- imagery profile --
    saveProfile(dims) {
      const clean = {};
      for (const key of IMAGERY_DIMENSIONS) clean[key] = Math.min(5, Math.max(0, Math.round(Number(dims?.[key]) || 0)));
      state.profile = { dims: clean, updatedAt: now(), skipped: false };
      writeStorage(STORAGE_KEYS.profile, state.profile);
      return state.profile;
    },
    skipCalibration() {
      state.profile = { dims: null, updatedAt: now(), skipped: true };
      writeStorage(STORAGE_KEYS.profile, state.profile);
    },
    clearProfile() {
      state.profile = null;
      try { store.removeItem(STORAGE_KEYS.profile); } catch { /* ignore */ }
    },

    // -- motion controls --
    get shouldAnimate() {
      return !state.motion.paused && !state.motion.reduced && !state.motion.hidden;
    },
    togglePause() {
      state.motion.paused = !state.motion.paused;
      persistMotion();
      return state.motion.paused;
    },
    setPaused(value) {
      state.motion.paused = Boolean(value);
      persistMotion();
    },
    setSpeed(value) {
      state.motion.speed = Math.min(2, Math.max(0.25, Number(value) || 1));
      persistMotion();
    },
    setReducedMotion(value) {
      state.motion.reduced = Boolean(value);
    },
    setHidden(value) {
      state.motion.hidden = Boolean(value);
    },
  };

  function fail(idea, code, message) {
    idea.syncing = false;
    idea.syncState = idea.inCloud ? 'dirty' : 'error';
    idea.syncError = message;
    persistIdeas();
    return { ok: false, reason: code, message };
  }

  return api;
}

let singleton = null;
export function useSparkStore() {
  if (!singleton) singleton = createSparkStore();
  return singleton;
}
export function setSparkStoreForTests(store) {
  singleton = store;
}
export function resetSparkStoreForTests() {
  singleton = null;
}
