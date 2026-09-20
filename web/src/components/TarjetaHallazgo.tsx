import { useRef } from "react";
import type { TarjetaHallazgo as TH } from "../lib/contratos";

/** Minigráfico inline SVG (línea con área al 10 % y punto final con anillo). */
function Spark({ etiquetas, valores }: { etiquetas: string[]; valores: number[] }) {
  if (!valores.length) return null;
  const W = 220, H = 40, P = 4;
  const min = Math.min(...valores), max = Math.max(...valores);
  const esc = (v: number) => max === min ? H / 2 : H - P - ((v - min) / (max - min)) * (H - 2 * P);
  const paso = (W - 2 * P) / Math.max(valores.length - 1, 1);
  const pts = valores.map((v, i) => [P + i * paso, esc(v)] as const);
  const d = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const dArea = `${d} L${pts[pts.length - 1][0].toFixed(1)},${H - 1} L${P},${H - 1} Z`;
  const ult = pts[pts.length - 1];
  return (
    <svg className="spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
      <path className="area" d={dArea} />
      <path className="linea" d={d} />
      <circle cx={ult[0]} cy={ult[1]} r={3.5} />
      <title>{`${etiquetas[0]} a ${etiquetas[etiquetas.length - 1]}`}</title>
    </svg>
  );
}

export default function TarjetaHallazgo({ t }: { t: TH }) {
  const titulos: Record<string,string> = {"tendencia-nacional":"Tasa nacional","composicion":"Cambio en la composición","concentracion":"Concentración municipal","volumen-vs-tasa":"Volumen frente a tasa","estacionalidad":"Estacionalidad"};
  const ref = useRef<HTMLDialogElement>(null);
  const esBaja = t.comparacion.includes("−") || /baj|descen|disminu|-/.test(t.comparacion);

  if (t.insuficiente) {
    return (
      <article className="tarjeta hallazgo hallazgo--insuficiente" aria-label={t.titulo}>
        <h3 className="hallazgo__titulo">{titulos[t.id] ?? t.titulo}</h3>
        <p className="hallazgo__interpretacion">{t.interpretacion}</p>
        <div className="hallazgo__pie"><span className="hallazgo__validez">Evidencia insuficiente con las reglas documentadas</span></div>
      </article>
    );
  }

  const validezTxt = t.validez === "2015-2025" ? "Válido para el instrumento 2015–2025"
    : t.validez === "2026" ? "Válido para el registro vigente desde 2026"
    : "Serie homologada del periodo completo";

  return (
    <article className="tarjeta tarjeta--alzable hallazgo" aria-label={t.titulo}>
      <h3 className="hallazgo__titulo">{titulos[t.id] ?? t.titulo}</h3>
      <p className="hallazgo__cifra">{t.cifra} <small>{t.unidad}</small></p>
      <p className="hallazgo__periodo">{t.periodo}</p>

      <details className="hallazgo-detalle"><summary>Interpretación y tendencia</summary><p>{t.titulo}</p>
      <p className={`hallazgo__comp ${esBaja ? "hallazgo__comp--baja" : "hallazgo__comp--alza"}`}>{t.comparacion}</p>
        <Spark etiquetas={t.mini.etiquetas} valores={t.mini.valores} />
        <p className="hallazgo__interpretacion">{t.interpretacion}</p>
        <p className="nota">{validezTxt}</p>
      </details>
      <div className="hallazgo__pie">
        
        <button className="ver-calculo" onClick={() => ref.current?.showModal()}>Ver cálculo</button>
      </div>
      <dialog ref={ref} className="calculo" aria-label={`Cálculo de: ${t.titulo}`}>
        <div className="calculo__head">
          <h3>Cómo se calculó</h3>
          <button className="boton" onClick={() => ref.current?.close()} aria-label="Cerrar">Cerrar</button>
        </div>
        <div className="calculo__cuerpo">
          <p><strong>Regla documentada.</strong> {t.calculo.regla}</p>
          <p style={{ marginTop: 8 }}><strong>Fórmula.</strong></p>
          <pre>{t.calculo.formula}</pre>
          <p style={{ marginTop: 8 }}><strong>Datos de entrada.</strong></p>
          <pre>{JSON.stringify(t.calculo.datos, null, 2)}</pre>
          <p style={{ marginTop: 8 }} className="nota">Fuente: {t.calculo.fuente}</p>
        </div>
      </dialog>
    </article>
  );
}
