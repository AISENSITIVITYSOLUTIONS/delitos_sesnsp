import { useEffect, useId, useRef, useState } from "react";
import type { SeriesNacionales, PoblacionAnual } from "../lib/contratos";
import { serieMensual, aAnual, acumulado, tasaPeriodo, tasaAnual } from "../lib/series";
import { colorDelito } from "../theme/paleta";
import { fEntero, fCompacto, fPct, fTasa } from "../lib/formato";
import { useEstado } from "../lib/estado";

/** Íconos de trazo por delito (genéricos, sin color propio). */
const ICONOS: Record<string, string> = {
  "violencia-familiar": '<path d="M4 11.5 12 5l8 6.5M6 10.5V19h12v-8.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M10.6 14.3 12 15.7l1.4-1.4" fill="none" stroke="currentColor" stroke-width="1.4"/>',
  "otros-robos": '<path d="M6 8h12l1 11H5L6 8Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8" fill="none" stroke="currentColor" stroke-width="1.6"/>',
  "otros-delitos-del-fuero-comun": '<path d="M12 4 20 8l-8 4-8-4 8-4Z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M4 12l8 4 8-4M4 16l8 4 8-4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>',
  "robo-de-vehiculo-automotor": '<path d="M3 13l2-5h11l3 3h2v4h-3M3 13v3h2m0 0a2 2 0 1 0 4 0m-4 0a2 2 0 1 1 4 0m7 0a2 2 0 1 0 4 0m-4 0a2 2 0 1 1 4 0" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>',
  "lesiones-dolosas": '<path d="M3 12h4l2-5 4 10 2-5h6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>',
  "dano-a-la-propiedad": '<path d="M4 20V9l8-5 8 5v11M4 20h16M9 20v-5h6v5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M13.5 8.5l-2 3h2l-1.5 3" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>',
  "amenazas": '<path d="M12 3 3 7v5c0 5 3.8 8 9 9 5.2-1 9-4 9-9V7l-9-4Z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M12 8v4.5M12 15.5v.5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
  "robo-a-negocio": '<path d="M4 10l1.5-4h13L20 10M4 10v9h16v-9M4 10h16M9 19v-5h6v5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>',
  "fraude": '<path d="M4 7h16v10H4z" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M4 10h16" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="8" cy="14" r="1.3" fill="currentColor"/><path d="M13 14h4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>',
  "robo-a-transeunte-en-via-publica": '<circle cx="12" cy="5.5" r="2.2" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M9 21v-6l-2-3 3-3h4l3 3-2 3v6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>',
};
const ICONO_FALLBACK = '<circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12 8v5l3 2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>';

const FLECHA_ARRIBA = '<path d="M12 19V7m0 0-5 5m5-5 5 5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>';
const FLECHA_ABAJO = '<path d="M12 5v12m0 0-5-5m5 5 5-5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>';
const GUION = '<path d="M5 12h14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>';
const CICLO = '<path d="M4 9a8 8 0 0 1 14-3m2-2v4h-4M20 15a8 8 0 0 1-14 3m-2 2v-4h4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>';

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
      <path className="fd-area" d={dArea} /><path className="fd-linea" d={d} pathLength={1} />
      <circle cx={u[0]} cy={u[1]} r={3.4} />
    </svg>
  );
}

type Metrica = "conteo" | "tasa";

interface Props {
  ranking: { etiqueta: string; delitos: Array<{ delito_id: string; nombre: string; cantidad: number; participacion: number }> };
  sn: SeriesNacionales;
  pob: PoblacionAnual;
}

interface Ficha {
  delito_id: string; nombre: string; participacion: number; rango: number; color: string; residual: boolean;
  cantidad: number; tasaP: number | null; promMensual: number | null;
  countAnnual: number[]; rateAnnual: number[];
  a0: number | null; a1: number | null; cambioCount: number | null; cambioRate: number | null;
}

const chgPct = (arr: number[]) => arr.length >= 2 && arr[0] ? (arr.at(-1)! - arr[0]) / arr[0] * 100 : null;

