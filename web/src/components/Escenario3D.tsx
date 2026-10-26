import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

export interface ParteEscena { valor: number; color: string }
export interface ItemEscena {
  id: string;
  etiqueta: string;
  valor: number;
  color: string;
  /** Solo en modo «anillos»: composición que suma 100. */
  partes?: ParteEscena[];
}

interface Props {
  items: ItemEscena[];
  modo: "barras" | "anillos";
  seleccion: string | null;
  onSeleccion: (id: string) => void;
  ariaLabel: string;
  formatear: (v: number) => string;
}

const reducido = () => typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Escena Three.js interactiva para las fichas: barras extruidas (volumen) o anillos
 * de composición. Clic/tap selecciona; arrastrar rota la escena. Se renderiza sólo
 * mientras es visible. Si WebGL no está disponible, no muestra nada y las fichas
 * HTML siguen funcionando.
 */
export default function Escenario3D({ items, modo, seleccion, onSeleccion, ariaLabel, formatear }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const latest = useRef({ items, seleccion, onSeleccion, formatear });
  latest.current = { items, seleccion, onSeleccion, formatear };
  const [soporte, setSoporte] = useState(true);
  const [enfoque, setEnfoque] = useState<string | null>(null);
  const clave = items.map(i => `${i.id}:${i.valor}:${(i.partes ?? []).map(p => p.valor).join(",")}`).join("|");
  const reactualizar = useRef<() => void>(() => {});

  useEffect(() => { reactualizar.current(); }, [clave, seleccion, modo]);

  useEffect(() => {
    const node = host.current;
    if (!node) return;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); }
    catch { setSoporte(false); return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.setClearColor(0x000000, 0);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    node.appendChild(renderer.domElement);
    const canvas = renderer.domElement;
    canvas.setAttribute("role", "img");
    canvas.setAttribute("aria-label", ariaLabel + ". Toca un elemento para seleccionarlo; arrastra para girar.");

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 200);
    camera.position.set(0, 7.5, 15);
    camera.lookAt(0, 1.2, 0);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x334155, 1.6));
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(-6, 12, 8); key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    scene.add(key);
    const rim = new THREE.PointLight(0x7dd3fc, 1.8, 40);
    rim.position.set(7, 5, -6); scene.add(rim);

    const suelo = new THREE.Mesh(new THREE.CircleGeometry(14, 64), new THREE.ShadowMaterial({ opacity: 0.22 }));
    suelo.rotation.x = -Math.PI / 2; suelo.receiveShadow = true; suelo.position.y = -0.01;
    scene.add(suelo);

    // Polvo luminoso de fondo (cheap, da profundidad).
    const N = 260, pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) { pos[i * 3] = (Math.random() - 0.5) * 30; pos[i * 3 + 1] = Math.random() * 12; pos[i * 3 + 2] = (Math.random() - 0.5) * 20; }
    const polvoGeo = new THREE.BufferGeometry();
    polvoGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const polvo = new THREE.Points(polvoGeo, new THREE.PointsMaterial({ color: 0x9be7ff, size: 0.05, transparent: true, opacity: 0.55, depthWrite: false }));
    scene.add(polvo);

    const raiz = new THREE.Group();
    scene.add(raiz);
    type Pieza = { id: string; obj: THREE.Object3D; mats: THREE.Material[]; alturaObjetivo: number; alturaActual: number; base: THREE.Vector3 };
    let piezas: Pieza[] = [];
    const limpiar = () => {
      for (const p of piezas) {
        p.obj.traverse(o => { const m = o as THREE.Mesh; m.geometry?.dispose(); });
        p.mats.forEach(m => m.dispose());
        raiz.remove(p.obj);
      }
      piezas = [];
    };

    const construir = () => {
      limpiar();
      const { items: its } = latest.current;
      const n = its.length;
      its.forEach((it, i) => {
        const ang = modo === "barras" ? -Math.PI * 0.5 + (i / Math.max(1, n - 1)) * Math.PI * 1.1 - Math.PI * 0.55 : 0;
        const grupo = new THREE.Group();
        const mats: THREE.Material[] = [];
        if (modo === "barras") {
          const mat = new THREE.MeshPhysicalMaterial({ color: it.color, roughness: 0.25, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.15, emissive: new THREE.Color(it.color), emissiveIntensity: 0.12 });
          mats.push(mat);
          const geo = new THREE.BoxGeometry(0.62, 1, 0.62);
          geo.translate(0, 0.5, 0);
          const malla = new THREE.Mesh(geo, mat);
          malla.castShadow = true; malla.receiveShadow = true;
          malla.userData = { id: it.id };
          grupo.add(malla);
        } else {
          let inicio = -Math.PI / 2;
          for (const parte of it.partes ?? []) {
            if (parte.valor <= 0) continue;
            const arco = (parte.valor / 100) * Math.PI * 2;
            const mat = new THREE.MeshPhysicalMaterial({ color: parte.color, roughness: 0.3, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.2, emissive: new THREE.Color(parte.color), emissiveIntensity: 0.1 });
            mats.push(mat);
            const geo = new THREE.TorusGeometry(1, 0.28, 18, 64, arco);
            const malla = new THREE.Mesh(geo, mat);
            malla.rotation.z = inicio; inicio += arco;
            malla.castShadow = true; malla.userData = { id: it.id };
            grupo.add(malla);
          }
          const nucleo = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.3, 40), new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.6, metalness: 0.2 }));
          nucleo.rotation.x = Math.PI / 2; nucleo.userData = { id: it.id };
          mats.push(nucleo.material as THREE.Material);
          grupo.add(nucleo);
        }
        if (modo === "barras") {
          grupo.position.set(Math.sin(ang) * 6.2, 0, Math.cos(ang) * 4.2);
        } else {
          const col = i % 5, fila = Math.floor(i / 5);
          grupo.position.set((col - 2) * 3.1, 2.4 - fila * 3.2, 0);
        }
        const obj = grupo;
        raiz.add(obj);
        piezas.push({ id: it.id, obj, mats, alturaObjetivo: 0, alturaActual: 0, base: grupo.position.clone() });
      });
      escalarBarras();
      reactualizar.current();
    };

    // Normaliza alturas: la mayor barra mide 5 unidades.
    const escalarBarras = () => {
      if (modo !== "barras") return;
      const max = Math.max(1, ...latest.current.items.map(i => i.valor));
      piezas.forEach((p, idx) => {
        const v = latest.current.items[idx]?.valor ?? 0;
        p.alturaObjetivo = Math.max(0.15, (v / max) * 5);
      });
    };

    const size = () => {
      const w = node.clientWidth, h = node.clientHeight;
      if (!w || !h) return;
      camera.aspect = w / h;
      camera.position.z = w < 640 ? 19 : 15;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
      canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
    };
    size();

    let rotY = 0, arrastrando = false, ultimoX = 0, inicioX = 0, inicioY = 0, moviste = false;
    let visible = true, raf = 0, t0 = performance.now();
    const motion = !reducido();

    const frame = (t: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (t - t0) / 1000); t0 = t;
      for (const p of piezas) {
        const sel = latest.current.seleccion === p.id;
        if (modo === "barras") {
          const dif = p.alturaObjetivo - p.alturaActual;
          if (Math.abs(dif) > 0.001) p.alturaActual += dif * Math.min(1, dt * 6);
          p.obj.children[0].scale.set(1, Math.max(0.01, p.alturaActual), 1);
        }
        const meta = sel ? 1.12 : enfoque === p.id ? 1.06 : 1;
        p.obj.scale.lerp(new THREE.Vector3(meta, meta, meta), Math.min(1, dt * 8));
        const lift = sel ? 0.35 : 0;
        p.obj.position.y += ((p.base.y + lift) - p.obj.position.y) * Math.min(1, dt * 8);
        p.mats.forEach(m => { if ("emissiveIntensity" in m) (m as THREE.MeshStandardMaterial).emissiveIntensity = sel ? 0.45 : 0.12; });
      }
      if (motion && !arrastrando && enfoque === null) rotY += dt * 0.12;
      raiz.rotation.y += (rotY - raiz.rotation.y) * Math.min(1, dt * 6);
      polvo.rotation.y += dt * 0.02;
      if (visible && !document.hidden) renderer.render(scene, camera);
    };
    const arrancar = () => { if (!raf) { t0 = performance.now(); raf = requestAnimationFrame(frame); } };
    const parar = () => { cancelAnimationFrame(raf); raf = 0; };

    const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2();
    const pick = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      pointer.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(raiz.children, true).find(h => h.object.userData.id);
      return hit?.object.userData.id as string | undefined;
    };
    const down = (e: PointerEvent) => { arrastrando = true; moviste = false; ultimoX = e.clientX; inicioX = e.clientX; inicioY = e.clientY; canvas.setPointerCapture(e.pointerId); };
    const move = (e: PointerEvent) => {
      if (arrastrando) {
        const dx = e.clientX - ultimoX; ultimoX = e.clientX;
        if (Math.hypot(e.clientX - inicioX, e.clientY - inicioY) > 5) moviste = true;
        rotY += dx * 0.008;
        return;
      }
      const id = pick(e);
      setEnfoque(id ?? null);
      canvas.style.cursor = id ? "pointer" : "grab";
    };
    const up = (e: PointerEvent) => {
      arrastrando = false;
      if (!moviste) { const id = pick(e); if (id) latest.current.onSeleccion(id); }
    };
    const leave = () => { arrastrando = false; setEnfoque(null); };
    const lost = (e: Event) => { e.preventDefault(); setSoporte(false); };
    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointerleave", leave);
    canvas.addEventListener("webglcontextlost", lost);

    reactualizar.current = () => { escalarBarras(); arrancar(); };
    construir();
    const ro = new ResizeObserver(() => { size(); arrancar(); });
    ro.observe(node);
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; visible ? arrancar() : parar(); });
    io.observe(node);
    const vis = () => { if (document.hidden) parar(); else arrancar(); };
    document.addEventListener("visibilitychange", vis);
    arrancar();

    return () => {
      parar(); ro.disconnect(); io.disconnect();
      document.removeEventListener("visibilitychange", vis);
      canvas.removeEventListener("pointerdown", down); canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up); canvas.removeEventListener("pointerleave", leave);
      canvas.removeEventListener("webglcontextlost", lost);
      limpiar();
      suelo.geometry.dispose(); (suelo.material as THREE.Material).dispose();
      polvoGeo.dispose(); (polvo.material as THREE.Material).dispose();
      renderer.dispose(); canvas.remove();
      reactualizar.current = () => {};
    };
    // Reconstruye sólo al cambiar el modo; los datos se actualizan por reactualizar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modo]);

  const sel = items.find(i => i.id === seleccion);
  if (!soporte) return null;
  return (
    <div className={`escenario-3d escenario-3d--${modo}`}>
      <div className="escenario-3d__lienzo" ref={host} />
      <p className="escenario-3d__pie" aria-live="polite">
        {sel ? <><strong>{sel.etiqueta}</strong> · {formatear(sel.valor)}</> : "Toca una pieza para seleccionarla · arrastra para girar"}
      </p>
    </div>
  );
}
