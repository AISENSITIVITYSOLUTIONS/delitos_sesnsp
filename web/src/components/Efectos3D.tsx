import { useEffect,useState } from 'react';
type Modo='cinematico'|'suave'|'apagado';
const etiquetas='.chip, .impacto-badge, .ni-status, .ni-tabs button, .impacto-tabs button, .seg button, .fx-toolbar button, .ni-preguntas a';
const targets='.impacto-kpis article, .hallazgo, .resumen-grid>article, '+etiquetas;
export default function Efectos3D(){
 const [modo,setModo]=useState<Modo>(()=>{try{const v=localStorage.getItem('ni-efectos');if(['cinematico','suave','apagado'].includes(v!))return v as Modo;}catch{/* preferences optional */}return matchMedia('(pointer:fine)').matches?'cinematico':'suave';});
 const [reducido,setReducido]=useState(()=>matchMedia('(prefers-reduced-motion:reduce)').matches);
 useEffect(()=>{const q=matchMedia('(prefers-reduced-motion:reduce)'),fn=()=>setReducido(q.matches);q.addEventListener('change',fn);return()=>q.removeEventListener('change',fn);},[]);
 useEffect(()=>{
  const root=document.documentElement;root.dataset.efectos=reducido?'apagado':modo;
  try{localStorage.setItem('ni-efectos',modo);}catch{/* optional */}
  const visibility=()=>{root.dataset.fxPaused=document.hidden?'true':'false';};visibility();document.addEventListener('visibilitychange',visibility);
  let active:HTMLElement|null=null,frame=0;let x=0,y=0;
  const clear=()=>{if(active){for(const k of ['--rx','--ry','--mx','--my'])active.style.removeProperty(k);active.classList.remove('fx-active');active=null;}cancelAnimationFrame(frame);frame=0;};
  const move=(e:PointerEvent)=>{
   if(reducido||modo!=='cinematico'||e.pointerType!=='mouse')return;
   const el=(e.target as HTMLElement).closest<HTMLElement>(targets);
   if(!el||el.querySelector('dialog[open],canvas,svg')){clear();return;}
   if(el!==active){clear();active=el;el.classList.add('fx-active');}
   const b=el.getBoundingClientRect();x=Math.max(0,Math.min(1,(e.clientX-b.left)/b.width));y=Math.max(0,Math.min(1,(e.clientY-b.top)/b.height));
   if(!frame)frame=requestAnimationFrame(()=>{frame=0;if(active){active.style.setProperty('--rx',`${(0.5-y)*8}deg`);active.style.setProperty('--ry',`${(x-0.5)*10}deg`);active.style.setProperty('--mx',`${x*100}%`);active.style.setProperty('--my',`${y*100}%`);}});
  };
  document.addEventListener('pointermove',move,{passive:true});document.addEventListener('pointerleave',clear);window.addEventListener('blur',clear);window.addEventListener('scroll',clear,{passive:true});
  const observer=new IntersectionObserver(entries=>entries.forEach(e=>e.target.classList.toggle('fx-visible',e.isIntersecting)),{threshold:.1});
  const seen=new WeakSet<Element>();const discover=()=>{document.querySelectorAll(etiquetas).forEach(e=>e.classList.add('fx-etiqueta'));document.querySelectorAll('.impacto-hero, .encabezado__sello').forEach(e=>{if(!seen.has(e)){seen.add(e);observer.observe(e);}});};discover();
  const mutation=new MutationObserver(discover);mutation.observe(document.getElementById('root')!,{childList:true,subtree:true});
  return()=>{clear();observer.disconnect();mutation.disconnect();document.removeEventListener('pointermove',move);document.removeEventListener('pointerleave',clear);document.removeEventListener('visibilitychange',visibility);window.removeEventListener('blur',clear);window.removeEventListener('scroll',clear);};
 },[modo,reducido]);
 return <aside className="fx-toolbar no-imprimir" aria-label="Efectos visuales"><span className="fx-diamond" aria-hidden="true">◈</span><strong>Experiencia 3D</strong><div role="group" aria-label="Intensidad de efectos">{(['cinematico','suave','apagado'] as Modo[]).map(m=><button key={m} aria-pressed={modo===m} onClick={()=>setModo(m)}>{m==='cinematico'?'Cinemático':m==='suave'?'Suave':'Sin efectos'}</button>)}</div><small>{reducido?'Movimiento reducido del dispositivo activo':modo==='cinematico'?'Etiquetas con relieve · reflejos reactivos · perspectiva':modo==='suave'?'Iluminación estática y movimiento ligero':'Visualización estática'}</small></aside>;
}