export default function FranjaDelitos({ ranking, sn, pob }: Props) {
  const metrica = useEstado(s => s.metrica) as Metrica;
  const top10 = ranking.delitos.slice(0, 10);
  const esResidual = (n: string) => /^otros\b/i.test(n);

  const fichas: Ficha[] = top10.map((d, i) => {
    const serie = serieMensual(sn, d.delito_id);
    const anual = aAnual(serie).filter(a => a.v != null);
    const countAnnual = anual.map(a => a.v as number);
    const rateAnnual = anual.map(a => tasaAnual(a.v, a.anio, pob, null)).filter((x): x is number => x != null);
    const { suma, mesesPublicados } = acumulado(serie);
    return {
      delito_id: d.delito_id, nombre: d.nombre, participacion: d.participacion, rango: i,
      color: colorDelito(d.delito_id), residual: esResidual(d.nombre),
      cantidad: d.cantidad, tasaP: tasaPeriodo(serie, pob, null).tasa,
      promMensual: mesesPublicados ? suma / mesesPublicados : null,
      countAnnual, rateAnnual,
      a0: anual[0]?.anio ?? null, a1: anual.at(-1)?.anio ?? null,
      cambioCount: chgPct(countAnnual), cambioRate: chgPct(rateAnnual),
    };
  });

  // Auto-volteo de presentación: onda escalonada cada 15 s; se pausa al interactuar o si el documento está oculto.
  const [pulso, setPulso] = useState(0);
  const pausaRef = useRef(false);
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion:reduce)").matches) return;
    const id = setInterval(() => {
      if (pausaRef.current || document.hidden) return;
      setPulso(p => p + 1);
    }, 15000);
    return () => clearInterval(id);
  }, []);

  const titulo = metrica === "tasa" ? "Los diez delitos por tasa /100 mil" : "Los diez delitos más frecuentes";

  return (
    <section className="seccion franja-delitos" id="panorama-delitos" aria-labelledby="t-franja">
      <p className="ni-eyebrow">Observatorio · Panorama nacional</p>
      <div className="seccion__head">
        <span className="seccion__num">◈</span>
        <h2 id="t-franja">{titulo}</h2>
      </div>
      <p className="seccion__desc">
        {metrica === "tasa"
          ? <>Tasa por cada 100 mil habitantes, {ranking.etiqueta} (denominador poblacional CONAPO). El orden coincide con el de volumen porque comparten el mismo denominador nacional.</>
          : <>Delitos registrados, {ranking.etiqueta}. Cada ficha se voltea: toca para ver cuánto cambió a lo largo del periodo, su promedio mensual y su peso en el total. La frecuencia no equivale a gravedad.</>}
      </p>
      <div className="fd-strip" role="list"
        onPointerEnter={() => { pausaRef.current = true; }} onPointerLeave={() => { pausaRef.current = false; }}
        onFocusCapture={() => { pausaRef.current = true; }} onBlurCapture={() => { pausaRef.current = false; }}>
        {fichas.map(f => <TarjetaDelito key={f.delito_id} f={f} etiqueta={ranking.etiqueta} metrica={metrica} pulso={pulso} />)}
      </div>
      <p className="nota fd-pie">
        Universo: nacional (fuente estatal) · {ranking.etiqueta} · elaboración propia con datos del SESNSP.
        {fichas.some(f => f.residual) && " ⁽ᴿ⁾ categoría residual del catálogo oficial."}
      </p>
    </section>
  );
}

