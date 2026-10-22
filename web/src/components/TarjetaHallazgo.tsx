import { useId, useRef, useState } from "react";
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

const TITULOS: Record<string, string> = {
  "tendencia-nacional": "Tasa nacional",
  "composicion": "Cambio en la composición",
  "concentracion": "Concentración municipal",
  "volumen-vs-tasa": "Volumen frente a tasa",
  "estacionalidad": "Estacionalidad",
};

export default function TarjetaHallazgo({ t }: { t: TH }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [volteada, setVolteada] = useState(false);
  const idDorso = useId();
  const rotulo = TITULOS[t.id] ?? t.titulo;
  // Un hallazgo puede contener varias direcciones: no inferir polaridad del texto.

  if (t.insuficiente) {
    return (
      <article className="tarjeta hallazgo hallazgo--insuficiente" aria-label={t.titulo}>
        <h3 className="hallazgo__titulo">{rotulo}</h3>
        <p className="hallazgo__interpretacion">{t.interpretacion}</p>
        <div className="hallazgo__pie"><span className="hallazgo__validez">Evidencia insuficiente con las reglas documentadas</span></div>
      </article>
    );
  }

  const validezTxt = t.validez === "2015-2025" ? "Válido para el instrumento 2015–2025"
    : t.validez === "2026" ? "Válido para el registro vigente desde 2026"
    : "Serie homologada del periodo completo";

  const voltear = () => setVolteada(v => !v);

  return (
    <article
      className={`tarjeta hallazgo hallazgo--flip${volteada ? " es-volteada" : ""}`}
      aria-label={t.titulo}
    >
      <div className="hz-flip">
        {/* ── Frente: cifra titular y mini-serie ── */}
        <div
          className="hz-cara hz-cara--frente"
          role="button"
          tabIndex={0}
          aria-expanded={volteada}
          aria-controls={idDorso}
          aria-label={`${rotulo}. Voltear para ver el detalle del hallazgo.`}
          onClick={voltear}
          onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); voltear(); } }}
        >
          <div className="hz-top">
            <span className="hz-rotulo">{rotulo}</span>
            <span className="hz-indice" aria-hidden="true">◈</span>
          </div>
          <p className="hallazgo__cifra">{t.cifra} <small>{t.unidad}</small></p>
          <Spark etiquetas={t.mini.etiquetas} valores={t.mini.valores} />
          <p className="hallazgo__periodo">{t.periodo}</p>
          <span className="hz-cue" aria-hidden="true">
            <svg viewBox="0 0 24 24"><path d="M4 9a8 8 0 0 1 14-3m2-2v4h-4M20 15a8 8 0 0 1-14 3m-2 2v-4h4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
            Voltear
          </span>
        </div>

        {/* ── Dorso: el hallazgo, interpretación y cálculo ── */}
        <div className="hz-cara hz-cara--dorso" id={idDorso} aria-hidden={!volteada}>
          <div className="hz-top">
            <span className="hz-rotulo hz-rotulo--dorso">{rotulo}</span>
            <button className="hz-volver" onClick={voltear} tabIndex={volteada ? 0 : -1} aria-label="Volver al frente">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9a8 8 0 0 1 14-3m2-2v4h-4M20 15a8 8 0 0 1-14 3m-2 2v-4h4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
          </div>
          <p className="hz-hallazgo">{t.titulo}</p>
          <p className="hallazgo__comp">{t.comparacion}</p>
          <p className="hallazgo__interpretacion">{t.interpretacion}</p>
          <div className="hz-pie">
            <span className="hallazgo__validez">{validezTxt}</span>
            <button className="ver-calculo" tabIndex={volteada ? 0 : -1}
              onClick={e => { e.stopPropagation(); ref.current?.showModal(); }}>Ver cálculo</button>
          </div>
        </div>
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
