/**
 * Preparación de datos para la vista isométrica. Funciones puras, sin DOM ni Three.js,
 * para poder probarlas con node:test. Respetan las reglas del tablero: solo años
 * completos para comparar, tasas con población CONAPO del mismo año, y null ≠ 0.
 */
import type { EstatalAnual, PoblacionAnual, SeriesNacionales } from "../lib/contratos";

export type MetricaIso = "conteo" | "tasa";
export const TODOS = "total";

/** Años con 12 meses publicados (comparables entre sí). */
export function aniosCompletos(estatal: EstatalAnual): number[] {
  return estatal.anios.filter(a => estatal.meses_publicados[String(a)] === 12);
}

/** Delitos con desglose estatal disponibles en todas las entidades. */
export function delitosEstatales(estatal: EstatalAnual): string[] {
  const ents = Object.values(estatal.datos);
  if (!ents.length) return [];
  return Object.keys(ents[0]).filter(id => ents.every(d => Array.isArray(d[id])));
}

function cantidadEstatal(estatal: EstatalAnual, cve: string, delito: string, anio: number): number | null {
  const i = estatal.anios.indexOf(anio);
  if (i < 0) return null;
  const fila = delito === TODOS ? estatal.total[cve] : estatal.datos[cve]?.[delito];
  const v = fila?.[i];
  return v == null ? null : v;
}

export function tasa(cantidad: number | null, poblacion: number | undefined): number | null {
  if (cantidad == null || !poblacion) return null;
  return cantidad / poblacion * 100000;
}

/** Valor por entidad para un delito, año y métrica. */
export function valoresEstatales(
  estatal: EstatalAnual, pob: PoblacionAnual, delito: string, anio: number, metrica: MetricaIso,
): Record<string, number | null> {
  const out: Record<string, number | null> = {};
  for (const cve of Object.keys(estatal.entidades)) {
    const c = cantidadEstatal(estatal, cve, delito, anio);
    out[cve] = metrica === "conteo" ? c : tasa(c, pob.estatal[cve]?.[String(anio)]);
  }
  return out;
}

/** Serie anual (años completos) de una entidad. */
export function serieEntidad(
  estatal: EstatalAnual, pob: PoblacionAnual, cve: string, delito: string, metrica: MetricaIso,
): Array<{ anio: number; v: number | null }> {
  return aniosCompletos(estatal).map(anio => {
    const c = cantidadEstatal(estatal, cve, delito, anio);
    return { anio, v: metrica === "conteo" ? c : tasa(c, pob.estatal[cve]?.[String(anio)]) };
  });
}

/** Posición (1 = mayor) de cada entidad; las que no tienen dato quedan fuera. */
export function posiciones(valores: Record<string, number | null>): Record<string, number> {
  const orden = Object.entries(valores).filter((e): e is [string, number] => e[1] != null)
    .sort((a, b) => b[1] - a[1]);
  return Object.fromEntries(orden.map(([cve], i) => [cve, i + 1]));
}

/** Matriz años × meses de la serie nacional mensual (null = no publicado). */
export function matrizMensual(sn: SeriesNacionales, delito: string): { anios: number[]; filas: (number | null)[][] } {
  const serie = delito === TODOS ? sn.total : sn.series[delito];
  const porAnio = new Map<number, (number | null)[]>();
  sn.meses.forEach((m, i) => {
    const anio = Number(m.slice(0, 4)), mes = Number(m.slice(5, 7)) - 1;
    if (!porAnio.has(anio)) porAnio.set(anio, Array(12).fill(null));
    porAnio.get(anio)![mes] = serie?.[i] ?? null;
  });
  const anios = [...porAnio.keys()].sort((a, b) => a - b);
  return { anios, filas: anios.map(a => porAnio.get(a)!) };
}

/** Suma anual de la serie nacional; null si algún mes no está publicado. */
export function anualNacional(sn: SeriesNacionales, delito: string): Array<{ anio: number; v: number | null }> {
  const { anios, filas } = matrizMensual(sn, delito);
  return anios.map((anio, i) => ({
    anio,
    v: filas[i].every(x => x != null) ? (filas[i] as number[]).reduce((a, b) => a + b, 0) : null,
  }));
}

/** Cambio porcentual entre el primer y el último valor no nulo. */
export function cambioPct(serie: Array<{ v: number | null }>): number | null {
  const v = serie.map(x => x.v).filter((x): x is number => x != null);
  if (v.length < 2 || v[0] === 0) return null;
  return (v[v.length - 1] - v[0]) / v[0] * 100;
}

/** Altura proporcional al máximo, con un mínimo visible para valores positivos. */
export function alturas(valores: Record<string, number | null>, maxAltura: number, minimo = 0.35): Record<string, number> {
  const nums = Object.values(valores).filter((v): v is number => v != null);
  const max = nums.length ? Math.max(...nums) : 0;
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(valores)) {
    out[k] = v == null || max <= 0 ? 0.12 : v === 0 ? 0.12 : Math.max(minimo, v / max * maxAltura);
  }
  return out;
}
