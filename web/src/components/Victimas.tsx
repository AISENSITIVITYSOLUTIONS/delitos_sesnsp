import { useEffect, useId, useMemo, useRef, useState } from "react";
import { cargar } from "../lib/datos";
import { fEntero, fCompacto } from "../lib/formato";
import { useCuentaAtras } from "../lib/animar";

interface DelitoVic {
  id: string; nombre: string; total: number;
  mujer: number; hombre: number; no_identificado: number;
  pct_mujer: number | null; pct_hombre: number | null;
  menores: number; adultos: number; pct_menores: number | null;
  total_2026: number | null; mujer_2026: number | null;
}
interface Datos { meta: { fuente: string; universo: string; anios: string[] }; delitos: DelitoVic[] }

// Diez delitos con interpretación clara de víctimas (se excluyen residuales y ambiguos).
const CURADOS = [
  "feminicidio", "rapto", "trata-de-personas", "corrupcion-de-menores", "lesiones-dolosas",
  "extorsion", "lesiones-culposas", "secuestro", "homicidio-culposo", "homicidio-doloso",
];
const CICLO = '<path d="M4 9a8 8 0 0 1 14-3m2-2v4h-4M20 15a8 8 0 0 1-14 3m-2 2v-4h4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>';

export default function Victimas() {
  const [d, setD] = useState<Datos | null>(null);
  useEffect(() => { cargar<Datos>("victimas.json").then(setD).catch(() => setD(null)); }, []);

  const filas = useMemo(() => {
    if (!d) return [];
    const ix = new Map(CURADOS.map((id, i) => [id, i]));
    return d.delitos.filter(x => ix.has(x.id) && x.total > 0 && x.pct_mujer != null)
      .sort((a, b) => (b.pct_mujer ?? 0) - (a.pct_mujer ?? 0));
  }, [d]);

  if (!d || !filas.length) return null;
  const fem = d.delitos.find(x => x.id === "feminicidio");

  return (
    <section className="seccion franja-delitos victimas" id="victimas" aria-labelledby="t-victimas">
      <p className="ni-eyebrow">Observatorio · Víctimas</p>
      <div className="seccion__head">
        <span className="seccion__num">◈</span>
        <h2 id="t-victimas">Quién es víctima: composición por sexo</h2>
      </div>
      <p className="seccion__desc">
        A diferencia del resto del tablero, aquí la unidad es la <strong>víctima</strong>, no la carpeta de investigación
        —un universo que el SESNSP reporta por separado para ciertos delitos—. Ordenadas de mayor a menor proporción de
        mujeres entre las víctimas, {d.meta.anios[0]}–{d.meta.anios.at(-1)}. Toca una ficha para ver el desglose.
      </p>
      <div className="vz-leyenda" aria-hidden="true">
        <span className="vz-li"><i className="vz-sw vz-sw--muj" /> Mujeres</span>
        <span className="vz-li"><i className="vz-sw vz-sw--hom" /> Hombres</span>
        <span className="vz-li"><i className="vz-sw vz-sw--ni" /> No identificado</span>
      </div>

      <div className="fd-strip" role="list">
        {filas.map(f => <TarjetaVictima key={f.id} f={f} />)}
      </div>

      {fem && (
        <p className="nota fd-pie">
          En el periodo se registraron <strong>{fCompacto(fem.total)}</strong> víctimas de feminicidio
          {fem.total_2026 ? <> y <strong>{fEntero(fem.total_2026)}</strong> en el corte parcial de 2026 (ene–sep, suma municipal)</> : null}.
          {" "}{d.meta.fuente}
        </p>
      )}
    </section>
  );
}

