/**
 * Instancia de paleta del proyecto (método dataviz, validada con
 * scripts/validate_palette.js del skill: seis verificaciones, ambos modos).
 *
 * Resultados de validación (2026-09-19):
 *  - Categórica LIGHT sobre #FBF9F4: todas las verificaciones PASS,
 *    peor par adyacente CVD ΔE 10.7 (objetivo ≥8), visión normal ≥15. Sin WARN.
 *  - Categórica DARK  sobre #12202E: todas PASS, peor par CVD ΔE 10.2. Sin WARN.
 * Orden de ranuras FIJO (mecanismo de seguridad CVD): azul → ocre → petróleo →
 * púrpura → terracota. El color sigue a la entidad, nunca a su rango.
 * Formas de todos-los-pares (dispersión, coropletas categóricas, múltiplos
 * pequeños): máximo 3 ranuras; más series se pliegan a "Otros" o se facetan.
 */

export const SUPERFICIE = {
  light: { chart: "#FBF9F4", page: "#F4F0E8" },
  dark: { chart: "#12202E", page: "#0B1520" },
} as const;

export const TINTA = {
  light: {
    primaria: "#14212E",   // 15.5:1 sobre superficie clara
    secundaria: "#4E5A66", // 6.7:1
    muted: "#8A8B86",
    grid: "#E5E1D6",       // hairline sólido
    eje: "#C9C4B6",
    borde: "rgba(20,33,46,0.10)",
  },
  dark: {
    primaria: "#F2EFE7",   // 14.4:1 sobre superficie oscura
    secundaria: "#A8B4BE", // 7.8:1
    muted: "#7C8894",
    grid: "#22303E",
    eje: "#33424F",
    borde: "rgba(242,239,231,0.10)",
  },
} as const;

/** Ranuras categóricas: orden fijo, nunca cicladas. */
export const CATEGORICA = {
  light: ["#1e5a96", "#b5811c", "#00816c", "#6e529a", "#b24f37"],
  dark: ["#437dbc", "#b27e17", "#128e78", "#7f63ae", "#bc5840"],
} as const;

/** Secuencial (magnitud): rampa análoga petróleo→azul marino (vecinos fríos,
 * excepción análoga documentada del método; luminosidad monótona verificada
 * 0.92→0.34). Claro→oscuro en modo claro; ancla invertida en modo oscuro. */
export const SECUENCIAL = {
  light: ["#d0ece7", "#a1d6d6", "#72bcc6", "#3e9db6", "#047ca6", "#005a8c", "#00386a"],
  dark: ["#0c2f52", "#00466f", "#006082", "#007f99", "#339ca9", "#6bb7b8", "#9cd0cb"],
} as const;

/** Divergente (polaridad de variaciones): petróleo ↔ terracota con punto medio
 * gris neutro. Descenso delictivo = petróleo; aumento = terracota. */
export const DIVERGENTE = {
  light: ["#005446", "#1d836f", "#7cb1a3", "#EDEAE2", "#cf9485", "#ac543f", "#792a17"],
  dark: ["#6bc1ac", "#319a84", "#136656", "#2B3947", "#824434", "#c36953", "#e69783"],
} as const;

/** Estado (reservado; nunca para series): banners de calidad de datos. */
export const ESTADO = {
  ok: "#0ca30c",
  aviso: "#b27e17",
  serio: "#ec835a",
  critico: "#d03b3b",
} as const;

/** De-énfasis para la forma "énfasis" (una serie resaltada, resto en gris). */
export const DEENFASIS = { light: "#C4C0B4", dark: "#3A4854" } as const;
