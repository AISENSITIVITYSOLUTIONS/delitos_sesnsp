/** Utilidades geográficas mínimas (proyección Mercator esférica para el SVG 2D).
 * La cartografía llega ya simplificada desde el pipeline (fuente oficial,
 * versión registrada en el manifiesto); aquí solo se proyecta y se dibuja. */

export interface Territorio {
  cve: string;
  nombre: string;
  /** Multipolígono: lista de anillos exteriores [lon, lat][] */
  pols: [number, number][][];
}

export interface GeoColeccion { territorios: Territorio[] }

const R = 6378137;
export const mercX = (lon: number) => R * (lon * Math.PI / 180);
export const mercY = (lat: number) => {
  const phi = Math.max(Math.min(lat, 85), -85) * Math.PI / 180;
  return R * Math.log(Math.tan(Math.PI / 4 + phi / 2));
};

export interface Marco { minX: number; maxX: number; minY: number; maxY: number }

export function marcoDe(ts: Territorio[]): Marco {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const t of ts) for (const anillo of t.pols) for (const [lon, lat] of anillo) {
    const x = mercX(lon), y = mercY(lat);
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  return { minX, maxX, minY, maxY };
}

/** Ruta SVG de un territorio dentro de un marco y tamaño dados. */
export function rutaSVG(t: Territorio, marco: Marco, ancho: number, alto: number, margen = 8): string {
  const sx = (ancho - 2 * margen) / (marco.maxX - marco.minX);
  const sy = (alto - 2 * margen) / (marco.maxY - marco.minY);
  const s = Math.min(sx, sy);
  const ox = margen + ((ancho - 2 * margen) - (marco.maxX - marco.minX) * s) / 2;
  const oy = margen + ((alto - 2 * margen) - (marco.maxY - marco.minY) * s) / 2;
  let d = "";
  for (const anillo of t.pols) {
    anillo.forEach(([lon, lat], i) => {
      const x = ox + (mercX(lon) - marco.minX) * s;
      const y = oy + (marco.maxY - mercY(lat)) * s;
      d += `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`;
    });
    d += "Z";
  }
  return d;
}

export function centroide(t: Territorio): [number, number] {
  let sx = 0, sy = 0, n = 0;
  for (const anillo of t.pols) for (const [lon, lat] of anillo) { sx += lon; sy += lat; n++; }
  return n ? [sx / n, sy / n] : [-102, 23.6];
}

/** Cortes de clase por cuantiles (documentados en la leyenda). */
export function cortesCuantiles(valores: number[], k = 7): number[] {
  const v = valores.filter(x => Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return [];
  const cortes: number[] = [];
  for (let i = 1; i < k; i++) cortes.push(v[Math.min(Math.floor(i * v.length / k), v.length - 1)]);
  return [...new Set(cortes)];
}

export const clase = (v: number, cortes: number[]): number => {
  let c = 0;
  for (const corte of cortes) if (v > corte) c++; else break;
  return c;
};
