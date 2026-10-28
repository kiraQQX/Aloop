/* Atlas data: tolerant manifest normaliser, indexes, search and the single visibility function. */
(function () {
  const Aloop = window.Aloop = window.Aloop || {};
  const atlas = Aloop.atlas = Aloop.atlas || {};
  const pick = (o, ...ks) => { for (const k of ks) if (o && o[k] != null && o[k] !== "") return o[k]; };
  const SIDE = /(?:^|[\s,(_-])(left|right|dexter|sinister|lt|rt|l|r)(?:$|[\s,)_-])/gi;
  const slug = s => String(s || "").toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-").replace(/^-+|-+$/g, "");
  const keyOf = label => slug(String(label || "").replace(SIDE, " ").replace(/\s{2,}/g, " "));
  const PALETTE = ["#4f82ad", "#3a9fa8", "#8f7ab8", "#c9873a", "#5a9a6e", "#b25a6a", "#7a8aa0", "#a8a04a"];
  const FIXED = { cortex: "#6696c1", tracts: "#c9873a", arteries: "#c24b4b", cranial_nerves: "#d9b333", ventricles: "#5ab7bd" };
  const colorOf = cat => FIXED[cat] || PALETTE[[...String(cat)].reduce((a, c) => a + c.charCodeAt(0), 0) % PALETTE.length];

  function listOf(raw) {
    if (Array.isArray(raw)) return raw;
    if (raw && typeof raw === "object") {
      for (const k of ["structures", "items", "meshes", "nodes", "entries"]) if (Array.isArray(raw[k])) return raw[k];
      return Object.entries(raw).map(([id, v]) => (v && typeof v === "object" ? { id, ...v } : null)).filter(Boolean);
    }
    return [];
  }
  function normalise(o, i) {
    const id = pick(o, "bx_id", "id", "name"); if (id == null) return null;
    const label = String(pick(o, "bx_label", "label", "name") ?? id);
    let path = pick(o, "ta2_path", "ta2Path", "ta2", "path", "ancestors");
    if (typeof path === "string") path = path.split(/\s*(?:›|>|\/|»)\s*/).filter(Boolean);
    return { id: String(id), label, key: keyOf(label), cat: String(pick(o, "bx_cat", "category", "cat") ?? "other"),
      side: String(pick(o, "bx_side", "side") ?? "median").toLowerCase(), region: String(pick(o, "bx_region", "region") ?? ""), path: Array.isArray(path) ? path.map(String) : [], order: i };
  }

  const data = atlas.data = {
    ready: false, origin: null, items: [], byId: new Map(), byKey: new Map(), cats: [], slug, keyOf, colorOf, _w: [],
    ingest(raw, origin) {
      const seen = new Set(), items = [];
      listOf(raw).forEach((o, i) => { const it = normalise(o, i); if (it && !seen.has(it.id)) { seen.add(it.id); it._hay = null; items.push(it); } });
      if (!items.length) return false;
      data.items = items; data.origin = origin || "manifest";
      data.byId = new Map(items.map(it => [it.id, it]));
      data.byKey = new Map(); items.forEach(it => { if (!data.byKey.has(it.key)) data.byKey.set(it.key, it); });
      const m = new Map(); items.forEach(it => { if (!m.has(it.cat)) m.set(it.cat, []); m.get(it.cat).push(it); });
      data.cats = [...m.entries()].map(([cat, list]) => ({ cat, list: list.sort((a, b) => a.label.localeCompare(b.label) || a.side.localeCompare(b.side)) }));
      data.ready = true; data._w.splice(0).forEach(fn => fn());
      document.dispatchEvent(new CustomEvent("aloop:atlas-data"));
      return true;
    },
    whenReady(fn) { data.ready ? fn() : data._w.push(fn); },
    haystack(it) {
      const c = atlas.cards;
      return it._hay || (it._hay = [it.label, c ? c.nameOf(it, "zh") : "", c ? c.nameOf(it, "en") : "", it.region, it.path.join(" "), it.cat, c ? c.catName(it.cat, "zh") : "", c ? c.catName(it.cat, "en") : ""].join(" ").toLowerCase());
    },
    matches(it, q) { q = String(q || "").trim().toLowerCase(); if (!q) return true; const h = data.haystack(it); return q.split(/\s+/).every(tok => h.includes(tok)); },
    /* One function decides what is on, faded and pickable, so list rows and meshes can never disagree. */
    visibility(it, s) {
      const q = s.query.trim();
      const matched = !q || data.matches(it, q);
      const isoActive = s.isolate && (q || s.selectedId);
      const isolatedOut = isoActive && (q ? !matched : it.id !== s.selectedId);
      const sideOff = (it.side === "left" && s.side === "right") || (it.side === "right" && s.side === "left");
      const hidden = s.hiddenCats.has(it.cat) || s.hiddenIds.has(it.id) || sideOff || !!isolatedOut;
      const faded = !hidden && !!q && !matched;
      const cortexFaint = it.cat === "cortex" && s.cortexOpacity <= 0.15;
      return { hidden, faded, matched, pickable: !hidden && !faded && !cortexFaint };
    },
  };
})();
