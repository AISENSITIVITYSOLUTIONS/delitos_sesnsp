import CambioVisual from "./CambioVisual";
import { colorDelito } from "../theme/paleta";
import Declaraciones from './Declaraciones';
import Persistencia from './Persistencia';
import ContrasteFuentes from './ContrasteFuentes';
import { useState } from 'react';
import type { SeriesNacionales, PoblacionAnual } from '../lib/contratos';
import { PRIORITARIOS, cambio, valorMes, medida } from '../lib/altoImpacto';
import { descargarCSV } from '../lib/datos';
import Grafica from './Grafica';
const fmt=(n:number|null)=>n==null?'No comparable':n.toLocaleString('es-MX',{maximumFractionDigits:2});

const enfoques=[
 ['1 · Evolución','¿Cuánto cambió?','Compara meses del mismo instrumento. Alterna registros, promedio diario y tasa mensual; una caída entre dos meses no demuestra una tendencia sostenida.'],
 ['2 · Punto de partida','¿Depende de la base?','Contrasta el mes elegido con el mismo mes de otros años. Todas las bases disponibles permanecen visibles; no se selecciona únicamente la que produzca la mayor caída.'],
 ['3 · Composición','¿Qué registros aumentan o disminuyen?','Observa cada categoría por separado. Un descenso en robo no permite concluir que también descendieron homicidio, feminicidio o extorsión. No se calcula un total de esta selección editorial.'],
 ['4 · Afirmaciones','¿Se puede reproducir?','Antes de calificar una declaración se necesita su fuente primaria, fecha, unidad, periodo, canasta, versión de datos y fórmula. Este módulo no emite veredictos sobre declaraciones todavía no documentadas.'],
 ['5 · Contraste externo','¿Qué mide cada fuente?','Contrasta registros con estadísticas de mortalidad y encuestas en sus periodos y universos respectivos. La coincidencia temporal no identifica por sí sola un efecto de gobierno.'],
];
export default function AltoImpacto({nm,nr,pob}:{nm:SeriesNacionales;nr:SeriesNacionales|null;pob:PoblacionAnual}){
 const [tramo,setTramo]=useState('nm');const sn=tramo==='nr'&&nr?nr:nm;
 const [id,setId]=useState('homicidio-doloso');const [tab,setTab]=useState(0);
 const [seleccion,setSeleccion]=useState('');const [baseSel,setBase]=useState('');const [modo,setModo]=useState('conteo');
 const ids=PRIORITARIOS.filter(k=>sn.series[k]).flatMap(k=>[k,...Object.keys(sn.series).filter(m=>m.startsWith(k+'/')&&(m.endsWith('/con-violencia')||m.endsWith('/sin-violencia')))]);
 const nombre=(k:string)=>{const [padre,modalidad]=k.split('/');return `${sn.jerarquia[padre]?.subtipo??padre}${modalidad?' · '+modalidad.replaceAll('-',' '):''}`;};const delito=ids.includes(id)?id:ids[0];
 const meses=sn.meses.filter(m=>m<=sn.meta.corte);
 const actual=meses.includes(seleccion)?seleccion:meses.at(-1)!;
 const mismoAnterior=`${Number(actual.slice(0,4))-1}${actual.slice(4)}`;
 const base=meses.includes(baseSel)?baseSel:meses.includes(mismoAnterior)?mismoAnterior:meses[0];
 const valor=(k:string,m:string)=>medida(valorMes(sn,k,m),m,modo,pob.nacional);
 const a=valor(delito,actual),b=valor(delito,base),dif=cambio(a,b);
 const unidad=modo==='tasa'?'Delitos por 100 mil habitantes · tasa mensual, no anualizada':modo==='diario'?'Delitos registrados por día del mes':'Delitos registrados';
 const filas=meses.map(m=>[m,valorMes(sn,delito,m),valor(delito,m)]);
 return <section className="seccion impacto" id="alto-impacto" aria-labelledby="t-impacto">
  <div className="impacto-hero"><div><p className="impacto-eyebrow">NI / LABORATORIO DE EVIDENCIA</p><h2 id="t-impacto">Delitos de alto impacto</h2><p>Medir el cambio. Examinar sus límites. Entender el contexto.</p></div><span className="impacto-badge">Análisis independiente</span></div>
  <p className="seccion__desc">Selección analítica de NI, no una canasta oficial certificada. El selector distingue robos agregados y modalidades con/sin violencia cuando están disponibles. No deben sumarse las modalidades con su categoría total. Se muestran delitos, no víctimas ni carpetas. No se unen automáticamente las metodologías 2015–2025 y 2026.</p>
  <div className="impacto-controles">
   <label>Instrumento<select className="control" value={tramo} onChange={e=>{setTramo(e.target.value);setSeleccion('');setBase('');}}><option value="nm">2015–2025</option>{nr&&<option value="nr">2026 · RNID</option>}</select></label>
   <label>Delito<select className="control" value={delito} onChange={e=>setId(e.target.value)}>{ids.map(k=><option value={k} key={k}>{nombre(k)}</option>)}</select></label>
   <label>Métrica<select className="control" value={modo} onChange={e=>setModo(e.target.value)}><option value="conteo">Registros mensuales</option><option value="diario">Promedio diario</option><option value="tasa">Tasa mensual /100 mil</option></select></label>
   <label>Mes de análisis<select className="control" value={actual} onChange={e=>{setSeleccion(e.target.value);setBase('');}}>{meses.map(m=><option key={m}>{m}</option>)}</select></label>
   <label>Mes de comparación<select className="control" value={base} onChange={e=>setBase(e.target.value)}>{meses.filter(m=>m<=actual).map(m=><option key={m}>{m}</option>)}</select></label>
  </div>
  <p className="nota">Filtros propios del laboratorio · ámbito nacional · {unidad}. Las tasas utilizan población total; feminicidio no se presenta aquí como tasa por población femenina.</p>
  <div className="impacto-kpis" aria-live="polite">
   <article><span>{nombre(delito)} · {actual}</span><strong>{fmt(a)}</strong><small>{unidad}</small></article>
   <article><span>Referencia · {base}</span><strong>{fmt(b)}</strong><small>Misma unidad y mismo instrumento</small></article>
   <article><span>Cambio frente a la referencia</span><strong><CambioVisual valor={dif} sufijo=" %"/></strong><small>{actual===base?'Se está comparando el mismo mes.':actual.slice(5)!==base.slice(5)?'Meses distintos: puede intervenir la estacionalidad.':'Mismo mes del calendario; no implica causalidad.'}</small></article>
  </div>
  <div className="impacto-tabs" role="group" aria-label="Enfoques analíticos">{enfoques.map((t,i)=><button className="boton" key={t[0]} aria-pressed={tab===i} onClick={()=>setTab(i)}>{t[0]}</button>)}</div>
  <div className="tarjeta impacto-panel"><h3>{enfoques[tab][1]}</h3><p>{enfoques[tab][2]}</p>
   {tab===0&&<><Persistencia sn={sn} id={delito} fin={actual}/><Grafica ariaLabel={`Serie mensual de ${nombre(delito)}`} opcion={{xAxis:{type:'category',data:meses,axisLabel:{color:'#8fa9bf'},axisLine:{lineStyle:{color:'#446078'}}},yAxis:{type:'value',min:0,axisLabel:{color:'#8fa9bf'},splitLine:{lineStyle:{color:'#345063'}}},series:[{type:'line',data:meses.map(m=>valor(delito,m)),connectNulls:false,symbol:'none',lineStyle:{color:colorDelito(delito),width:3},areaStyle:{color:colorDelito(delito),opacity:0.12}}]}}/><details><summary>Ver tabla accesible</summary><div className="impacto-tabla"><table><thead><tr><th>Mes</th><th>Registros</th><th>{unidad}</th></tr></thead><tbody>{meses.map(m=><tr key={m}><td>{m}</td><td>{fmt(valorMes(sn,delito,m))}</td><td>{fmt(valor(delito,m))}</td></tr>)}</tbody></table></div></details><button className="boton" onClick={()=>descargarCSV('ni-alto-impacto.csv',['mes','registros',unidad],filas,{fuente:sn.meta.fuente,url:sn.meta.url_fuente,corte:sn.meta.corte,version:String(sn.meta.version),delito,metrica:unidad,instrumento:sn.metodologia,poblacion:pob.meta.fuente,version_poblacion:String(pob.meta.version)})}>Descargar serie CSV</button></>}
   {tab===1&&<div className="impacto-tabla"><table><thead><tr><th>Base, mismo mes</th><th>Valor base</th><th>Valor {actual}</th><th>Variación</th></tr></thead><tbody>{meses.filter(m=>m<actual&&m.slice(5)===actual.slice(5)).map(m=><tr key={m}><td>{m}</td><td>{fmt(valor(delito,m))}</td><td>{fmt(a)}</td><td><CambioVisual valor={cambio(a,valor(delito,m))} sufijo=" %"/></td></tr>)}</tbody></table>{!meses.some(m=>m<actual&&m.slice(5)===actual.slice(5))&&<p>No hay un año anterior comparable dentro de este instrumento. No se empalma con 2025 sin correspondencia validada.</p>}</div>}
   {tab===2&&<div className="impacto-tabla"><table><thead><tr><th>Categoría editorial NI</th><th>{base}</th><th>{actual}</th><th>Cambio</th></tr></thead><tbody>{ids.map(k=><tr key={k}><td><span className="punto" style={{background:colorDelito(k)}}/> {nombre(k)}</td><td>{fmt(valor(k,base))}</td><td>{fmt(valor(k,actual))}</td><td><CambioVisual valor={cambio(valor(k,actual),valor(k,base))} sufijo=" %"/></td></tr>)}</tbody></table></div>}
   {tab===3&&<div className="impacto-protocolo"><Declaraciones/><h4>Protocolo de verificación</h4><ol><li>Registrar cita, emisor, fecha y enlace al documento original.</li><li>Precisar víctimas o delitos; fuero, ámbito y categorías incluidas.</li><li>Reproducir ambos valores con la misma versión de datos.</li><li>Contrastar meses equivalentes, promedio diario, tasas y ventanas de 12 meses cuando sean comparables.</li><li>Clasificar: reproducible, reproducible con matices, no comparable o evidencia insuficiente.</li></ol><p><strong>Estado: una ficha periodística documentada; ninguna declaración certificada contra su fuente primaria.</strong> Los registros de este sitio no permiten certificar anuncios referidos a víctimas.</p></div>}
   {tab===4&&<div className="impacto-protocolo"><ContrasteFuentes/><ul><li><a href="https://www.inegi.org.mx/programas/mortalidad/">INEGI · Defunciones registradas</a>: confrontar homicidios por año de ocurrencia y de registro, con su rezago y cobertura.</li><li><a href="https://www.inegi.org.mx/contenidos/programas/envipe/2025/doc/envipe2025_presentacion_nacional.pdf">ENVIPE 2025 · documento verificado</a>: victimización de 2024; percepción de marzo–abril de 2025. No mide el mismo periodo ni universo que los registros mensuales.</li><li><a href="https://gabinetedeseguridad.gob.mx/">Gabinete de Seguridad</a>: localizar las declaraciones originales y sus anexos antes de evaluarlas.</li></ul><p>ENVIPE se presenta como referencia numérica de contexto. La comparación con víctimas y mortalidad aún requiere integrar esas series. No se aplica un factor universal de cifra negra ni se atribuye causalidad a una administración con una comparación antes/después.</p></div>}
  </div>
  <details className="impacto-metodo"><summary>Fórmulas, alcance y trazabilidad</summary><p>Cambio = 100 × (actual / base − 1), solo con base positiva; con base cero se muestra «No comparable». Promedio diario = registros / días reales del mes. Tasa mensual = registros / población anual × 100 000. No se imputan ausencias ni meses futuros. Las tentativas de 2026 permanecen fuera de esta selección.</p><p>Fuente: {sn.meta.fuente} · corte {sn.meta.corte} · versión {sn.meta.version}. La presencia de una categoría en ambos instrumentos no demuestra equivalencia metodológica.</p></details>
 </section>;
}
