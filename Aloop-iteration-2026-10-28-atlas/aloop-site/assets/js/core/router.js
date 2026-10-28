/* Aloop shell: hash router, plugin loading, progress UI, and route lifecycle. */
(function () {
  const Aloop = window.Aloop = window.Aloop || {};
  const home = document.getElementById("home");
  const experimentShell = document.getElementById("experimentShell");
  const experimentRoot = document.getElementById("experiment-root");
  const experimentSubbar = document.getElementById("experimentSubbar");
  const exitButton = document.getElementById("experimentExit");
  const progressLabel = document.getElementById("progressLabel");
  const progressCount = document.getElementById("progressCount");
  const progressFill = document.getElementById("progressFill");
  const storageWarning = document.getElementById("storageWarning");
  let activeUnmount = null;
  let activeExperimentId = null;
  let routeToken = 0;
  let isGateVisible = false;
  let lastRoute = null;
  let pendingRunId = null;

  Aloop.isExperimentRunning = false;
  Aloop.setStorageWarning = value => {
    if (storageWarning) storageWarning.textContent = value || "";
  };
  Aloop.updateExperimentProgress = (step, label, current, total) => {
    if (!progressLabel || !progressCount || !progressFill) return;
    if (step < 0 || !label) {
      experimentSubbar.hidden = true;
      return;
    }
    experimentSubbar.hidden = false;
    progressLabel.textContent = label;
    progressCount.textContent = `${current} / ${total}`;
    progressFill.style.width = `${Math.max(0,Math.min(1,current/total))*100}%`;
    progressFill.parentElement.setAttribute("aria-label", `${label}, ${current} of ${total}`);
  };
  Aloop.navigate = hash => {
    const clean = hash.startsWith("#") ? hash : `#${hash}`;
    if (window.location.hash === clean) renderRoute();
    else window.location.hash = clean;
  };

  function parseRoute() {
    const hash = window.location.hash || "#/";
    const parts = hash.replace(/^#\/?/, "").split("/").filter(Boolean);
    if (parts.length === 0) return { type: "home" };
    if (parts[0] === "smart-brain") return { type: "smartbrain", sub: parts[1] === "learn" ? "learn" : parts[1] === "atlas" ? "atlas" : null, id: parts[1] === "atlas" && parts[2] ? decodeURIComponent(parts[2]) : null };
    if (parts[0] === "easysci") return { type: "easysci", slug: parts[1] || null };
    if (parts[0] === "e" && parts[1]) {
      if (parts[2] === "run") return { type: "run", id: parts[1] };
      return { type: "section", id: parts[1] };
    }
    return { type: "home" };
  }
  function qaContext() {
    const params = new URLSearchParams(window.location.search);
    const qa = params.get("qa") === "1";
    const arm = qa && /^[ABC]$/.test(params.get("arm") || "") ? params.get("arm") : "A";
    return { qa, arm };
  }
  function resetProgress() {
    experimentSubbar.hidden = true;
    progressLabel.textContent = "";
    progressCount.textContent = "";
    progressFill.style.width = "0%";
  }
  function unmountRuntime() {
    if (activeUnmount) {
      try { activeUnmount(); } catch (error) { console.error("beLieve unmount error", error); }
    }
    activeUnmount = null;
    activeExperimentId = null;
    experimentRoot.innerHTML = "";
    resetProgress();
  }
  function showHome(route) {
    if (Aloop.isExperimentRunning || activeUnmount || isGateVisible) unmountRuntime();
    isGateVisible = false;
    Aloop.isExperimentRunning = false;
    Aloop.audio?.setExperimentActive(false);
    experimentShell.hidden = true;
    home.hidden = false;
    document.body.classList.remove("experiment-active");
    window.AloopGL?.pauseAll(false);
    Aloop.audio?.stopGlassGlide();
    if (route.type === "section" && Aloop.registry.get(route.id)) {
      requestAnimationFrame(() => Aloop.sections.scrollTo(route.id));
      Aloop.quickMenu?.markCurrent(route.id);
    } else if (route.type === "home") {
      requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "auto" }));
    }
  }
  function gateMarkup() {
    const t = key => Aloop.i18n.t(key);
    return `<section class="card resume-card gate-card" aria-labelledby="gateTitle"><p class="eb">${t("gate.eyebrow")}</p><h1 id="gateTitle">${t("gate.title")}</h1><p class="gate-copy">${t("gate.body")}</p><p class="mut gate-note">${t("gate.note")}</p><div class="gate-actions"><button class="btn" id="gateContinue" type="button"><span>${t("gate.resume")}</span></button><button class="btn secondary" id="gateRestart" type="button"><span>${t("gate.restart")}</span></button></div></section>`;
  }
  function showGate(item, token) {
    isGateVisible = true;
    experimentSubbar.hidden = true;
    experimentRoot.innerHTML = gateMarkup();
    document.getElementById("gateContinue")?.addEventListener("click", () => mountRuntime(item,token,{ fresh: false }));
    document.getElementById("gateRestart")?.addEventListener("click", () => mountRuntime(item,token,{ fresh: true }));
  }
  async function mountRuntime(item, token, options = {}) {
    if (token !== routeToken) return;
    isGateVisible = false;
    experimentRoot.innerHTML = "";
    experimentSubbar.hidden = false;
    Aloop.updateExperimentProgress(-1, "", 0, 4);
    const qa = qaContext();
    const context = {
      lang: Aloop.i18n.lang,
      t: Aloop.i18n.t,
      auth: Aloop.auth,
      qa: qa.qa,
      arm: qa.arm,
      exit: () => {
        const t = key => Aloop.i18n.t(key);
        const api = Aloop.experiments && Aloop.experiments[item.id];
        const phase = api && api.getPhase ? api.getPhase() : null;
        if (phase && !["consent", "debrief"].includes(phase) && !window.confirm(t("exp.exitConfirm"))) return;
        Aloop.navigate(`#/e/${item.id}`);
      },
    };
    try {
      const api = Aloop.experiments && Aloop.experiments[item.id];
      if (!api || typeof api.mount !== "function") throw new Error("Experiment runtime did not register its mount function.");
      activeExperimentId = item.id;
      const unmount = api.mount(experimentRoot,context,options);
      activeUnmount = typeof unmount === "function" ? unmount : (() => api.unmount && api.unmount());
      Aloop.experimentApi = api;
      experimentRoot.focus({ preventScroll: true });
    } catch (error) {
      console.error("Aloop experiment mount failed",error);
      experimentSubbar.hidden = true;
      experimentRoot.innerHTML = `<section class="card"><p class="eb">ALOOP / ERROR</p><h1>${Aloop.i18n.lang === "zh" ? "实验暂时无法打开" : "Experiment could not be opened"}</h1><p class="mut">${Aloop.i18n.lang === "zh" ? "请检查工程文件是否完整，并重新加载页面。" : "Check that the project files are complete, then reload the page."}</p><a class="primary-pill" href="#/e/${item.id}"><span>${Aloop.i18n.t("exp.exit")}</span></a></section>`;
    }
  }
  async function showRun(route) {
    const token = ++routeToken;
    const item = Aloop.registry.get(route.id);
    if (!item) { showHome({ type: "home" }); return; }
    if (activeUnmount) unmountRuntime();
    Aloop.isExperimentRunning = true;
    Aloop.audio?.setExperimentActive(true);
    document.body.classList.add("experiment-active");
    home.hidden = true;
    experimentShell.hidden = false;
    experimentSubbar.hidden = true;
    window.AloopGL?.pauseAll(true);
    Aloop.audio?.stopGlassGlide();
    Aloop.quickMenu?.close();
    experimentRoot.innerHTML = `<div class="runtime-loading" role="status"><span class="loading-orbit" aria-hidden="true"></span><span>${Aloop.i18n.lang === "zh" ? "正在载入实验…" : "Loading experiment…"}</span></div>`;
    try {
      await item.load();
      if (token !== routeToken) return;
      const api = Aloop.experiments && Aloop.experiments[item.id];
      if (!api || typeof api.mount !== "function") throw new Error("Runtime module did not expose its experiment API.");
      Aloop.experimentApi = api;
      if (api.hasResumable && api.hasResumable()) {
        showGate(item,token);
      } else {
        mountRuntime(item,token,{ fresh: false });
      }
    } catch (error) {
      if (token !== routeToken) return;
      console.error("Aloop runtime loading failed",error);
      experimentSubbar.hidden = true;
      experimentRoot.innerHTML = `<section class="card"><p class="eb">ALOOP / ERROR</p><h1>${Aloop.i18n.lang === "zh" ? "实验资源加载失败" : "Experiment failed to load"}</h1><p class="mut">${Aloop.i18n.lang === "zh" ? "请确认 experiments/believe/runtime.js 存在，并通过 HTTP 本地服务器访问。" : "Check that experiments/believe/runtime.js exists and open the site through a local HTTP server."}</p><a class="primary-pill" href="#/e/${item.id}"><span>${Aloop.i18n.t("exp.exit")}</span></a></section>`;
    }
  }
  function renderRoute() {
    const route = parseRoute();
    lastRoute = route;
    if (route.type !== "easysci") Aloop.easysci?.hide();
    if (route.type !== "smartbrain") Aloop.smartbrain?.hide();
    if (route.type === "smartbrain") {
      routeToken += 1;
      if (activeUnmount || isGateVisible) unmountRuntime();
      isGateVisible = false; Aloop.isExperimentRunning = false;
      Aloop.audio?.setExperimentActive(false); Aloop.audio?.stopGlassGlide();
      experimentShell.hidden = true; home.hidden = true;
      document.body.classList.remove("experiment-active");
      window.AloopGL?.pauseAll(true);
      Aloop.quickMenu?.close();
      Aloop.productsMenu?.close();
      Aloop.smartbrain?.show(route);
      return;
    }
    if (route.type === "easysci") {
      routeToken += 1;
      if (activeUnmount || isGateVisible) unmountRuntime();
      isGateVisible = false; Aloop.isExperimentRunning = false;
      Aloop.audio?.setExperimentActive(false); Aloop.audio?.stopGlassGlide();
      experimentShell.hidden = true; home.hidden = true;
      document.body.classList.remove("experiment-active");
      window.AloopGL?.pauseAll(true);
      Aloop.quickMenu?.close();
      Aloop.productsMenu?.close();
      Aloop.easysci?.show(route);
      return;
    }
    if (route.type === "run") {
      const item = Aloop.registry.get(route.id);
      if (!item) { routeToken += 1; showHome({ type: "home" }); return; }
      if (item.requireLogin && !Aloop.auth?.user) {
        pendingRunId = route.id;
        routeToken += 1; // invalidate a pending experiment load before sending the visitor back to its section
        const sectionHash = `#/e/${route.id}`;
        if (window.location.hash !== sectionHash) { window.location.hash = sectionHash; return; }
        showHome({ type: "section", id: route.id });
        window.setTimeout(() => Aloop.authModal?.open(), 35);
        return;
      }
      pendingRunId = null;
      showRun(route);
      return;
    }
    routeToken += 1; // invalidate any pending lazy-load from a prior route
    Aloop.productsMenu?.close();
    showHome(route);
    if (pendingRunId && !Aloop.auth?.user) window.setTimeout(() => Aloop.authModal?.open(), 35);
  }
  document.addEventListener("aloop:auth-success", () => {
    if (!pendingRunId) return;
    const id = pendingRunId;
    pendingRunId = null;
    Aloop.navigate(`#/e/${id}/run`);
  });
  document.addEventListener("aloop:auth-modal-closed", () => {
    if (!Aloop.auth?.user) pendingRunId = null;
  });
  document.addEventListener("aloop:auth-change", event => {
    if (!event.detail?.user && lastRoute?.type === "run") Aloop.navigate(`#/e/${lastRoute.id}`);
  });
  exitButton?.addEventListener("click", () => {
    if (activeExperimentId) {
      const api = Aloop.experiments?.[activeExperimentId];
      const phase = api && api.getPhase ? api.getPhase() : null;
      if (phase && !["consent", "debrief"].includes(phase) && !window.confirm(Aloop.i18n.t("exp.exitConfirm"))) return;
      Aloop.navigate(`#/e/${activeExperimentId}`);
    }
  });
  window.addEventListener("hashchange",renderRoute);
  document.addEventListener("aloop:language",() => {
    if (isGateVisible && lastRoute && lastRoute.type === "run") {
      const item = Aloop.registry.get(lastRoute.id);
      if (item) showGate(item,routeToken);
    }
  });
  document.addEventListener("DOMContentLoaded",() => Aloop.i18n.apply(),{once:true});
  if (!window.location.hash) {
    try { history.replaceState(null,"",`${window.location.pathname}${window.location.search}#/`); }
    catch (_) { window.location.hash = "#/"; }
  }
  renderRoute();
})();
