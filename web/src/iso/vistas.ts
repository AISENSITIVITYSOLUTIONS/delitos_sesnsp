/**
 * Constructores de escena para la vista isométrica: mapa estatal extruido y torres
 * (simples o apiladas). Devuelven un Contenido listo para el motor y un índice de piezas.
 */
import * as THREE from "three";
import type { Territorio } from "../lib/geo";
import { marcoDe, mercX, mercY } from "../lib/geo";
import type { Contenido, Pieza } from "./motor";

export interface Construido { contenido: Contenido; piezas: Map<string, Pieza> }

const materialBorde = () => new THREE.LineBasicMaterial({ color: 0x0a1422, transparent: true, opacity: 0.55 });
const materialCara = (color: string) => new THREE.MeshStandardMaterial({
  color: new THREE.Color(color), roughness: 0.52, metalness: 0.06, flatShading: true,
});

/** Mapa de entidades extruido. Ancho total ≈ `ancho` unidades, norte hacia el fondo. */
export function construirMapa(territorios: Territorio[], ancho = 100): Construido {
  const marco = marcoDe(territorios);
  const escala = ancho / Math.max(marco.maxX - marco.minX, marco.maxY - marco.minY);
  const cx = (marco.minX + marco.maxX) / 2, cy = (marco.minY + marco.maxY) / 2;
  const grupo = new THREE.Group();
  const geometrias: THREE.BufferGeometry[] = [];
  const materiales: THREE.Material[] = [];
  const piezas = new Map<string, Pieza>();
  const lista: Pieza[] = [];
  let maxD = 1;
  const centros = new Map<string, THREE.Vector3>();

  for (const t of territorios) {
    let sx = 0, sz = 0, n = 0, mayor = 0, ax = 0, az = 0;
    for (const anillo of t.pols) {
      if (anillo.length < 4) continue;
      let ix = 0, iz = 0;
      for (const [lon, lat] of anillo) { ix += (mercX(lon) - cx) * escala; iz += -(mercY(lat) - cy) * escala; }
      sx += ix; sz += iz; n += anillo.length;
      if (anillo.length > mayor) { mayor = anillo.length; ax = ix / anillo.length; az = iz / anillo.length; }
    }
    const c = n ? new THREE.Vector3(ax || sx / n, 1, az || sz / n) : new THREE.Vector3(0, 1, 0);
    centros.set(t.cve, c);
    maxD = Math.max(maxD, Math.hypot(c.x, c.z));
  }

  for (const t of territorios) {
    const g = new THREE.Group();
    const mat = materialCara("#1d3550");
    mat.flatShading = false;
    // Paredes de tono plano: evita el rayado que produce una costa de cientos de vértices.
    const lado = new THREE.MeshBasicMaterial({ color: new THREE.Color("#0f1d2c") });
    const bordeMat = materialBorde();
    materiales.push(mat, lado, bordeMat);
    const mallas: THREE.Mesh[] = [];
    const bordes: THREE.Line[] = [];
    // Islas diminutas fuera: extruidas se ven como agujas. Se conserva siempre el anillo mayor.
    const proyectados = t.pols.filter(a => a.length >= 4).map(a => a.map(([lon, lat]) =>
      new THREE.Vector2((mercX(lon) - cx) * escala, (mercY(lat) - cy) * escala)));
    const areas = proyectados.map(pts => Math.abs(THREE.ShapeUtils.area(pts)));
    const mayorArea = Math.max(0, ...areas);
    for (let k = 0; k < proyectados.length; k++) {
      if (areas[k] < 0.5 && areas[k] < mayorArea) continue;
      const pts = proyectados[k];
      const geo = new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth: 1, bevelEnabled: false, steps: 1 });
      geo.rotateX(-Math.PI / 2);
      geometrias.push(geo);
      const m = new THREE.Mesh(geo, [mat, lado]);
      // Contorno superior nítido (y = 1 se escala con la altura).
      const lg = new THREE.BufferGeometry().setFromPoints(pts.map(v => new THREE.Vector3(v.x, 1.001, -v.y)));
      geometrias.push(lg);
      const l = new THREE.LineLoop(lg, bordeMat);
      m.add(l);
      g.add(m);
      mallas.push(m); bordes.push(l);
    }
    const c = centros.get(t.cve)!;
    const p: Pieza = {
      id: t.cve, grupo: g, mallas, mats: [mat], lados: [lado], bordes, altura: 0, objetivo: 0.12,
      retardo: Math.hypot(c.x, c.z) / maxD * 0.85,
      colorObjetivo: [new THREE.Color("#1d3550")], ancla: c,
    };
    grupo.add(g);
    piezas.set(t.cve, p);
    lista.push(p);
  }

  return {
    piezas,
    contenido: {
      grupo, piezas: lista, etiquetas: [], radio: ancho * 0.5, azimut: -Math.PI / 4, elevacion: 0.93,
      centro: new THREE.Vector3(9, 3, 9), geometrias, materiales,
    },
  };
}

export interface Segmento { frac: number; color: string }
export interface Torre {
  id: string;
  x: number;
  z: number;
  altura: number;
  retardo: number;
  segmentos: Segmento[];
}

/** Torres (cajas) simples o apiladas. Cada torre escala en y; sus segmentos conservan proporciones. */
export function construirTorres(torres: Torre[], base: number, radio: number, centro: THREE.Vector3): Construido {
  const grupo = new THREE.Group();
  const caja = new THREE.BoxGeometry(base, 1, base);
  caja.translate(0, 0.5, 0);
  const aristas = new THREE.EdgesGeometry(caja);
  const geometrias: THREE.BufferGeometry[] = [caja, aristas];
  const materiales: THREE.Material[] = [];
  const piezas = new Map<string, Pieza>();
  const lista: Pieza[] = [];

  for (const t of torres) {
    const g = new THREE.Group();
    g.position.set(t.x, 0, t.z);
    const mallas: THREE.Mesh[] = [];
    const mats: THREE.MeshStandardMaterial[] = [];
    const bordes: THREE.Line[] = [];
    const colores: THREE.Color[] = [];
    let acumulado = 0;
    for (const s of t.segmentos) {
      if (s.frac <= 0) continue;
      const mat = materialCara(s.color);
      const bm = materialBorde();
      materiales.push(mat, bm);
      const m = new THREE.Mesh(caja, mat);
      m.scale.y = s.frac;
      m.position.y = acumulado;
      acumulado += s.frac;
      const l = new THREE.LineSegments(aristas, bm);
      m.add(l);
      g.add(m);
      mallas.push(m); mats.push(mat); bordes.push(l); colores.push(new THREE.Color(s.color));
    }
    const p: Pieza = {
      id: t.id, grupo: g, mallas, mats, bordes, altura: 0, objetivo: t.altura, retardo: t.retardo,
      colorObjetivo: colores, ancla: new THREE.Vector3(t.x, 1, t.z),
    };
    grupo.add(g);
    piezas.set(t.id, p);
    lista.push(p);
  }
  return { piezas, contenido: { grupo, piezas: lista, etiquetas: [], radio, centro, geometrias, materiales } };
}
