import type { SeriesNacionales } from './contratos';
export const mesesCortos=['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
export function diasMes(m:string){const [a,b]=m.split('-').map(Number);return new Date(Date.UTC(a,b,0)).getUTCDate();}
export function indiceMes(m:string){const [a,b]=m.split('-').map(Number);return a*12+b-1;}
export function valorSerie(sn:SeriesNacionales,id:string){return id==='total'?sn.total:sn.series[id]??[];}
export function calendario(sn:SeriesNacionales,id:string,modo:string){
 const valores=valorSerie(sn,id), anos=[...new Set(sn.meses.map(m=>m.slice(0,4)))];
 const completos=anos.filter(a=>Array.from({length:12},(_,i)=>`${a}-${String(i+1).padStart(2,'0')}`).every(m=>{const i=sn.meses.indexOf(m);return i>=0&&valores[i]!=null&&valores[i]!>=0;}));
 const referencia=Array.from({length:12},(_,mes)=>{const vs=sn.meses.flatMap((m,i)=>completos.includes(m.slice(0,4))&&Number(m.slice(5))===mes+1&&valores[i]!=null?[valores[i]!/diasMes(m)]:[]);return vs.length?vs.reduce((a,b)=>a+b,0)/vs.length:null;});
 return anos.flatMap(a=>mesesCortos.map((_,mes)=>{const fecha=`${a}-${String(mes+1).padStart(2,'0')}`,i=sn.meses.indexOf(fecha),v=i<0?null:valores[i];const diario=v==null||v<0?null:v/diasMes(fecha),r=referencia[mes];return {fecha,valor:diario==null?null:modo==='diario'?diario:modo==='patron'?r!=null&&r>0?100*(diario/r-1):null:v,referencia:r};}));
}
export const administraciones=[{nombre:'Peña Nieto',desde:'2012-12',hasta:'2018-11'},{nombre:'López Obrador',desde:'2018-12',hasta:'2024-09'},{nombre:'Sheinbaum',desde:'2024-10',hasta:'2030-09'}];
export function serieMandato(sn:SeriesNacionales,id:string,desde:string,hasta:string,diario:boolean){return Array.from({length:72},(_,i)=>{const x=indiceMes(desde)+i;if(x>indiceMes(hasta))return null;const pos=sn.meses.findIndex(m=>indiceMes(m)===x),v=valorSerie(sn,id)[pos];return pos<0||v==null||v<0?null:diario?v/diasMes(sn.meses[pos]):v;});}
