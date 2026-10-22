import { useEffect, useId, useRef, useState } from "react";
import type { SeriesNacionales } from "../lib/contratos";
import { serieMensual, aAnual, acumulado } from "../lib/series";
import { colorDelito } from "../theme/paleta";
import { fEntero, fCompacto, fPct } from "../lib/formato";

/** Íconos de trazo por delito (genéricos, sin color propio). */
const ICONOS: Record<string, string> = {
  "violencia-familiar": '<path d="M4 11.5 12 5l8 6.5M6 10.5V19h12v-8.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M10.6 14.3 12 15.7l1.4-1.4" fill="none" stroke="currentColor" stroke-width="1.4"/>',
  "otros-robos": '<path d="M6 8h12l1 11H5L6 8Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8" fill="none" stroke="currentColor" stroke-width="1.6"/>',
  "otros-delitos-del-fuero-comun": '<path d="M12 4 20 8l-8 4-8-4 8-4Z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M4 12l8 4 8-4M4 16l8 4 8-4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>',
  "robo-de-vehiculo-automotor": '<path d="M3 13l2-5h11l3 3h2v4h-3M3 13v3h2m0 0a2 2 0 1 0 4 0m-4 0a2 2 0 1 1 4 0m7 0a2 2 0 1 0 4 0m-4 0a2 2 0 1 1 4 0" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>',
  "lesiones-dolosas": '<path d="M3 12h4l2-5 4 10 2-5h6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>',
};
const ICONO_FALLBACK = '<circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12 8v5l3 2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>';

const FLECHA_ARRIBA = '<path d="M12 19V7m0 0-5 5m5-5 5 5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>';
const FLECHA_ABAJO = '<path d="M12 5v12m0 0-5-5m5 5 5-5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>';
const GUION = '<path d="M5 12h14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>';
const CICLO = '<path d="M4 9a8 8 0 0 1 14-3m2-2v4h-4M20 15a8 8 0 0 1-14 3m-2 2v-4h4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>';

/** Minigráfico anual (línea con área y punto final). */
function Spark({ valores }: { valores: number[] }) {
  if (valores.length < 2) return null;
  const W = 240, H = 44, P = 4;
  const min = Math.min(...valores), max = Math.max(...valores);
  const esc = (v: number) => max === min ? H / 2 : H - P - ((v - min) / (max - min)) * (H - 2 * P);
  const paso = (W - 2 * P) / (valores.length - 1);
  const pts = valores.map((v, i) => [P + i * paso, esc(v)] as const);
  const d = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const dArea = `${d} L${pts.at(-1)![0].toFixed(1)},${H - 1} L${P},${H - 1} Z`;
  const u = pts.at(-1)!;
  return (
    <svg className="fd-spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
      <path className="fd-area" d={dArea} /><path className="fd-linea" d={d} />
      <circle cx={u[0]} cy={u[1]} r={3.4} />
    </svg>
  );
}

interface Props {
  ranking: { etiqueta: string; delitos: Array<{ delito_id: string; nombre: string; cantidad: number; participacion: number }> };
  sn: SeriesNacionales;
  completo?: boolean;
}

export default function FranjaDelitos({ ranking, sn }: Props) {
  const top5 = ranking.delitos.slice(0, 5);
  const esResidual = (n: string) => /^otros\b/i.test(n);

  const tarjetas = top5.map((d, i) => {
    const serie = serieMensual(sn, d.delito_id);
    const anual = aAnual(serie).filter(a => a.v != null);
    const valores = anual.map(a => a.v as number);
    const { suma, mesesPublicados } = acumulado(serie);
    const promMensual = mesesPublicados ? suma / mesesPublicados : null;
    let cambio: { pct: number | null; a0: number; a1: number } | null = null;
    if (anual.length >= 2) {
      const p = anual[0], u = anual.at(-1)!;
      cambio = { pct: p.v ? ((u.v as number) - (p.v as number)) / (p.v as number) * 100 : null, a0: p.anio, a1: u.anio };
    }
    const dir = cambio?.pct == null ? "igual" : cambio.pct > 1 ? "alza" : cambio.pct < -1 ? "baja" : "igual";
    return { ...d, rango: i, color: colorDelito(d.delito_id), valores, promMensual, cambio, dir, residual: esResidual(d.nombre) };
  });

  return (
    <section className="seccion franja-delitos" id="panorama-delitos" aria-labelledby="t-franja">
      <div className="seccion__head">
        <span className="seccion__num">◈</span>
        <h2 id="t-franja">Los cinco delitos más frecuentes</h2>
      </div>
      <p className="seccion__desc">
        Delitos registrados, {ranking.etiqueta}. Cada tarjeta se voltea: toca para ver cuánto cambió a lo largo del periodo,
        su promedio mensual y su peso en el total. La frecuencia no equivale a gravedad.
      </p>
      <div className="fd-strip" role="list">
        {tarjetas.map(t => <TarjetaDelito key={t.delito_id} t={t} etiqueta={ranking.etiqueta} />)}
      </div>
      <p className="nota fd-pie">
        Universo: nacional (fuente estatal) · {ranking.etiqueta} · elaboración propia con datos del SESNSP.
        {tarjetas.some(t => t.residual) && " ⁽ᴿ⁾ categoría residual del catálogo oficial."}
      </p>
    </section>
  );
}

