/* Atlas store: single source of truth for Smart Brain Explore. Scene and sidebar only talk through this. */
(function () {
  const Aloop = window.Aloop = window.Aloop || {};
  const atlas = Aloop.atlas = Aloop.atlas || {};
  const fresh = () => ({
    selectedId: null, hoverId: null, query: "",
    hiddenCats: new Set(), hiddenIds: new Set(), expanded: new Set(),
    side: "both", cortexOpacity: 1, isolate: false, autoFocus: true,
  });
  let state = fresh();
  const subs = new Set();
  let pending = null;
  function emit(change, source) {
    change.source = source || "api";
    if (pending) { Object.assign(pending, change); return; }
    pending = change;
    queueMicrotask(() => {
      const p = pending; pending = null;
      subs.forEach(fn => { try { fn(state, p); } catch (e) { console.error("atlas subscriber failed", e); } });
    });
  }
  atlas.store = {
    get: () => state,
    subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
    select(id, source) { if (!id) return this.clear(source); if (state.selectedId === id) return; state.selectedId = id; emit({ selected: true }, source); },
    clear(source) { if (!state.selectedId && !state.isolate) return; state.selectedId = null; state.isolate = false; emit({ selected: true, layers: true }, source); },
    hover(id, source) { id = id || null; if (state.hoverId === id) return; state.hoverId = id; emit({ hover: true }, source); },
    setQuery(q, source) { q = String(q || ""); if (state.query === q) return; state.query = q; emit({ query: true }, source || "sidebar"); },
    setCategoryHidden(cat, hidden) { if (state.hiddenCats.has(cat) === hidden) return; hidden ? state.hiddenCats.add(cat) : state.hiddenCats.delete(cat); emit({ layers: true }, "sidebar"); },
    setIdHidden(id, hidden) { if (state.hiddenIds.has(id) === hidden) return; hidden ? state.hiddenIds.add(id) : state.hiddenIds.delete(id); emit({ layers: true }, "sidebar"); },
    toggleExpanded(cat, open) { open = open ?? !state.expanded.has(cat); open ? state.expanded.add(cat) : state.expanded.delete(cat); emit({ expanded: true }, "sidebar"); },
    setSide(side) { if (state.side === side) return; state.side = side; emit({ layers: true }, "sidebar"); },
    setCortexOpacity(v) { v = Math.max(0, Math.min(1, +v)); if (state.cortexOpacity === v) return; state.cortexOpacity = v; emit({ layers: true }, "sidebar"); },
    setIsolate(on) { on = !!on; if (state.isolate === on) return; state.isolate = on; emit({ layers: true, refit: on }, "sidebar"); },
    setAutoFocus(on) { state.autoFocus = !!on; emit({ settings: true }, "sidebar"); },
    focus() { emit({ focus: true }, "sidebar"); },
    reset() { const keep = state.autoFocus; state = fresh(); state.autoFocus = keep; emit({ selected: true, layers: true, query: true, expanded: true, reset: true }, "sidebar"); },
    _resetAll() { state = fresh(); pending = null; },   // used on view teardown and by tests
  };
})();
