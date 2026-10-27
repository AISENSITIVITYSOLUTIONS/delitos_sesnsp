import * as THREE from "three";

/**
 * Terrenos 3D inmersivos por ficha: la serie anual del delito se levanta como cordillera
 * que avanza hacia el lector. Un único renderizador compartido dibuja todas las escenas
 * y copia cada cuadro al canvas de su ficha. Sólo se renderiza lo visible.
 */
const TAM = 400;
const COLS = 110, FILAS = 44;
const reducido = () => typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

export interface Vitrina {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  escena: THREE.Scene;
  camara: THREE.PerspectiveCamera;
  malla: THREE.Mesh;
  linea: THREE.Line;
  serie: number[];
  suave: number[];
  color: THREE.Color;
  px: number; py: number;
  hover: boolean;
  visible: boolean;
  t: number;
  geo: THREE.BufferGeometry[];
  mats: THREE.Material[];
}

let renderer: THREE.WebGLRenderer | null = null;
const activas = new Set<Vitrina>();
let raf = 0;
let t0 = 0;

function asegurarRenderer(): THREE.WebGLRenderer | null {
  if (renderer) return renderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, premultipliedAlpha: true }); }
  catch { return null; }
  renderer.setPixelRatio(1);
  renderer.setSize(TAM, TAM, false);
  renderer.setClearColor(0x000000, 0);
  return renderer;
}

/** Interpola la serie anual en x∈[0,1]. */
function muestrear(serie: number[], x: number): number {
  if (serie.length === 0) return 0;
  if (serie.length === 1) return serie[0];
  const pos = x * (serie.length - 1);
  const i = Math.floor(pos), f = pos - i;
  const a = serie[Math.min(i, serie.length - 1)], b = serie[Math.min(i + 1, serie.length - 1)];
  const k = f * f * (3 - 2 * f);
  return a + (b - a) * k;
}

export function crearVitrina(canvas: HTMLCanvasElement, color: string, serie: number[]): Vitrina | null {
  const r = asegurarRenderer();
  const ctx = canvas.getContext("2d");
  if (!r || !ctx) return null;
  canvas.width = TAM; canvas.height = TAM;

  const escena = new THREE.Scene();
  escena.fog = new THREE.Fog(0x0b1220, 12, 22);
  const camara = new THREE.PerspectiveCamera(50, 1, 0.1, 60);
  camara.position.set(0, 4.6, 5.4);
  camara.lookAt(0, 0.7, 0);

  const c = new THREE.Color(color);
  escena.add(new THREE.HemisphereLight(0xdbeafe, 0x0b1220, 1.4));
  const key = new THREE.DirectionalLight(0xffffff, 1.8);
  key.position.set(-4, 7, 5); escena.add(key);
  const rim = new THREE.PointLight(c, 14, 18);
  rim.position.set(4, 3, -3); escena.add(rim);

  const geo: THREE.BufferGeometry[] = [];
  const mats: THREE.Material[] = [];

  const g = new THREE.PlaneGeometry(12, 7.5, COLS, FILAS);
  g.rotateX(-Math.PI / 2);
  geo.push(g);
  const colores = new Float32Array(g.attributes.position.count * 3);
  g.setAttribute("color", new THREE.BufferAttribute(colores, 3));
  const mat = new THREE.MeshPhysicalMaterial({
    vertexColors: true, roughness: 0.32, metalness: 0.1, clearcoat: 0.8, clearcoatRoughness: 0.2,
    flatShading: false,
  });
  mats.push(mat);
  const malla = new THREE.Mesh(g, mat);
  escena.add(malla);

  // Cresta frontal iluminada: la serie tal cual, sobre el frente del terreno.
  const lg = new THREE.BufferGeometry();
  lg.setAttribute("position", new THREE.BufferAttribute(new Float32Array((COLS + 1) * 3), 3));
  geo.push(lg);
  const lm = new THREE.LineBasicMaterial({ color: c.clone().lerp(new THREE.Color(0xffffff), 0.45), transparent: true, opacity: 0.95 });
  mats.push(lm);
  const linea = new THREE.Line(lg, lm);
  escena.add(linea);

  const v: Vitrina = {
    canvas, ctx, escena, camara, malla, linea, serie, suave: serie.map(() => 0), color: c,
    px: 0, py: 0, hover: false, visible: true, t: 0, geo, mats,
  };
  activas.add(v);
  arrancar();
  return v;
}

export function fijarSerie(v: Vitrina, serie: number[]) {
  v.serie = serie;
  const mx = Math.max(1, ...serie);
  v.suave = serie.map(x => x / mx);
}

export function fijarPuntero(v: Vitrina, px: number, py: number) { v.px = px; v.py = py; }

export function destruirVitrina(v: Vitrina) {
  activas.delete(v);
  v.geo.forEach(g => g.dispose());
  v.mats.forEach(m => m.dispose());
  if (activas.size === 0) parar();
}

const BASE = new THREE.Color(0x1d3550);
const CLARO = new THREE.Color(0xffffff);

function actualizarTerreno(v: Vitrina, dt: number) {
  const pos = v.malla.geometry.attributes.position as THREE.BufferAttribute;
  const col = v.malla.geometry.attributes.color as THREE.BufferAttribute;
  const mov = !reducido();
  const tmp = new THREE.Color();
  const lp = v.linea.geometry.attributes.position as THREE.BufferAttribute;
  for (let j = 0; j <= FILAS; j++) {
    const z = j / FILAS; // 0 fondo, 1 frente
    const ascenso = 0.05 + 0.95 * Math.pow(z, 1.25);
    for (let i = 0; i <= COLS; i++) {
      const x = i / COLS;
      const idx = j * (COLS + 1) + i;
      const s = muestrear(v.suave, x);
      const onda = mov ? Math.sin(v.t * 0.9 + x * 9 + z * 4) * 0.035 * z : 0;
      const h = s * ascenso * 4.4 + onda + 0.02;
      pos.setY(idx, h);
      const k = Math.min(1, s * 0.9 + z * 0.15);
      tmp.copy(BASE).lerp(v.color, k * 0.85).lerp(CLARO, Math.pow(s, 4) * 0.35);
      col.setXYZ(idx, tmp.r, tmp.g, tmp.b);
      if (j === FILAS) {
        lp.setXYZ(i, (x - 0.5) * 12, h + 0.02, 7.5 / 2);
      }
    }
  }
  pos.needsUpdate = true; col.needsUpdate = true; lp.needsUpdate = true;
  v.malla.geometry.computeVertexNormals();
  // La cámara orbita suavemente con el puntero (inmersión).
  const objX = v.px * 2.2, objY = 5.4 - v.py * 1.0;
  v.camara.position.x += (objX - v.camara.position.x) * Math.min(1, dt * 3);
  v.camara.position.y += (objY - v.camara.position.y) * Math.min(1, dt * 3);
  v.camara.lookAt(0, 0.7, 0);
}

function cuadro(t: number) {
  raf = requestAnimationFrame(cuadro);
  const r = renderer; if (!r) return;
  const dt = Math.min(0.05, (t - t0) / 1000); t0 = t;
  for (const v of activas) {
    v.t += dt * (v.hover ? 1.6 : 0.6);
    if (!v.visible || document.hidden) continue;
    actualizarTerreno(v, dt);
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
function parar() { cancelAnimationFrame(raf); raf = 0; }
