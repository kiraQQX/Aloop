/* Smart Brain view: overview + Learn module with narration controls (CHG-1, CHG-3). */
(function () {
  const Aloop = window.Aloop = window.Aloop || {};
  const root = document.getElementById("smartbrainView");
  if (!root) return;
  const t = (k, vars) => { let s = Aloop.i18n.t(k); if (vars) for (const x in vars) s = s.replace(`{${x}}`, vars[x]); return s; };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const provider = new Aloop.narration.WebSpeechProvider();
  let visible = false, route = { sub: null }, lessonIdx = 0, paraIdx = 0, state = "idle", voices = [], statusKey = "tts.idle", statusVars = null;
  const stored = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* in-memory only */ } };
  let rate = stored("aloop_tts_rate", 1);

  const lessonParas = () => Aloop.lessons[lessonIdx].body[Aloop.i18n.lang];
  const setStatus = (key, vars) => { statusKey = key; statusVars = vars || null; const el = root.querySelector(".sb-status"); if (el) el.textContent = t(key, vars); };
  function markSpeaking(i) {
    paraIdx = i;
    root.querySelectorAll(".sb-para").forEach((p, n) => p.classList.toggle("is-speaking", n === i && state !== "idle"));
    setStatus("tts.playing", { n: i + 1, total: lessonParas().length });
  }
  function stop(silent) {
    provider.cancel(); state = "idle";
    root.querySelectorAll(".sb-para.is-speaking").forEach(p => p.classList.remove("is-speaking"));
    if (!silent) setStatus("tts.stopped");
    syncControls();
  }
  async function loadVoices() {
    voices = await provider.voicesFor(Aloop.i18n.lang);
    const sel = root.querySelector("#sbVoice"); if (!sel) return;
    const pick = stored("aloop_tts_voice_" + Aloop.i18n.lang, null);
    sel.innerHTML = voices.map(v => `<option value="${esc(v.voiceURI)}"${v.voiceURI === pick ? " selected" : ""}>${esc(v.name)} (${esc(v.lang)})</option>`).join("");
    syncControls();
  }
  function currentVoice() { const sel = root.querySelector("#sbVoice"); return voices.find(v => v.voiceURI === sel?.value) || voices[0]; }
  function play(from) {
    if (!provider.supported || !voices.length) { setStatus("tts.unavailable"); return; }
    state = "playing";
    provider.speak(lessonParas(), { lang: Aloop.i18n.lang, voice: currentVoice(), rate, start: from });
    syncControls();
  }
  function syncControls() {
    const ok = provider.supported && voices.length > 0;
    const $ = id => root.querySelector(id);
    if (!$("#sbPlay")) return;
    $("#sbPlay").textContent = state === "playing" ? t("tts.pause") : state === "paused" ? t("tts.resume") : t("tts.play");
    $("#sbPlay").setAttribute("aria-pressed", String(state === "playing"));
    ["#sbPlay", "#sbStop", "#sbPrev", "#sbNext", "#sbVoice", "#sbRate"].forEach(id => { $(id).disabled = !ok; });
    $("#sbStop").disabled = !ok || state === "idle";
    if (!ok && statusKey === "tts.idle") setStatus("tts.unavailable");
  }

  function overview() {
    return `<p class="eb">${t("sb.kicker")}</p><h1>${t("sb.title")}</h1><p class="lede">${t("sb.intro")}</p>
      ${tabs("overview")}
      <section class="sb-model-panel sb-atlas-cta" aria-labelledby="sbAtlasTitle"><div class="sb-model-heading"><div><p class="sb-model-eyebrow">ANATOMICAL ATLAS / 3D</p><h2 id="sbAtlasTitle">${t("atlas.cta.title")}</h2><p>${t("atlas.cta.body")}</p></div><a class="primary-pill" href="#/smart-brain/atlas"><span>${t("atlas.cta.open")}</span></a></div></section>
      <div class="sb-grid">${[1, 2, 3].map(n => `<article class="sb-card"><h2>${t(`sb.card${n}.t`)}</h2><p>${t(`sb.card${n}.b`)}</p></article>`).join("")}</div>
      <p style="margin-top:28px"><a class="primary-pill" href="#/smart-brain/learn"><span>${t("sb.start")}</span></a></p>
      <p class="sb-note">${t("sb.disclaimer")}</p>`;
  }
  function tabs(active) {
    return `<nav class="sb-tabs" aria-label="Smart Brain"><a class="sb-tab" href="#/smart-brain" ${active === "overview" ? 'aria-current="page"' : ""}>${t("sb.tab.overview")}</a><a class="sb-tab" href="#/smart-brain/learn" ${active === "learn" ? 'aria-current="page"' : ""}>${t("sb.tab.learn")}</a><a class="sb-tab" href="#/smart-brain/atlas" ${active === "atlas" ? 'aria-current="page"' : ""}>${t("sb.tab.atlas")}</a></nav>`;
  }
  function learn() {
    const lang = Aloop.i18n.lang, L = Aloop.lessons[lessonIdx];
    return `<p class="eb">${t("sb.kicker")}</p><h1>${t("sb.tab.learn")}</h1>${tabs("learn")}
      <div class="sb-learn">
        <nav aria-label="${t("sb.lessons")}"><ol class="sb-lessons">${Aloop.lessons.map((l, i) => `<li><button type="button" data-lesson="${i}" ${i === lessonIdx ? 'aria-current="true"' : ""}>${i + 1}. ${esc(l.title[lang])}</button></li>`).join("")}</ol></nav>
        <article class="sb-lesson" aria-labelledby="sbLessonTitle">
          <div class="sb-narration" role="group" aria-label="${t("tts.group")}">
            <button class="sb-btn" id="sbPrev" type="button" aria-label="${t("tts.prev")}">⏮</button>
            <button class="sb-btn primary" id="sbPlay" type="button" aria-pressed="false">${t("tts.play")}</button>
            <button class="sb-btn" id="sbStop" type="button">${t("tts.stop")}</button>
            <button class="sb-btn" id="sbNext" type="button" aria-label="${t("tts.next")}">⏭</button>
            <label>${t("tts.rate")} <input id="sbRate" type="range" min="0.75" max="1.5" step="0.25" value="${rate}" aria-valuetext="${rate}×"></label>
            <label>${t("tts.voice")} <select id="sbVoice"></select></label>
            <p class="sb-status" role="status" aria-live="polite">${t(statusKey, statusVars)}</p>
          </div>
          <h2 id="sbLessonTitle">${esc(L.title[lang])}</h2>
          ${L.body[lang].map(p => `<p class="sb-para">${esc(p)}</p>`).join("")}
          <p class="sb-note">${t("sb.disclaimer")}</p>
        </article>
      </div>`;
  }
  function render() {
    stop(true);
    Aloop.atlas?.view.destroy();
    if (route.sub === "atlas") {
      root.innerHTML = `<div class="sb-wrap sb-wrap-atlas"><p class="eb">${t("sb.kicker")}</p><h1>${t("sb.tab.atlas")}</h1>${tabs("atlas")}<div id="atlasRoot"></div><p class="sb-note">${t("sb.disclaimer")}</p></div>`;
      Aloop.atlas.view.mount(root.querySelector("#atlasRoot"), route.id);
      return;
    }
    root.innerHTML = `<div class="sb-wrap">${route.sub === "learn" ? learn() : overview()}</div>`;
    if (route.sub === "learn") { loadVoices(); syncControls(); }
  }

  root.addEventListener("click", e => {
    const lb = e.target.closest("[data-lesson]");
    if (lb) { lessonIdx = +lb.dataset.lesson; setStatus("tts.idle"); render(); return; }
    const id = e.target.closest("button")?.id;
    if (id === "sbPlay") {
      if (state === "playing") { provider.pause(); state = "paused"; setStatus("tts.paused"); syncControls(); }
      else if (state === "paused") { provider.resume(); state = "playing"; markSpeaking(paraIdx); syncControls(); }
      else play(0);
    } else if (id === "sbStop") stop();
    else if (id === "sbPrev" || id === "sbNext") {
      const n = Math.max(0, Math.min(lessonParas().length - 1, paraIdx + (id === "sbNext" ? 1 : -1)));
      play(n);
    }
  });
  root.addEventListener("input", e => {
    if (e.target.id !== "sbRate") return;
    rate = +e.target.value; save("aloop_tts_rate", rate); e.target.setAttribute("aria-valuetext", rate + "×");
    if (state === "playing") play(paraIdx);
  });
  root.addEventListener("change", e => {
    if (e.target.id === "sbVoice") { save("aloop_tts_voice_" + Aloop.i18n.lang, e.target.value); if (state === "playing") play(paraIdx); }
  });
  provider.on("paragraph", markSpeaking);
  provider.on("end", () => { state = "idle"; root.querySelectorAll(".sb-para.is-speaking").forEach(p => p.classList.remove("is-speaking")); setStatus("tts.done"); syncControls(); });
  provider.on("error", () => { state = "idle"; setStatus("tts.unavailable"); syncControls(); });

  /* Lifecycle (TTS-6): never speak without a gesture; cancel on route/lang change and page hide. */
  document.addEventListener("aloop:language", () => { if (visible) { setStatus("tts.idle"); render(); } });
  window.addEventListener("pagehide", () => provider.cancel());
  let hiddenTimer = 0;
  document.addEventListener("visibilitychange", () => { clearTimeout(hiddenTimer); if (document.hidden) hiddenTimer = setTimeout(() => stop(true), 30000); });

  Aloop.smartbrain = {
    show(r) {
      const changed = !visible || r.sub !== route.sub;
      route = r; visible = true; root.hidden = false;
      if (changed) { setStatus("tts.idle"); render(); } else if (r.sub === "atlas" && r.id) Aloop.atlas?.view.select(r.id);
      window.scrollTo({ top: 0, behavior: "auto" });
    },
    hide() { if (!visible) return; stop(true); Aloop.atlas?.view.destroy(); visible = false; root.hidden = true; },
  };
})();
