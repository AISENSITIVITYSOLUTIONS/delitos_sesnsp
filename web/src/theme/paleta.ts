/** Paleta Grafito y zafiro.
 * Categorías con ranuras fijas; variaciones conservan su escala divergente.
 * La nueva rampa secuencial requiere una auditoría perceptual independiente.
 */
export const SUPERFICIE = {
  light: { chart: "#FBF9F4", page: "#F4F0E8" },
  dark: { chart: "#172337", page: "#0B1220" },
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
  dark: ["#459CFF", "#b27e17", "#128e78", "#7f63ae", "#bc5840"],
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
  dark: ["#80CBBE", "#52988D", "#305D58", "#536173", "#71524C", "#B17968", "#EBA18C"],
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

/** Identidad estable por categoría, independiente de ranking, periodo o vista.
 * Las modalidades heredan la identidad del agregado y mantienen su etiqueta. */
const IDENTIDADES: Record<string,string> = {
 'violencia-familiar':'#C2A5F0','otros-robos':'#E4C786',
 'otros-delitos-del-fuero-comun':'#A9BCCB','robo-de-vehiculo-automotor':'#E8A7D1',
 'lesiones-dolosas':'#9AD0C4','homicidio-doloso':'#F0D58F',
 'feminicidio':'#D9B6F4','extorsion':'#B8D888','secuestro':'#F3B9AE',
 'robo-a-negocio':'#C8BFEB','robo-a-casa-habitacion':'#B2D3B1',
 'robo-a-transeunte-en-via-publica':'#DBC6A9'
};
export function colorDelito(id:string):string {
 const k=id.split('/')[0];
 const color=IDENTIDADES[k] ?? ['#C2A5F0','#E4C786','#A9BCCB','#E8A7D1','#9AD0C4'][Array.from(k).reduce((a,c)=>(a*31+c.charCodeAt(0))>>>0,0)%5];
 const claro=typeof document!=='undefined'&&document.documentElement.dataset.theme==='light';
 return claro?'#'+color.slice(1).match(/../g)!.map(c=>Math.round(parseInt(c,16)*.52).toString(16).padStart(2,'0')).join(''):color;
}
export function indiceCambio(v:number,max:number):number {
 if(v===0||max===0)return 3;
 const paso=Math.min(3,Math.max(1,Math.ceil(Math.abs(v)/max*3)));
 return 3+Math.sign(v)*paso;
}
