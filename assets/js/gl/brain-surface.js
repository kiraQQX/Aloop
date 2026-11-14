/* Aloop homepage cortical surface viewer.
 * Source geometry: itayinbarr/brainproject -> Z-Anatomy / BodyParts3D / DBCLS.
 * Geometry licence: CC BY-SA 4.0. The code in this file is project code.
 */
(() => {
  const stage = document.getElementById("brainSurfaceStage");
  if (!stage) return;

  const canvas = stage.querySelector(".brain-surface-canvas");
  const status = document.getElementById("brainSurfaceState");
  const rotateButton = document.getElementById("brainRotateToggle");
  const resetButton = document.getElementById("brainResetView");
  const modelLink = document.getElementById("brainModelLink");
  // Self-hosted (assets/models/atlas/brain.glb): raw.githubusercontent.com is reset in
  // mainland China and a 4.6 MB cold fetch there exceeds the load timeout.
  const MODEL_URL = new URL("assets/models/atlas/brain.glb", document.baseURI).href;
  const VIEWER_URL = "https://itayinbarr.github.io/brainproject/";
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let renderer, scene, camera, controls, brainRoot, corticalMeshes = [];
  let animationFrame = 0;
  let inView = true;
  let disposed = false;
  let rotating = false;
  let interactionUntil = 0;
  let originalCameraPosition = null;
  let selectedMesh = null;
  let hoveredMesh = null;
  let pointerStart = null;
  let lastWidth = 0;
  let lastHeight = 0;
  let lastRenderedAt = 0;
  const FRAME_INTERVAL_MS = 1000 / 30;
  const baseMaterials = new WeakMap();
  const raycasterHolder = { raycaster: null, pointer: null };

  const t = (key, fallback) => window.Aloop?.i18n?.t(key) || fallback;
  const withTimeout = (promise, ms, label) => new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(`${label} timed out after ${ms} ms`)), ms);
    promise.then(value => { window.clearTimeout(timer); resolve(value); }, error => { window.clearTimeout(timer); reject(error); });
  });
  const setStatus = (key, fallback) => {
    if (status) status.textContent = t(key, fallback);
  };
  const setRotateLabel = () => {
    if (!rotateButton) return;
    rotateButton.setAttribute("aria-pressed", String(rotating));
    rotateButton.setAttribute("aria-label", rotating
      ? t("hero.brainPauseRotation", "暂停模型自动旋转")
      : t("hero.brainStartRotation", "开始模型自动旋转"));
    rotateButton.title = rotateButton.getAttribute("aria-label");
    rotateButton.querySelector("span").textContent = rotating
      ? t("hero.brainPauseRotationShort", "暂停旋转")
      : t("hero.brainStartRotationShort", "自动旋转");
    if (controls) controls.autoRotate = rotating;
  };
  const regionColor = (region = "") => {
    const value = String(region).toLowerCase();
    if (/frontal|precentral|orbitofrontal/.test(value)) return 0x80a9cf;
    if (/parietal|postcentral|precuneus/.test(value)) return 0x6696c1;
    if (/temporal|fusiform|hippocampal/.test(value)) return 0x4f82ad;
    if (/occipital|cuneus|calcarine/.test(value)) return 0x3c6e9b;
    return 0x6f9ac1;
  };
  const metadata = (object, key) => {
    for (let node = object; node && node !== brainRoot; node = node.parent) {
      if (node.userData && node.userData[key] != null) return node.userData[key];
    }
    return "";
  };
  const isCortex = (mesh) => String(metadata(mesh, "bx_cat")).toLowerCase() === "cortex";

  function clearHighlight(mesh) {
    if (!mesh || !baseMaterials.has(mesh)) return;
    mesh.material.emissive?.setHex(0x000000);
    mesh.material.emissiveIntensity = 0;
    mesh.material.needsUpdate = true;
  }
  function highlight(mesh, color, intensity) {
    if (!mesh || !baseMaterials.has(mesh)) return;
    mesh.material.emissive?.setHex(color);
    mesh.material.emissiveIntensity = intensity;
    mesh.material.needsUpdate = true;
  }
  function showSelected(mesh) {
    if (selectedMesh) clearHighlight(selectedMesh);
    selectedMesh = mesh || null;
    if (selectedMesh) {
      highlight(selectedMesh, 0xf2cc4d, 0.48);
      const label = metadata(selectedMesh, "bx_label") || selectedMesh.name || t("hero.brainCortex", "大脑皮层");
      setStatus("hero.brainSelected", "已选择：{label}");
      if (status) {
        status.textContent = t("hero.brainSelected", "已选择：{label}").replace("{label}", label);
        status.dataset.template = "selected";
      }
    } else {
      if (status) delete status.dataset.template;
      setStatus("hero.brainReady", "模型已就绪。拖动旋转，滚轮缩放，点击皮层区域查看结构。");
    }
  }
  function resetView() {
    if (!camera || !controls || !originalCameraPosition) return;
    showSelected(null);
    controls.target.set(0, 0, 0);
    camera.position.copy(originalCameraPosition);
    camera.up.set(0, 1, 0);
    camera.lookAt(0, 0, 0);
    controls.update();
  }
  function resize() {
    if (!renderer || !camera || !stage) return;
    const rect = stage.getBoundingClientRect();
    const width = Math.max(1, Math.floor(rect.width));
    const height = Math.max(1, Math.floor(rect.height));
    if (width === lastWidth && height === lastHeight) return;
    lastWidth = width;
    lastHeight = height;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
  function updatePointer(event) {
    const rect = canvas.getBoundingClientRect();
    raycasterHolder.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    raycasterHolder.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }
  function render(timestamp = performance.now()) {
    if (disposed) return;
    animationFrame = 0;
    if (!renderer || !inView || document.hidden) return;
    if (timestamp - lastRenderedAt < FRAME_INTERVAL_MS) {
      animationFrame = window.requestAnimationFrame(render);
      return;
    }
    lastRenderedAt = timestamp;
    resize();
    controls.update();
    renderer.render(scene, camera);
    if (rotating || performance.now() < interactionUntil) {
      animationFrame = window.requestAnimationFrame(render);
    }
  }
  function wake() {
    if (!disposed && inView && !document.hidden && !animationFrame && renderer) {
      animationFrame = window.requestAnimationFrame(render);
    }
  }
  function fail(error) {
    console.warn("Aloop cortical surface viewer unavailable; an external viewer remains available.", error?.message || error || "unknown error");
    stage.classList.remove("is-model-ready");
    stage.classList.add("is-model-error");
    setStatus("hero.brainModelError", "脑表面模型暂时无法加载，请检查网络或打开开源模型查看器。");
    stage.setAttribute("aria-label", t("hero.brainModelErrorLabel", "3D 脑模型加载失败；可打开开源模型查看器"));
    if (modelLink) modelLink.hidden = false;
    if (rotateButton) rotateButton.disabled = true;
    if (resetButton) resetButton.disabled = true;
  }

  async function init() {
    setStatus("hero.brainStatusLoading", "正在加载真实脑表面模型…");
    if (modelLink) {
      modelLink.href = VIEWER_URL;
      modelLink.hidden = true;
    }
    try {
      // Dynamic imports let a blocked CDN fail into the visible fallback instead of
      // preventing the rest of the Aloop page from initialising.
      const [THREE, { GLTFLoader }, { DRACOLoader }, { OrbitControls }] = await withTimeout(Promise.all([
        import("three"),
        import("three/addons/loaders/GLTFLoader.js"),
        import("three/addons/loaders/DRACOLoader.js"),
        import("three/addons/controls/OrbitControls.js")
      ]), 8500, "Three.js CDN imports");
      if (disposed) return;
      const isMobile = window.matchMedia("(max-width: 700px)").matches;
      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: !isMobile, powerPreference: "low-power" });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile ? 1 : 1.2));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.15;
      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(33, 1, 0.01, 100);
      camera.position.set(0, 0.16, 4.7);
      originalCameraPosition = camera.position.clone();
      scene.add(new THREE.HemisphereLight(0xdcecff, 0x17314e, 2.0));
      const keyLight = new THREE.DirectionalLight(0xffffff, 2.7);
      keyLight.position.set(-3.7, 4.5, 5.5);
      scene.add(keyLight);
      const fillLight = new THREE.DirectionalLight(0x71d5df, 1.25);
      fillLight.position.set(4.5, 0.5, 2.5);
      scene.add(fillLight);
      const rimLight = new THREE.DirectionalLight(0xf2cc4d, 1.05);
      rimLight.position.set(0, -3.0, -4.5);
      scene.add(rimLight);

      controls = new OrbitControls(camera, canvas);
      controls.enableDamping = true;
      controls.dampingFactor = 0.065;
      controls.enablePan = false;
      controls.minDistance = 2.0;
      controls.maxDistance = 8.2;
      controls.autoRotate = rotating;
      controls.autoRotateSpeed = 0.24;
      controls.target.set(0, 0, 0);
      controls.addEventListener("change", () => {
        interactionUntil = performance.now() + 320;
        wake();
      });
      raycasterHolder.raycaster = new THREE.Raycaster();
      raycasterHolder.pointer = new THREE.Vector2();

      const draco = new DRACOLoader();
      draco.setDecoderPath(new URL("assets/models/atlas/draco/", document.baseURI).href);
      const loader = new GLTFLoader();
      loader.setDRACOLoader(draco);
      const gltf = await withTimeout(loader.loadAsync(MODEL_URL), 14000, "Open-source brain GLB");
      if (disposed) { draco.dispose(); return; }
      brainRoot = gltf.scene;
      brainRoot.traverse((object) => {
        if (!object.isMesh || !isCortex(object)) {
          if (object.isMesh) object.visible = false;
          return;
        }
        const region = metadata(object, "bx_region");
        const material = new THREE.MeshStandardMaterial({
          color: regionColor(region),
          roughness: 0.68,
          metalness: 0.025,
          side: THREE.DoubleSide
        });
        object.material = material;
        baseMaterials.set(object, material);
        object.castShadow = false;
        object.receiveShadow = false;
        corticalMeshes.push(object);
      });
      if (!corticalMeshes.length) throw new Error("No glTF nodes were tagged with bx_cat=cortex");
      stage.dataset.corticalMeshCount = String(corticalMeshes.length);
      const bounds = new THREE.Box3().setFromObject(brainRoot);
      const size = bounds.getSize(new THREE.Vector3());
      const center = bounds.getCenter(new THREE.Vector3());
      const maxDimension = Math.max(size.x, size.y, size.z) || 1;
      brainRoot.position.sub(center);
      brainRoot.scale.setScalar(2.68 / maxDimension);
      scene.add(brainRoot);
      // Recompute after model normalisation so the result stays centred even when
      // the source atlas uses life-size world coordinates.
      const normalizedBounds = new THREE.Box3().setFromObject(brainRoot);
      const normalizedCenter = normalizedBounds.getCenter(new THREE.Vector3());
      brainRoot.position.sub(normalizedCenter);
      controls.target.set(0, 0, 0);
      controls.update();
      draco.dispose();
      stage.classList.add("is-model-ready");
      stage.classList.remove("is-model-error");
      stage.setAttribute("aria-label", t("hero.brainLabel", "可交互的 3D 大脑皮层模型。拖动旋转，滚轮缩放，点击查看结构。"));
      setStatus("hero.brainReady", "模型已就绪。拖动旋转，滚轮缩放，点击皮层区域查看结构。");
      if (rotateButton) rotateButton.disabled = false;
      if (resetButton) resetButton.disabled = false;
      setRotateLabel();
      wake();
    } catch (error) {
      fail(error);
    }
  }

  rotateButton?.addEventListener("click", () => {
    if (rotateButton.disabled) return;
    rotating = !rotating;
    setRotateLabel();
    wake();
  });
  resetButton?.addEventListener("click", () => {
    if (resetButton.disabled) return;
    resetView();
    wake();
  });
  canvas?.addEventListener("pointerdown", (event) => {
    pointerStart = { x: event.clientX, y: event.clientY, pointerId: event.pointerId };
  });
  canvas?.addEventListener("keydown", (event) => {
    if (!brainRoot) return;
    const step = event.shiftKey ? 0.18 : 0.08;
    if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) {
      event.preventDefault();
      if (event.key === "ArrowLeft") brainRoot.rotation.y -= step;
      if (event.key === "ArrowRight") brainRoot.rotation.y += step;
      if (event.key === "ArrowUp") brainRoot.rotation.x -= step;
      if (event.key === "ArrowDown") brainRoot.rotation.x += step;
      wake();
    } else if (event.key === "Home") {
      event.preventDefault();
      resetView();
      brainRoot.rotation.set(0, 0, 0);
      wake();
    }
  });
  canvas?.addEventListener("pointerup", (event) => {
    if (!pointerStart || pointerStart.pointerId !== event.pointerId || !raycasterHolder.raycaster || !camera || !brainRoot) {
      pointerStart = null;
      return;
    }
    const distance = Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y);
    pointerStart = null;
    if (distance > 5) return;
    updatePointer(event);
    raycasterHolder.raycaster.setFromCamera(raycasterHolder.pointer, camera);
    const hit = raycasterHolder.raycaster.intersectObjects(corticalMeshes, false)[0];
    if (hit) showSelected(hit.object);
    else showSelected(null);
    wake();
  });
  canvas?.addEventListener("pointermove", (event) => {
    if (!raycasterHolder.raycaster || !camera || !corticalMeshes.length || pointerStart) return;
    updatePointer(event);
    raycasterHolder.raycaster.setFromCamera(raycasterHolder.pointer, camera);
    const hit = raycasterHolder.raycaster.intersectObjects(corticalMeshes, false)[0];
    const nextMesh = hit?.object || null;
    if (nextMesh !== hoveredMesh) {
      if (hoveredMesh && hoveredMesh !== selectedMesh) clearHighlight(hoveredMesh);
      hoveredMesh = nextMesh;
      if (hoveredMesh && hoveredMesh !== selectedMesh) highlight(hoveredMesh, 0x5ab7bd, 0.22);
      canvas.style.cursor = hoveredMesh ? "pointer" : "grab";
      wake();
    }
  });
  canvas?.addEventListener("pointerleave", () => {
    if (hoveredMesh && hoveredMesh !== selectedMesh) clearHighlight(hoveredMesh);
    hoveredMesh = null;
    if (canvas) canvas.style.cursor = "grab";
    wake();
  });
  window.addEventListener("resize", () => { resize(); wake(); }, { passive: true });
  document.addEventListener("visibilitychange", wake);
  prefersReducedMotion.addEventListener?.("change", (event) => {
    if (!event.matches) return;
    rotating = false;
    setRotateLabel();
    wake();
  });
  document.addEventListener("aloop:language", () => {
    setRotateLabel();
    if (status && status.dataset.template === "selected" && selectedMesh) {
      const label = metadata(selectedMesh, "bx_label") || selectedMesh.name || t("hero.brainCortex", "大脑皮层");
      status.textContent = t("hero.brainSelected", "已选择：{label}").replace("{label}", label);
    } else if (stage.classList.contains("is-model-ready")) {
      setStatus("hero.brainReady", "模型已就绪。拖动旋转，滚轮缩放，点击皮层区域查看结构。");
    } else if (stage.classList.contains("is-model-error")) {
      setStatus("hero.brainModelError", "脑表面模型暂时无法加载，请检查网络或打开开源模型查看器。");
    } else {
      setStatus("hero.brainStatusLoading", "正在加载真实脑表面模型…");
    }
  });

  const observer = "IntersectionObserver" in window ? new IntersectionObserver((entries) => {
    inView = Boolean(entries[0]?.isIntersecting);
    if (inView) wake();
  }, { threshold: 0.03 }) : null;
  observer?.observe(stage);
  const teardown = () => {
    disposed = true;
    if (animationFrame) cancelAnimationFrame(animationFrame);
    observer?.disconnect();
    controls?.dispose();
    renderer?.dispose();
  };
  window.addEventListener("pagehide", teardown, { once: true });
  setRotateLabel();
  init();
})();
