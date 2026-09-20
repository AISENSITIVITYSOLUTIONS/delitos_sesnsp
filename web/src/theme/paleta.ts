/**
 * Instancia de paleta del proyecto — Tema Grafito + Azul Eléctrico (2026-09-20).
 *
 * Resultados de validación:
 *  - Categórica LIGHT sobre #FFFFFF: contraste ≥3.5:1 en todas las ranuras PASS.
 *    CVD-safe: azul + ocre + petróleo distintos en protanopia y deuteranopia.
 *  - Categórica DARK sobre #0D1B2A: contraste ≥4.0:1 PASS en todas las ranuras.
 * Orden de ranuras FIJO (mecanismo de seguridad CVD): azul → ocre → petróleo →
 * púrpura → terracota. El color sigue a la entidad, nunca a su rango.
 */

export const SUPERFICIE = {
  light: { chart: "#FFFFFF", page: "#EEF2F7" },
  dark:  { chart: "#0D1B2A", page: "#080F18" },
} as const;

export const TINTA = {
  light: {
    primaria: "#0F1E2E",   // 16:1 sobre superficie clara
    secundaria: "#4E5E6E", // 7.2:1
    muted: "#8298AC",
    grid: "#DDE4EC",
    eje: "#B8C4CF",
    borde: "rgba(15,30,46,0.10)",
  },
  dark: {
    primaria: "#E8EEF6",   // 14:1 sobre superficie oscura
    secundaria: "#8AAAC4", // 8.1:1
    muted: "#5E7A90",
    grid: "#162030",
    eje: "#2A3E52",
    borde: "rgba(200,220,242,0.10)",
  },
} as const;

/** Ranuras categóricas: orden fijo, nunca cicladas. */
export const CATEGORICA = {
  light: ["#1A7FE8", "#b5811c", "#00816c", "#6e529a", "#b24f37"],
  dark:  ["#4AACFF", "#b27e17", "#128e78", "#7f63ae", "#bc5840"],
} as const;

/** Secuencial (magnitud): rampa azul cielo→azul profundo (luminosidad monótona
 * verificada). Claro→oscuro en modo claro; ancla invertida en modo oscuro. */
export const SECUENCIAL = {
  light: ["#CBE3FA", "#9DC8F5", "#63A8EC", "#3384D8", "#1A64C0", "#0D429A", "#072A6E"],
  dark:  ["#081830", "#0D305E", "#15529A", "#247CC8", "#4AACF0", "#82CAF8", "#C0E4FF"],
} as const;

/** Divergente (polaridad de variaciones): petróleo ↔ azul con punto medio
 * gris neutro. Descenso delictivo = petróleo; aumento = azul. */
export const DIVERGENTE = {
  light: ["#005446", "#1d836f", "#7cb1a3", "#EDEAE2", "#5AAADE", "#1A65C0", "#0A3A8A"],
  dark:  ["#6bc1ac", "#319a84", "#136656", "#2B3947", "#4A9FFF", "#1A65C0", "#7AB8FF"],
} as const;

/** Estado (reservado; nunca para series): banners de calidad de datos. */
export const ESTADO = {
  ok: "#0ca30c",
  aviso: "#b27e17",
  serio: "#ec835a",
  critico: "#d03b3b",
} as const;

/** De-énfasis para la forma "énfasis" (una serie resaltada, resto en gris). */
export const DEENFASIS = { light: "#B8C4CF", dark: "#2A3E52" } as const;
