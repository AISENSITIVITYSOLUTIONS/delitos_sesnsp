import type { SeriesNacionales } from '../lib/contratos';
import { resumenTemporal } from '../lib/altoImpacto';
const f=(v:number|null)=>v==null?'Datos insuficientes':v.toLocaleString('es-MX',{maximumFractionDigits:1});
export default function Persistencia({sn,id,fin}:{sn:SeriesNacionales;id:string;fin:string}){
 const r=resumenTemporal(sn,id,fin), validos=r.filter(x=>x.cambio!=null), caidas=validos.filter(x=>x.cambio!<0).length;
 return <div className="persistencia"><h4>¿La dirección del cambio se mantiene?</h4><p>Comparaciones en <strong>registros absolutos</strong>, con ventanas completas y el mismo calendario. Son distintas lecturas de la misma serie; no pruebas independientes de causalidad.</p>
 <div className="impacto-kpis">{r.map(x=><article key={x.titulo}><span>{x.titulo}</span><strong>{x.cambio==null?'—':`${f(x.cambio)} %`}</strong><small>{f(x.actual)} frente a {f(x.base)} registros</small><small>{x.periodo}</small></article>)}</div>
 <p>{validos.length?`${caidas} de ${validos.length} comparaciones calculables muestran descenso. ${validos.length<4?'Las restantes carecen de una ventana completa comparable.':''}`:'No existe una ventana interanual completa dentro de este instrumento. Una variación entre meses de 2026 no sustituye esta comparación.'}</p>
 <details><summary>Cómo interpretar la persistencia</summary><p>Si la variación mensual difiere de los acumulados, la conclusión depende de la ventana. La coincidencia de signos refuerza la descripción de la tendencia, pero no identifica la causa ni corrige cambios de denuncia o registro. Base cero: variación porcentual no definida.</p></details></div>;
}
