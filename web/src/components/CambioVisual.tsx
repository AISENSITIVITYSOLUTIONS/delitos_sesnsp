export default function CambioVisual({valor,sufijo=''}:{valor:number|null|undefined;sufijo?:string}){
 const clase=valor==null?'sin-dato':valor>0?'alza':valor<0?'baja':'igual';
 const texto=valor==null?'Sin información comparable':valor>0?'Aumento del registro':valor<0?'Descenso del registro':'Sin cambio';
 return <span className={`cambio cambio--${clase}`}><span aria-hidden="true">{valor==null?'—':valor>0?'↑':valor<0?'↓':'↔'} </span>{valor==null?'No comparable':`${valor>0?'+':''}${valor.toLocaleString('es-MX',{maximumFractionDigits:2})}${sufijo}`}<small> · {texto}</small></span>;
}
