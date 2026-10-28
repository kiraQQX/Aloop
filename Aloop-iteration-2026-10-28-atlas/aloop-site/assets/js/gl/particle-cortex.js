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
  const MODEL_URL = "https://raw.githubusercontent.com/itayinbarr/brainproject/main/brain-atlas/models/brain.glb";
  const DRACO_PATH = "https://www.gstatic.com/draco/versioned/decoders/1.5.7/";
  const FOV = 30, CAM_Z = 4.25, R = 1.3, EXTENT = 2.6, WAVE_SPEED = 3.2;
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

  /* ---------- point sets ---------- */
  // Deterministic PRNG so the procedural fallback is reproducible.
  const mulberry = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t1 = Math.imul(a ^ a >>> 15, 1 | a); t1 = t1 + Math.imul(t1 ^ t1 >>> 7, 61 | t1) ^ t1; return ((t1 ^ t1 >>> 14) >>> 0) / 4294967296; };

  function proceduralPoints(N) {
    const rnd = mulberry(20261023), pos = new Float32Array(N * 3), nrm = new Float32Array(N * 3), hemi = new Float32Array(N), seed = new Float32Array(N);
    const ax = [0.62, 0.95, 1.3];
    for (let i = 0; i < N; i++) {
      const h = i < N / 2 ? -1 : 1;
      let ux, uy, uz;
      do { const z = rnd() * 2 - 1, a = rnd() * 2 * Math.PI, r = Math.sqrt(1 - z * z); ux = r * Math.cos(a); uy = r * Math.sin(a); uz = z; } while (ux * h <= 0.02 || uy < -0.72);
      const fold = 0.05 * (Math.sin(9 * ux + 3 * uy) + Math.sin(8 * uy + 5 * uz) + Math.sin(7 * uz - 4 * ux)) / 3;
      const k = 1 + fold;
      pos[i * 3] = h * 0.05 + ux * ax[0] * k; pos[i * 3 + 1] = uy * ax[1] * k; pos[i * 3 + 2] = uz * ax[2] * k;
      const nx = ux / ax[0], ny = uy / ax[1], nz = uz / ax[2], nl = Math.hypot(nx, ny, nz);
      nrm[i * 3] = nx / nl; nrm[i * 3 + 1] = ny / nl; nrm[i * 3 + 2] = nz / nl;
      hemi[i] = h > 0 ? 1 : 0; seed[i] = rnd();
    }
    return { pos, nrm, hemi, seed };
  }

  /** Area-weighted uniform triangle sampling of the cortex meshes, balanced per hemisphere (PRT-2..4). */
  function sampleCortex(THREE, root, N) {
    const meta = (o, key) => { for (let n = o; n && n !== root.parent; n = n.parent) if (n.userData && n.userData[key] != null) return n.userData[key]; return ""; };
    root.updateMatrixWorld(true);
    const groups = [{ tris: [], area: [] }, { tris: [], area: [] }];   // 0: x<centre, 1: x>=centre
    const meshes = [];
    root.traverse(o => { if (o.isMesh && String(meta(o, "bx_cat")).toLowerCase() === "cortex") meshes.push(o); });
    if (!meshes.length) throw new Error("no cortex meshes");
    const box = new THREE.Box3(); meshes.forEach(m => box.expandByObject(m));
    const cx = (box.min.x + box.max.x) / 2;
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), e1 = new THREE.Vector3(), e2 = new THREE.Vector3();
    for (const m of meshes) {
      const g = m.geometry, p = g.attributes.position, idx = g.index;
      const label = String(meta(m, "bx_label") || m.name).toLowerCase();
      const labelHemi = /left|(^|[_.\s-])l($|[_.\s-])/.test(label) ? 0 : /right|(^|[_.\s-])r($|[_.\s-])/.test(label) ? 1 : -1;
      const count = idx ? idx.count / 3 : p.count / 3;
      for (let i = 0; i < count; i++) {
        const i0 = idx ? idx.getX(i * 3) : i * 3, i1 = idx ? idx.getX(i * 3 + 1) : i * 3 + 1, i2 = idx ? idx.getX(i * 3 + 2) : i * 3 + 2;
        a.fromBufferAttribute(p, i0).applyMatrix4(m.matrixWorld); b.fromBufferAttribute(p, i1).applyMatrix4(m.matrixWorld); c.fromBufferAttribute(p, i2).applyMatrix4(m.matrixWorld);
        const area = e1.subVectors(b, a).cross(e2.subVectors(c, a)).length() * 0.5;
        if (!(area > 0)) continue;
        const grp = groups[labelHemi >= 0 ? labelHemi : ((a.x + b.x + c.x) / 3 >= cx ? 1 : 0)];
        grp.tris.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
        grp.area.push((grp.area.length ? grp.area[grp.area.length - 1] : 0) + area);
      }
    }
    if (!groups[0].area.length || !groups[1].area.length) throw new Error("cortex lacks two hemispheres");
    const rnd = mulberry(7), pos = new Float32Array(N * 3), nrm = new Float32Array(N * 3), hemi = new Float32Array(N), seed = new Float32Array(N);
    const centroids = groups.map(g => { const s = [0, 0, 0]; for (let i = 0; i < g.tris.length; i += 3) { s[0] += g.tris[i]; s[1] += g.tris[i + 1]; s[2] += g.tris[i + 2]; } const n = g.tris.length / 3; return s.map(v => v / n); });
    for (let i = 0; i < N; i++) {
      const hi = i < N / 2 ? 0 : 1, g = groups[hi], total = g.area[g.area.length - 1];
      const target = rnd() * total; let lo = 0, hiIdx = g.area.length - 1;
      while (lo < hiIdx) { const mid = (lo + hiIdx) >> 1; if (g.area[mid] < target) lo = mid + 1; else hiIdx = mid; }
      const o = lo * 9, t = g.tris, su = Math.sqrt(rnd()), v = rnd();
      const w0 = 1 - su, w1 = su * (1 - v), w2 = su * v;
      const px = w0 * t[o] + w1 * t[o + 3] + w2 * t[o + 6], py = w0 * t[o + 1] + w1 * t[o + 4] + w2 * t[o + 7], pz = w0 * t[o + 2] + w1 * t[o + 5] + w2 * t[o + 8];
      e1.set(t[o + 3] - t[o], t[o + 4] - t[o + 1], t[o + 5] - t[o + 2]); e2.set(t[o + 6] - t[o], t[o + 7] - t[o + 1], t[o + 8] - t[o + 2]);
      const n = e1.cross(e2).normalize(), cen = centroids[hi];
      if (n.x * (px - cen[0]) + n.y * (py - cen[1]) + n.z * (pz - cen[2]) < 0) n.negate();
      pos.set([px, py, pz], i * 3); nrm.set([n.x, n.y, n.z], i * 3); hemi[i] = hi; seed[i] = rnd();
    }
    // Normalise: centre and scale the cloud to EXTENT (uniform scale keeps normals valid).
    let mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
    for (let i = 0; i < N; i++) for (let k = 0; k < 3; k++) { const v = pos[i * 3 + k]; if (v < mn[k]) mn[k] = v; if (v > mx[k]) mx[k] = v; }
    const ctr = mn.map((v, k) => (v + mx[k]) / 2), s = EXTENT / Math.max(mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]);
    for (let i = 0; i < N; i++) for (let k = 0; k < 3; k++) pos[i * 3 + k] = (pos[i * 3 + k] - ctr[k]) * s;
    return { pos, nrm, hemi, seed };
  }

  /* ---------- shaders ---------- */
  const VERT = `
    attribute vec3 aRest; attribute vec3 aNormal; attribute float aSeed; attribute float aHemi;
    uniform float uSize, uAmp; uniform vec3 uClickPos[3]; uniform float uClickT[3];
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
      float ang = aSeed * 6.2831 + disp * 2.0;
      vec3 ax = normalize(vec3(sin(aSeed*91.7), cos(aSeed*57.3), sin(aSeed*13.1 + 1.0)) + vec3(0.001));
      vec3 local = rotAxis(position, ax, ang) * uSize * (0.75 + 0.5 * fract(aSeed * 7.13));
      vec3 world = aRest + aNormal * (uAmp * 0.12 * ${R.toFixed(2)} * disp * (0.6 + 0.4 * fract(aSeed * 3.7))) + local;
      vec4 mv = modelViewMatrix * vec4(world, 1.0);
      gl_Position = projectionMatrix * mv;
      vec3 vn = normalize(normalMatrix * rotAxis(normal, ax, ang));
      float shade = clamp(0.25 + 0.75 * clamp(dot(vn, normalize(vec3(-0.45, 0.65, 0.62))), 0.0, 1.0) + (aHemi - 0.5) * 0.22, 0.0, 1.0);
      vec3 col = shade < 0.5 ? mix(uDeep, uPrimary, shade * 2.0) : mix(uPrimary, uMid, (shade - 0.5) * 2.0);
      col = mix(col, uCyan, step(0.88, fract(aSeed * 17.31)) * (0.55 + 0.35 * shade));
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
    // Surface-sampled particles only. Keep density restrained; mobile uses fewer instances.
    const N = small || (navigator.hardwareConcurrency || 8) <= 4 ? 520 : 1100;
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

    const css = getComputedStyle(document.documentElement);
    const col = (name, d) => new THREE.Color((css.getPropertyValue(name) || d).trim() || d);
    const uniforms = {
      // PRT-8: particle geometry scale is 10× the previous 0.007 baseline.
      uSize: { value: 0.07 }, uAmp: { value: 1 },
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
    const clicks = [];                                              // INT-4: <= 3 concurrent origins
    const ray = new THREE.Raycaster(), sphere = new THREE.Sphere(new THREE.Vector3(), R), inv = new THREE.Matrix4(), tmp = new THREE.Vector3();
    const frameTimes = []; let slowSince = 0, fastSince = 0;

    const limits = () => reduced ? { yaw: 6 * DEG, pitch: 3.4 * DEG, amp: 0.25 } : { yaw: 28 * DEG, pitch: 16 * DEG, amp: 1 };
    function resize() {
      const w = Math.max(1, stage.clientWidth), h = Math.max(1, stage.clientHeight);
      renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
      uniforms.uSize.value = (2 * CAM_Z * Math.tan(FOV * DEG / 2) / h) * 1.2;   // restrained ~2px particle facets
      wake();
    }
    function trigger(clientX, clientY, centre) {
      const rect = stage.getBoundingClientRect();
      const nx = centre ? 0 : ((clientX - rect.left) / rect.width) * 2 - 1, ny = centre ? 0 : -(((clientY - rect.top) / rect.height) * 2 - 1);
      mesh.updateMatrixWorld(true); camera.updateMatrixWorld(true);
      ray.setFromCamera({ x: nx, y: ny }, camera);
      inv.copy(mesh.matrixWorld).invert(); ray.ray.origin.applyMatrix4(inv); ray.ray.direction.transformDirection(inv);
      if (!ray.ray.intersectSphere(sphere, tmp)) { ray.ray.closestPointToPoint(sphere.center, tmp); tmp.setLength(R * 0.9); }
      if (clicks.length >= 3) clicks.shift();
      clicks.push({ pos: tmp.clone(), start: performance.now() });
      if (!centre) {
        stage.style.setProperty("--shock-x", ((clientX - rect.left) / rect.width * 100) + "%"); stage.style.setProperty("--shock-y", ((clientY - rect.top) / rect.height * 100) + "%");
        stage.classList.remove("has-shockwave"); void stage.offsetWidth; stage.classList.add("has-shockwave");
        setTimeout(() => stage.classList.remove("has-shockwave"), 700);
      }
      wake();
    }
    function frame(now) {
      raf = 0;
      if (!ready || lost) return;
      const dt = Math.min(0.05, (now - last) / 1000 || 0.016); last = now;
      const lim = limits();
      const tYaw = pointerIn ? ndcX * lim.yaw : 0, tPitch = pointerIn ? -ndcY * lim.pitch : 0;
      const tau = pointerIn ? 0.11 : 0.25, k = 1 - Math.exp(-dt / tau);   // INT-1: critically damped follow
      const gy = tYaw + keyYaw, gp = tPitch + keyPitch;
      yaw += (gy - yaw) * k; pitch += (gp - pitch) * k;
      mesh.rotation.set(pitch, yaw, 0);
      brainRoot.rotation.set(pitch, yaw, 0);
      uniforms.uAmp.value = lim.amp;
      for (let i = clicks.length - 1; i >= 0; i--) if ((now - clicks[i].start) / 1000 > 2.3) clicks.splice(i, 1);
      for (let i = 0; i < 3; i++) {
        const c = clicks[i]; uniforms.uClickT.value[i] = c ? (now - c.start) / 1000 : -1;
        if (c) uniforms.uClickPos.value[i].copy(c.pos);
      }
      renderer.render(scene, camera);
      // PRF-3: adaptive quality governor
      frameTimes.push(dt * 1000); if (frameTimes.length > 30) frameTimes.shift();
      if (frameTimes.length === 30) {
        const avg = frameTimes.reduce((s, v) => s + v, 0) / 30;
        if (avg > 24 && geo.instanceCount > 2000) { geo.instanceCount = Math.floor(geo.instanceCount / 2); frameTimes.length = 0; fastSince = 0; }
        else if (avg < 14 && geo.instanceCount < N) { fastSince ||= now; if (now - fastSince > 5000) { geo.instanceCount = Math.min(N, geo.instanceCount * 2); fastSince = 0; frameTimes.length = 0; } }
        else fastSince = 0;
      }
      const settled = Math.abs(gy - yaw) < 4e-4 && Math.abs(gp - pitch) < 4e-4 && !clicks.length;
      if (!settled) wake();
    }
    function wake() { if (raf || !ready || lost || !inView || document.hidden) return; last = performance.now(); raf = requestAnimationFrame(frame); }

    stage.addEventListener("pointermove", e => { const r = stage.getBoundingClientRect(); ndcX = ((e.clientX - r.left) / r.width) * 2 - 1; ndcY = -(((e.clientY - r.top) / r.height) * 2 - 1); pointerIn = true; wake(); });
    stage.addEventListener("pointerleave", () => { pointerIn = false; wake(); });
    stage.addEventListener("pointerdown", e => trigger(e.clientX, e.clientY, false));
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

    ready = true; stage.classList.add("is-ready"); resize(); setStatus("hero.particleLoading"); wake();

    /* Upgrade to the real cortical surface when the GLB is available (PRT-1). */
    try {
      const [{ GLTFLoader }, { DRACOLoader }] = await withTimeout(Promise.all([import("three/addons/loaders/GLTFLoader.js"), import("three/addons/loaders/DRACOLoader.js")]), 8500, "loaders");
      const draco = new DRACOLoader(); draco.setDecoderPath(DRACO_PATH);
      const loader = new GLTFLoader(); loader.setDRACOLoader(draco);
      const gltf = await withTimeout(loader.loadAsync(MODEL_URL), 20000, "brain GLB");
      const bounds = new THREE.Box3().setFromObject(gltf.scene);
      const center = bounds.getCenter(new THREE.Vector3());
      const size = bounds.getSize(new THREE.Vector3());
      const scale = EXTENT / Math.max(size.x, size.y, size.z);
      gltf.scene.position.set(-center.x * scale, -center.y * scale, -center.z * scale);
      gltf.scene.scale.setScalar(scale);
      gltf.scene.updateMatrixWorld(true);
      const meshMeta = (o, key) => {
        for (let n = o; n && n !== gltf.scene.parent; n = n.parent) {
          if (n.userData && n.userData[key] != null) return n.userData[key];
        }
        return "";
      };
      gltf.scene.traverse(o => {
        if (!o.isMesh) return;
        const isCortex = String(meshMeta(o, "bx_cat")).toLowerCase() === "cortex";
        o.visible = isCortex;
        if (!isCortex) return;
        o.material = brainMaterial;
        o.castShadow = false;
        o.receiveShadow = false;
      });
      brainRoot.add(gltf.scene);
      brainRoot.visible = true;
      // Sample from the real cortex mesh before hiding it. Visibility is local to this
      // homepage scene and never mutates shared Smart Brain product state/materials.
      const surfacePoints = sampleCortex(THREE, gltf.scene, N);
      gltf.scene.traverse(o => {
        if (o.isMesh && String(meshMeta(o, "bx_cat")).toLowerCase() === "cortex") o.visible = false;
      });
      setPoints(surfacePoints);
      draco.dispose(); stage.dataset.source = "cortex-glb"; stage.dataset.surface = "sampled-hidden-mesh"; setStatus("hero.particleReady"); wake();
    } catch (err) {
      console.warn("Particle cortex: anatomical GLB unavailable; retaining poster rather than fabricating a brain surface", err);
      stage.dataset.source = "unavailable";
      stage.classList.remove("is-ready");
      setStatus("hero.particleFail");
    }
  })();
})();
