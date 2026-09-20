import { useRef, useCallback } from "react";
import type { TarjetaHallazgo as TH } from "../lib/contratos";

/** Hook para efecto 3D de inclinación por seguimiento del cursor. */
function useTilt3D() {
  const elRef = useRef<HTMLElement>(null);

  const onMove = useCallback((e: React.MouseEvent<HTMLElement>) => {
    const el = elRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = (e.clientX - cx) / (rect.width / 2);   // -1 a 1
    const dy = (e.clientY - cy) / (rect.height / 2);  // -1 a 1
    const rotX = (-dy * 9).toFixed(2);
    const rotY = (dx * 9).toFixed(2);
    const shine = `radial-gradient(circle at ${((dx + 1) / 2 * 100).toFixed(0)}% ${((dy + 1) / 2 * 100).toFixed(0)}%, rgba(130,195,255,0.12) 0%, transparent 65%)`;
    el.style.transform = `perspective(600px) rotateX(${rotX}deg) rotateY(${rotY}deg) translateZ(4px)`;
    el.style.setProperty("--shine", shine);
  }, []);

  const onLeave = useCallback(() => {
    const el = elRef.current;
    if (!el) return;
    el.style.transform = "perspective(600px) rotateX(0deg) rotateY(0deg) translateZ(0px)";
    el.style.setProperty("--shine", "none");
  }, []);

  return { elRef, onMove, onLeave };
}

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
  const ref = useRef<HTMLDialogElement>(null);
  const { elRef, onMove, onLeave } = useTilt3D();
  const esBaja = t.comparacion.includes("−") || /baj|descen|disminu|-/.test(t.comparacion);

  if (t.insuficiente) {
    return (
      <article className="tarjeta hallazgo hallazgo--insuficiente" aria-label={t.titulo}>
        <h3 className="hallazgo__titulo">{t.titulo}</h3>
        <p className="hallazgo__interpretacion">{t.interpretacion}</p>
        <div className="hallazgo__pie"><span className="hallazgo__validez">Evidencia insuficiente con las reglas documentadas</span></div>
      </article>
    );
  }

  const validezTxt = t.validez === "2015-2025" ? "Válido para el instrumento 2015–2025"
    : t.validez === "2026" ? "Válido para el registro vigente desde 2026"
    : "Serie homologada del periodo completo";

  return (
    <article
      ref={elRef as React.RefObject<HTMLElement>}
      className="tarjeta tarjeta--alzable hallazgo hallazgo--3d"
      aria-label={t.titulo}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
    >
      <div className="hallazgo__shine" aria-hidden="true" />
      <h3 className="hallazgo__titulo">{t.titulo}</h3>
      <p className="hallazgo__cifra">{t.cifra} <small>{t.unidad}</small></p>
      <p className="hallazgo__periodo">{t.periodo}</p>
      <p className={`hallazgo__comp ${esBaja ? "hallazgo__comp--baja" : "hallazgo__comp--alza"}`}>{t.comparacion}</p>
      <Spark etiquetas={t.mini.etiquetas} valores={t.mini.valores} />
      <p className="hallazgo__interpretacion">{t.interpretacion}</p>
      <div className="hallazgo__pie">
        <span className="hallazgo__validez">{validezTxt}</span>
        <button className="ver-calculo" onClick={() => ref.current?.showModal()}>Ver cálculo</button>
      </div>
      <dialog ref={ref as React.RefObject<HTMLDialogElement>} className="calculo" aria-label={`Cálculo de: ${t.titulo}`}>
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
