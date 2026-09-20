import { useEffect, useState } from "react";
import Grafica from "./Grafica";
import MapaMx from "./MapaMx";
import { cargar } from "../lib/datos";
import { useEstado } from "../lib/estado";
import { fEntero } from "../lib/formato";
import type { GeoColeccion, Territorio } from "../lib/geo";
import type { SeriesNacionales, EstatalAnual, PoblacionAnual, RankingDelitos, RankingMunicipios } from "../lib/contratos";

export default function Resumen({ sn, estatal, pob, ranking, municipios, completo }: {
 sn: SeriesNacionales; estatal: EstatalAnual; pob: PoblacionAnual;
 ranking: RankingDelitos["periodos"][string]; municipios?: RankingMunicipios["periodos"][string]; completo: boolean;
}) {
 const { metrica, desde, hasta, set } = useEstado();
 const [geo, setGeo] = useState<Territorio[]>([]);
 const [geoError, setGeoError] = useState(false);
 const [modo, setModo] = useState<"2d"|"3d">("2d");
 useEffect(() => { cargar<GeoColeccion>("geo/estados.json").then(g=>setGeo(g.territorios)).catch(()=>setGeoError(true)); }, []);
 const indices = sn.meses.map((m,i)=>({m,i})).filter(({m})=>m>=desde && m<=hasta);
 const serie = indices.map(({m,i})=> {
   const v=sn.total[i], p=pob.nacional[m.slice(0,4)];
   return v == null ? null : metrica==="tasa" ? (p>0 ? v/p*100000 : null) : v;
 });
 const anio = estatal.anios.filter(a=>a>=Number(desde.slice(0,4)) && a<=Number(hasta.slice(0,4))).at(-1);
 const compatible = !completo && anio!=null && (sn.metodologia==="NM-2015" ? anio<=2025 : anio>=2026);
 const valores = Object.fromEntries(Object.entries(estatal.total).map(([cve,arr])=>{
   const v=compatible ? arr[estatal.anios.indexOf(anio!)] : null;
   const p=anio ? pob.estatal[cve]?.[String(anio)] : null;
   return [cve,{v:v==null ? null : metrica==="tasa" ? (p && p>0 ? v/p*100000 : null) : v}];
 }));
 const top=ranking.delitos.slice(0,5);
 return <section id="resumen" className="resumen-grid" aria-label="Resumen gráfico">
   <article className="tarjeta resumen-panel">
     <h2>Tendencia nacional mensual</h2>
     <p className="nota">{completo ? "Consulta las series homologadas en el detalle; no se suma un total entre instrumentos." : `${indices[0]?.m ?? "—"} a ${indices.at(-1)?.m ?? "—"} · ${metrica==="tasa" ? "Tasa mensual por 100 mil habitantes" : "Delitos registrados"}`}</p>
     {!completo && <Grafica alto={260} ariaLabel="Serie mensual nacional, todos los delitos" opcion={{
       xAxis:{type:"category",data:indices.map(x=>x.m),boundaryGap:false},
       yAxis:{type:"value"}, grid:{left:8,right:18,top:24,bottom:28,containLabel:true},
       series:[{type:"line",data:serie,showSymbol:false,connectNulls:false,lineStyle:{color:"#169bff",width:2},itemStyle:{color:"#169bff"},areaStyle:{color:"#169bff",opacity:.1}}]
     }}/>}
     <a href="#delitos">Explorar series por delito →</a>
   </article>
   <article className="tarjeta resumen-panel resumen-mapa">
     <h2>Incidencia por entidad federativa</h2>
     <p className="nota">{compatible ? `${anio} · ${estatal.meses_publicados[String(anio)] ?? "—"} meses publicados · todos los delitos` : "Sin un mapa comparable para el tramo seleccionado."}</p>
     {compatible && (geo.length ? <MapaMx territorios={geo} valores={valores} metrica={metrica} titulo="Incidencia estatal" modo={modo} onModo={setModo}
       onSeleccion={cve=>{set({cveEnt:cve,cveMun:null});document.getElementById("explorador")?.scrollIntoView({behavior:"smooth"});}}/> : <p role="status">{geoError ? "No se pudo cargar la cartografía." : "Cargando mapa…"}</p>)}
     <a href="#explorador">Abrir explorador territorial →</a>
   </article>
   <article className="tarjeta resumen-panel">
     <h2>Cinco delitos más frecuentes</h2>
     <p className="nota">{ranking.etiqueta} · cantidades absolutas</p>
     <ol className="resumen-barras">{top.map(d=><li key={d.delito_id}>
       <div><span>{d.nombre}</span><strong>{fEntero(d.cantidad)}</strong></div>
       <div className="barra-pista"><span style={{width:`${top[0]?.cantidad ? d.cantidad/top[0].cantidad*100 : 0}%`}}/></div>
     </li>)}</ol>
     <a href="#delitos">Ver tasas y evolución →</a>
   </article>
   <article className="tarjeta resumen-panel">
     <h2>Cinco municipios con mayor incidencia</h2>
     <p className="nota">{municipios?.etiqueta ?? "Sin ranking disponible"} · todos los delitos · orden por cantidad</p>
     <div className="tabla-scroll" role="region" aria-label="Ranking municipal del resumen" tabIndex={0}>
       <table className="datos"><thead><tr><th>Municipio</th><th className="num">Cantidad</th><th className="num">Tasa /100 mil</th></tr></thead>
       <tbody>{municipios?.por_volumen.slice(0,5).map(m=><tr key={m.cve}><td>{m.nombre}<small className="nota entidad-tabla">{m.entidad}</small></td><td className="num">{fEntero(m.cantidad)}</td><td className="num">{m.tasa_100k==null ? "No disponible" : m.tasa_100k.toLocaleString("es-MX",{maximumFractionDigits:1})}</td></tr>)}</tbody></table>
     </div>
     <a href="#municipios">Explorar ranking municipal →</a>
   </article>
 </section>;
}
