(function () {
  const Aloop = window.Aloop = window.Aloop || {};
  const trigger = document.getElementById("experimentsToggle");
  const panel = document.getElementById("quickMenu");
  const list = document.getElementById("quickMenuItems");
  const productsTrigger = document.getElementById("productsToggle");
  const productsPanel = document.getElementById("productsMenu");
  let open = false;
  let productsOpen = false;

  function thumbnail(scene) {
    if (scene === "data-sea") return '<svg viewBox="0 0 48 48" aria-hidden="true"><g fill="none" stroke="#F2CC4D" stroke-width="1.35" stroke-linecap="round"><path d="M3 17 C10 11 15 23 23 17 S36 11 45 16M3 23 C10 17 15 29 23 23 S36 17 45 22M3 29 C10 23 15 35 23 29 S36 23 45 28M3 35 C10 29 15 41 23 35 S36 29 45 34"/><path d="M12 11v25M20 14v23M28 12v25M36 15v21" stroke-opacity=".45"/></g><g fill="#fff"><circle cx="14" cy="20" r="1"/><circle cx="31" cy="26" r="1"/><circle cx="38" cy="33" r="1"/></g></svg>';
    return '<svg viewBox="0 0 48 48" aria-hidden="true"><g fill="none" stroke="#477EAE" stroke-width="1.1" stroke-linecap="round"><path d="M22 38c-8 2-14-3-13-10-5-5-1-11 3-12 0-6 6-9 11-5 5-4 11-1 12 4 5 2 6 8 2 12 1 6-6 10-11 8M22 15c-3 4 2 6-1 10s4 5 1 11M29 16c-3 5 3 6 0 10s2 4-1 7"/></g><circle cx="35" cy="11" r="2" fill="#F2CC4D"/></svg>';
  }
  function render() {
    if (!list || !Aloop.registry) return;
    const items = Aloop.registry.all();
    list.innerHTML = items.map(item => `<button class="quick-menu-item" type="button" role="menuitem" data-experiment-id="${item.id}"><span class="menu-thumb">${thumbnail(item.scene)}</span><span class="menu-name">${item.name}</span><span class="menu-arrow" aria-hidden="true">↗</span></button>`).join("");
    list.querySelectorAll("[data-experiment-id]").forEach(button => {
      button.addEventListener("click", () => {
        close();
        Aloop.productsMenu?.close();
        window.location.hash = `#/e/${button.dataset.experimentId}`;
      });
    });
    markCurrent();
  }
  function markCurrent(id) {
    const match = id || (window.location.hash.match(/^#\/e\/([^/]+)/) || [])[1];
    list?.querySelectorAll("[data-experiment-id]").forEach(button => {
      const current = button.dataset.experimentId === match;
      if (current) button.setAttribute("aria-current", "true"); else button.removeAttribute("aria-current");
    });
  }
  function openMenu() {
    if (!trigger || !panel) return;
    Aloop.productsMenu?.close();
    open = true;
    panel.hidden = false;
    trigger.setAttribute("aria-expanded", "true");
    panel.querySelector("[role=menuitem]")?.focus({ preventScroll: true });
  }
  function close(restoreFocus = false) {
    if (!trigger || !panel) return;
    open = false;
    panel.hidden = true;
    trigger.setAttribute("aria-expanded", "false");
    if (restoreFocus) trigger.focus({ preventScroll: true });
  }
  function openProductsMenu() {
    if (!productsTrigger || !productsPanel) return;
    close();
    productsOpen = true;
    productsPanel.hidden = false;
    productsTrigger.setAttribute("aria-expanded", "true");
    productsPanel.querySelector("[role=menuitem]")?.focus({ preventScroll: true });
  }
  function closeProductsMenu(restoreFocus = false) {
    if (!productsTrigger || !productsPanel) return;
    productsOpen = false;
    productsPanel.hidden = true;
    productsTrigger.setAttribute("aria-expanded", "false");
    if (restoreFocus) productsTrigger.focus({ preventScroll: true });
  }

  trigger?.addEventListener("click", () => open ? close() : openMenu());
  productsTrigger?.addEventListener("click", () => productsOpen ? closeProductsMenu() : openProductsMenu());
  productsPanel?.querySelectorAll("[role=menuitem]").forEach(item => item.addEventListener("click", () => closeProductsMenu()));

  document.addEventListener("click", event => {
    if (open && !panel.contains(event.target) && !trigger.contains(event.target)) close();
    if (productsOpen && !productsPanel.contains(event.target) && !productsTrigger.contains(event.target)) closeProductsMenu();
  });
  document.addEventListener("keydown", event => {
    if (open) {
      if (event.key === "Escape") { event.preventDefault(); close(true); return; }
      const items = Array.from(panel.querySelectorAll("[role=menuitem]"));
      const current = items.indexOf(document.activeElement);
      if (items.length && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
        event.preventDefault();
        const offset = event.key === "ArrowDown" ? 1 : -1;
        items[(current + offset + items.length) % items.length]?.focus();
      }
      if (event.key === "Home") { event.preventDefault(); items[0]?.focus(); }
      if (event.key === "End") { event.preventDefault(); items.at(-1)?.focus(); }
    }
    if (productsOpen) {
      if (event.key === "Escape") { event.preventDefault(); closeProductsMenu(true); return; }
      const items = Array.from(productsPanel.querySelectorAll("[role=menuitem]"));
      const current = items.indexOf(document.activeElement);
      if (items.length && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
        event.preventDefault();
        const offset = event.key === "ArrowDown" ? 1 : -1;
        items[(current + offset + items.length) % items.length]?.focus();
      }
      if (event.key === "Home" || event.key === "End") { event.preventDefault(); items[0]?.focus(); }
    }
  });
  window.addEventListener("hashchange", () => { markCurrent(); close(); closeProductsMenu(); });
  document.addEventListener("aloop:registry-change", render);
  Aloop.quickMenu = { render, close, markCurrent, isOpen: () => open };
  Aloop.productsMenu = { close: closeProductsMenu, isOpen: () => productsOpen };
  render();
})();
