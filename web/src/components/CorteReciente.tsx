import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, PointerEvent as RPointerEvent } from "react";
import type { SeriesNacionales } from "../lib/contratos";
import { fEntero, fMesLargo, fPct, fAcumulado } from "../lib/formato";
import CampoParticulas from "./CampoParticulas";
import type { MesBarra } from "./BarrasMes3D";
import "./corte-reciente.css";

const BarrasMes3D = lazy(() => import("./BarrasMes3D"));

const CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const nf1 = new Intl.NumberFormat("es-MX", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const diasDelMes = (ym: string) => { const [a, m] = ym.split("-").map(Number); return new Date(a, m, 0).getDate(); };
const reducido = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion:reduce)").matches;

/** Cifra que asciende hasta su valor cuando la ficha entra en pantalla. */
function Cifra({ valor, formato, activo }: { valor: number; formato: (v: number) => string; activo: boolean }) {
  const [v, setV] = useState(reducido() ? valor : 0);
  useEffect(() => {
    if (!activo || reducido()) { setV(valor); return; }
    let raf = 0; const t0 = performance.now(), dur = 1100;
    const paso = (t: number) => {
      const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      setV(valor * e);
      if (k < 1) raf = requestAnimationFrame(paso);
    };
    raf = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(raf);
  }, [valor, activo]);
  return <>{formato(v)}</>;
}

/** Minigráfico de línea para las fichas (misma escala dentro de la ficha; el último punto se marca). */
function Mini({ valores }: { valores: number[] }) {
  if (valores.length < 2) return null;
  const W = 200, H = 30, P = 3;
  const min = Math.min(...valores), max = Math.max(...valores);
  const y = (v: number) => (max === min ? H / 2 : H - P - ((v - min) / (max - min)) * (H - 2 * P));
  const paso = (W - 2 * P) / (valores.length - 1);
  const pts = valores.map((v, i) => [P + i * paso, y(v)] as const);
  const d = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const u = pts.at(-1)!;
  return (
    <svg className="corte-mini" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
      <path className="corte-mini__area" d={`${d} L${u[0].toFixed(1)},${H} L${P},${H} Z`} />
      <path className="corte-mini__linea" d={d} />
    </svg>
  );
}

/** Avance del año: un segmento por mes; los publicados se rellenan. */
function Segmentos({ parte, total }: { parte: number; total: number }) {
  return (
    <span className="corte-seg" aria-hidden="true">
      {Array.from({ length: total }, (_, i) => <i key={i} className={i < parte ? "on" : undefined} style={{ "--i": i } as CSSProperties} />)}
    </span>
  );
}

function Ficha({ etiqueta, children, pie, tono, retardo, grafico }: {
  etiqueta: string; children: React.ReactNode; pie: React.ReactNode; tono: string; retardo: number; grafico?: React.ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);
  const mover = (e: RPointerEvent<HTMLElement>) => {
    if (e.pointerType !== "mouse" || reducido()) return;
    const el = ref.current; if (!el) return;
    const b = el.getBoundingClientRect();
    const x = (e.clientX - b.left) / b.width, y = (e.clientY - b.top) / b.height;
    el.style.setProperty("--rx", `${(0.5 - y) * 9}deg`);
    el.style.setProperty("--ry", `${(x - 0.5) * 11}deg`);
    el.style.setProperty("--mx", `${x * 100}%`);
    el.style.setProperty("--my", `${y * 100}%`);
  };
  const salir = () => { const el = ref.current; if (!el) return; for (const k of ["--rx", "--ry", "--mx", "--my"]) el.style.removeProperty(k); };
  return (
    <article ref={ref} className="corte-kpi" onPointerMove={mover} onPointerLeave={salir}
      style={{ "--tono": tono, "--retardo": `${retardo}ms` } as CSSProperties}>
      <span className="corte-kpi__etq">{etiqueta}</span>
      <strong className="corte-kpi__val">{children}</strong>
      {grafico && <span className="corte-kpi__graf">{grafico}</span>}
      <span className="corte-kpi__pie">{pie}</span>
    </article>
  );
}

