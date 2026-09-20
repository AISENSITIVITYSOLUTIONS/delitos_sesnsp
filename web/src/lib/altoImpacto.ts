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

/** Ventanas completas: un faltante invalida el agregado; los ceros sí cuentan. */
export function desplazarMes(mes:string,delta:number):string {
 const [y,m]=mes.split('-').map(Number),d=new Date(Date.UTC(y,m-1+delta,1));
 return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}`;
}
export function ventana(sn:SeriesNacionales,id:string,fin:string,n:number):number|null {
 if(!Number.isInteger(n)||n<1)return null;
 const vs=Array.from({length:n},(_,i)=>valorMes(sn,id,desplazarMes(fin,i-n+1)));
 return vs.some(v=>v==null)?null:vs.reduce<number>((a,v)=>a+v!,0);
}
export function resumenTemporal(sn:SeriesNacionales,id:string,fin:string){
 const previo=desplazarMes(fin,-12), n=Number(fin.slice(5));
 return [
  {titulo:'Mismo mes del año anterior',actual:valorMes(sn,id,fin),base:valorMes(sn,id,previo),periodo:`${fin} frente a ${previo}`},
  {titulo:'Acumulado del año',actual:ventana(sn,id,fin,n),base:ventana(sn,id,previo,n),periodo:`${fin.slice(0,4)}-01–${fin} frente a ${previo.slice(0,4)}-01–${previo}`},
  {titulo:'Últimos tres meses',actual:ventana(sn,id,fin,3),base:ventana(sn,id,previo,3),periodo:`${desplazarMes(fin,-2)}–${fin} frente a ${desplazarMes(previo,-2)}–${previo}`},
  {titulo:'Doce meses móviles',actual:ventana(sn,id,fin,12),base:ventana(sn,id,previo,12),periodo:`${desplazarMes(fin,-11)}–${fin} frente a ${desplazarMes(previo,-11)}–${previo}`},
 ].map(d=>({...d,cambio:cambio(d.actual,d.base)}));
}
