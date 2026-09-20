/** Paleta grafito y azul eléctrico.
 * Categorías con ranuras fijas; variaciones conservan su escala divergente.
 * La nueva rampa secuencial requiere una auditoría perceptual independiente.
 */
export const SUPERFICIE = {
  light: { chart: "#FBF9F4", page: "#F4F0E8" },
  dark: { chart: "#172630", page: "#0b141c" },
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
  dark: ["#169bff", "#b27e17", "#128e78", "#7f63ae", "#bc5840"],
} as const;

/** Secuencial: magnitud en azul. Los valores altos son más claros en modo oscuro. */
export const SECUENCIAL = {
  light: ["#d0ece7", "#a1d6d6", "#72bcc6", "#3e9db6", "#047ca6", "#005a8c", "#00386a"],
  dark: ["#12375b", "#14518a", "#176bc0", "#168bea", "#43a6f5", "#80c4fa", "#b8dfff"],
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
