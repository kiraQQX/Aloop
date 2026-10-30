/* Aloop homepage cortical surface (CHG-4).
 * Render the real cortical mesh as the primary visual, with a sparse instanced accent layer
 * sampled from its surface. Click ripple and eased pointer rotation remain shader-driven.
 * Source geometry: itayinbarr/brainproject -> Z-Anatomy / BodyParts3D (CC BY-SA 4.0).
 */
(() => {
  const stage = document.getElementById("particleCortexStage");
  if (!stage) return;
  const canvas = stage.querySelector(".particle-cortex-canvas");
  const statusEl = document.getElementById("particleCortexState");
  // Self-hosted copy (assets/models/atlas/): the upstream raw.githubusercontent.com URL
  // is reset in mainland China, which made the homepage report a model load failure.
  const MODEL_URL = new URL("assets/models/atlas/brain.glb", document.baseURI).href;
  const DRACO_PATH = new URL("assets/models/atlas/draco/", document.baseURI).href;
  const FOV = 30, CAM_Z = 4.25, R = 1.3, EXTENT = 2.6;
  const TUNING = Object.freeze({
    waveSpeed: 3.2,
    desktopParticles: 1800,
    lowPowerParticles: 1120,
    mobileParticles: 720,
    qualityFloor: 0.58,
    particlePixelScale: window.matchMedia("(max-width: 700px)").matches ? 5.2 : 10.2,
    hoverRadius: 0.38,
    hoverLift: 0.012,
    hoverPush: 0.010,
    hoverFollow: 0.13,
    pointerYaw: 12,
    pointerPitch: 7,
    pointerFollow: 0.12,
    pointerReturn: 0.32,
    clickLifetime: 2.3,
    maxClickWaves: 3
  });
  const WAVE_SPEED = TUNING.waveSpeed;
  const DEG = Math.PI / 180;
  const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const t = (k, d) => window.Aloop?.i18n?.t(k) || d;
  const withTimeout = (p, ms, label) => new Promise((res, rej) => {
    const id = setTimeout(() => rej(new Error(`${label} timed out`)), ms);
    p.then(v => { clearTimeout(id); res(v); }, e => { clearTimeout(id); rej(e); });
  });
  let statusKey = "hero.particleLoading";
  const setStatus = key => { statusKey = key; if (statusEl) statusEl.textContent = t(key, key); };
  document.addEventListener("aloop:language", () => setStatus(statusKey));

  const hasWebGL = () => { try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); } catch { return false; } };
  if (!hasWebGL()) { setStatus("hero.particleNoWebgl"); return; }   // PRF-6: poster stays visible

  /* ---------- anatomical surface sampling ---------- */
  const mulberry = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t1 = Math.imul(a ^ a >>> 15, 1 | a); t1 = t1 + Math.imul(t1 ^ t1 >>> 7, 61 | t1) ^ t1; return ((t1 ^ t1 >>> 14) >>> 0) / 4294967296; };

  /**
   * Area-weighted sampling on the real cortical surface.
   * Per-vertex normals are interpolated at each sample; this avoids the centroid-based
   * normal flip, which can invert normals on concave sulci/folds.
   */
  function sampleCortex(THREE, root, N) {
    const meta = (o, key) => {
      for (let n = o; n && n !== root.parent; n = n.parent) {
        if (n.userData && n.userData[key] != null) return n.userData[key];
      }
      return "";
    };

    root.updateMatrixWorld(true);
    const groups = [{ tris: [], area: [] }, { tris: [], area: [] }];
    const meshes = [];
    root.traverse(o => {
      if (o.isMesh && String(meta(o, "bx_cat")).toLowerCase() === "cortex") meshes.push(o);
    });
    if (!meshes.length) throw new Error("no cortex meshes");

    const box = new THREE.Box3();
    meshes.forEach(m => box.expandByObject(m));
    const centre = box.getCenter(new THREE.Vector3());
    const normalMatrix = new THREE.Matrix3();
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    const na = new THREE.Vector3(), nb = new THREE.Vector3(), nc = new THREE.Vector3();
    const e1 = new THREE.Vector3(), e2 = new THREE.Vector3();

    for (const m of meshes) {
      const g = m.geometry;
      const p = g.attributes.position;
      if (!g.attributes.normal) g.computeVertexNormals();
      const normal = g.attributes.normal;
      const idx = g.index;
      normalMatrix.getNormalMatrix(m.matrixWorld);
      const label = String(meta(m, "bx_label") || m.name).toLowerCase();
      const labelHemi = /left|(^|[_.\s-])l($|[_.\s-])/.test(label) ? 0
        : /right|(^|[_.\s-])r($|[_.\s-])/.test(label) ? 1 : -1;
      const count = idx ? idx.count / 3 : p.count / 3;

      for (let i = 0; i < count; i++) {
        const i0 = idx ? idx.getX(i * 3) : i * 3;
        const i1 = idx ? idx.getX(i * 3 + 1) : i * 3 + 1;
        const i2 = idx ? idx.getX(i * 3 + 2) : i * 3 + 2;
        a.fromBufferAttribute(p, i0).applyMatrix4(m.matrixWorld);
        b.fromBufferAttribute(p, i1).applyMatrix4(m.matrixWorld);
        c.fromBufferAttribute(p, i2).applyMatrix4(m.matrixWorld);
        const area = e1.subVectors(b, a).cross(e2.subVectors(c, a)).length() * 0.5;
        if (!(area > 0)) continue;

        const groupIndex = labelHemi >= 0 ? labelHemi : ((a.x + b.x + c.x) / 3 >= centre.x ? 1 : 0);
        const group = groups[groupIndex];
        // 18 values per triangle: 3 world-space vertices followed by 3 world-space normals.
        group.tris.push(
          a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z,
          ...na.fromBufferAttribute(normal, i0).applyMatrix3(normalMatrix).normalize().toArray(),
          ...nb.fromBufferAttribute(normal, i1).applyMatrix3(normalMatrix).normalize().toArray(),
          ...nc.fromBufferAttribute(normal, i2).applyMatrix3(normalMatrix).normalize().toArray()
        );
        group.area.push((group.area.length ? group.area[group.area.length - 1] : 0) + area);
      }
    }

    if (!groups[0].area.length || !groups[1].area.length) throw new Error("cortex lacks two hemispheres");
    const total0 = groups[0].area[groups[0].area.length - 1];
    const total1 = groups[1].area[groups[1].area.length - 1];
    // Proportional allocation keeps point density per unit surface area consistent.
    const count0 = Math.max(1, Math.min(N - 1, Math.round(N * total0 / (total0 + total1))));
    const rnd = mulberry(7);
    const pos = new Float32Array(N * 3), nrm = new Float32Array(N * 3);
    const hemi = new Float32Array(N), seed = new Float32Array(N);
    // Coordinates are already centred/scaled by modelRoot. Do not normalise the
    // sample cloud independently: pointer ray hits must remain in this same space.
    for (let i = 0; i < N; i++) {
      const hi = i < count0 ? 0 : 1;
      const group = groups[hi], total = group.area[group.area.length - 1];
      const target = rnd() * total;
      let lo = 0, hiIdx = group.area.length - 1;
      while (lo < hiIdx) {
        const mid = (lo + hiIdx) >> 1;
        if (group.area[mid] < target) lo = mid + 1;
        else hiIdx = mid;
      }

      const offset = lo * 18, tri = group.tris;
      const su = Math.sqrt(rnd()), v = rnd();
      const w0 = 1 - su, w1 = su * (1 - v), w2 = su * v;
      const px = w0 * tri[offset] + w1 * tri[offset + 3] + w2 * tri[offset + 6];
      const py = w0 * tri[offset + 1] + w1 * tri[offset + 4] + w2 * tri[offset + 7];
      const pz = w0 * tri[offset + 2] + w1 * tri[offset + 5] + w2 * tri[offset + 8];
      const n = na.set(
        w0 * tri[offset + 9] + w1 * tri[offset + 12] + w2 * tri[offset + 15],
        w0 * tri[offset + 10] + w1 * tri[offset + 13] + w2 * tri[offset + 16],
        w0 * tri[offset + 11] + w1 * tri[offset + 14] + w2 * tri[offset + 17]
      ).normalize();

      pos.set([px, py, pz], i * 3);
      nrm.set([n.x, n.y, n.z], i * 3);
      hemi[i] = hi;
      seed[i] = rnd();
    }
    return { pos, nrm, hemi, seed, meshes };
  }

  /* ---------- shaders ---------- */
  const VERT = `
    attribute vec3 aRest; attribute vec3 aNormal; attribute float aSeed; attribute float aHemi;
    uniform float uSize, uAmp, uHover; uniform vec3 uHoverPos;
    uniform vec3 uClickPos[3]; uniform float uClickT[3];
    uniform vec3 uDeep, uPrimary, uMid, uCyan, uSignal;
    varying vec3 vColor;
    vec3 rotAxis(vec3 v, vec3 k, float a){ float c = cos(a), s = sin(a); return v*c + cross(k,v)*s + k*dot(k,v)*(1.0-c); }
    void main(){
      float disp = 0.0, front = 0.0;
      for (int i = 0; i < 3; i++) {
        if (uClickT[i] < 0.0) continue;
        float d = distance(aRest, uClickPos[i]);
        float s = uClickT[i] - d / ${WAVE_SPEED.toFixed(1)};
        if (s < 0.0) continue;
        float sp = max(s - 0.22, 0.0);
        float f = s < 0.22 ? 1.0 - pow(1.0 - s / 0.22, 3.0) : exp(-5.6 * sp) * cos(4.2 * sp);
        disp += f * (0.35 + 0.65 * exp(-d * d / 2.5));
        front = max(front, exp(-pow((s - 0.04) / 0.07, 2.0)));
      }
      disp = clamp(disp, -0.2, 1.3);
      float hoverD = distance(aRest, uHoverPos);
      float hover = uHover * uAmp * (1.0 - smoothstep(0.04, ${TUNING.hoverRadius.toFixed(2)}, hoverD));
      vec3 hoverDir = normalize(aRest - uHoverPos + aNormal * 0.002);
      float ang = aSeed * 6.2831 + disp * 2.0 * uAmp;
      vec3 ax = normalize(vec3(sin(aSeed*91.7), cos(aSeed*57.3), sin(aSeed*13.1 + 1.0)) + vec3(0.001));
      vec3 local = rotAxis(position, ax, ang) * uSize * (0.75 + 0.5 * fract(aSeed * 7.13));
      vec3 world = aRest
        + aNormal * (uAmp * 0.12 * ${R.toFixed(2)} * disp * (0.6 + 0.4 * fract(aSeed * 3.7)) + hover * ${TUNING.hoverLift.toFixed(3)})
        + hoverDir * (hover * ${TUNING.hoverPush.toFixed(3)})
        + local;
      vec4 mv = modelViewMatrix * vec4(world, 1.0);
      gl_Position = projectionMatrix * mv;
      vec3 vn = normalize(normalMatrix * rotAxis(normal, ax, ang));
      float shade = clamp(0.25 + 0.75 * clamp(dot(vn, normalize(vec3(-0.45, 0.65, 0.62))), 0.0, 1.0) + (aHemi - 0.5) * 0.22, 0.0, 1.0);
      vec3 col = shade < 0.5 ? mix(uDeep, uPrimary, shade * 2.0) : mix(uPrimary, uMid, (shade - 0.5) * 2.0);
      col = mix(col, uCyan, step(0.88, fract(aSeed * 17.31)) * (0.55 + 0.35 * shade));
      col = mix(col, uCyan, hover * 0.42);
      col = mix(col, uSignal, front * step(0.97, fract(aSeed * 29.7)));
      col = mix(col, vec3(0.52, 0.69, 0.85), smoothstep(-4.6, -5.9, mv.z) * 0.3);
      vColor = col;
    }`;
  const FRAG = `varying vec3 vColor;
    void main(){
      gl_FragColor = vec4(vColor, 1.0);
      #include <colorspace_fragment>
    }`;

  /* ---------- main ---------- */
  (async () => {
    let THREE;
    try { THREE = await withTimeout(import("three"), 8500, "Three.js import"); }
    catch (err) { console.warn("Particle cortex: Three.js unavailable", err); setStatus("hero.particleFail"); return; }

    const small = window.matchMedia("(max-width: 767px)").matches;
    // Keep the surface readable, not cloud-dense. Counts are starting tiers; the FPS governor can reduce them.
    const cores = navigator.hardwareConcurrency || 8;
    const N = small ? TUNING.mobileParticles
      : cores <= 4 ? TUNING.lowPowerParticles : TUNING.desktopParticles;
    const MIN_INSTANCES = Math.max(420, Math.floor(N * TUNING.qualityFloor));
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, small ? 1 : 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 50);
    camera.position.set(0, 0.10, CAM_Z); camera.lookAt(0, 0, 0);

    // Preserve a readable cortical surface underneath the point accents.
    const brainRoot = new THREE.Group();
    const brainMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color("#91A9C7"),
      roughness: 0.82,
      metalness: 0.02,
      emissive: new THREE.Color("#101B32"),
      emissiveIntensity: 0.24,
      side: THREE.DoubleSide
    });
    brainRoot.visible = false;
    scene.add(brainRoot);
    scene.add(new THREE.HemisphereLight(0xDDE8FF, 0x101321, 1.55));
    const keyLight = new THREE.DirectionalLight(0xE7EEFF, 2.0);
    keyLight.position.set(-3.5, 4.0, 5.0);
    scene.add(keyLight);
    const rimLight = new THREE.DirectionalLight(0xF2CC4D, 0.45);
    rimLight.position.set(4.0, 1.5, -3.0);
    scene.add(rimLight);

    const uniforms = {
      // PRT-8: particle geometry scale is 10× the previous 0.007 baseline.
      uSize: { value: 0.07 }, uAmp: { value: 1 },
      uHoverPos: { value: new THREE.Vector3() }, uHover: { value: 0 },
      uClickPos: { value: [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()] }, uClickT: { value: [-1, -1, -1] },
      uDeep: { value: new THREE.Color("#23466D") }, uPrimary: { value: new THREE.Color("#315E91") }, uMid: { value: new THREE.Color("#F5F7FA") },
      uCyan: { value: new THREE.Color("#FFFFFF") }, uSignal: { value: new THREE.Color("#F2CC4D") },
    };
    const geo = new THREE.InstancedBufferGeometry();
    geo.copy(new THREE.TetrahedronGeometry(1, 0));                // PRT-7: regular tetrahedron, non-indexed
    const attrs = {};
    const addAttr = (name, size) => { attrs[name] = new THREE.InstancedBufferAttribute(new Float32Array(N * size), size); geo.setAttribute(name, attrs[name]); };
    addAttr("aRest", 3); addAttr("aNormal", 3); addAttr("aSeed", 1); addAttr("aHemi", 1);
    geo.instanceCount = N;
    const mesh = new THREE.Mesh(geo, new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms }));
    mesh.frustumCulled = false;
    scene.add(mesh);
    const setPoints = d => { attrs.aRest.array.set(d.pos); attrs.aNormal.array.set(d.nrm); attrs.aSeed.array.set(d.seed); attrs.aHemi.array.set(d.hemi); Object.values(attrs).forEach(a => { a.needsUpdate = true; }); };
    // Wait for the real cortical surface before placing any particles.
    // The static poster remains visible if the upstream model cannot be loaded.

    /* state */
    let yaw = 0, pitch = 0, keyYaw = 0, keyPitch = 0, ndcX = 0, ndcY = 0, pointerIn = false;
    let raf = 0, last = 0, inView = true, ready = false, lost = false, reduced = motionQuery.matches;
    let pointerDirty = false, hoverTarget = 0;
    let shockTimer = 0;
    const hoverPosTarget = new THREE.Vector3();
    let cortexMeshes = [];
    const clicks = [];                                              // At most 3 concurrent click-wave origins.
    const ray = new THREE.Raycaster(), sphere = new THREE.Sphere(new THREE.Vector3(), R);
    const inv = new THREE.Matrix4(), tmp = new THREE.Vector3();
    const frameTimes = []; let fastSince = 0;

    // Pointer rotation is intentionally subtle; a local hover field handles close interaction.
    const limits = () => reduced
      ? { yaw: 5 * DEG, pitch: 3 * DEG, amp: 0.25 }
      : { yaw: TUNING.pointerYaw * DEG, pitch: TUNING.pointerPitch * DEG, amp: 1 };
    function resize() {
      const w = Math.max(1, stage.clientWidth), h = Math.max(1, stage.clientHeight);
      renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
      uniforms.uSize.value = (2 * CAM_Z * Math.tan(FOV * DEG / 2) / h) * TUNING.particlePixelScale;
      wake();
    }
    function pickSurface(nx, ny, allowSphereFallback = false) {
      camera.updateMatrixWorld(true);
      brainRoot.updateMatrixWorld(true);
      ray.setFromCamera({ x: nx, y: ny }, camera);

      // Raycast against the original cortex meshes, which are hidden from rendering but
      // retained as anatomical picking surfaces.
      if (cortexMeshes.length) {
        const hits = ray.intersectObjects(cortexMeshes, false);
        if (hits.length) {
          inv.copy(brainRoot.matrixWorld).invert();
          return hits[0].point.clone().applyMatrix4(inv);
        }
      }

      if (!allowSphereFallback) return null;
      // Fallback only for click/keyboard activation when a very thin mesh misses the ray.
      mesh.updateMatrixWorld(true);
      inv.copy(mesh.matrixWorld).invert();
      const localRay = new THREE.Ray(
        ray.ray.origin.clone().applyMatrix4(inv),
        ray.ray.direction.clone().transformDirection(inv)
      );
      if (!localRay.intersectSphere(sphere, tmp)) return null;
      return tmp.clone();
    }

    function trigger(clientX, clientY, centre) {
      const rect = stage.getBoundingClientRect();
      const nx = centre ? 0 : ((clientX - rect.left) / rect.width) * 2 - 1;
      const ny = centre ? 0 : -(((clientY - rect.top) / rect.height) * 2 - 1);
      const point = pickSurface(nx, ny, true);
      if (!point) return;

      hoverPosTarget.copy(point);
      hoverTarget = 1;
      if (clicks.length >= TUNING.maxClickWaves) clicks.shift();
      clicks.push({ pos: point, start: performance.now() });
      if (!centre) {
        stage.style.setProperty("--shock-x", ((clientX - rect.left) / rect.width * 100) + "%");
        stage.style.setProperty("--shock-y", ((clientY - rect.top) / rect.height * 100) + "%");
        stage.classList.remove("has-shockwave"); void stage.offsetWidth; stage.classList.add("has-shockwave");
        clearTimeout(shockTimer);
        shockTimer = setTimeout(() => stage.classList.remove("has-shockwave"), 700);
      }
      wake();
    }

    function frame(now) {
      raf = 0;
      if (!ready || lost) return;
      const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
      last = now;
      const lim = limits();
      const targetYaw = pointerIn ? ndcX * lim.yaw : 0;
      const targetPitch = pointerIn ? -ndcY * lim.pitch : 0;
      const tau = pointerIn ? TUNING.pointerFollow : TUNING.pointerReturn;
      const k = 1 - Math.exp(-dt / tau);
      const gy = targetYaw + keyYaw, gp = targetPitch + keyPitch;
      yaw += (gy - yaw) * k;
      pitch += (gp - pitch) * k;

      const px = pointerIn ? ndcX * 0.022 : 0;
      const py = pointerIn ? ndcY * 0.014 : 0;
      mesh.rotation.set(pitch, yaw, 0);
      brainRoot.rotation.set(pitch, yaw, 0);
      mesh.position.set(px, py, 0);
      brainRoot.position.set(px, py, 0);
      uniforms.uAmp.value = lim.amp;

      if (pointerDirty) {
        const hit = pickSurface(ndcX, ndcY, false);
        pointerDirty = false;
        if (hit) {
          hoverPosTarget.copy(hit);
          hoverTarget = 1;
        } else {
          hoverTarget = 0;
        }
      }
      const hoverK = 1 - Math.exp(-dt / TUNING.hoverFollow);
      uniforms.uHover.value += (hoverTarget - uniforms.uHover.value) * hoverK;
      uniforms.uHoverPos.value.lerp(hoverPosTarget, hoverK);

      for (let i = clicks.length - 1; i >= 0; i--) {
        if ((now - clicks[i].start) / 1000 > TUNING.clickLifetime) clicks.splice(i, 1);
      }
      for (let i = 0; i < TUNING.maxClickWaves; i++) {
        const c = clicks[i];
        uniforms.uClickT.value[i] = c ? (now - c.start) / 1000 : -1;
        if (c) uniforms.uClickPos.value[i].copy(c.pos);
      }

      renderer.render(scene, camera);

      // Adaptive instance count: the previous >2000 guard could never fire because N <= 1100.
      frameTimes.push(dt * 1000);
      if (frameTimes.length > 30) frameTimes.shift();
      if (frameTimes.length === 30) {
        const avg = frameTimes.reduce((sum, value) => sum + value, 0) / frameTimes.length;
        if (avg > 23 && geo.instanceCount > MIN_INSTANCES) {
          geo.instanceCount = Math.max(MIN_INSTANCES, Math.floor(geo.instanceCount * 0.82));
          frameTimes.length = 0;
          fastSince = 0;
        } else if (avg < 18 && geo.instanceCount < N) {
          fastSince ||= now;
          if (now - fastSince > 5000) {
            geo.instanceCount = Math.min(N, Math.ceil(geo.instanceCount * 1.12));
            fastSince = 0;
            frameTimes.length = 0;
          }
        } else {
          fastSince = 0;
        }
      }

      const settled = Math.abs(gy - yaw) < 4e-4
        && Math.abs(gp - pitch) < 4e-4
        && Math.abs(uniforms.uHover.value - hoverTarget) < 0.004
        && !pointerDirty
        && !clicks.length;
      if (!settled) wake();
    }

    function wake() { if (raf || !ready || lost || !inView || document.hidden) return; last = performance.now(); raf = requestAnimationFrame(frame); }

    stage.addEventListener("pointermove", e => {
      const r = stage.getBoundingClientRect();
      ndcX = ((e.clientX - r.left) / r.width) * 2 - 1;
      ndcY = -(((e.clientY - r.top) / r.height) * 2 - 1);
      pointerIn = true;
      pointerDirty = true;
      wake();
    });
    stage.addEventListener("pointerleave", () => {
      pointerIn = false;
      pointerDirty = false;
      hoverTarget = 0;
      wake();
    });
    stage.addEventListener("pointercancel", () => {
      pointerIn = false;
      pointerDirty = false;
      hoverTarget = 0;
      wake();
    });
    stage.addEventListener("pointerdown", e => {
      if (e.button === 0) trigger(e.clientX, e.clientY, false);
    });
    stage.addEventListener("keydown", e => {
      const s = 6 * DEG, lim = 35 * DEG;
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); trigger(0, 0, true); return; }
      if (e.key === "Home") { keyYaw = keyPitch = 0; }
      else if (e.key === "ArrowLeft") keyYaw = Math.max(-lim, keyYaw - s);
      else if (e.key === "ArrowRight") keyYaw = Math.min(lim, keyYaw + s);
      else if (e.key === "ArrowUp") keyPitch = Math.max(-lim, keyPitch - s);
      else if (e.key === "ArrowDown") keyPitch = Math.min(lim, keyPitch + s);
      else return;
      e.preventDefault(); wake();
    });
    new ResizeObserver(resize).observe(stage);
    new IntersectionObserver(es => { inView = es[0].isIntersecting; if (inView) wake(); }).observe(stage);
    document.addEventListener("visibilitychange", wake);
    motionQuery.addEventListener?.("change", () => { reduced = motionQuery.matches; wake(); });
    canvas.addEventListener("webglcontextlost", e => { e.preventDefault(); lost = true; setStatus("hero.particleContextLost"); });
    canvas.addEventListener("webglcontextrestored", () => { lost = false; setStatus("hero.particleReady"); wake(); });

    setStatus("hero.particleLoading");

    /* Activate only after the real cortical surface has been sampled. */
    try {
      const [{ GLTFLoader }, { DRACOLoader }] = await withTimeout(Promise.all([import("three/addons/loaders/GLTFLoader.js"), import("three/addons/loaders/DRACOLoader.js")]), 8500, "loaders");
      const draco = new DRACOLoader(); draco.setDecoderPath(DRACO_PATH);
      const loader = new GLTFLoader(); loader.setDRACOLoader(draco);
      const gltf = await withTimeout(loader.loadAsync(MODEL_URL), 20000, "brain GLB");
      gltf.scene.updateMatrixWorld(true);
      const meshMeta = (o, key) => {
        for (let n = o; n && n !== gltf.scene.parent; n = n.parent) {
          if (n.userData && n.userData[key] != null) return n.userData[key];
        }
        return "";
      };
      const sourceCortex = [];
      gltf.scene.traverse(o => {
        if (o.isMesh && String(meshMeta(o, "bx_cat")).toLowerCase() === "cortex") sourceCortex.push(o);
      });
      if (!sourceCortex.length) throw new Error("no cortex meshes");

      // Fit to the cortex bounds, not the whole GLB (which may also contain non-cortical parts).
      const cortexBounds = new THREE.Box3();
      sourceCortex.forEach(m => cortexBounds.expandByObject(m));
      const center = cortexBounds.getCenter(new THREE.Vector3());
      const size = cortexBounds.getSize(new THREE.Vector3());
      const scale = EXTENT / Math.max(size.x, size.y, size.z);
      const modelRoot = new THREE.Group();
      modelRoot.scale.setScalar(scale);
      modelRoot.position.copy(center).multiplyScalar(-scale);
      modelRoot.add(gltf.scene);
      brainRoot.add(modelRoot);
      brainRoot.updateMatrixWorld(true);

      gltf.scene.traverse(o => {
        if (!o.isMesh) return;
        const isCortex = String(meshMeta(o, "bx_cat")).toLowerCase() === "cortex";
        o.visible = isCortex;
        if (!isCortex) return;
        o.material = brainMaterial;
        o.castShadow = false;
        o.receiveShadow = false;
      });
      brainRoot.visible = true;
      // Sample from the real cortex mesh before hiding it. Visibility is local to this
      // homepage scene and never mutates shared Smart Brain product state/materials.
      const surfacePoints = sampleCortex(THREE, gltf.scene, N);
      cortexMeshes = surfacePoints.meshes;
      gltf.scene.traverse(o => {
        if (o.isMesh && String(meshMeta(o, "bx_cat")).toLowerCase() === "cortex") o.visible = false;
      });
      setPoints(surfacePoints);
      draco.dispose();
      stage.dataset.source = "cortex-glb";
      stage.dataset.surface = "sampled-hidden-mesh";
      ready = true;
      stage.classList.add("is-ready");
      resize();
      setStatus("hero.particleReady");
      wake();
    } catch (err) {
      console.warn("Particle cortex: anatomical GLB unavailable; retaining poster rather than fabricating a brain surface", err);
      ready = false;
      stage.dataset.source = "unavailable";
      stage.classList.remove("is-ready");
      setStatus("hero.particleFail");
    }
  })();
})();
