import type { EstatalAnual,SeriesNacionales } from './contratos';
import { ventana } from './altoImpacto.ts';
export function descomponer(e:EstatalAnual,sn:SeriesNacionales,id:string,base:number,actual:number){
 if(sn.metodologia!=='NM-2015'||base>=actual||actual>2025||e.meses_publicados[String(base)]!==12||e.meses_publicados[String(actual)]!==12)return null;
 const ib=e.anios.indexOf(base),ia=e.anios.indexOf(actual);
 const filas=Object.entries(e.entidades).map(([cve,nombre])=>{
  const b=e.datos[cve]?.[id]?.[ib],a=e.datos[cve]?.[id]?.[ia];
  return {cve,nombre,base:b,actual:a,diferencia:a!=null&&b!=null?a-b:null};
 });
 if(filas.length!==32||filas.some(r=>r.base==null||r.actual==null||r.base<0||r.actual<0))return null;
 const b=filas.reduce((a,r)=>a+r.base!,0),a=filas.reduce((a,r)=>a+r.actual!,0);
 if(b!==ventana(sn,id,`${base}-12`,12)||a!==ventana(sn,id,`${actual}-12`,12))return null;
 return {filas,base:b,actual:a,diferencia:a-b};
}