function TarjetaVictima({ f }: { f: DelitoVic }) {
  const [volteada, setVolteada] = useState(false);
  const sceneRef = useRef<HTMLDivElement>(null);
  const tiltRef = useRef<HTMLDivElement>(null);
  const idDorso = useId();
  const voltear = () => setVolteada(v => !v);

  useEffect(() => {
    const scene = sceneRef.current, tilt = tiltRef.current;
    if (!scene || !tilt) return;
    if (!matchMedia("(hover:hover) and (pointer:fine)").matches || matchMedia("(prefers-reduced-motion:reduce)").matches) return;
    const mover = (e: PointerEvent) => {
      if (document.documentElement.dataset.efectos === "apagado") { tilt.style.transform = ""; return; }
      const r = scene.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5, py = (e.clientY - r.top) / r.height - 0.5;
      tilt.style.setProperty("--mx", `${(px + 0.5) * 100}%`); tilt.style.setProperty("--my", `${(py + 0.5) * 100}%`);
      tilt.style.transform = `rotateY(${px * 7}deg) rotateX(${-py * 7}deg)`;
    };
    const salir = () => { tilt.style.transform = ""; };
    scene.addEventListener("pointermove", mover, { passive: true });
    scene.addEventListener("pointerleave", salir);
    return () => { scene.removeEventListener("pointermove", mover); scene.removeEventListener("pointerleave", salir); };
  }, []);

  const pm = f.pct_mujer ?? 0, ph = f.pct_hombre ?? 0, pn = Math.max(0, 100 - pm - ph);
  const pmAnim = useCuentaAtras(pm, 1200) ?? 0;
  const g1 = pm * 3.6, g2 = (pm + ph) * 3.6;
  const conic = `conic-gradient(var(--vz-muj) 0 ${g1}deg, var(--vz-hom) ${g1}deg ${g2}deg, var(--vz-ni) ${g2}deg 360deg)`;
  const hue = pm >= 50 ? "var(--vz-muj)" : "var(--vz-hom)";

  return (
    <div className="fd-scene" role="listitem" ref={sceneRef}>
      <div className="fd-tilt" ref={tiltRef}>
        <div className={`fd-card${volteada ? " es-volteada" : ""}`} style={{ ["--hue" as string]: hue }}>
          <div className="fd-flip">
            {/* Frente: dona de composición por sexo */}
            <div className="fd-cara fd-frente vz-cara" role="button" tabIndex={0}
              aria-expanded={volteada} aria-controls={idDorso}
              aria-label={`${f.nombre}: ${pm.toFixed(1)}% de víctimas mujeres. Voltear para el desglose.`}
              onClick={voltear}
              onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); voltear(); } }}>
              <h3 className="vz-nom">{f.nombre}</h3>
              <div className="vz-dona-wrap">
                <div className="vz-dona" style={{ background: conic }} aria-hidden="true" />
                <div className="vz-dona-centro">
                  <span className="vz-dona-pct">{pmAnim.toFixed(pm === 100 ? 0 : 1)}<small>%</small></span>
                  <span className="vz-dona-lab">mujeres</span>
                </div>
              </div>
              <p className="vz-tot num">{fEntero(f.total)} <small>víctimas</small></p>
              <span className="fd-cue" aria-hidden="true"><svg viewBox="0 0 24 24" dangerouslySetInnerHTML={{ __html: CICLO }} /> voltear</span>
            </div>
            {/* Dorso: desglose */}
            <div className="fd-cara fd-dorso vz-cara" id={idDorso} aria-hidden={!volteada}>
              <div className="fd-top"><span className="fd-rotulo">{f.nombre}</span>
                <button className="fd-volver" onClick={voltear} tabIndex={volteada ? 0 : -1} aria-label="Volver">
                  <svg viewBox="0 0 24 24" dangerouslySetInnerHTML={{ __html: CICLO }} /></button>
              </div>
              <dl className="vz-desglose">
                <div><dt><i className="vz-sw vz-sw--muj" /> Mujeres</dt><dd>{fEntero(f.mujer)} <small>({pm.toFixed(1)}%)</small></dd></div>
                <div><dt><i className="vz-sw vz-sw--hom" /> Hombres</dt><dd>{fEntero(f.hombre)} <small>({ph.toFixed(1)}%)</small></dd></div>
                <div><dt><i className="vz-sw vz-sw--ni" /> No identificado</dt><dd>{fEntero(f.no_identificado)} <small>({pn.toFixed(1)}%)</small></dd></div>
                {f.pct_menores != null && <div><dt>Menores de edad</dt><dd>{f.pct_menores.toFixed(0)}% de las víctimas</dd></div>}
                {f.total_2026 ? <div><dt>Corte 2026 (ene–sep)</dt><dd>{fEntero(f.total_2026)} víctimas</dd></div> : null}
              </dl>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