function TarjetaDelito({ f, etiqueta, metrica, pulso }: { f: Ficha; etiqueta: string; metrica: Metrica; pulso: number }) {
  const [volteada, setVolteada] = useState(false);
  const sceneRef = useRef<HTMLDivElement>(null);
  const tiltRef = useRef<HTMLDivElement>(null);
  const idDorso = useId();
  const voltear = () => setVolteada(v => !v);

  // Auto-volteo en onda (retraso por posición de la ficha); no se activa en el primer render.
  useEffect(() => {
    if (pulso === 0) return;
    const t = setTimeout(() => setVolteada(v => !v), f.rango * 70);
    return () => clearTimeout(t);
  }, [pulso, f.rango]);

  useEffect(() => {
    const scene = sceneRef.current, tilt = tiltRef.current;
    if (!scene || !tilt) return;
    const fino = matchMedia("(hover:hover) and (pointer:fine)").matches;
    const reducido = matchMedia("(prefers-reduced-motion:reduce)").matches;
    if (!fino || reducido) return;
    const activo = () => document.documentElement.dataset.efectos !== "apagado";
    const mover = (e: PointerEvent) => {
      if (!activo()) { tilt.style.transform = ""; return; }
      const r = scene.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5, py = (e.clientY - r.top) / r.height - 0.5;
      tilt.style.setProperty("--mx", `${(px + 0.5) * 100}%`);
      tilt.style.setProperty("--my", `${(py + 0.5) * 100}%`);
      tilt.style.setProperty("--px", `${px * 2}`);
      tilt.style.setProperty("--py", `${py * 2}`);
      tilt.style.transform = `rotateY(${px * 12}deg) rotateX(${-py * 10}deg)`;
    };
    const salir = () => { tilt.style.transform = ""; tilt.style.setProperty("--px", "0"); tilt.style.setProperty("--py", "0"); };
    scene.addEventListener("pointermove", mover, { passive: true });
    scene.addEventListener("pointerleave", salir);
    return () => { scene.removeEventListener("pointermove", mover); scene.removeEventListener("pointerleave", salir); };
  }, []);

  const esTasa = metrica === "tasa";
  const cifra = esTasa ? fTasa(f.tasaP) : fEntero(f.cantidad);
  const valores = esTasa ? f.rateAnnual : f.countAnnual;
  const cambio = esTasa ? f.cambioRate : f.cambioCount;
  const sub = esTasa
    ? `por 100 mil hab. · ${etiqueta.replace("acumulado ", "")}`
    : `${fPct(f.participacion, false)} del total · ${etiqueta.replace("acumulado ", "")}`;
  const dir = cambio == null ? "igual" : cambio > 1 ? "alza" : cambio < -1 ? "baja" : "igual";

  const icono = ICONOS[f.delito_id] ?? ICONO_FALLBACK;
  const flecha = dir === "alza" ? FLECHA_ARRIBA : dir === "baja" ? FLECHA_ABAJO : GUION;
  const trendTxt = cambio == null ? "s/d" : `${fPct(cambio)} (${f.a0}→${String(f.a1).slice(2)})`;

  return (
    <div className="fd-scene" role="listitem" ref={sceneRef} style={{ animationDelay: `${f.rango * 55}ms` }}>
      <div className="fd-tilt" ref={tiltRef}>
        <div className={`fd-card${volteada ? " es-volteada" : ""}`} style={{ ["--hue" as string]: f.color }}>
          <div className="fd-flip">
            {/* Frente */}
            <div className="fd-cara fd-frente" role="button" tabIndex={0}
              aria-expanded={volteada} aria-controls={idDorso}
              aria-label={`${f.nombre}. Voltear para ver el detalle.`}
              onClick={voltear}
              onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); voltear(); } }}>
              <div className="fd-top">
                <span className="fd-rango">#{f.rango + 1}</span>
                <span className="fd-ico" aria-hidden="true"><svg viewBox="0 0 24 24" dangerouslySetInnerHTML={{ __html: icono }} /></span>
                <span className={`fd-trend fd-trend--${dir}`}>
                  <svg viewBox="0 0 24 24" dangerouslySetInnerHTML={{ __html: flecha }} />{trendTxt}
                </span>
              </div>
              <h3 className="fd-nombre">{f.nombre}{f.residual ? " ⁽ᴿ⁾" : ""}</h3>
              <div className="fd-metrica" key={metrica}>
                <p className="fd-cifra">{cifra}{esTasa && <span className="fd-u"> /100 mil</span>}</p>
                <p className="fd-sub">{sub}</p>
                <Spark key={`${metrica}-${volteada}`} valores={valores} />
              </div>
              <span className="fd-cue" aria-hidden="true"><svg viewBox="0 0 24 24" dangerouslySetInnerHTML={{ __html: CICLO }} /> voltear</span>
            </div>
            {/* Dorso */}
            <div className="fd-cara fd-dorso" id={idDorso} aria-hidden={!volteada}>
              <div className="fd-top"><span className="fd-rotulo">{f.nombre}</span>
                <button className="fd-volver" onClick={voltear} tabIndex={volteada ? 0 : -1} aria-label="Volver">
                  <svg viewBox="0 0 24 24" dangerouslySetInnerHTML={{ __html: CICLO }} /></button>
              </div>
              <dl className="fd-datos">
                <div><dt>Cambio {f.a0 ? `${f.a0}→${f.a1}` : "en el periodo"}</dt>
                  <dd className={`fd-cambio fd-trend--${dir}`}>{cambio == null ? "sin dato" : fPct(cambio)}</dd></div>
                <div><dt>Tasa del periodo</dt><dd>{fTasa(f.tasaP)} <span className="fd-u">/100 mil</span></dd></div>
                <div><dt>Participación</dt><dd>{fPct(f.participacion, false)} del total nacional</dd></div>
                <div><dt>Acumulado</dt><dd>{fCompacto(f.cantidad)} carpetas</dd></div>
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
