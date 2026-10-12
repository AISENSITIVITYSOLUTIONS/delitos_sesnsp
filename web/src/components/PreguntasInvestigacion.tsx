import '../laboratorio.css';
export default function PreguntasInvestigacion(){
 return <section id="preguntas" className="seccion ni-lab" aria-labelledby="titulo-preguntas">
  <header className="ni-lab-head"><p className="ni-eyebrow">Observatorio · Investigación</p><h2 id="titulo-preguntas">Preguntas de investigación</h2></header>
  <nav className="ni-preguntas" aria-label="Cinco recorridos analíticos">{[['#territorio-impacto','01','¿Dónde ocurre el cambio?'],['#alto-impacto','02','¿Resiste la comparación?'],['#laboratorio','03','Reconocimiento feminicida'],['#laboratorio','04','¿Se sostiene y se extiende?'],['#alto-impacto','05','Registro y victimización']].map(([href,n,t])=><a href={href} key={n} onClick={()=>{const v=n==='04'?'trayectorias':n==='03'?'fuentes':null;if(v)window.dispatchEvent(new CustomEvent('lab-vista',{detail:v}));}}><span>{n}</span><strong>{t}</strong><small>{n==='03'?'Requiere nuevas fuentes':'Explorar evidencia →'}</small></a>)}</nav>
 </section>;
}
