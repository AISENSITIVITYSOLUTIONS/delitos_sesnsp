/** Operaciones de series centralizadas (mismas definiciones que el pipeline). */
import type { SeriesNacionales, PoblacionAnual } from "./contratos";

export interface PuntoMensual { ym: string; anio: number; mes: number; v: number | null }

export function serieMensual(sn: SeriesNacionales, delitoId: string | "total"): PuntoMensual[] {
  const vals = delitoId === "total" ? sn.total : sn.series[delitoId];
  if (!vals) return [];
  return sn.meses.map((ym, i) => {
    const [a, m] = ym.split("-").map(Number);
    return { ym, anio: a, mes: m, v: vals[i] ?? null };
  });
}

export function recortar(serie: PuntoMensual[], desde: string, hasta: string): PuntoMensual[] {
  return serie.filter(p => p.ym >= desde && p.ym <= hasta);
}

/** Agregado anual: suma de meses publicados; reporta meses por año. */
export function aAnual(serie: PuntoMensual[]): { anio: number; v: number | null; meses: number }[] {
  const por = new Map<number, { s: number; n: number }>();
  for (const p of serie) {
    const e = por.get(p.anio) ?? { s: 0, n: 0 };
    if (p.v != null) { e.s += p.v; e.n += 1; }
    por.set(p.anio, e);
  }
  return [...por.entries()].sort((a, b) => a[0] - b[0])
    .map(([anio, e]) => ({ anio, v: e.n ? e.s : null, meses: e.n }));
}

/** Media móvil de 12 meses: SOLO ventanas completas (12 valores publicados). */
export function mediaMovil12(serie: PuntoMensual[]): (number | null)[] {
  return serie.map((_, i) => {
    if (i < 11) return null;
    const ventana = serie.slice(i - 11, i + 1);
    if (ventana.some(p => p.v == null)) return null;
    return ventana.reduce((s, p) => s + (p.v as number), 0) / 12;
  });
}

/** ¿Hay al menos una ventana completa de 12 meses? */
export const hayVentanaCompleta = (serie: PuntoMensual[]): boolean =>
  mediaMovil12(serie).some(v => v != null);

export function acumulado(serie: PuntoMensual[]): { suma: number; mesesPublicados: number } {
  let suma = 0, n = 0;
  for (const p of serie) if (p.v != null) { suma += p.v; n += 1; }
  return { suma, mesesPublicados: n };
}

/** Comparación entre meses equivalentes: mismos meses del año anterior.
 * Devuelve null si el periodo anterior no está completo o cruza tramos
 * metodológicos no homologados (eso lo controla quien llama con `limiteInferior`). */
export function comparacionEquivalente(
  serie: PuntoMensual[], desde: string, hasta: string, limiteInferior?: string,
): { actual: number; anterior: number; absoluta: number; pct: number | null } | null {
  const d = new Date(`${desde}-01T00:00:00Z`), h = new Date(`${hasta}-01T00:00:00Z`);
  const dPrev = `${d.getUTCFullYear() - 1}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  const hPrev = `${h.getUTCFullYear() - 1}-${String(h.getUTCMonth() + 1).padStart(2, "0")}`;
  if (limiteInferior && dPrev < limiteInferior) return null;
  const act = recortar(serie, desde, hasta), prev = recortar(serie, dPrev, hPrev);
  if (!act.length || !prev.length) return null;
  if (act.some(p => p.v == null) || prev.some(p => p.v == null)) return null;
  if (act.length !== prev.length) return null;
  const a = act.reduce((s, p) => s + (p.v as number), 0);
  const b = prev.reduce((s, p) => s + (p.v as number), 0);
  return { actual: a, anterior: b, absoluta: a - b, pct: b === 0 ? null : (a - b) / b * 100 };
}

/** Tasa por 100 mil con el denominador del año del numerador. */
export function tasaMensual(p: PuntoMensual, pob: PoblacionAnual, cve: string | null): number | null {
  if (p.v == null) return null;
  const anio = String(p.anio);
  const base = cve == null ? pob.nacional[anio] : pob.estatal[cve]?.[anio];
  if (!base) return null;
  return p.v / base * 100_000;
}

/** Tasa anual (o del periodo parcial etiquetado) por 100 mil. */
export function tasaAnual(v: number | null, anio: number, pob: PoblacionAnual, cve: string | null): number | null {
  if (v == null) return null;
  const base = cve == null ? pob.nacional[String(anio)] : pob.estatal[cve]?.[String(anio)];
  if (!base) return null;
  return v / base * 100_000;
}

/** Tasa anual media de un periodo multianual: exposición poblacional acumulada,
 * ponderando años parciales por meses publicados. */
export function tasaPeriodo(
  serie: PuntoMensual[], pob: PoblacionAnual, cve: string | null,
): { tasa: number | null; aniosPersona: number } {
  const porAnio = aAnual(serie);
  let suma = 0, exposicion = 0;
  for (const r of porAnio) {
    const base = cve == null ? pob.nacional[String(r.anio)] : pob.estatal[cve]?.[String(r.anio)];
    if (r.v == null || !base) continue;
    suma += r.v;
    exposicion += base * (r.meses / 12);
  }
  return { tasa: exposicion > 0 ? suma / exposicion * 100_000 : null, aniosPersona: exposicion };
}
