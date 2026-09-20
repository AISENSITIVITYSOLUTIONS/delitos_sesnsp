import { descargarCSV } from '../lib/datos';
const fuente='https://www.inegi.org.mx/contenidos/programas/envipe/2025/doc/envipe2025_presentacion_nacional.pdf';
const indicadores=[
 {nombre:'Personas víctimas',valor:23.1,unidad:'millones',pagina:6},
 {nombre:'Delitos estimados',valor:33.5,unidad:'millones',pagina:6},
 {nombre:'Cifra oculta',valor:93.2,unidad:'por ciento',pagina:23},
 {nombre:'Delitos denunciados',valor:9.6,unidad:'por ciento',pagina:23},
];
export default function ContrasteFuentes(){return <div>
 <h4>Registro y victimización: universos distintos</h4><p><strong>ENVIPE 2025 · hechos de 2024.</strong> Referencia histórica verificada el 20 de septiembre de 2026; no se presenta como la última edición disponible. Encuesta a población de 18 años y más.</p>
 <div className="impacto-kpis">{indicadores.map(x=><article key={x.nombre}><span>{x.nombre}</span><strong>{x.valor.toLocaleString('es-MX')}</strong><small>{x.unidad} · 2024</small><a href={`${fuente}#page=${x.pagina}`}>Fuente, página {x.pagina}</a></article>)}</div>
 <p>La cifra oculta incorpora delitos no denunciados, denunciados sin investigación y casos no especificados. No es un multiplicador aplicable a cada serie del SESNSP. Estos valores agregados no permiten evaluar por sí solos homicidio, feminicidio ni la evolución de 2026.</p>
 <button className="boton" onClick={()=>descargarCSV('ni-envipe-2025-contexto.csv',['indicador','valor','unidad','anio_hechos','pagina_pdf'],indicadores.map(x=>[x.nombre,x.valor,x.unidad,2024,x.pagina]),{fuente,corte:'Victimización 2024; edición 2025',consulta:'2026-09-20',alcance:'Nacional; población de 18 años y más; indicadores redondeados publicados',uso:'Contexto; no agregado ni cociente con SESNSP'})}>Descargar indicadores ENVIPE</button>
 </div>;}
