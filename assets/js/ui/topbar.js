(function () {
  const Aloop = window.Aloop = window.Aloop || {};
  const languageGroup = document.getElementById("langToggle");
  const soundButton = document.getElementById("soundToggle");
  const syncLang = () => languageGroup?.querySelectorAll("[data-lang-set]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.langSet === Aloop.i18n.lang)));
  languageGroup?.addEventListener("click", event => {
    const b = event.target.closest("[data-lang-set]");
    if (b) Aloop.i18n?.set(b.dataset.langSet);
  });
  window.addEventListener("DOMContentLoaded", syncLang, { once: true });
  soundButton?.addEventListener("click", () => Aloop.audio?.setEnabled(!Aloop.audio.isEnabled()));

  function playFor(element, kind) {
    if (!element || !Aloop.audio || Aloop.isExperimentRunning) return;
    if (element.closest(".particle-stage")) return;
    if (element.dataset.sound === "none") return;
    Aloop.audio.chime(kind);
  }
  document.addEventListener("pointerdown", event => {
    const target = event.target.closest("[data-sound],button,a");
    if (target) playFor(target, "click");
  }, { passive: true });
  document.addEventListener("click", event => {
    if (event.detail !== 0) return;
    const target = event.target.closest("[data-sound],button,a");
    if (target) playFor(target, "click");
  });
  if (window.matchMedia && window.matchMedia("(hover:hover) and (pointer:fine)").matches) {
    document.addEventListener("pointerover", event => {
      const target = event.target.closest("[data-sound],button,a");
      if (target && !target.contains(event.relatedTarget)) playFor(target, "hover");
    }, { passive: true });
  }
  document.addEventListener("aloop:language", () => {
    syncLang();
    const enabled = Aloop.audio?.isEnabled() ?? true;
    if (soundButton) {
      soundButton.setAttribute("aria-pressed", String(enabled));
      soundButton.setAttribute("aria-label", Aloop.i18n.t(enabled ? "sound.on" : "sound.off"));
    }
  });
})();