function TarjetaDelito({ t, etiqueta }: {
  t: { delito_id: string; nombre: string; cantidad: number; participacion: number; rango: number; color: string;
       valores: number[]; promMensual: number | null; cambio: { pct: number | null; a0: number; a1: number } | null;
       dir: string; residual: boolean };
  etiqueta: string;
}) {
  const [volteada, setVolteada] = useState(false);
  const sceneRef = useRef<HTMLDivElement>(null);
  const tiltRef = useRef<HTMLDivElement>(null);
  const idDorso = useId();
  const voltear = () => setVolteada(v => !v);

  // Inclinación 3D propia (respeta el conmutador global «Experiencia 3D» y el movimiento reducido).
  useEffect(() => {
    const scene = sceneRef.current, tilt = tiltRef.current;
    if (!scene || !tilt) return;
    const fino = matchMedia("(hover:hover) and (pointer:fine)").matches;
    const reducido = matchMedia("(prefers-reduced-motion:reduce)").matches;
    if (!fino || reducido) return;
    const activo = () => document.documentElement.dataset.efectos === "cinematico";
    const mover = (e: PointerEvent) => {
      if (!activo()) { tilt.style.transform = ""; return; }
      const r = scene.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5, py = (e.clientY - r.top) / r.height - 0.5;
      tilt.style.setProperty("--mx", `${(px + 0.5) * 100}%`);
      tilt.style.setProperty("--my", `${(py + 0.5) * 100}%`);
      tilt.style.transform = `rotateY(${px * 7}deg) rotateX(${-py * 7}deg)`;
    };
    const salir = () => { tilt.style.transform = ""; };
    scene.addEventListener("pointermove", mover, { passive: true });
    scene.addEventListener("pointerleave", salir);
    return () => { scene.removeEventListener("pointermove", mover); scene.removeEventListener("pointerleave", salir); };
  }, []);

  const icono = ICONOS[t.delito_id] ?? ICONO_FALLBACK;
  const flecha = t.dir === "alza" ? FLECHA_ARRIBA : t.dir === "baja" ? FLECHA_ABAJO : GUION;
  const trendTxt = t.cambio?.pct == null ? "s/d"
    : `${fPct(t.cambio.pct)} (${t.cambio.a0}→${String(t.cambio.a1).slice(2)})`;

  return (
    <div className="fd-scene" role="listitem" ref={sceneRef}>
      <div className="fd-tilt" ref={tiltRef}>
        <div className={`fd-card${volteada ? " es-volteada" : ""}`} style={{ ["--hue" as string]: t.color }}>
          <div className="fd-flip">
            {/* Frente */}
            <div className="fd-cara fd-frente" role="button" tabIndex={0}
              aria-expanded={volteada} aria-controls={idDorso}
              aria-label={`${t.nombre}. Voltear para ver el cambio en el periodo.`}
              onClick={voltear}
              onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); voltear(); } }}>
              <div className="fd-top">
                <span className="fd-rango">#{t.rango + 1}</span>
                <span className="fd-ico" aria-hidden="true"><svg viewBox="0 0 24 24" dangerouslySetInnerHTML={{ __html: icono }} /></span>
                <span className={`fd-trend fd-trend--${t.dir}`}>
                  <svg viewBox="0 0 24 24" dangerouslySetInnerHTML={{ __html: flecha }} />{trendTxt}
                </span>
              </div>
              <h3 className="fd-nombre">{t.nombre}{t.residual ? " ⁽ᴿ⁾" : ""}</h3>
              <p className="fd-cifra">{fEntero(t.cantidad)}</p>
              <p className="fd-sub">{fPct(t.participacion, false)} del total · {etiqueta.replace("acumulado ", "")}</p>
              <Spark valores={t.valores} />
              <span className="fd-cue" aria-hidden="true"><svg viewBox="0 0 24 24" dangerouslySetInnerHTML={{ __html: CICLO }} /> voltear</span>
            </div>
            {/* Dorso */}
            <div className="fd-cara fd-dorso" id={idDorso} aria-hidden={!volteada}>
              <div className="fd-top"><span className="fd-rotulo">{t.nombre}</span>
                <button className="fd-volver" onClick={voltear} tabIndex={volteada ? 0 : -1} aria-label="Volver">
                  <svg viewBox="0 0 24 24" dangerouslySetInnerHTML={{ __html: CICLO }} /></button>
              </div>
              <dl className="fd-datos">
                <div><dt>Cambio {t.cambio ? `${t.cambio.a0}→${t.cambio.a1}` : "en el periodo"}</dt>
                  <dd className={`fd-cambio fd-trend--${t.dir}`}>{t.cambio?.pct == null ? "sin dato" : fPct(t.cambio.pct)}</dd></div>
                <div><dt>Promedio mensual</dt><dd>{t.promMensual == null ? "s/d" : fEntero(Math.round(t.promMensual))}</dd></div>
                <div><dt>Participación</dt><dd>{fPct(t.participacion, false)} del total nacional</dd></div>
                <div><dt>Acumulado</dt><dd>{fCompacto(t.cantidad)} carpetas</dd></div>
              </dl>
              <a className="fd-detalle" href="#delitos"
                onClick={e => { e.stopPropagation(); document.getElementById("delitos")?.scrollIntoView({ behavior: "smooth" }); }}
                tabIndex={volteada ? 0 : -1}>Ver en detalle →</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
