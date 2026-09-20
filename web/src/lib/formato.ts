/** Formato numérico y de fechas en español de México. */

const nfEntero = new Intl.NumberFormat("es-MX", { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat("es-MX", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const nf2 = new Intl.NumberFormat("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const fEntero = (v: number | null | undefined): string =>
  v == null ? "—" : nfEntero.format(v);

export const fTasa = (v: number | null | undefined): string =>
  v == null ? "n. d." : nf1.format(v);

export const fPct = (v: number | null | undefined, signo = true): string => {
  if (v == null) return "no calculable";
  const s = signo && v > 0 ? "+" : "";
  return `${s}${nf1.format(v)} %`;
};

export const fPuntosTasa = (v: number | null | undefined): string =>
  v == null ? "n. d." : `${v > 0 ? "+" : ""}${nf2.format(v)} pts`;

/** Compacto para etiquetas: 1.2 M, 45.3 mil. */
export const fCompacto = (v: number | null | undefined): string => {
  if (v == null) return "—";
  if (Math.abs(v) >= 1_000_000) return `${nf1.format(v / 1_000_000)} M`;
  if (Math.abs(v) >= 10_000) return `${nf1.format(v / 1_000)} mil`;
  return nfEntero.format(v);
};

const MESES_CORTO = ["ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic"];
const MESES_LARGO = ["enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

/** "2015-03" → "mar 2015" */
export const fMes = (ym: string): string => {
  const [a, m] = ym.split("-").map(Number);
  return `${MESES_CORTO[m - 1]} ${a}`;
};

export const fMesLargo = (ym: string): string => {
  const [a, m] = ym.split("-").map(Number);
  return `${MESES_LARGO[m - 1]} de ${a}`;
};

/** Rango: "ene 2015 – jul 2026" */
export const fRango = (desde: string, hasta: string): string =>
  `${fMes(desde)} – ${fMes(hasta)}`;

/** "ene–jul 2026" (mismo año) para acumulados parciales. */
export const fAcumulado = (anio: number, mesHasta: number): string =>
  mesHasta >= 12 ? `${anio}` : `ene–${MESES_CORTO[mesHasta - 1]} ${anio}`;

export const fFechaHora = (iso: string | null): string => {
  if (!iso) return "—";
  const d = new Date(iso);
  return new Intl.DateTimeFormat("es-MX", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", timeZone: "America/Mexico_City",
  }).format(d) + " (CDMX)";
};
