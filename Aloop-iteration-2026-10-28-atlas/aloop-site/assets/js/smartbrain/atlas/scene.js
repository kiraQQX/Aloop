/* Atlas 3D scene: orbit/pan/zoom, hover + click picking, highlight/fade/hide driven purely by the store.
 * No sidebar imports. Renders on demand (no idle loop cost). */
(function () {
  const Aloop = window.Aloop = window.Aloop || {};
  const atlas = Aloop.atlas = Aloop.atlas || {};
  let active = null;
  const reduced = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const ease = k => k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;

  async function mount(host, ui) {
    destroy();
    const inst = active = { dead: false, ac: new AbortController(), raf: 0 };
    const { signal } = inst.ac;
    const { THREE, root, meshesById, rawMeta } = await atlas.assets.loadModel(ui.progress);
    if (inst.dead) return;
    const data = atlas.data, store = atlas.store;
    if (!data.ready || (data.origin === "manifest" && rawMeta.filter(m => data.byId.has(m.bx_id)).length < rawMeta.length * .5)) data.ingest(rawMeta, "glb");

    const t = k => Aloop.i18n?.t(k) ?? k;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    inst.renderer = renderer;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8));
    renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
    const canvas = renderer.domElement;
    canvas.className = "atlas-canvas"; canvas.tabIndex = 0; canvas.setAttribute("role", "application");
    canvas.setAttribute("aria-label", t("atlas.canvasLabel")); canvas.style.touchAction = "none";
    host.querySelector(".atlas-canvas")?.remove(); host.prepend(canvas);

    const scene = new THREE.Scene(); inst.scene = scene;
    scene.add(new THREE.HemisphereLight(0xeaf4ff, 0x50627a, 2.0));
    const key = new THREE.DirectionalLight(0xffffff, 3.2); key.position.set(4, 5, 7); scene.add(key);
    const fill = new THREE.DirectionalLight(0x8ab9ec, 1.6); fill.position.set(-5, 1, -4); scene.add(fill);
    scene.add(root);
    const camera = new THREE.PerspectiveCamera(34, 1, .01, 200);
    const INITIAL = { yaw: .35, pitch: .08, dist: 5.4, tx: 0, ty: 0, tz: 0 };
    const pose = { ...INITIAL };
    let dirty = true, tween = null;
    const need = () => { dirty = true; };

    function placeCamera() {
      const cp = Math.cos(pose.pitch);
      camera.position.set(pose.tx + pose.dist * Math.sin(pose.yaw) * cp, pose.ty + pose.dist * Math.sin(pose.pitch), pose.tz + pose.dist * Math.cos(pose.yaw) * cp);
      camera.lookAt(pose.tx, pose.ty, pose.tz);
    }
    function resize() { const w = Math.max(1, host.clientWidth), h = Math.max(1, host.clientHeight); camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h); need(); }
    const ro = new ResizeObserver(resize); ro.observe(host); inst.ro = ro; resize();

    function flyTo(to) {
      if (reduced()) { Object.assign(pose, to); need(); return; }
      tween = { from: { ...pose }, to: { ...pose, ...to }, t0: performance.now(), ms: 600 }; need();
    }
    function poseFor(ids) {
      const box = new THREE.Box3();
      ids.forEach(id => (meshesById.get(id) || []).forEach(m => { if (m.visible) box.expandByObject(m); }));
      if (box.isEmpty()) return null;
      const c = box.getCenter(new THREE.Vector3()), r = box.getSize(new THREE.Vector3()).length() / 2;
      return { tx: c.x, ty: c.y, tz: c.z, dist: Math.max(1.4, Math.min(10, (r / Math.sin(camera.fov * Math.PI / 360)) * 1.15)) };
    }

    /* ---- state -> materials (diffed; nothing is cloned here) ---- */
    const applied = new Map(); let pickable = [];
    function apply(s) {
      if (!data.ready) return;
      const next = [];
      for (const it of data.items) {
        const meshes = meshesById.get(it.id); if (!meshes) continue;
        const v = data.visibility(it, s), sel = it.id === s.selectedId, hov = !sel && it.id === s.hoverId;
        const op = v.faded ? .12 : (it.cat === "cortex" ? s.cortexOpacity : 1);
        const em = sel ? 0xf2cc4d : hov ? 0x5ab7bd : 0, ei = sel ? .48 : hov ? .22 : 0;
        const sig = `${v.hidden}|${op}|${em}|${ei}`;
        for (const m of meshes) {
          if (applied.get(m) !== sig) {
            applied.set(m, sig); m.visible = !v.hidden;
            for (const mat of Array.isArray(m.material) ? m.material : [m.material]) {
              const tr = op < 1; if (mat.transparent !== tr) { mat.transparent = tr; mat.needsUpdate = true; }
              mat.opacity = op; mat.depthWrite = !tr;
              if (mat.emissive) { mat.emissive.setHex(em); mat.emissiveIntensity = ei; }
            }
          }
          if (v.pickable) next.push(m);
        }
      }
      pickable = next; need();
    }
    const idsMatching = s => data.items.filter(it => data.visibility(it, s).matched && !data.visibility(it, s).hidden).map(it => it.id);
    function focusFor(s) { const ids = s.isolate && s.query.trim() && !s.selectedId ? idsMatching(s) : (s.selectedId ? [s.selectedId] : []); const p = ids.length && poseFor(ids); if (p) flyTo(p); }

    inst.unsub = store.subscribe((s, ch) => {
      apply(s);
      if (ch.reset) flyTo(INITIAL);
      else if (ch.focus) focusFor(s);
      else if (ch.refit && s.isolate) focusFor(s);
      else if (ch.selected && s.selectedId && ch.source !== "scene" && s.autoFocus) focusFor(s);
    });
    data.whenReady(() => apply(store.get()));
    document.addEventListener("aloop:atlas-data", () => apply(store.get()), { signal });

    /* ---- picking ---- */
    const ray = new THREE.Raycaster(), ptr = new THREE.Vector2();
    function pickAt(e) {
      const r = canvas.getBoundingClientRect();
      ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ptr, camera);
      const hit = ray.intersectObjects(pickable, false)[0];
      return hit ? hit.object.userData.atlasId : null;
    }
    let hoverEvt = null, hoverQueued = false;
    const queueHover = e => { hoverEvt = e; if (hoverQueued) return; hoverQueued = true; requestAnimationFrame(() => { hoverQueued = false; if (inst.dead || !hoverEvt) return; const id = pickAt(hoverEvt); store.hover(id, "scene"); canvas.style.cursor = id ? "pointer" : "grab"; }); };

    /* ---- pointer / wheel / keys ---- */
    const ptrs = new Map(); let drag = null, pinch = null;
    const zoomBy = f => { pose.dist = Math.max(1.2, Math.min(12, pose.dist * f)); need(); };
    canvas.addEventListener("contextmenu", e => e.preventDefault(), { signal });
    canvas.addEventListener("pointerdown", e => {
      canvas.setPointerCapture?.(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); tween = null;
      if (ptrs.size === 1) drag = { x: e.clientX, y: e.clientY, moved: 0, mode: (e.button === 2 || e.ctrlKey || e.metaKey) ? "pan" : "rot", button: e.button };
      else if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) }; drag = null; }
    }, { signal });
    canvas.addEventListener("pointermove", e => {
      const p = ptrs.get(e.pointerId);
      if (p && ptrs.size === 2 && pinch) { p.x = e.clientX; p.y = e.clientY; const [a, b] = [...ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y); if (d > 0) { zoomBy(pinch.d / d); pinch.d = d; } return; }
      if (p && drag) {
        const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY; drag.moved += Math.abs(dx) + Math.abs(dy);
        if (drag.moved > 4) {
          if (drag.mode === "rot") { pose.yaw -= dx * .008; pose.pitch = Math.max(-1.45, Math.min(1.45, pose.pitch + dy * .008)); }
          else { const k = pose.dist * .0016, right = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 0), up = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 1); pose.tx += (-right.x * dx + up.x * dy) * k; pose.ty += (-right.y * dx + up.y * dy) * k; pose.tz += (-right.z * dx + up.z * dy) * k; }
          const r = canvas.getBoundingClientRect(); Aloop.audio?.glassGlide?.(Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)), Math.min(1, (Math.abs(dx) + Math.abs(dy)) / 40));
          need();
        }
        return;
      }
      if (!p && e.pointerType !== "touch") queueHover(e);
    }, { signal });
    const end = e => {
      const wasClick = drag && drag.moved <= 4 && drag.button === 0 && e.type === "pointerup";
      ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch = null;
      if (ptrs.size === 0) { drag = null; Aloop.audio?.stopGlassGlide?.(); }
      if (wasClick) { const id = pickAt(e); id ? store.select(id, "scene") : store.clear("scene"); }
    };
    canvas.addEventListener("pointerup", end, { signal }); canvas.addEventListener("pointercancel", end, { signal });
    canvas.addEventListener("pointerleave", () => { hoverEvt = null; store.hover(null, "scene"); }, { signal });
    canvas.addEventListener("wheel", e => { e.preventDefault(); tween = null; zoomBy(Math.exp(e.deltaY * .0012)); }, { passive: false, signal });
    canvas.addEventListener("keydown", e => {
      const k = e.key;
      if (k === "ArrowLeft") pose.yaw += .09; else if (k === "ArrowRight") pose.yaw -= .09;
      else if (k === "ArrowUp") pose.pitch = Math.min(1.45, pose.pitch + .09); else if (k === "ArrowDown") pose.pitch = Math.max(-1.45, pose.pitch - .09);
      else if (k === "+" || k === "=") zoomBy(.9); else if (k === "-") zoomBy(1.1);
      else if (k === "Home") flyTo(INITIAL); else if (k === "Escape") store.clear("scene"); else return;
      e.preventDefault(); need();
    }, { signal });
    canvas.addEventListener("webglcontextlost", e => { e.preventDefault(); ui.fail?.(); }, { signal });

    /* ---- render on demand ---- */
    const loop = now => {
      if (inst.dead) return; inst.raf = requestAnimationFrame(loop);
      if (tween) { const k = Math.min(1, (now - tween.t0) / tween.ms), e = ease(k); for (const key of ["yaw", "pitch", "dist", "tx", "ty", "tz"]) pose[key] = tween.from[key] + (tween.to[key] - tween.from[key]) * e; if (k >= 1) tween = null; dirty = true; }
      if (dirty && !document.hidden) { dirty = false; placeCamera(); renderer.render(scene, camera); }
    };
    inst.raf = requestAnimationFrame(loop);
    apply(store.get()); ui.ready?.();
  }

  function destroy() {
    if (!active) return;
    const a = active; active = null; a.dead = true;
    cancelAnimationFrame(a.raf); a.ac.abort(); a.ro?.disconnect(); a.unsub?.();
    Aloop.audio?.stopGlassGlide?.();
    if (a.scene) a.scene.clear();           // detach cached model; geometry/materials stay cached for the next visit
    a.renderer?.dispose(); a.renderer?.domElement?.remove();
  }
  atlas.scene = { mount, destroy };
})();
