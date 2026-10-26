import { useEffect, useMemo, useState } from 'react';
import MapaMx from './MapaMx';
import type { ValorTerritorio } from './MapaMx';
import type { VistaThree } from './Mapa3D';
import type { EstatalAnual, MunicipalAnual, PoblacionAnual } from '../lib/contratos';
import type { Territorio } from '../lib/geo';
import { cortesCuantiles } from '../lib/geo';
import { valorAnual, cambioComparable, rankingAtlas } from '../lib/atlas';
import { fEntero, fTasa } from '../lib/formato';
import Grafica from './Grafica';
import './atlas-premium.css';

interface Props {
 estatal: EstatalAnual; municipal: MunicipalAnual; pob: PoblacionAnual;
 territorios: Territorio[]; cveEnt: string | null; aniosVisibles: number[];
 onEntrar: (cve: string | null) => void;
}
export default function AtlasPremium(p: Props) {
 const disponibles = p.estatal.anios.filter(a => p.aniosVisibles.includes(a));
 const [anioElegido, setAnio] = useState<number | null>(()=>{const a=Number(new URLSearchParams(location.search).get('atlasYear'));return a>0?a:null;});
 const anio = anioElegido != null && disponibles.includes(anioElegido) ? anioElegido : disponibles.filter(a=>p.estatal.meses_publicados[String(a)]===12).at(-1) ?? disponibles.at(-1) ?? p.estatal.anios.at(-1)!;
 const [delito, setDelito] = useState(()=>new URLSearchParams(location.search).get('atlasCrime')??'total');
 const [tasa, setTasa] = useState(()=>new URLSearchParams(location.search).get('atlasRate')==='1');
 const [comparar, setComparar] = useState(false);
 const [antes, setAntes] = useState<number | null>(null);
 const [play, setPlay] = useState(false);
 const [inspeccion, setInspeccion] = useState<string | null>(null);
 const [modo, setModo] = useState<'2d'|'3d'>('3d');
 const [camara, setCamara] = useState<VistaThree | undefined>();
 const municipal = !!p.cveEnt;
 const categoria = municipal ? 'total' : delito;
 const completos = disponibles.filter(a => p.estatal.meses_publicados[String(a)] === 12);
 const referencia = antes != null && completos.includes(antes) ? antes : completos.filter(a=>a<anio).at(-1) ?? completos[0];
 const meses = p.estatal.meses_publicados[String(anio)] ?? 0;
 const etiqueta = (a:number) => `${a} · ${p.estatal.meses_publicados[String(a)] ?? 0}/12 meses`;
 const nombreDelito = categoria === 'total' ? 'Todos los delitos' : categoria.replaceAll('-', ' ');
 const fmt = (v:number|null) => v == null ? 'Sin información' : tasa ? fTasa(v) : fEntero(v);
 const obtener = (cve:string,a:number) => {
   const idx = (municipal ? p.municipal.anios : p.estatal.anios).indexOf(a);
   const v = municipal ? p.municipal.municipios.find(m=>m.cve===cve)?.total[idx] : categoria==='total' ? p.estatal.total[cve]?.[idx] : p.estatal.datos[cve]?.[categoria]?.[idx];
   const pop = municipal ? p.pob.municipal?.[cve]?.[String(a)] : p.pob.estatal[cve]?.[String(a)];
   return valorAnual(v,pop,tasa);
 };
 const valores = (a:number):Record<string,ValorTerritorio> => Object.fromEntries(p.territorios.map(t=>[t.cve,{v:obtener(t.cve,a),etiqueta:etiqueta(a)}]));
 const datos = valores(anio);
 const datosAntes = referencia == null ? {} : valores(referencia);
 const filas = rankingAtlas(p.territorios.map(t=>({cve:t.cve,nombre:t.nombre,valor:datos[t.cve]?.v??null})));
 const seleccionado = p.territorios.find(t=>t.cve===inspeccion) ?? p.territorios.find(t=>t.cve===filas[0]?.cve);
 const v = seleccionado ? datos[seleccionado.cve]?.v??null : null;
 const rango = seleccionado ? filas.findIndex(t=>t.cve===seleccionado.cve)+1 : 0;
 const anterior = seleccionado ? obtener(seleccionado.cve,anio-1) : null;
 const cambio = cambioComparable(v,anterior,meses,p.estatal.meses_publicados[String(anio-1)]??0);
 // Escalas de altura y de color estables durante toda la secuencia y entre las dos vistas.
 const universo = useMemo(()=>p.territorios.flatMap(t=>disponibles.map(a=>obtener(t.cve,a))).filter((x):x is number=>x!=null&&x>0),[p.territorios,p.estatal,p.municipal,p.pob,categoria,tasa,disponibles.join(',')]);
 const maximo = universo.length ? Math.max(...universo) : 0;
 const cortes = cortesCuantiles(universo,7);
 useEffect(()=>{setPlay(false);setInspeccion(null);setCamara(undefined);},[p.cveEnt,categoria,tasa]);
 useEffect(()=>{
   if(!play || completos.length<2 || document.hidden) return;
   const timer=window.setInterval(()=>setAnio(a=>{const actual=a??anio;return completos[(completos.indexOf(actual)+1)%completos.length];}),1800);
   const detener=()=>{if(document.hidden)setPlay(false);};document.addEventListener('visibilitychange',detener);
   return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',detener);};
 },[play,completos.join(',')]);
 const mapa = (a:number, ds:Record<string,ValorTerritorio>) => <MapaMx territorios={p.territorios} valores={ds} metrica={tasa?'tasa':'conteo'} titulo={`${nombreDelito} · ${etiqueta(a)} · ${p.cveEnt?p.estatal.entidades[p.cveEnt]:'México'}`} modo={modo} onModo={setModo} maxFijo={maximo} cortesFijos={cortes} notaEscala="Alturas y cuantiles fijos para los años disponibles de esta selección." seleccionado={seleccionado?.cve} onSeleccion={c=>{setInspeccion(c);setPlay(false);}} vistaExterna={comparar?camara:undefined} onVistaExterna={comparar?setCamara:undefined} />;
 const serie = seleccionado ? disponibles.map(a=>obtener(seleccionado.cve,a)) : [];
 const compartir=async()=>{try{const url=new URL(window.location.href);url.searchParams.set('atlasYear',String(anio));url.searchParams.set('atlasCrime',categoria);url.searchParams.set('atlasRate',tasa?'1':'0');await navigator.clipboard.writeText(url.toString());setAviso('Enlace con año, indicador y unidad copiado.');}catch{setAviso('Puedes copiar la dirección desde el navegador.');}};
 const [aviso,setAviso]=useState('');
 return <section className="atlas-premium" aria-label="Atlas territorial inmersivo">
  <header className="atlas-hero"><div><span className="atlas-eyebrow">NNI / INTELIGENCIA TERRITORIAL</span><h3>El territorio.<br/><em>Otra perspectiva.</em></h3><p>Explora el registro delictivo, recorre sus cambios y contrasta territorios con una misma escala.</p></div><div className="atlas-edition"><span>ATLAS INTERACTIVO</span><strong>{anio}</strong><span>{meses===12?'AÑO COMPLETO':`CORTE PARCIAL · ${meses} MESES`}</span></div></header>
  <div className="atlas-controls">
   <div className="atlas-breadcrumb"><button onClick={()=>p.onEntrar(null)}>México</button>{p.cveEnt&&<><span>/</span><strong>{p.estatal.entidades[p.cveEnt]}</strong></>}</div>
   <label>Indicador<select aria-label="Indicador" value={categoria} disabled={municipal} onChange={e=>{setDelito(e.target.value);setPlay(false);}}><option value="total">Todos los delitos</option>{Object.keys(p.estatal.datos[Object.keys(p.estatal.entidades)[0]]??{}).map(id=><option key={id} value={id}>{id.replaceAll('-',' ')}</option>)}</select></label>
   <div className="atlas-switch" role="group" aria-label="Unidad del indicador"><button aria-pressed={!tasa} onClick={()=>setTasa(false)}>Registros</button><button aria-pressed={tasa} onClick={()=>setTasa(true)}>Tasa /100 mil</button></div>
   <button className="atlas-outline" aria-pressed={comparar} disabled={completos.length<2 || meses!==12} onClick={()=>{setComparar(!comparar);setPlay(false);}}>◫ {comparar?'Cerrar comparación':'Comparar años'}</button>
  </div>
  {municipal&&<p className="atlas-notice">Escala municipal: todos los delitos. El producto municipal disponible no contiene el desglose por categoría.</p>}
  <div className="atlas-workspace">
   <div className="atlas-cartography">
    <div className="atlas-map-label"><span>{municipal?'EXPLORACIÓN MUNICIPAL':'REPÚBLICA MEXICANA'}</span><strong>{nombreDelito} · {etiqueta(anio)}</strong></div>
    <div className={comparar&&meses===12?'atlas-dual':'atlas-single'}><div>{mapa(anio,datos)}</div>{comparar&&meses===12&&referencia!=null&&<div><label className="atlas-reference">Año de referencia<select aria-label="Año de referencia" value={referencia} onChange={e=>setAntes(Number(e.target.value))}>{completos.map(a=><option key={a} value={a}>{a}</option>)}</select></label>{mapa(referencia,datosAntes)}</div>}</div>
    <div className="atlas-timeline"><button aria-label={play?'Pausar secuencia':'Reproducir años completos'} disabled={completos.length<2||comparar} onClick={()=>{if(!play&&meses!==12)setAnio(completos[0]);setPlay(!play);}}>{play?'Ⅱ':'▶'}</button><div><label htmlFor="atlas-year">Recorrido anual <strong>{etiqueta(anio)}</strong></label><input id="atlas-year" type="range" min="0" max={Math.max(0,disponibles.length-1)} value={Math.max(0,disponibles.indexOf(anio))} onChange={e=>{setAnio(disponibles[Number(e.target.value)]);setPlay(false);}}/><div className="atlas-yearmarks">{disponibles.map(a=><button key={a} aria-pressed={a===anio} onClick={()=>{setAnio(a);setPlay(false);}}>{a}{p.estatal.meses_publicados[String(a)]!==12?'*':''}</button>)}</div></div></div>
    <p className="atlas-notice">La reproducción incluye únicamente años completos. * Año parcial: no se calcula variación interanual ni se habilita comparación anual. El instrumento de registro cambia en 2026.</p>
   </div>
   <aside className="atlas-dossier" aria-label="Detalle territorial">
    <span className="atlas-eyebrow">FICHA TERRITORIAL</span><h4>{seleccionado?.nombre??'Selecciona un territorio'}</h4><span className="atlas-unit">{nombreDelito} · {etiqueta(anio)}</span><strong className="atlas-number">{fmt(v)}</strong><span className="atlas-unit">{tasa?'por 100 mil habitantes':'delitos registrados'}</span>
    <div className="atlas-kpis"><div><small>Posición</small><strong>{rango>0?rango:'—'}<span> / {filas.length}</span></strong></div><div><small>Vs. año anterior</small><strong>{cambio==null?'—':`${cambio>0?'+':''}${cambio.toFixed(1)}%`}</strong></div></div>
    {seleccionado&&<><Grafica alto={145} ariaLabel={`Serie anual de ${seleccionado.nombre}; valores disponibles en tabla desplegable`} opcion={{grid:{left:8,right:10,top:16,bottom:24,containLabel:true},xAxis:{type:'category',data:disponibles.map(String),axisLabel:{fontSize:9}},yAxis:{type:'value',axisLabel:{fontSize:9}},tooltip:{trigger:'axis'},series:[{type:'line',data:serie,connectNulls:false,showSymbol:true,lineStyle:{color:'#38bdf8',width:2},itemStyle:{color:'#38bdf8'}}]}}/><details className="atlas-values"><summary>Ver valores anuales</summary><table><tbody>{disponibles.map((a,i)=><tr key={a}><td>{etiqueta(a)}</td><td>{fmt(serie[i])}</td></tr>)}</tbody></table></details>{!municipal&&<button className="atlas-enter" onClick={()=>p.onEntrar(seleccionado.cve)}>Explorar municipios ↗</button>}</>}
    <div className="atlas-ranking"><span className="atlas-eyebrow">MAYORES VALORES DEL AÑO</span>{filas.slice(0,5).map((f,i)=><button key={f.cve} onClick={()=>setInspeccion(f.cve)} aria-pressed={f.cve===seleccionado?.cve}><span>{String(i+1).padStart(2,'0')}</span><span>{f.nombre}<i style={{width:`${filas[0].valor?f.valor/filas[0].valor*100:0}%`}}/></span><strong>{fmt(f.valor)}</strong></button>)}</div>
    <button className="atlas-outline" onClick={compartir}>Copiar enlace del tablero</button><span role="status" className="atlas-unit">{aviso}</span>
   </aside>
  </div>
  <footer className="atlas-source"><span>FUENTE / SESNSP · POBLACIÓN / CONAPO</span><span>Corte del producto: {p.estatal.meta.corte} · {p.territorios.length} territorios · {filas.length} con información</span><p>Registros administrativos: no equivalen a víctimas ni a la totalidad de hechos ocurridos. La selección anual de este atlas es independiente del agregado del explorador clásico. La serie muestra cada año con su cobertura; un corte parcial no constituye una reducción.</p></footer>
 </section>;
}
