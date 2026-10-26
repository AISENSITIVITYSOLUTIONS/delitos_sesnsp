/** Escena Three.js con coordenadas Mercator locales y extrusión lineal. */
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { marcoDe, mercX, mercY } from '../lib/geo';
import type { Territorio } from '../lib/geo';
import type { ValorTerritorio } from './MapaMx';
import './mapa-three.css';

export interface VistaThree { posicion: number[]; objetivo: number[]; territorio: string }
interface Props {
  territorios: Territorio[]; valores: Record<string, ValorTerritorio>;
  rampa: readonly string[]; cortes: number[]; maxV: number;
  metrica: 'conteo' | 'tasa'; onSeleccion?: (cve: string) => void; colorDe: (cve: string) => string;
  onFallo: () => void; seleccionado?: string | null;
  vistaGuardada?: VistaThree; onVista?: (v: VistaThree) => void;
  fmt: (v: number | null) => string;
}
type Pieza = THREE.Mesh<THREE.ExtrudeGeometry, THREE.MeshStandardMaterial>;
export default function Mapa3D(p: Props) {
  const host = useRef<HTMLDivElement>(null);
  const latest = useRef(p); latest.current = p;
  const acciones = useRef<(accion: string) => void>(() => {});
  const [relieve, setRelieve] = useState(1);
  const [plana, setPlana] = useState(false);
  const [malla, setMalla] = useState(false);
  const [hover, setHover] = useState<{ nombre: string; cve: string; valor: number | null } | null>(null);
  const actualizar = useRef<() => void>(() => {});
  const configuracion = useRef({ relieve, malla }); configuracion.current = { relieve, malla };
  useEffect(() => { actualizar.current(); }, [p.valores, p.rampa, p.cortes, p.maxV, p.seleccionado, relieve, malla]);

  useEffect(() => {
    const node = host.current;
    if (!node || !p.territorios.length) return;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); }
    catch { latest.current.onFallo(); return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setClearColor(0x000000, 0);
    node.appendChild(renderer.domElement);
    renderer.domElement.setAttribute('aria-label', 'Mapa territorial 3D. Arrastra para rotar; usa la rueda para acercar. La selección por teclado está debajo del mapa.');
    const territorio = p.territorios.map(t => t.cve).join(",");
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 2500);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = false; controls.minDistance = 12; controls.maxDistance = 550;
    controls.maxPolarAngle = Math.PI / 2 - 0.03;
    const marco = marcoDe(p.territorios);
    const span = Math.max(marco.maxX - marco.minX, marco.maxY - marco.minY);
    const escala = span > 0 ? 120 / span : 1;
    const cx = (marco.minX + marco.maxX) / 2, cy = (marco.minY + marco.maxY) / 2;
    scene.add(new THREE.HemisphereLight(0xffffff, 0x64748b, 2.4));
    const luz = new THREE.DirectionalLight(0xffffff, 2.5); luz.position.set(-50, 100, 60); scene.add(luz);
    const piezas: Pieza[] = [];
    for (const t of p.territorios) for (const ring of t.pols) {
      if (ring.length < 3) continue;
      const points = ring.map(([lon, lat]) => new THREE.Vector2((mercX(lon) - cx) * escala, (mercY(lat) - cy) * escala));
      const shape = new THREE.Shape(points);
      const geometry = new THREE.ExtrudeGeometry(shape, { depth: 1, bevelEnabled: false, steps: 1 });
      geometry.rotateX(-Math.PI / 2);
      const material = new THREE.MeshStandardMaterial({ roughness: 0.8, metalness: 0.08 });
      const mesh: Pieza = new THREE.Mesh(geometry, material);
      mesh.userData = { cve: t.cve, nombre: t.nombre };
      scene.add(mesh); piezas.push(mesh);
    }
    const grid = new THREE.GridHelper(210, 21, 0x64748b, 0x94a3b8);
    grid.position.y = -0.15;
    const gm = grid.material as THREE.Material; gm.transparent = true; gm.opacity = 0.13;
    scene.add(grid);
    let visible = true;
    const render = () => { if (visible && !document.hidden) renderer.render(scene, camera); };
    const guardar = () => { latest.current.onVista?.({ posicion: camera.position.toArray(), objetivo: controls.target.toArray(), territorio }); render(); };
    controls.addEventListener('change', guardar);
    const reset = () => {
      const aspect = camera.aspect || 1;
      const distancia = Math.max(155, 100 / aspect);
      camera.position.set(0, distancia * 0.83, distancia * 0.68);
      controls.target.set(0, 0, 0); controls.update(); render();
    };
    const resize = () => {
      const w = node.clientWidth, h = node.clientHeight;
      if (!w || !h) return;
      camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h); render();
    };
    resize();
    if (p.vistaGuardada?.territorio === territorio) {
      camera.position.fromArray(p.vistaGuardada.posicion); controls.target.fromArray(p.vistaGuardada.objetivo); controls.update();
    } else reset();
    actualizar.current = () => {
      const q = latest.current;
      for (const mesh of piezas) {
        const v = q.valores[mesh.userData.cve]?.v ?? null;
        mesh.userData.valor = v;
        mesh.scale.y = v == null || q.maxV <= 0 ? 0.12 : Math.max(0.12, Math.max(0, v) / q.maxV * 24 * configuracion.current.relieve);
        mesh.material.color.set(q.colorDe(mesh.userData.cve));
        mesh.material.emissive.set(mesh.userData.cve === q.seleccionado ? '#2563eb' : '#000000');
        mesh.material.emissiveIntensity = 0.35;
        mesh.material.wireframe = configuracion.current.malla;
      }
      render();
    };
    actualizar.current();
    acciones.current = accion => {
      if (accion === 'reset') { reset(); setPlana(false); }
      else if (accion === 'plana') {
        const d = camera.position.distanceTo(controls.target);
        camera.position.copy(controls.target).add(new THREE.Vector3(0, d, 0.001)); controls.update(); setPlana(true);
      } else if (accion === 'perspectiva') { reset(); setPlana(false); }
      else { camera.position.sub(controls.target).multiplyScalar(accion === '+' ? 0.8 : 1.25).clampLength(12, 550).add(controls.target); controls.update(); }
      guardar();
    };
    const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2();
    const pick = (e: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set((e.clientX - rect.left) / rect.width * 2 - 1, -(e.clientY - rect.top) / rect.height * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      return raycaster.intersectObjects(piezas, false)[0]?.object;
    };
    const move = (e: PointerEvent) => {
      const obj = pick(e);
      setHover(obj ? { nombre: obj.userData.nombre, cve: obj.userData.cve, valor: obj.userData.valor } : null);
      renderer.domElement.style.cursor = obj ? 'pointer' : 'grab';
    };
    let inicio = { x: 0, y: 0 };
    const down = (e: PointerEvent) => { inicio = { x: e.clientX, y: e.clientY }; };
    const up = (e: PointerEvent) => { if (Math.hypot(e.clientX - inicio.x, e.clientY - inicio.y) < 5) { const obj = pick(e); if (obj) latest.current.onSeleccion?.(obj.userData.cve); } };
    const leave = () => setHover(null);
    const lost = (e: Event) => { e.preventDefault(); latest.current.onFallo(); };
    const canvas = renderer.domElement;
    canvas.addEventListener('pointermove', move); canvas.addEventListener('pointerdown', down); canvas.addEventListener('pointerup', up); canvas.addEventListener('pointerleave', leave); canvas.addEventListener('webglcontextlost', lost);
    const ro = new ResizeObserver(resize); ro.observe(node);
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; render(); }); io.observe(node);
    document.addEventListener('visibilitychange', render);
    return () => {
      ro.disconnect(); io.disconnect(); document.removeEventListener('visibilitychange', render);
      canvas.removeEventListener('pointermove', move); canvas.removeEventListener('pointerdown', down); canvas.removeEventListener('pointerup', up); canvas.removeEventListener('pointerleave', leave); canvas.removeEventListener('webglcontextlost', lost);
      controls.removeEventListener('change', guardar); controls.dispose();
      for (const mesh of piezas) { mesh.geometry.dispose(); mesh.material.dispose(); }
      grid.geometry.dispose(); gm.dispose(); renderer.dispose(); canvas.remove();
      actualizar.current = () => {}; acciones.current = () => {};
    };
  }, [p.territorios]);
  const actual = hover ? p.valores[hover.cve]?.v ?? null : null;
  return <div className="three-dashboard">
    <div className="three-heading"><span className="three-badge">EXPLORACIÓN TERRITORIAL · 3D</span><p>Arrastra para rotar · Desplaza para acercar · Selecciona un territorio</p></div>
    <div className="three-viewport" ref={host} />
    {hover && <div className="three-tooltip" role="status"><strong>{hover.nombre}</strong><span>{p.fmt(actual)}</span><small>Clave territorial {hover.cve}</small></div>}
    <div className="three-toolbar" role="group" aria-label="Controles de cámara 3D">
      <button className="boton" onClick={() => acciones.current('+')} aria-label="Acercar">＋</button>
      <button className="boton" onClick={() => acciones.current('-')} aria-label="Alejar">−</button>
      <button className="boton" aria-pressed={plana} onClick={() => acciones.current(plana ? 'perspectiva' : 'plana')}>{plana ? 'Perspectiva' : 'Vista superior'}</button>
      <button className="boton" aria-pressed={malla} onClick={() => setMalla(!malla)}>Malla</button>
      <button className="boton" onClick={() => acciones.current('reset')}>Restablecer</button>
      <label>Relieve <input type="range" aria-label="Intensidad del relieve" min="0" max="1" step="0.1" value={relieve} onChange={e => setRelieve(Number(e.target.value))} /></label>
    </div>
    <p className="three-method">Altura lineal: {p.metrica === 'conteo' ? 'delitos registrados' : 'tasa por 100 mil habitantes'}. Máximo de referencia: {p.fmt(p.maxV)}. El relieve modifica la representación; las cifras permanecen iguales. Cero: plano claro · Sin información: plano gris.</p>
  </div>;
}
