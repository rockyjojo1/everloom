import { ASSET_CATALOG, ASSET_REGISTRY, isAssetUsed } from "@everloom/assets";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export function AssetBrowser() {
  const [query, setQuery] = useState("");
  const [pack, setPack] = useState("all");
  const [selected, setSelected] = useState(ASSET_CATALOG[0]!);
  const [details, setDetails] = useState({ dimensions: "Loading…", triangles: 0, animations: "None", rigged: false });
  const host = useRef<HTMLDivElement>(null);
  const packs = useMemo(() => [...new Set(ASSET_CATALOG.map((item) => item.pack))].sort(), []);
  const results = useMemo(() => ASSET_CATALOG.filter((item) =>
    (pack === "all" || item.pack === pack) && `${item.id} ${item.category} ${item.sourceFile}`.toLowerCase().includes(query.toLowerCase())), [query, pack]);
  const registryEntry = Object.values(ASSET_REGISTRY).find((item) => item.sourceFile === selected.sourceFile);

  useEffect(() => {
    if (!host.current) return;
    setDetails({ dimensions: "Loading…", triangles: 0, animations: "None", rigged: false });
    const element = host.current;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x17231f);
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.set(3, 2.4, 4);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x566457, 3));
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    element.appendChild(renderer.domElement);
    let model: THREE.Object3D | null = null;
    let frame = 0;
    let disposed = false;
    new GLTFLoader().load(`/models/${selected.sourceFile}`, (gltf) => {
      if (disposed) return;
      model = gltf.scene;
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      let triangles = 0;
      let rigged = false;
      model.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          const index = child.geometry.index;
          triangles += index ? index.count / 3 : child.geometry.attributes.position.count / 3;
        }
        if (child instanceof THREE.SkinnedMesh) rigged = true;
      });
      setDetails({
        dimensions: `${size.x.toFixed(2)} × ${size.y.toFixed(2)} × ${size.z.toFixed(2)}`,
        triangles: Math.round(triangles),
        animations: gltf.animations.map((clip) => clip.name).join(", ") || "None",
        rigged,
      });
      model.position.sub(center);
      model.scale.setScalar(2.5 / Math.max(size.x, size.y, size.z, 0.1));
      scene.add(model);
    });
    const resize = () => {
      renderer.setSize(element.clientWidth, element.clientHeight, false);
      camera.aspect = element.clientWidth / Math.max(1, element.clientHeight);
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    resize();
    const animate = () => {
      if (disposed) return;
      frame = requestAnimationFrame(animate);
      if (model) model.rotation.y += 0.006;
      renderer.render(scene, camera);
    };
    animate();
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      renderer.dispose();
      element.replaceChildren();
    };
  }, [selected]);

  return <main className="asset-browser">
    <header><div><span className="eyebrow">DEVELOPMENT TOOL</span><h1>Everloom Asset Browser</h1></div><b>{ASSET_CATALOG.length} assets indexed</b></header>
    <aside><input placeholder="Filter assets…" value={query} onChange={(e) => setQuery(e.target.value)} />
      <select value={pack} onChange={(e) => setPack(e.target.value)}><option value="all">All packs</option>{packs.map((item) => <option key={item}>{item}</option>)}</select>
      <div className="asset-list">{results.map((item) => <button className={item.id === selected.id ? "active" : ""} onClick={() => setSelected(item)} key={item.id}>
        <strong>{item.id}</strong><small>{item.pack} · {item.category}</small>{isAssetUsed(item.sourceFile) && <i>USED</i>}</button>)}</div>
    </aside>
    <section className="asset-preview"><div ref={host} /><article><h2>{selected.id}</h2><code>{selected.sourceFile}</code>
      <dl><dt>Pack</dt><dd>{selected.pack}</dd><dt>Format</dt><dd>{selected.format}</dd><dt>Size</dt><dd>{Math.round(selected.bytes / 1024)} KB</dd>
        <dt>Dimensions</dt><dd>{details.dimensions}</dd><dt>Triangles</dt><dd>{details.triangles.toLocaleString()}</dd>
        <dt>Rigged</dt><dd>{details.rigged ? "Yes" : "No"}</dd><dt>Animations</dt><dd>{details.animations}</dd>
        <dt>Runtime ID</dt><dd>{registryEntry?.id ?? "Unassigned"}</dd><dt>Licence</dt><dd>{registryEntry?.licence ?? "See pack metadata"}</dd></dl></article></section>
  </main>;
}
