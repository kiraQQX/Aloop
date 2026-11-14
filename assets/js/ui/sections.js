(function () {
  const Aloop = window.Aloop = window.Aloop || {};
  const container = document.getElementById("experimentSections");

  function sectionMarkup(item) {
    const label = Aloop.i18n.t("exp.enter");
    return `<section class="experiment-section" id="experiment-${item.id}" data-section-id="${item.id}">
      <div class="experiment-tile data-sea-tile">
        <div class="experiment-copy">
          <span class="experiment-name">${item.name}</span>
          <a class="primary-pill experiment-enter" href="#/e/${item.id}/run" aria-label="${item.name} — ${label}" data-sound="chime">
            <span data-i18n="exp.enter">${label}</span>
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 8h10m-4-4 4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </a>
        </div>
        <div class="particle-stage data-sea-stage" data-particle-stage data-scene="${item.scene}" aria-hidden="true">
          <canvas class="particle-canvas"></canvas>
        </div>
      </div>
    </section>`;
  }

  function render() {
    if (!container || !Aloop.registry) return;
    container.innerHTML = Aloop.registry.all().map(sectionMarkup).join("");
    if (window.AloopGL) window.AloopGL.refresh();
    Aloop.quickMenu?.render();
    attachScrollSpy();
  }

  let spy = null;
  function attachScrollSpy() {
    if (spy) spy.disconnect();
    if (!("IntersectionObserver" in window)) return;
    spy = new IntersectionObserver(entries => {
      if (Aloop.isExperimentRunning) return;
      const visible = entries.filter(entry => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible) Aloop.quickMenu?.markCurrent(visible.target.dataset.sectionId);
    }, { threshold: [0.25, 0.5, 0.75] });
    container.querySelectorAll("[data-section-id]").forEach(section => spy.observe(section));
  }

  document.addEventListener("aloop:registry-change", render);
  Aloop.sections = {
    render,
    container,
    scrollTo(id) {
      document.getElementById(`experiment-${id}`)?.scrollIntoView({
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
        block: "start"
      });
    }
  };
  render();
})();
