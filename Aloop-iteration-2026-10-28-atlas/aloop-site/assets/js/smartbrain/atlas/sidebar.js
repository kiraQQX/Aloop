/* Atlas sidebar + view lifecycle. Talks to the scene only through atlas.store. Works before/without the model. */
(function () {
  const Aloop = window.Aloop = window.Aloop || {};
  const atlas = Aloop.atlas = Aloop.atlas || {};
  const t = (k, v) => { let s = Aloop.i18n?.t(k) ?? k; if (v) for (const x in v) s = s.replace(`{${x}}`, v[x]); return s; };
  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const PAGE = 120;
  let view = null;

  function mount(container, routeId) {
    destroy();
    const store = atlas.store, data = atlas.data, cards = atlas.cards;
    store._resetAll();
    if (routeId) store.select(routeId, "hash");
    const v = view = { dead: false, ac: new AbortController(), limit: {}, speaking: false, provider: null, timer: 0 };
    const { signal } = v.ac;

    container.innerHTML = `<div class="atlas-layout">
      <section class="atlas-stage" id="atlasStage" aria-label="${esc(t("atlas.title"))}">
        <div class="atlas-loading" data-atlas-status role="status" aria-live="polite">${esc(t("atlas.loadingModel"))}</div>
        <div class="atlas-hint" aria-hidden="true">${esc(t("atlas.hint"))}</div>
        <div class="atlas-foot">Z-Anatomy / BodyParts3D · CC BY-SA 4.0 · <a href="https://github.com/itayinbarr/brainproject" target="_blank" rel="noopener noreferrer">${esc(t("atlas.source"))}</a></div>
      </section>
      <aside class="atlas-side" id="atlasSide" aria-label="${esc(t("atlas.panel"))}"></aside></div>`;
    const stage = container.querySelector("#atlasStage"), side = container.querySelector("#atlasSide");
    const status = stage.querySelector("[data-atlas-status]");

    function buildSide() {
      const s = store.get();
      side.innerHTML = `<div class="atlas-search"><input id="atlasSearch" type="search" autocomplete="off" spellcheck="false" placeholder="${esc(t("atlas.searchPh"))}" aria-label="${esc(t("atlas.search"))}" value="${esc(s.query)}"><span class="atlas-count" id="atlasCount" aria-live="polite"></span></div>
        <div class="atlas-cardhost" id="atlasCard" aria-live="polite"></div>
        <div class="atlas-controls">
          <div class="atlas-seg" role="group" aria-label="${esc(t("atlas.side"))}">${["both", "left", "right"].map(k => `<button type="button" data-act="side" data-side="${k}" aria-pressed="${s.side === k}">${esc(t("atlas.side." + k))}</button>`).join("")}</div>
          <label class="atlas-range">${esc(t("atlas.opacity"))}<input id="atlasOpacity" type="range" min="0" max="1" step="0.05" value="${s.cortexOpacity}"></label>
          <label class="atlas-check"><input id="atlasAuto" type="checkbox" ${s.autoFocus ? "checked" : ""}> ${esc(t("atlas.autofocus"))}</label>
          <button type="button" class="atlas-reset" data-act="reset">${esc(t("atlas.reset"))}</button>
        </div>
        <h2 class="atlas-h">${esc(t("atlas.layers"))}</h2><div class="atlas-list" id="atlasList"></div>`;
      renderAll();
    }
    const $ = id => side.querySelector(id);
    const catOpen = (s, cat) => s.query.trim() ? true : s.expanded.has(cat);

    function renderCount() {
      const s = store.get(), el = $("#atlasCount"); if (!el) return;
      if (!data.ready) { el.textContent = t("atlas.listLoading"); return; }
      el.textContent = s.query.trim() ? t("atlas.count", { n: data.items.filter(it => data.matches(it, s.query)).length, total: data.items.length }) : "";
    }
    function renderList() {
      const s = store.get(), host = $("#atlasList"); if (!host) return;
      if (!data.ready) { host.innerHTML = `<p class="atlas-empty">${esc(t("atlas.listLoading"))}</p>`; return; }
      const q = s.query.trim(), parts = [];
      for (const { cat, list } of data.cats) {
        const rows = q ? list.filter(it => data.matches(it, q)) : list;
        if (q && !rows.length) continue;
        const open = catOpen(s, cat), lim = v.limit[cat] || PAGE;
        const hiddenN = list.filter(it => s.hiddenIds.has(it.id)).length;
        parts.push(`<section class="atlas-cat"><div class="atlas-cathead"><input type="checkbox" data-act="cat-vis" data-cat="${esc(cat)}" ${s.hiddenCats.has(cat) ? "" : "checked"} data-partial="${hiddenN > 0 && hiddenN < list.length}" aria-label="${esc(cards.catName(cat))}"><button type="button" class="atlas-cattoggle" data-act="toggle" data-cat="${esc(cat)}" aria-expanded="${open}"><span class="atlas-caret" aria-hidden="true">${open ? "▾" : "▸"}</span><span class="atlas-dot" style="background:${data.colorOf(cat)}"></span>${esc(cards.catName(cat))}<span class="atlas-n">${rows.length}</span></button></div>`
          + (open ? `<ul class="atlas-rows">${rows.slice(0, lim).map(it => {
            const sd = it.side === "left" || it.side === "right" ? `<span class="atlas-side-tag">${esc(t("atlas.side." + it.side))}</span>` : "";
            return `<li class="atlas-row${s.selectedId === it.id ? " is-selected" : ""}" data-row="${esc(it.id)}"><input type="checkbox" data-act="row-vis" data-id="${esc(it.id)}" ${s.hiddenIds.has(it.id) ? "" : "checked"} aria-label="${esc(cards.nameOf(it))}"><button type="button" class="atlas-name" data-act="select" data-id="${esc(it.id)}" ${s.selectedId === it.id ? 'aria-current="true"' : ""}>${esc(cards.nameOf(it))}</button>${sd}</li>`;
          }).join("")}${rows.length > lim ? `<li><button type="button" class="atlas-more" data-act="more" data-cat="${esc(cat)}">${esc(t("atlas.more", { n: rows.length - lim }))}</button></li>` : ""}</ul>` : "") + `</section>`);
      }
      host.innerHTML = parts.join("") || `<p class="atlas-empty">${esc(t("atlas.noMatch"))}</p>`;
      host.querySelectorAll('input[data-partial="true"]').forEach(cb => { cb.indeterminate = true; });
    }
    function renderCard() {
      const s = store.get(), host = $("#atlasCard"); if (!host) return;
      const it = s.selectedId && data.byId.get(s.selectedId);
      host.innerHTML = it ? cards.html(it, s) : `<p class="atlas-placeholder">${esc(t("atlas.empty"))}</p>`;
    }
    function renderControls() {
      const s = store.get();
      side.querySelectorAll("[data-side]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.side === s.side)));
      const o = $("#atlasOpacity"); if (o && +o.value !== s.cortexOpacity) o.value = s.cortexOpacity;
      const a = $("#atlasAuto"); if (a) a.checked = s.autoFocus;
    }
    function renderAll() { renderCount(); renderList(); renderCard(); renderControls(); }
    function syncSelected(s, source) {
      side.querySelectorAll(".atlas-row.is-selected").forEach(r => { r.classList.remove("is-selected"); r.querySelector(".atlas-name")?.removeAttribute("aria-current"); });
      const it = s.selectedId && data.byId.get(s.selectedId); if (!it) return;
      if (source !== "sidebar" && !catOpen(s, it.cat)) { store.toggleExpanded(it.cat, true); return; }   // re-render then re-sync
      const row = side.querySelector(`[data-row="${CSS.escape(it.id)}"]`);
      if (row) { row.classList.add("is-selected"); row.querySelector(".atlas-name")?.setAttribute("aria-current", "true"); if (source !== "sidebar") requestAnimationFrame(() => row.scrollIntoView({ block: "nearest", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" })); }
    }
    function stopSpeech() { v.provider?.cancel(); v.speaking = false; }
    async function listen() {
      const s = store.get(), it = s.selectedId && data.byId.get(s.selectedId); if (!it) return;
      if (v.speaking) { stopSpeech(); return; }
      v.provider = v.provider || new Aloop.narration.WebSpeechProvider();
      if (!v.provider.supported) return;
      const lang = Aloop.i18n.lang, voices = await v.provider.voicesFor(lang);
      v.speaking = true; v.provider.on("end", () => { v.speaking = false; }); v.provider.on("error", () => { v.speaking = false; });
      v.provider.speak(cards.narration(it), { lang, voice: voices[0], rate: 1, start: 0 });
    }

    /* ---- events ---- */
    side.addEventListener("click", e => {
      const b = e.target.closest("[data-act]"); if (!b || b.tagName === "INPUT") return;
      const s = store.get(), act = b.dataset.act;
      if (act === "select") store.select(b.dataset.id, "sidebar");
      else if (act === "close") store.clear("sidebar");
      else if (act === "focus") store.focus();
      else if (act === "isolate") store.setIsolate(!s.isolate);
      else if (act === "listen") listen();
      else if (act === "copy") { const link = location.origin + location.pathname + "#/smart-brain/atlas/" + encodeURIComponent(s.selectedId); navigator.clipboard?.writeText(link).then(() => { b.textContent = t("atlas.copied"); setTimeout(() => { if (!v.dead) b.textContent = t("atlas.copy"); }, 1400); }, () => {}); }
      else if (act === "crumb") { const i = $("#atlasSearch"); i.value = b.dataset.q; store.setQuery(b.dataset.q, "sidebar"); }
      else if (act === "toggle") store.toggleExpanded(b.dataset.cat);
      else if (act === "more") { v.limit[b.dataset.cat] = (v.limit[b.dataset.cat] || PAGE) + PAGE; renderList(); }
      else if (act === "side") store.setSide(b.dataset.side);
      else if (act === "reset") { store.reset(); const i = $("#atlasSearch"); if (i) i.value = ""; }
    }, { signal });
    side.addEventListener("change", e => {
      const a = e.target.dataset.act;
      if (a === "cat-vis") store.setCategoryHidden(e.target.dataset.cat, !e.target.checked);
      else if (a === "row-vis") store.setIdHidden(e.target.dataset.id, !e.target.checked);
      else if (e.target.id === "atlasAuto") store.setAutoFocus(e.target.checked);
    }, { signal });
    side.addEventListener("input", e => {
      if (e.target.id === "atlasSearch") { clearTimeout(v.timer); v.timer = setTimeout(() => store.setQuery(e.target.value, "sidebar"), 120); }
      else if (e.target.id === "atlasOpacity") store.setCortexOpacity(e.target.value);
    }, { signal });
    side.addEventListener("keydown", e => {
      if (e.key === "Escape") { if (e.target.id === "atlasSearch" && e.target.value) { e.target.value = ""; store.setQuery("", "sidebar"); } else store.clear("sidebar"); }
    }, { signal });
    const rowId = e => e.target.closest?.("[data-row]")?.dataset.row || null;
    side.addEventListener("pointerover", e => { const id = rowId(e); if (id) store.hover(id, "sidebar"); }, { signal });
    side.addEventListener("pointerout", e => { if (rowId(e) && !e.relatedTarget?.closest?.("[data-row]")) store.hover(null, "sidebar"); }, { signal });
    side.addEventListener("focusin", e => { const id = rowId(e); if (id) store.hover(id, "sidebar"); }, { signal });
    side.addEventListener("focusout", e => { if (rowId(e)) store.hover(null, "sidebar"); }, { signal });
    document.addEventListener("keydown", e => { if (e.key === "/" && !/input|textarea|select/i.test(document.activeElement?.tagName || "")) { e.preventDefault(); $("#atlasSearch")?.focus(); } }, { signal });
    document.addEventListener("aloop:language", () => { stopSpeech(); buildSide(); status.textContent = status.dataset.state ? t(status.dataset.state) : ""; stage.querySelector(".atlas-hint").textContent = t("atlas.hint"); }, { signal });
    document.addEventListener("aloop:atlas-data", () => {
      const s = store.get();
      if (s.selectedId && !data.byId.has(s.selectedId)) { store.clear("hash"); const c = $("#atlasCount"); if (c) c.textContent = t("atlas.notFound"); }
      renderAll(); if (s.selectedId && data.byId.has(s.selectedId)) syncSelected(s, "hash");
    }, { signal });
    window.addEventListener("pagehide", stopSpeech, { signal });

    v.unsub = store.subscribe((s, ch) => {
      if (ch.selected) { stopSpeech(); const h = "#/smart-brain/atlas" + (s.selectedId ? "/" + encodeURIComponent(s.selectedId) : ""); if (location.hash !== h) history.replaceState(null, "", h); }
      if (ch.query || ch.layers || ch.expanded || ch.reset) renderList();
      if (ch.query || ch.layers) renderCount();
      if (ch.selected || ch.layers) renderCard();
      if (ch.layers || ch.settings || ch.reset) renderControls();
      if (ch.selected || ch.expanded) syncSelected(s, ch.source);
      if (ch.hover) { side.querySelectorAll(".atlas-row.is-hover").forEach(r => r.classList.remove("is-hover")); if (s.hoverId && ch.source !== "sidebar") side.querySelector(`[data-row="${CSS.escape(s.hoverId)}"]`)?.classList.add("is-hover"); }
    });

    buildSide();
    const setState = k => { status.dataset.state = k; status.textContent = k ? t(k) : ""; status.hidden = !k; };
    atlas.assets.loadManifest();   // sidebar fills as soon as this resolves, independent of the model
    atlas.scene.mount(stage, { progress: p => { if (!v.dead) status.textContent = t("atlas.loadingModel") + " " + Math.round(p * 100) + "%"; }, ready: () => setState(""), fail: () => setState("atlas.modelFail") })
      .catch(err => { console.error("Atlas model failed", err); if (!v.dead) setState("atlas.modelFail"); });
  }

  function select(id) { if (view && id) atlas.store.select(id, "hash"); }
  function destroy() {
    if (!view) return;
    view.dead = true; clearTimeout(view.timer); view.provider?.cancel(); view.ac.abort(); view.unsub?.();
    atlas.scene.destroy(); atlas.store._resetAll(); view = null;
  }
  atlas.view = { mount, destroy, select };
})();