export default function CorteReciente({ nr }: { nr: SeriesNacionales | null }) {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);
  const [sinGL, setSinGL] = useState(false);
  const alFallar = useCallback(() => setSinGL(true), []);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const o = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { setVisible(true); o.disconnect(); } }), { threshold: 0.2 });
    o.observe(el);
    return () => o.disconnect();
  }, []);

  const c = useMemo(() => {
    if (!nr) return null;
    const idx = nr.total.reduce<number>((u, v, i) => (v != null ? i : u), -1);
    if (idx < 0) return null;
    const ym = nr.meses[idx], actual = nr.total[idx] as number;
    const previo = idx > 0 ? nr.total[idx - 1] : null;
    const publicados = nr.total.slice(0, idx + 1).map(v => v ?? 0);
    const acumulado = publicados.reduce((s, v) => s + v, 0);
    const diarios = publicados.map((v, i) => v / diasDelMes(nr.meses[i]));
    const diario = diarios[idx];
    const diarioPrevio = idx > 0 ? diarios[idx - 1] : null;
    const maximo = Math.max(...nr.total.map(v => v ?? 0));
    const acumulados = publicados.map((_, i) => publicados.slice(0, i + 1).reduce((s, v) => s + v, 0));
    const meses: MesBarra[] = nr.meses.map((m, i) => {
      const v = nr.total[i], ant = i > 0 ? nr.total[i - 1] : null;
      return { ym: m, corto: CORTOS[Number(m.slice(5, 7)) - 1], valor: v,
        diario: v != null ? v / diasDelMes(m) : null,
        variacion: v != null && ant ? (v / ant - 1) * 100 : null };
    });
    // Solo el nivel subtipo (ids presentes en la jerarquía); las claves «a/b» son modalidades.
    const top = Object.entries(nr.jerarquia)
      .map(([id, j]) => {
        const valor = nr.series[id]?.[idx] ?? 0, ant = idx > 0 ? nr.series[id]?.[idx - 1] ?? null : null;
        return { id, nombre: j.subtipo, valor, parte: (valor / actual) * 100, variacion: ant ? (valor / ant - 1) * 100 : null };
      })
      .sort((a, b) => b.valor - a.valor).slice(0, 5);
    return { idx, ym, actual, previo, acumulado, diario, diarioPrevio, maximo, top, publicados, diarios, acumulados, meses };
  }, [nr]);

  if (!nr || !c) return null;
  const [anio, mes] = c.ym.split("-").map(Number);
  const nombreMes = fMesLargo(c.ym);
  const titulo = nombreMes.charAt(0).toUpperCase() + nombreMes.slice(1);
  const mesPrevio = c.idx > 0 ? CORTOS[Number(nr.meses[c.idx - 1].slice(5, 7)) - 1] : "";
  const varMes = c.previo ? (c.actual / c.previo - 1) * 100 : null;
  const varDiario = c.diarioPrevio ? (c.diario / c.diarioPrevio - 1) * 100 : null;
  const ALTO = 74;
  const validado = nr.meta.validado_utc
    ? new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", year: "numeric", timeZone: "America/Mexico_City" }).format(new Date(nr.meta.validado_utc))
    : null;
  const topMax = c.top[0]?.parte || 1;

  return (
    <section ref={ref} className={`seccion corte${visible ? " corte--visible" : ""}`} id="corte-reciente" aria-labelledby="t-corte">
      <CampoParticulas />
      <div className="corte__head">
        <div>
          <span className="corte__eyebrow"><i aria-hidden="true" /> Último corte oficial · registro RNID</span>
          <h2 id="t-corte">
            {titulo.split(" ").map((w, i) => <span key={i} className="corte__w" style={{ "--i": i } as CSSProperties}>{i > 0 ? " " : ""}{w}</span>)}
          </h2>
        </div>
        <div className="corte__lado">
          <p className="corte__desc">
            Delitos registrados en carpetas de investigación, total nacional. El registro vigente desde enero de {anio} no
            es comparable de forma directa con 2015–2025.
          </p>
          <div className="corte__sellos">
            <span className="corte__sello">Fuente · SESNSP</span>
            {validado && <span className="corte__sello">Validado · {validado}</span>}
            <span className="corte__sello">{mes} de 12 meses</span>
          </div>
        </div>
      </div>

      <div className="corte__grid">
        <div className="corte__col">
          <div className="corte__kpis">
            <Ficha etiqueta={`Registros en ${CORTOS[mes - 1]} ${anio}`} tono="#38baff" retardo={0}
              grafico={<Mini valores={c.publicados} />}
              pie={varMes != null ? <><b className={varMes > 0 ? "sube" : "baja"}>{fPct(varMes)}</b> frente a {mesPrevio} ({fEntero(c.previo)})</> : "Primer mes del registro"}>
              <Cifra valor={c.actual} formato={v => fEntero(Math.round(v))} activo={visible} />
            </Ficha>
            <Ficha etiqueta="Promedio diario del mes" tono="#8f7cff" retardo={90}
              grafico={<Mini valores={c.diarios} />}
              pie={varDiario != null ? <><b className={varDiario > 0 ? "sube" : "baja"}>{fPct(varDiario)}</b> frente a {mesPrevio} ({nf1.format(c.diarioPrevio!)} al día)</> : "Sin mes previo"}>
              <Cifra valor={c.diario} formato={v => nf1.format(v)} activo={visible} />
            </Ficha>
            <Ficha etiqueta={`Acumulado ${fAcumulado(anio, mes)}`} tono="#2fd3b0" retardo={180}
              grafico={<Segmentos parte={mes} total={12} />}
              pie={<>{mes} de 12 meses publicados</>}>
              <Cifra valor={c.acumulado} formato={v => fEntero(Math.round(v))} activo={visible} />
            </Ficha>
          </div>

          <div className="corte-top">
            <div className="corte-top__cab">
              <span>Cinco delitos con más registros · {CORTOS[mes - 1]} {anio}</span>
              <span>% del mes</span>
            </div>
            <ol>
              {c.top.map((t, i) => (
                <li key={t.id} style={{ "--i": i, "--w": `${(t.parte / topMax) * 100}%` } as CSSProperties}>
                  <em>{i + 1}</em>
                  <span className="corte-top__nom">{t.nombre}</span>
                  <b className="corte-top__val">{fEntero(t.valor)}</b>
                  <span className="corte-top__pct">{nf1.format(t.parte)} %</span>
                  <i className="corte-top__barra" aria-hidden="true" />
                </li>
              ))}
            </ol>
          </div>
        </div>

        <figure className="corte-barras" aria-label={`Registros mensuales de ${anio}`}>
          <figcaption>
            <span>Registros por mes, {anio}</span>
            <span className="corte-barras__pista">{sinGL ? "Miles de registros" : "Miles de registros · señala una barra"}</span>
          </figcaption>
          {!sinGL ? (
            <Suspense fallback={<div className="b3d" aria-hidden="true" />}>
              <BarrasMes3D meses={c.meses} ultimo={c.idx} activo={visible} alFallar={alFallar} />
            </Suspense>
          ) : (
            <div className="corte-barras__escena" aria-hidden="true">
              <div className="corte-barras__piso">
                {nr.total.map((v, i) => {
                  const h = v != null ? Math.max(4, (v / c.maximo) * ALTO) : 0;
                  const cls = v == null ? " corte-barra--np" : i === c.idx ? " corte-barra--ult" : "";
                  return (
                    <div key={nr.meses[i]} className={`corte-barra${cls}`}
                      style={{ "--h": `${h}px`, "--i": i } as CSSProperties}>
                      {v != null && <><i className="cb-frente" /><i className="cb-lado" /><i className="cb-tapa" /></>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          <ol className={`corte-barras__eje${sinGL ? "" : " visualmente-oculto"}`}>
            {nr.total.map((v, i) => (
              <li key={nr.meses[i]} className={i === c.idx ? "es-ult" : v == null ? "es-np" : undefined}>
                <span>{CORTOS[i]} </span>
                <b>{v != null ? nf1.format(v / 1000) : "n. p."}</b>
              </li>
            ))}
          </ol>
          <p className="corte-barras__nota">Altura desde cero · contorno punteado = mes no publicado · el promedio diario descuenta la distinta duración de los meses</p>
        </figure>
      </div>

      <p className="nota corte__fuente">{nr.meta.fuente}. Corte {fMesLargo(nr.meta.corte)}.</p>
    </section>
  );
}
