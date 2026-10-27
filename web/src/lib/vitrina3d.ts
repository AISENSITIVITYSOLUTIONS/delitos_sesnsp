import * as THREE from "three";

/**
 * Vitrinas 3D para las fichas: una columna con brillo y un anillo en órbita por delito.
 * Un único renderizador WebGL compartido dibuja todas las escenas (evita agotar contextos
 * del navegador) y copia cada cuadro al canvas 2D de su ficha. Sólo renderiza lo visible.
 */
const TAM = 224;
const reducido = () => typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

export interface Vitrina {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  escena: THREE.Scene;
  camara: THREE.PerspectiveCamera;
  columna: THREE.Mesh;
  anillo: THREE.Mesh;
  mat: THREE.MeshPhysicalMaterial;
  objetivo: number;
  actual: number;
  hover: boolean;
  visible: boolean;
  giro: number;
  geo: THREE.BufferGeometry[];
  mats: THREE.Material[];
}

let renderer: THREE.WebGLRenderer | null = null;
const activas = new Set<Vitrina>();
let raf = 0;
let t0 = 0;

function asegurarRenderer(): THREE.WebGLRenderer | null {
  if (renderer) return renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, premultipliedAlpha: true });
  } catch {
    return null;
  }
  renderer.setPixelRatio(1);
  renderer.setSize(TAM, TAM, false);
  renderer.setClearColor(0x000000, 0);
  return renderer;
}

export function crearVitrina(canvas: HTMLCanvasElement, color: string): Vitrina | null {
  const r = asegurarRenderer();
  const ctx = canvas.getContext("2d");
  if (!r || !ctx) return null;
  canvas.width = TAM; canvas.height = TAM;

  const escena = new THREE.Scene();
  const camara = new THREE.PerspectiveCamera(28, 1, 0.1, 60);
  camara.position.set(4.2, 5.4, 7.2);
  camara.lookAt(0, 0.9, 0);

  escena.add(new THREE.HemisphereLight(0xffffff, 0x1e293b, 1.5));
  const key = new THREE.DirectionalLight(0xffffff, 2.4);
  key.position.set(-3, 6, 4); escena.add(key);
  const rim = new THREE.PointLight(new THREE.Color(color), 9, 22);
  rim.position.set(3.5, 2.5, -3); escena.add(rim);

  const geo: THREE.BufferGeometry[] = [];
  const mats: THREE.Material[] = [];

  const baseGeo = new THREE.CylinderGeometry(1.9, 1.9, 0.12, 72); geo.push(baseGeo);
  const baseMat = new THREE.MeshStandardMaterial({ color: 0x0b1220, roughness: 0.35, metalness: 0.55 }); mats.push(baseMat);
  const base = new THREE.Mesh(baseGeo, baseMat); base.position.y = -0.06; escena.add(base);

  const colGeo = new THREE.CylinderGeometry(0.78, 0.78, 1, 64, 1); colGeo.translate(0, 0.5, 0); geo.push(colGeo);
  const mat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(color), roughness: 0.18, metalness: 0.12, clearcoat: 1, clearcoatRoughness: 0.08,
    emissive: new THREE.Color(color), emissiveIntensity: 0.18,
  });
  mats.push(mat);
  const columna = new THREE.Mesh(colGeo, mat); columna.castShadow = false; escena.add(columna);

  const anilloGeo = new THREE.TorusGeometry(1.45, 0.025, 10, 120); geo.push(anilloGeo);
  const anilloMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(color), transparent: true, opacity: 0.85 }); mats.push(anilloMat);
  const anillo = new THREE.Mesh(anilloGeo, anilloMat); anillo.rotation.x = Math.PI / 2.6; escena.add(anillo);

  const v: Vitrina = { canvas, ctx, escena, camara, columna, anillo, mat, objetivo: 0.2, actual: 0.2, hover: false, visible: true, giro: 0, geo, mats };
  activas.add(v);
  arrancar();
  return v;
}

export function destruirVitrina(v: Vitrina) {
  activas.delete(v);
  v.geo.forEach(g => g.dispose());
  v.mats.forEach(m => m.dispose());
  if (activas.size === 0) parar();
}

export function fijarValor(v: Vitrina, valor01: number) {
  v.objetivo = Math.max(0.12, Math.min(1, valor01));
}

function cuadro(t: number) {
  raf = requestAnimationFrame(cuadro);
  const r = renderer; if (!r) return;
  const dt = Math.min(0.05, (t - t0) / 1000); t0 = t;
  const movimiento = !reducido();
  for (const v of activas) {
    v.actual += (v.objetivo - v.actual) * Math.min(1, dt * 3.2);
    v.columna.scale.set(1, v.actual * 1.9, 1);
    v.giro += dt * (v.hover ? 1.6 : movimiento ? 0.4 : 0);
    v.columna.rotation.y = v.giro;
    v.anillo.rotation.z += dt * (v.hover ? 2.2 : movimiento ? 0.6 : 0);
    v.mat.emissiveIntensity = v.hover ? 0.42 : 0.18;
    if (!v.visible || document.hidden) continue;
    r.render(v.escena, v.camara);
    v.ctx.clearRect(0, 0, TAM, TAM);
    v.ctx.drawImage(r.domElement, 0, 0, TAM, TAM);
  }
}

function arrancar() {
  if (raf || activas.size === 0) return;
  t0 = performance.now();
  raf = requestAnimationFrame(cuadro);
}
function parar() {
  cancelAnimationFrame(raf); raf = 0;
}
