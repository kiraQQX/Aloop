// Store + data logic without a browser. Usage: node tests/atlas_store.test.js
global.window = global; global.document = { dispatchEvent() {} }; global.CustomEvent = class { constructor(n) { this.type = n; } };
require("../assets/js/smartbrain/atlas/store.js"); require("../assets/js/smartbrain/atlas/cards.js"); require("../assets/js/smartbrain/atlas/data.js");
const assert = require("assert"), { store, data } = global.Aloop.atlas;
const tick = () => new Promise(r => queueMicrotask(r));
(async () => {
  assert(data.ingest([
    { bx_id: "a1", bx_label: "Precentral gyrus, left", bx_cat: "cortex", bx_side: "left", ta2_path: "Telencephalon › Frontal lobe › Precentral gyrus" },
    { bx_id: "a2", bx_label: "Precentral gyrus, right", bx_cat: "cortex", bx_side: "right" },
    { bx_id: "t1", bx_label: "Thalamus", bx_cat: "deep_grey", bx_side: "median" },
  ]), "ingest");
  assert.strictEqual(data.byId.get("a1").key, "precentral-gyrus"); assert.strictEqual(data.byId.get("a2").key, "precentral-gyrus", "L/R share a card key");
  assert.deepStrictEqual(data.byId.get("a1").path, ["Telencephalon", "Frontal lobe", "Precentral gyrus"]);
  assert(data.ingest({ structures: [{ id: "x", label: "X" }] }) && data.items.length === 1, "alternate manifest shape");
  data.ingest([{ bx_id: "a1", bx_label: "Precentral gyrus, left", bx_cat: "cortex", bx_side: "left" }, { bx_id: "a2", bx_label: "Precentral gyrus, right", bx_cat: "cortex", bx_side: "right" }, { bx_id: "t1", bx_label: "Thalamus", bx_cat: "deep_grey", bx_side: "median" }]);

  const log = []; const off = store.subscribe((s, ch) => log.push([s.selectedId, ch.source, !!ch.selected]));
  store.select("a1", "scene"); store.select("a1", "scene"); await tick();
  assert.strictEqual(log.length, 1, "idempotent + coalesced"); assert.deepStrictEqual(log[0], ["a1", "scene", true]);
  store.select("t1", "sidebar"); await tick(); assert.strictEqual(log[1][1], "sidebar");
  store.clear("scene"); await tick(); assert.strictEqual(store.get().selectedId, null);

  let s = store.get(), v = id => data.visibility(data.byId.get(id), store.get());
  assert(v("a1").pickable && v("t1").pickable);
  store.setSide("right"); assert(v("a1").hidden && !v("a2").hidden, "side filter");
  store.setSide("both"); store.setQuery("thalamus"); assert(v("a1").faded && !v("a1").pickable && v("t1").pickable, "search fades non-matches");
  store.setQuery("丘脑"); assert(v("t1").matched, "zh search via card names");
  store.setQuery(""); store.setCategoryHidden("cortex", true); assert(v("a1").hidden); store.setCategoryHidden("cortex", false);
  store.setCortexOpacity(0.1); assert(!v("a1").pickable && v("t1").pickable, "near-transparent cortex not pickable"); store.setCortexOpacity(1);
  store.select("t1", "sidebar"); store.setIsolate(true); assert(v("a1").hidden && !v("t1").hidden, "isolate selection");
  store.reset(); await tick(); s = store.get(); assert(!s.isolate && !s.selectedId && s.query === "");
  assert(data.byKey.get("thalamus") === data.byId.get("t1"));
  const html = global.Aloop.atlas.cards.html(data.byId.get("t1"), store.get()); assert(html.includes("atlas-card") );
  off(); console.log("atlas store/data tests OK");
})().catch(e => { console.error(e); process.exit(1); });
