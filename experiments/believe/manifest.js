(function () {
  window.Aloop.registry.register({
    id: "believe",
    name: "beLieve",
    scene: "data-sea",
    accent: "var(--c-primary)",
    order: 1,
    requireLogin: true,
    load: () => window.Aloop.loadScript("experiments/believe/runtime.js"),
  });
})();
