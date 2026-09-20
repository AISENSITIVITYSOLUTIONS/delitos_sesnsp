/** Estado global de exploración (filtros) con sincronización en el hash de la
 * URL para que los enlaces conserven la selección. */
import { create } from "zustand";

export type Metrica = "conteo" | "tasa";
export type Tramo = "2015-2025" | "2026" | "completo";
export type Vista3D = "2d" | "3d";

export interface Filtros {
  tramo: Tramo;
  metrica: Metrica;
  /** Rango temporal seleccionado, meses "YYYY-MM" inclusive. */
  desde: string;
  hasta: string;
  cveEnt: string | null;        // null = nacional
  cveMun: string | null;
  delitoId: string | null;      // null = todos los delitos
  comparacion: string[];        // hasta 5 claves de territorio (ent o mun)
  umbralPoblacion: number;      // filtro municipal visible y modificable
  vistaMapa: Vista3D;
}

interface Estado extends Filtros {
  set: (p: Partial<Filtros>) => void;
  reiniciar: () => void;
}

export const FILTROS_INICIALES: Filtros = {
  tramo: "2015-2025",
  metrica: "conteo",
  desde: "2015-01",
  hasta: "2025-12",
  cveEnt: null,
  cveMun: null,
  delitoId: null,
  comparacion: [],
  umbralPoblacion: 0,
  vistaMapa: "2d",
};

const aHash = (f: Filtros): string => {
  const p = new URLSearchParams();
  if (f.tramo !== FILTROS_INICIALES.tramo) p.set("t", f.tramo);
  if (f.metrica !== "conteo") p.set("m", f.metrica);
  if (f.desde !== FILTROS_INICIALES.desde) p.set("d", f.desde);
  if (f.hasta !== FILTROS_INICIALES.hasta) p.set("h", f.hasta);
  if (f.cveEnt) p.set("e", f.cveEnt);
  if (f.cveMun) p.set("mu", f.cveMun);
  if (f.delitoId) p.set("del", f.delitoId);
  if (f.comparacion.length) p.set("c", f.comparacion.join("."));
  if (f.umbralPoblacion) p.set("u", String(f.umbralPoblacion));
  if (f.vistaMapa !== "2d") p.set("v", f.vistaMapa);
  const s = p.toString();
  return s ? `#${s}` : "";
};

const deHash = (): Partial<Filtros> => {
  try {
    const p = new URLSearchParams(window.location.hash.slice(1));
    const f: Partial<Filtros> = {};
    const t = p.get("t"); if (t === "2015-2025" || t === "2026" || t === "completo") f.tramo = t;
    if (p.get("m") === "tasa") f.metrica = "tasa";
    const re = /^\d{4}-\d{2}$/;
    const d = p.get("d"); if (d && re.test(d)) f.desde = d;
    const h = p.get("h"); if (h && re.test(h)) f.hasta = h;
    const e = p.get("e"); if (e && /^\d{2}$/.test(e)) f.cveEnt = e;
    const mu = p.get("mu"); if (mu && /^\d{5}$/.test(mu)) f.cveMun = mu;
    const del = p.get("del"); if (del && del.length < 80) f.delitoId = del;
    const c = p.get("c"); if (c) f.comparacion = c.split(".").filter(x => /^\d{2}(\d{3})?$/.test(x)).slice(0, 5);
    const u = p.get("u"); if (u && /^\d+$/.test(u)) f.umbralPoblacion = Math.min(+u, 1_000_000);
    if (p.get("v") === "3d") f.vistaMapa = "3d";
    return f;
  } catch { return {}; }
};

export const useEstado = create<Estado>((set, get) => ({
  ...FILTROS_INICIALES,
  ...deHash(),
  set: (p) => {
    set(p);
    const f = get();
    const hash = aHash(f);
    try {
      history.replaceState(null, "", hash || window.location.pathname + window.location.search);
    } catch { /* entorno sin history */ }
  },
  reiniciar: () => {
    set(FILTROS_INICIALES);
    try { history.replaceState(null, "", window.location.pathname + window.location.search); } catch { /* noop */ }
  },
}));

/** Tema del documento (claro/oscuro/auto) con persistencia ligera. */
export function alternarTema(): void {
  const raiz = document.documentElement;
  const actual = raiz.getAttribute("data-theme");
  const osOscuro = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const efectivo = actual ?? (osOscuro ? "dark" : "light");
  const siguiente = efectivo === "dark" ? "light" : "dark";
  raiz.setAttribute("data-theme", siguiente);
  try { localStorage.setItem("tema", siguiente); } catch { /* almacenamiento no disponible */ }
}

export function iniciarTema(): void {
  try {
    const t = localStorage.getItem("tema");
    if (t === "light" || t === "dark") document.documentElement.setAttribute("data-theme", t);
  } catch { /* almacenamiento no disponible */ }
}
