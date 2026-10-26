/** Escena Three.js con coordenadas Mercator locales y extrusión lineal. */
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { clase, marcoDe, mercX, mercY } from '../lib/geo';
import type { Territorio } from '../lib/geo';
import type { ValorTerritorio } from './MapaMx';
import './mapa-three.css';

export interface VistaThree { posicion: number[]; objetivo: number[]; territorio: string }
interface Props {
  territorios: Territorio[]; valores: Record<string, ValorTerritorio>;
  rampa: readonly string[]; cortes: number[]; maxV: number;
  metrica: 'conteo' | 'tasa'; onSeleccion?: (cve: string) => void;
  onFallo: () => void; seleccionado?: string | null;
  vistaGuardada?: VistaThree; onVista?: (v: VistaThree) => void;
  titulo?: string; vistaExterna?: VistaThree;
  fmt: (v: number | null) => string;
}
type Pieza = THREE.Mesh<THREE.ExtrudeGeometry, THREE.MeshStandardMaterial>;
export default function Mapa3D(p: Props) {
  const host = useRef<HTMLDivElement>(null);
  const latest = useRef(p); latest.current = p;
  const acciones = useRef<(accion: string) => void>(() => {});
  const sincronizar = useRef<(v: VistaThree) => void>(() => {});
  useEffect(()=>{if(p.vistaExterna)sincronizar.current(p.vistaExterna);},[p.vistaExterna]);
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
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
    node.appendChild(renderer.domElement);
    renderer.domElement.setAttribute('aria-label', 'Mapa territorial Three.js. Arrastra para rotar; usa la rueda para acercar. La selección por teclado está debajo del mapa.');
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
    const bordes: THREE.LineSegments[] = [];
    for (const t of p.territorios) for (const ring of t.pols) {
      if (ring.length < 3) continue;
      const points = ring.map(([lon, lat]) => new THREE.Vector2((mercX(lon) - cx) * escala, (mercY(lat) - cy) * escala));
      const shape = new THREE.Shape(points);
      const geometry = new THREE.ExtrudeGeometry(shape, { depth: 1, bevelEnabled: false, steps: 1 });
      geometry.rotateX(-Math.PI / 2);
      const material = new THREE.MeshStandardMaterial({ roughness: 0.8, metalness: 0.08 });
      const mesh: Pieza = new THREE.Mesh(geometry, material);
      mesh.userData = { cve: t.cve, nombre: t.nombre };
      const edge = new THREE.LineSegments(new THREE.EdgesGeometry(geometry, 30), new THREE.LineBasicMaterial({ color: '#a6d9ee', transparent: true, opacity: 0.24 }));
      mesh.add(edge); bordes.push(edge);
      scene.add(mesh); piezas.push(mesh);
    }
    const grid = new THREE.GridHelper(210, 21, 0x64748b, 0x94a3b8);
    grid.position.y = -0.15;
    const gm = grid.material as THREE.Material; gm.transparent = true; gm.opacity = 0.13;
    scene.add(grid);
    const suelo = new THREE.Mesh(new THREE.CylinderGeometry(94, 94, 0.7, 96), new THREE.MeshStandardMaterial({color:'#10283b',roughness:0.9,metalness:0.15,transparent:true,opacity:0.3}));
    suelo.position.y=-0.65; scene.add(suelo);
    const aro = new THREE.Mesh(new THREE.TorusGeometry(94,0.06,4,128),new THREE.MeshBasicMaterial({color:'#7dd3fc',transparent:true,opacity:0.18}));
    aro.rotation.x=Math.PI/2;aro.position.y=-0.25;scene.add(aro);
    let visible = true;
    const render = () => { if (visible && !document.hidden) renderer.render(scene, camera); };
    let externo = false;
    const guardar = () => { if(!externo)latest.current.onVista?.({ posicion: camera.position.toArray(), objetivo: controls.target.toArray(), territorio }); render(); };
    sincronizar.current = v => { if(v.territorio!==territorio)return;externo=true;camera.position.fromArray(v.posicion);controls.target.fromArray(v.objetivo);controls.update();render();externo=false; };
    let frame=0;
    const mover = (posicion:THREE.Vector3, objetivo:THREE.Vector3) => {
      cancelAnimationFrame(frame);
      if(matchMedia('(prefers-reduced-motion: reduce)').matches){camera.position.copy(posicion);controls.target.copy(objetivo);controls.update();guardar();return;}
      const desde=camera.position.clone(), target=controls.target.clone(), inicio=performance.now();
      const tick=(ahora:number)=>{const t=Math.min(1,(ahora-inicio)/650),ease=t*t*(3-2*t);camera.position.lerpVectors(desde,posicion,ease);controls.target.lerpVectors(target,objetivo,ease);controls.update();render();if(t<1)frame=requestAnimationFrame(tick);else guardar();};
      frame=requestAnimationFrame(tick);
    };
    const cancelar=()=>cancelAnimationFrame(frame);controls.addEventListener('start',cancelar);
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
        mesh.material.color.set(v == null ? '#8c8c87' : v === 0 ? '#e2e8f0' : q.rampa[Math.min(clase(v, q.cortes), q.rampa.length - 1)]);
        mesh.material.emissive.set(mesh.userData.cve === q.seleccionado ? '#2563eb' : '#000000');
        mesh.material.emissiveIntensity = 0.35;
        mesh.material.wireframe = configuracion.current.malla;
      }
      render();
    };
    actualizar.current();
    acciones.current = accion => {
      if (accion === 'reset') { reset(); setPlana(false); }
      else if (accion === 'focus') {
        const meshes=piezas.filter(m=>m.userData.cve===latest.current.seleccionado);if(!meshes.length)return;
        const box=new THREE.Box3();meshes.forEach(m=>box.expandByObject(m));
        const center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3());
        const d=Math.max(22,Math.max(size.x,size.z)*2,size.y*2.5);
        mover(center.clone().add(new THREE.Vector3(0,d*0.85,d*0.7)),center);
      }
      else if (accion === 'export') {
        renderer.render(scene,camera);
        const image=document.createElement('canvas');image.width=1600;image.height=1100;
        const ctx=image.getContext('2d');if(!ctx)return;
        ctx.fillStyle='#081523';ctx.fillRect(0,0,1600,1100);ctx.fillStyle='#e8f1f8';ctx.font='24px sans-serif';
        ctx.fillText((latest.current.titulo??'Exploración territorial').slice(0,105),45,55);
        const canvas=renderer.domElement;
        const ratio=Math.min(1510/canvas.width,780/canvas.height);ctx.drawImage(canvas,45+(1510-canvas.width*ratio)/2,90,canvas.width*ratio,canvas.height*ratio);
        ctx.font='18px sans-serif';ctx.fillStyle='#a0b5c7';
        ctx.fillText('SESNSP · Población CONAPO · '+(latest.current.metrica==='conteo'?'Delitos registrados':'Tasa por 100 mil habitantes'),45,930);
        ctx.fillText('Altura lineal desde cero · Máximo: '+latest.current.fmt(latest.current.maxV),45,965);
        const q=latest.current;let x=45;
        q.rampa.forEach((color,i)=>{ctx.fillStyle=color;ctx.fillRect(x,990,100,14);ctx.fillStyle='#a0b5c7';ctx.font='12px sans-serif';ctx.fillText(i===0?'≤ '+q.fmt(q.cortes[0]??q.maxV):i<q.cortes.length?'≤ '+q.fmt(q.cortes[i]):'> '+q.fmt(q.cortes.at(-1)??0),x,1028);x+=205;});
        ctx.font='15px sans-serif';ctx.fillStyle='#a0b5c7';ctx.fillText('Cero: plano claro · Sin información: plano gris · Altura mínima: base visual.',45,1070);
        image.toBlob(blob=>{if(!blob)return;const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='NNI-atlas-territorial.png';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);},'image/png');
      }
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
      cancelAnimationFrame(frame);controls.removeEventListener('start',cancelar);sincronizar.current=()=>{};
      controls.removeEventListener('change', guardar); controls.dispose();
      for (const mesh of piezas) { mesh.geometry.dispose(); mesh.material.dispose(); }
      for(const edge of bordes){edge.geometry.dispose();(edge.material as THREE.Material).dispose();}
      suelo.geometry.dispose();suelo.material.dispose();aro.geometry.dispose();aro.material.dispose();
      grid.geometry.dispose(); gm.dispose(); renderer.dispose(); canvas.remove();
      actualizar.current = () => {}; acciones.current = () => {};
    };
  }, [p.territorios]);
  const actual = hover ? p.valores[hover.cve]?.v ?? null : null;
  return <div className="three-dashboard">
    <div className="three-heading"><span className="three-badge">EXPLORACIÓN TERRITORIAL · VISTA 3D</span><p>Arrastra para rotar · Desplaza para acercar · Selecciona un territorio</p></div>
    <div className="three-viewport" ref={host} />
    {hover && <div className="three-tooltip" role="status"><strong>{hover.nombre}</strong><span>{p.fmt(actual)}</span><small>Clave territorial {hover.cve}</small></div>}
    <div className="three-toolbar" role="group" aria-label="Controles de cámara 3D">
      <button className="boton" onClick={() => acciones.current('+')} aria-label="Acercar">＋</button>
      <button className="boton" onClick={() => acciones.current('-')} aria-label="Alejar">−</button>
      <button className="boton" aria-pressed={plana} onClick={() => acciones.current(plana ? 'perspectiva' : 'plana')}>{plana ? 'Perspectiva' : 'Vista superior'}</button>
      <button className="boton" aria-pressed={malla} onClick={() => setMalla(!malla)}>Malla</button>
      <button className="boton" disabled={!p.seleccionado} onClick={() => acciones.current('focus')}>Enfocar selección</button>
      <button className="boton" onClick={() => acciones.current('reset')}>Restablecer</button>
      <button className="boton" onClick={() => acciones.current('export')}>Exportar PNG</button>
      <label>Relieve <input type="range" aria-label="Intensidad del relieve" min="0" max="1" step="0.1" value={relieve} onChange={e => setRelieve(Number(e.target.value))} /></label>
    </div>
    <p className="three-method">Altura lineal: {p.metrica === 'conteo' ? 'delitos registrados' : 'tasa por 100 mil habitantes'}. Máximo de referencia: {p.fmt(p.maxV)}. El relieve modifica la representación; las cifras permanecen iguales. Cero: plano claro · Sin información: plano gris.</p>
  </div>;
}
