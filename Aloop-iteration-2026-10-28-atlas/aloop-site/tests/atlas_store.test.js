import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

let store;
let data;
let cards;

beforeAll(async () => {
  await import('../assets/js/smartbrain/atlas/store.js');
  await import('../assets/js/smartbrain/atlas/cards.js');
  await import('../assets/js/smartbrain/atlas/data.js');
  ({ store, data } = window.Aloop.atlas);
  cards = window.Aloop.atlas.cards;
});

beforeEach(() => {
  store.reset();
  data.ingest([
    { bx_id: 'a1', bx_label: 'Precentral gyrus, left', bx_cat: 'cortex', bx_side: 'left', ta2_path: 'Telencephalon › Frontal lobe › Precentral gyrus' },
    { bx_id: 'a2', bx_label: 'Precentral gyrus, right', bx_cat: 'cortex', bx_side: 'right' },
    { bx_id: 't1', bx_label: 'Thalamus', bx_cat: 'deep_grey', bx_side: 'median' },
  ]);
});

afterAll(() => {
  store?.reset();
});

const tick = () => new Promise((resolve) => queueMicrotask(resolve));
const visibility = (id) => data.visibility(data.byId.get(id), store.get());

describe('Smart Brain atlas store and data', () => {
  it('normalizes bilateral structures to one shared card key and parses anatomy paths', () => {
    expect(data.byId.get('a1').key).toBe('precentral-gyrus');
    expect(data.byId.get('a2').key).toBe('precentral-gyrus');
    expect(data.byId.get('a1').path).toEqual(['Telencephalon', 'Frontal lobe', 'Precentral gyrus']);
  });

  it('accepts the alternate manifest shape', () => {
    expect(data.ingest({ structures: [{ id: 'x', label: 'X' }] })).toBe(true);
    expect(data.items).toHaveLength(1);
    expect(data.items[0].id).toBe('x');
  });

  it('coalesces duplicate selections and preserves selection source', async () => {
    const events = [];
    const unsubscribe = store.subscribe((state, change) => events.push([state.selectedId, change.source, Boolean(change.selected)]));
    store.select('a1', 'scene');
    store.select('a1', 'scene');
    await tick();
    expect(events).toEqual([['a1', 'scene', true]]);
    store.select('t1', 'sidebar');
    await tick();
    expect(events[1][1]).toBe('sidebar');
    store.clear('scene');
    await tick();
    expect(store.get().selectedId).toBeNull();
    unsubscribe();
  });

  it('applies side, search, category, opacity, and isolate filters', () => {
    expect(visibility('a1').pickable).toBe(true);
    expect(visibility('t1').pickable).toBe(true);
    store.setSide('right');
    expect(visibility('a1').hidden).toBe(true);
    expect(visibility('a2').hidden).toBe(false);
    store.setSide('both');
    store.setQuery('thalamus');
    expect(visibility('a1').faded).toBe(true);
    expect(visibility('a1').pickable).toBe(false);
    expect(visibility('t1').pickable).toBe(true);
    store.setQuery('丘脑');
    expect(visibility('t1').matched).toBe(true);
    store.setQuery('');
    store.setCategoryHidden('cortex', true);
    expect(visibility('a1').hidden).toBe(true);
    store.setCategoryHidden('cortex', false);
    store.setCortexOpacity(0.1);
    expect(visibility('a1').pickable).toBe(false);
    expect(visibility('t1').pickable).toBe(true);
    store.setCortexOpacity(1);
    store.select('t1', 'sidebar');
    store.setIsolate(true);
    expect(visibility('a1').hidden).toBe(true);
    expect(visibility('t1').hidden).toBe(false);
  });

  it('resets state, resolves shared keys, and renders anatomy cards', () => {
    store.select('t1', 'sidebar');
    store.setIsolate(true);
    store.setQuery('丘脑');
    store.reset();
    const state = store.get();
    expect(state.isolate).toBe(false);
    expect(state.selectedId).toBeNull();
    expect(state.query).toBe('');
    expect(data.byKey.get('thalamus')).toBe(data.byId.get('t1'));
    expect(cards.html(data.byId.get('t1'), state)).toContain('atlas-card');
  });
});
