(function () {
  const Aloop = window.Aloop = window.Aloop || {};
  const experiments = new Map();
  Aloop.registry = {
    register(definition) {
      if (!definition || !/^[a-z0-9-]+$/.test(definition.id || "") || !definition.name || typeof definition.load !== "function") {
        throw new TypeError("Invalid Aloop experiment manifest.");
      }
      experiments.set(definition.id, Object.freeze({ ...definition }));
      document.dispatchEvent(new CustomEvent("aloop:registry-change"));
    },
    get(id) { return experiments.get(id) || null; },
    all() { return Array.from(experiments.values()).sort((a, b) => (a.order || 0) - (b.order || 0)); },
  };
  const scriptPromises = new Map();
  Aloop.loadScript = function loadScript(src) {
    if (scriptPromises.has(src)) return scriptPromises.get(src);
    const promise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = src;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => { scriptPromises.delete(src); reject(new Error("Could not load " + src)); };
      document.head.appendChild(script);
    });
    scriptPromises.set(src, promise);
    return promise;
  };

  /* First-level products (IA-1, IA-5): one registry object drives the Products menu. */
  Aloop.products = Object.freeze([
    { id: "easysci", route: "#/easysci", monogram: "ES", name: "EasySci", descriptionKey: "products.easysciDescription" },
    { id: "smart-brain", route: "#/smart-brain", monogram: "SB", name: "Smart Brain", descriptionKey: "products.smartbrainDescription" },
  ]);
  const menuItems = document.getElementById("productsMenuItems");
  if (menuItems) {
    menuItems.innerHTML = Aloop.products.map(p => `<a class="products-menu-item" href="${p.route}" role="menuitem" data-product="${p.id}" data-sound="chime"><span class="products-menu-mark" aria-hidden="true">${p.monogram}</span><span class="products-menu-copy"><span class="products-menu-name">${p.name}</span><span class="products-menu-description" data-i18n="${p.descriptionKey}"></span></span><span class="menu-arrow" aria-hidden="true">\u2197</span></a>`).join("");
  }
})();
