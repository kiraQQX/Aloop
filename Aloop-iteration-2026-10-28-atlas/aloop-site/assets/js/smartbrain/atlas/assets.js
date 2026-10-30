/* Atlas assets: loads manifest + GLB once, prepares meshes once, caches for every visit.
 * BASE: set window.ALOOP_ATLAS_BASE before this script to self-host (recommended; see TECHNICAL_SPECIFICATIONS). */
(function () {
  const Aloop = window.Aloop = window.Aloop || {};
  const atlas = Aloop.atlas = Aloop.atlas || {};
  // Model + manifest are self-hosted under assets/models/atlas/ (see ATTRIBUTION.md).
  // They used to come from raw.githubusercontent.com, which is reset in mainland China.
  const LOCAL_BASE = new URL("assets/models/atlas/", document.baseURI).href;
  const BASE = (window.ALOOP_ATLAS_BASE || LOCAL_BASE).replace(/\/?$/, "/");
  const DRACO = window.ALOOP_DRACO_PATH || new URL("assets/models/atlas/draco/", document.baseURI).href;
  let modelPromise = null, manifestPromise = null;

  const metaOf = obj => { for (let o = obj; o; o = o.parent) if (o.userData && o.userData.bx_id != null) return o.userData; return null; };

  function loadManifest() {
    return manifestPromise || (manifestPromise = fetch(BASE + "manifest.json").then(r => { if (!r.ok) throw new Error("manifest " + r.status); return r.json(); })
      .then(raw => { if (!atlas.data.ingest(raw, "manifest")) throw new Error("manifest empty"); return true; })
      .catch(err => { manifestPromise = null; console.warn("Atlas manifest unavailable; will index from GLB extras.", err); return false; }));
  }
  function loadModel(onProgress) {
    if (modelPromise) return modelPromise;
    modelPromise = (async () => {
      const [THREE, { GLTFLoader }, { DRACOLoader }] = await Promise.all([import("three"), import("three/addons/loaders/GLTFLoader.js"), import("three/addons/loaders/DRACOLoader.js")]);
      const draco = new DRACOLoader(); draco.setDecoderPath(DRACO);
      const loader = new GLTFLoader(); loader.setDRACOLoader(draco);
      const gltf = await new Promise((res, rej) => loader.load(BASE + "brain.glb", res, e => onProgress && e.total && onProgress(e.loaded / e.total), rej));
      draco.dispose();
      const root = new THREE.Group(); root.add(gltf.scene);
      const meshesById = new Map(), rawMeta = [];
      gltf.scene.traverse(obj => {
        if (!obj.isMesh) return;
        const meta = metaOf(obj); if (!meta) return;
        const id = String(meta.bx_id);
        obj.userData.atlasId = id;
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        const own = mats.map(m => { const c = m.clone(); if ("roughness" in c) { c.roughness = Math.min(1, Math.max(.42, c.roughness ?? .72)); c.metalness = Math.min(.18, c.metalness ?? 0); } return c; });
        obj.material = own.length === 1 ? own[0] : own;       // cloned ONCE; highlight/fade mutate these
        if (!meshesById.has(id)) { meshesById.set(id, []); rawMeta.push({ bx_id: id, bx_label: meta.bx_label ?? obj.name, bx_cat: meta.bx_cat, bx_side: meta.bx_side, bx_region: meta.bx_region }); }
        meshesById.get(id).push(obj);
      });
      const box = new THREE.Box3().setFromObject(root), c = box.getCenter(new THREE.Vector3()), s = box.getSize(new THREE.Vector3());
      gltf.scene.position.sub(c); root.scale.setScalar(2.7 / (Math.max(s.x, s.y, s.z) || 1)); root.updateMatrixWorld(true);
      return { THREE, root, meshesById, rawMeta };
    })().catch(e => { modelPromise = null; throw e; });
    return modelPromise;
  }
  atlas.assets = { BASE, loadManifest, loadModel };
})();
