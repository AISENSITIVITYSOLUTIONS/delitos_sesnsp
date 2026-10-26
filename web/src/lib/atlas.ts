/** Contratos de la exploración anual: nunca sumar tasas o convertir ausencias en cero. */
export function valorAnual(valor: number | null | undefined, poblacion: number | null | undefined, tasa: boolean): number | null {
  if (valor == null || !Number.isFinite(valor)) return null;
  return tasa ? poblacion != null && poblacion > 0 ? valor / poblacion * 100_000 : null : valor;
}
export function cambioComparable(actual: number | null, anterior: number | null, meses: number, mesesAntes: number): number | null {
  return meses === 12 && mesesAntes === 12 && actual != null && anterior != null && anterior > 0 ? (actual / anterior - 1) * 100 : null;
}
export function rankingAtlas(filas: {cve: string; nombre: string; valor: number | null}[]) {
  return filas.filter((x): x is {cve: string; nombre: string; valor: number} => x.valor != null && Number.isFinite(x.valor))
    .sort((a,b) => b.valor - a.valor || a.cve.localeCompare(b.cve));
}
