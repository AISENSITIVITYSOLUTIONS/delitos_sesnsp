import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, PointerEvent as RPointerEvent } from "react";
import type { SeriesNacionales } from "../lib/contratos";
import { fEntero, fMesLargo, fPct, fAcumulado } from "../lib/formato";
import "./corte-reciente.css";

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

function Ficha({ etiqueta, children, pie, tono, retardo }: {
  etiqueta: string; children: React.ReactNode; pie: React.ReactNode; tono: string; retardo: number;
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
      <span className="corte-kpi__pie">{pie}</span>
    </article>
  );
}

export default function CorteReciente({ nr }: { nr: SeriesNacionales | null }) {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);
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
    const acumulado = nr.total.slice(0, idx + 1).reduce<number>((s, v) => s + (v ?? 0), 0);
    const diario = actual / diasDelMes(ym);
    const diarioPrevio = previo != null ? previo / diasDelMes(nr.meses[idx - 1]) : null;
    const maximo = Math.max(...nr.total.map(v => v ?? 0));
    // Solo el nivel subtipo (ids presentes en la jerarquía); las claves «a/b» son modalidades.
    const top = Object.entries(nr.jerarquia)
      .map(([id, j]) => ({ id, nombre: j.subtipo, valor: nr.series[id]?.[idx] ?? 0 }))
      .sort((a, b) => b.valor - a.valor).slice(0, 3);
    return { idx, ym, actual, previo, acumulado, diario, diarioPrevio, maximo, top };
  }, [nr]);

  if (!nr || !c) return null;
  const [anio, mes] = c.ym.split("-").map(Number);
  const nombreMes = fMesLargo(c.ym);
  const mesPrevio = c.idx > 0 ? CORTOS[Number(nr.meses[c.idx - 1].slice(5, 7)) - 1] : "";
  const varMes = c.previo ? (c.actual / c.previo - 1) * 100 : null;
  const varDiario = c.diarioPrevio ? (c.diario / c.diarioPrevio - 1) * 100 : null;
  const ALTO = 74;

  return (
    <section ref={ref} className={`seccion corte${visible ? " corte--visible" : ""}`} id="corte-reciente" aria-labelledby="t-corte">
      <div className="corte__head">
        <div>
          <span className="corte__eyebrow"><i aria-hidden="true" /> Último corte oficial · registro RNID</span>
          <h2 id="t-corte">{nombreMes.charAt(0).toUpperCase() + nombreMes.slice(1)}</h2>
        </div>
        <p className="corte__desc">
          Delitos registrados en carpetas de investigación, total nacional. El registro vigente desde enero de {anio} no
          es comparable de forma directa con 2015–2025.
        </p>
      </div>

      <div className="corte__grid">
        <div className="corte__kpis">
          <Ficha etiqueta={`Registros en ${CORTOS[mes - 1]} ${anio}`} tono="#38baff" retardo={0}
            pie={varMes != null ? <><b className={varMes > 0 ? "sube" : "baja"}>{fPct(varMes)}</b> frente a {mesPrevio} ({fEntero(c.previo)})</> : "Primer mes del registro"}>
            <Cifra valor={c.actual} formato={v => fEntero(Math.round(v))} activo={visible} />
          </Ficha>
          <Ficha etiqueta="Promedio diario del mes" tono="#8f7cff" retardo={90}
            pie={varDiario != null ? <><b className={varDiario > 0 ? "sube" : "baja"}>{fPct(varDiario)}</b> frente a {mesPrevio} ({nf1.format(c.diarioPrevio!)} al día)</> : "Sin mes previo"}>
            <Cifra valor={c.diario} formato={v => nf1.format(v)} activo={visible} />
          </Ficha>
          <Ficha etiqueta={`Acumulado ${fAcumulado(anio, mes)}`} tono="#2fd3b0" retardo={180}
            pie={<>{mes} de 12 meses publicados</>}>
            <Cifra valor={c.acumulado} formato={v => fEntero(Math.round(v))} activo={visible} />
          </Ficha>
        </div>

        <figure className="corte-barras" aria-label={`Registros mensuales de ${anio}`}>
          <figcaption>Registros por mes, {anio}</figcaption>
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
          <ol className="corte-barras__eje">
            {nr.total.map((v, i) => (
              <li key={nr.meses[i]} className={i === c.idx ? "es-ult" : v == null ? "es-np" : undefined}>
                <span>{CORTOS[i]}</span>
                <b>{v != null ? nf1.format(v / 1000) : "n. p."}</b>
              </li>
            ))}
          </ol>
          <p className="corte-barras__nota">Miles de registros · altura desde cero · n. p. = mes no publicado</p>
        </figure>
      </div>

      <div className="corte__top">
        <span>Más registros en {CORTOS[mes - 1]} {anio}</span>
        {c.top.map((t, i) => (
          <span key={t.id} className="corte__chip"><em>{i + 1}</em>{t.nombre}<b>{fEntero(t.valor)}</b></span>
        ))}
      </div>
      <p className="nota corte__fuente">{nr.meta.fuente}. Corte {fMesLargo(nr.meta.corte)}. El promedio diario descuenta la distinta duración de los meses.</p>
    </section>
  );
}
