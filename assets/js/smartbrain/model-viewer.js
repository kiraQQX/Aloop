/* Smart Brain product model viewer. Independent Three.js scene; never shares homepage particle state. */
(function () {
  const Aloop = window.Aloop = window.Aloop || {};
  const MODEL_URL = new URL("assets/models/atlas/brain.glb", document.baseURI).href;
  let active = null;
  const copy = () => Aloop.i18n?.lang === "en"
    ? { loading: "Loading anatomical model…", drag: "Drag to rotate · Scroll to zoom · Select a structure", selected: "Selected structure", ready: "Model ready", failed: "Model failed to load. Check the network and try again.", reset: "Reset view", attribution: "Z-Anatomy / BodyParts3D · CC BY-SA 4.0", source: "Model source" }
    : { loading: "正在加载解剖模型…", drag: "拖动旋转 · 滚轮缩放 · 点击选择脑区", selected: "当前选中结构", ready: "模型已加载", failed: "模型加载失败，请检查网络后重试。", reset: "重置视角", attribution: "Z-Anatomy / BodyParts3D · CC BY-SA 4.0", source: "模型来源" };

  function destroy() {
    if (!active) return;
    active.dead = true;
    cancelAnimationFrame(active.raf);
    active.resizeObserver?.disconnect();
    active.scene?.traverse?.(obj => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) (Array.isArray(obj.material) ? obj.material : [obj.material]).forEach(material => material.dispose?.());
    });
    active.renderer?.dispose();
    active.renderer?.domElement?.remove();
    active = null;
  }

  async function mount() {
    destroy();
    const host = document.getElementById("sbModelStage");
    if (!host) return;
    const labels = copy();
    const status = host.querySelector("[data-model-status]");
    const selected = host.querySelector("[data-model-selected]");
    const reset = host.querySelector("[data-model-reset]");
    if (status) status.textContent = labels.loading;
    const instance = { dead: false, raf: 0, renderer: null, resizeObserver: null };
    active = instance;
    try {
      const [THREE, { GLTFLoader }, { DRACOLoader }] = await Promise.all([
        import("three"), import("three/addons/loaders/GLTFLoader.js"), import("three/addons/loaders/DRACOLoader.js")
      ]);
      if (instance.dead || !host.isConnected) return;
      const width = Math.max(320, host.clientWidth), height = Math.max(320, host.clientHeight);
      const scene = new THREE.Scene();
      instance.scene = scene;
      scene.background = new THREE.Color("#edf3f8");
      const camera = new THREE.PerspectiveCamera(34, width / height, 0.01, 2000);
      camera.position.set(0, 0, 5);
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
      instance.renderer = renderer;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8));
      renderer.setSize(width, height);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.15;
      renderer.domElement.className = "sb-model-canvas";
      renderer.domElement.setAttribute("aria-label", labels.drag);
      host.querySelector(".sb-model-canvas")?.remove();
      host.prepend(renderer.domElement);

      scene.add(new THREE.HemisphereLight(0xeaf4ff, 0x50627a, 2.0));
      const key = new THREE.DirectionalLight(0xffffff, 3.2); key.position.set(4, 5, 7); scene.add(key);
      const fill = new THREE.DirectionalLight(0x8ab9ec, 1.6); fill.position.set(-5, 1, -4); scene.add(fill);
      const rim = new THREE.DirectionalLight(0xffe2a0, 1.0); rim.position.set(0, -3, 5); scene.add(rim);
      const modelRoot = new THREE.Group(); scene.add(modelRoot);

      const draco = new DRACOLoader();
      draco.setDecoderPath(new URL("assets/models/atlas/draco/", document.baseURI).href);
      const loader = new GLTFLoader(); loader.setDRACOLoader(draco);
      const gltf = await new Promise((resolve, reject) => loader.load(MODEL_URL, resolve, undefined, reject));
      draco.dispose();
      if (instance.dead || !host.isConnected) { gltf.scene.traverse(o => { if (o.geometry) o.geometry.dispose(); }); return; }
      const model = gltf.scene;
      model.traverse(obj => {
        if (!obj.isMesh) return;
        obj.userData.originalMaterials = Array.isArray(obj.material) ? obj.material.slice() : [obj.material];
        obj.material = obj.userData.originalMaterials.map(m => {
          const mat = m.clone();
          if (mat.color) mat.color.multiplyScalar(1.1);
          if ("roughness" in mat) mat.roughness = Math.min(1, Math.max(0.42, mat.roughness ?? 0.72));
          if ("metalness" in mat) mat.metalness = Math.min(0.18, mat.metalness ?? 0);
          return mat;
        });
        if (obj.material.length === 1) obj.material = obj.material[0];
      });
      modelRoot.add(model);
      const bounds = new THREE.Box3().setFromObject(modelRoot);
      const center = bounds.getCenter(new THREE.Vector3());
      const size = bounds.getSize(new THREE.Vector3());
      model.position.sub(center);
      const maxDim = Math.max(size.x, size.y, size.z) || 1;
      modelRoot.scale.setScalar(2.7 / maxDim);
      const sphere = new THREE.Sphere(); new THREE.Box3().setFromObject(modelRoot).getBoundingSphere(sphere);
      camera.position.set(0, 0.04, Math.max(3.6, sphere.radius * 3.1));
      camera.near = 0.01; camera.far = 1000; camera.updateProjectionMatrix();
      modelRoot.rotation.set(0.08, -0.32, 0);
      const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2();
      let down = null, dragging = false, distance = camera.position.z;
      const initial = modelRoot.rotation.clone();
      const onDown = e => { down = { x: e.clientX, y: e.clientY, rx: modelRoot.rotation.x, ry: modelRoot.rotation.y }; dragging = false; renderer.domElement.setPointerCapture?.(e.pointerId); };
      const onMove = e => {
        if (down && (e.buttons & 1)) { const dx = e.clientX - down.x, dy = e.clientY - down.y; if (Math.abs(dx) + Math.abs(dy) > 3) dragging = true; modelRoot.rotation.y = down.ry + dx * 0.008; modelRoot.rotation.x = Math.max(-1.2, Math.min(1.2, down.rx + dy * 0.008)); }
      };
      const onUp = e => {
        if (down && !dragging) {
          const rect = renderer.domElement.getBoundingClientRect();
          pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1; pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
          raycaster.setFromCamera(pointer, camera);
          const hit = raycaster.intersectObject(model, true).find(h => h.object.isMesh);
          if (hit) {
            const name = hit.object.name || hit.object.parent?.name || (Aloop.i18n?.lang === "en" ? "Anatomical structure" : "脑部解剖结构");
            if (selected) selected.textContent = `${labels.selected}：${name}`;
            model.traverse(obj => {
              if (!obj.isMesh) return;
              const mats = obj.userData.originalMaterials || [];
              const highlighted = obj === hit.object;
              const setHighlight = m => { const clone = m.clone(); if (highlighted && clone.emissive) { clone.emissive.set("#e9bd38"); clone.emissiveIntensity = 0.42; } return clone; };
              const newMats = mats.map(setHighlight); obj.material = newMats.length === 1 ? newMats[0] : newMats;
            });
          }
        }
        down = null;
      };
      const onWheel = e => { e.preventDefault(); distance = Math.max(1.7, Math.min(9, distance * (e.deltaY > 0 ? 1.09 : 0.92))); camera.position.setLength(distance); };
      renderer.domElement.addEventListener("pointerdown", onDown);
      renderer.domElement.addEventListener("pointermove", onMove);
      renderer.domElement.addEventListener("pointerup", onUp);
      renderer.domElement.addEventListener("pointercancel", () => { down = null; });
      renderer.domElement.addEventListener("wheel", onWheel, { passive: false });
      reset?.addEventListener("click", () => { modelRoot.rotation.copy(initial); distance = Math.max(3.6, sphere.radius * 3.1); camera.position.setLength(distance); if (selected) selected.textContent = labels.ready; });
      const resize = () => { if (instance.dead) return; const w = Math.max(1, host.clientWidth), h = Math.max(1, host.clientHeight); camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h); };
      instance.resizeObserver = new ResizeObserver(resize); instance.resizeObserver.observe(host);
      const render = () => { if (instance.dead || active !== instance) return; instance.raf = requestAnimationFrame(render); renderer.render(scene, camera); };
      render();
      if (status) status.textContent = labels.ready;
      if (selected) selected.textContent = labels.ready;
      host.classList.add("is-loaded");
    } catch (err) {
      if (!instance.dead && status) status.textContent = labels.failed;
      console.error("Smart Brain model load failed", err);
    }
  }
  Aloop.smartbrainModel = { mount, destroy };
})();


