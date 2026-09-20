import type { SeriesNacionales } from './contratos';
/** Selección editorial NI, no canasta oficial. Sin agregación entre instrumentos. */
export const PRIORITARIOS = ['homicidio-doloso','feminicidio','extorsion','extorsion-presencial','extorsion-por-otros-medios','secuestro','secuestro-extorsivo','secuestro-expres','secuestro-con-calidad-de-rehen','secuestro-para-causar-dano','robo-de-vehiculo-automotor','robo-de-vehiculo-automotor-coche-de-4-ruedas','robo-de-vehiculo-automotor-motocicleta','robo-de-vehiculo-automotor-embarcaciones','robo-a-transportista','robo-a-negocio','robo-a-casa-habitacion','robo-a-transeunte-en-via-publica','violacion-simple','violacion-equiparada'];
export function cambio(actual:number|null, base:number|null):number|null {
  return actual == null || base == null || !Number.isFinite(actual) || !Number.isFinite(base) || base <= 0 || actual < 0 ? null : (actual/base-1)*100;
}
export function valorMes(sn:SeriesNacionales,id:string,mes:string):number|null {
  if (mes>sn.meta.corte) return null;
  const i=sn.meses.indexOf(mes), v=sn.series[id]?.[i];
  return i<0 || v==null || !Number.isFinite(v) || v<0 ? null : v;
}
export function dias(mes:string):number { const [y,m]=mes.split('-').map(Number);return new Date(Date.UTC(y,m,0)).getUTCDate(); }
export function medida(v:number|null,mes:string,modo:string,poblacion:Record<string,number>):number|null {
  if(v==null)return null;
  if(modo==='diario')return v/dias(mes);
  if(modo==='tasa'){const p=poblacion[mes.slice(0,4)];return p>0?v/p*100000:null;}
  return v;
}
