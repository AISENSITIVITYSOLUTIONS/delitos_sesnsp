import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { cargar } from "../lib/datos";
import { fEntero, fCompacto } from "../lib/formato";
import "./victimas-anillo.css";

interface DelitoVic {
  id: string; nombre: string; total: number;
  mujer: number; hombre: number; no_identificado: number;
  pct_mujer: number | null; pct_hombre: number | null;
  menores: number; adultos: number; pct_menores: number | null;
  total_2026: number | null; mujer_2026: number | null;
}
interface Datos { meta: { fuente: string; universo: string; anios: string[]; etiqueta_2026?: string }; delitos: DelitoVic[] }

// Diez delitos con interpretación clara de víctimas (se excluyen residuales y ambiguos).
const CURADOS = [
  "feminicidio", "rapto", "trata-de-personas", "corrupcion-de-menores", "lesiones-dolosas",
  "extorsion", "lesiones-culposas", "secuestro", "homicidio-culposo", "homicidio-doloso",
];

const CAPAS = 7; // capas apiladas en Z que dan grosor a la dona

function conico(pm: number, ph: number) {
  const g1 = pm * 3.6, g2 = (pm + ph) * 3.6;
  return `conic-gradient(var(--vz-muj) 0 ${g1}deg, var(--vz-hom) ${g1}deg ${g2}deg, var(--vz-ni) ${g2}deg 360deg)`;
}

export default function Victimas() {
  const [d, setD] = useState<Datos | null>(null);
  useEffect(() => { cargar<Datos>("victimas.json").then(setD).catch(() => setD(null)); }, []);

  const filas = useMemo(() => {
    if (!d) return [];
    const ix = new Map(CURADOS.map((id, i) => [id, i]));
    return d.delitos.filter(x => ix.has(x.id) && x.total > 0 && x.pct_mujer != null)
      .sort((a, b) => (b.pct_mujer ?? 0) - (a.pct_mujer ?? 0));
  }, [d]);

  const n = filas.length;
  const [frente, setFrente] = useState(0);
  const escenaRef = useRef<HTMLDivElement>(null);
  const anilloRef = useRef<HTMLDivElement>(null);
  const irRef = useRef<(i: number) => void>(() => {});
  const ir = useCallback((i: number) => irRef.current(i), []);

  // Carrusel en anillo (adaptado del «Año decroliano»): gira solo, se arrastra y trae al frente la ficha elegida.
  useEffect(() => {
    const escena = escenaRef.current, anillo = anilloRef.current;
    if (!escena || !anillo || n < 3) return;
    const fichas = [...anillo.querySelectorAll<HTMLElement>(".va-card")];
    const paso = 360 / n;
    const quieto = matchMedia("(prefers-reduced-motion:reduce)").matches;
    const VEL = quieto ? 0 : -4.6; // grados por segundo
    let ang = 0, vel = VEL, impulso = 0, meta: number | null = null, R = 300;
    let arrastre: { x: number; a: number; movido: boolean } | null = null;
    let visible = false, dentro = false, pausaHasta = 0, raf = 0, actual = -1, ultimoY = scrollY, previo = 0;

    const medir = () => { R = Math.round((fichas[0].offsetWidth / 2) / Math.tan(Math.PI / n) + 34); pintar(); };
    const pintar = () => {
      anillo.style.transform = `translateZ(${-R}px) rotateY(${ang.toFixed(3)}deg)`;
      fichas.forEach((c, i) => {
        const cos = Math.cos(((i * paso + ang) * Math.PI) / 180);
        c.style.transform = `rotateY(${i * paso}deg) translateZ(${R}px)`;
        c.style.setProperty("--c", Math.max(0, cos).toFixed(3));
      });
      const f = ((Math.round(-ang / paso) % n) + n) % n;
      if (f !== actual) { actual = f; setFrente(f); fichas.forEach((c, i) => c.classList.toggle("es-frente", i === f)); }
    };
    const ciclo = (t: number) => {
      raf = 0;
      if (!visible || document.hidden) return;
      const dt = previo ? Math.min(0.05, (t - previo) / 1000) : 0.016; previo = t;
      const k = dt * 60; // equivalencia a fotogramas de 60 Hz
      const dy = scrollY - ultimoY; ultimoY = scrollY;
      if (!quieto && !arrastre && meta == null && Math.abs(dy) > 0) impulso = Math.max(-1.6, Math.min(1.6, impulso - dy / 260));
      if (meta != null) {
        ang += (meta - ang) * (1 - Math.pow(0.89, k));
        if (Math.abs(meta - ang) < 0.05) { ang = meta; meta = null; }
      } else if (!arrastre) {
        const libre = t > pausaHasta && !dentro;
        ang += (libre ? vel * dt : 0) + impulso * k; impulso *= Math.pow(0.93, k);
        if (Math.abs(impulso) < 0.002) impulso = 0;
      }
      pintar();
      if (!quieto || meta != null || arrastre || impulso) pedir();
    };
    const pedir = () => { if (!raf) raf = requestAnimationFrame(ciclo); };
    const reanudar = () => { previo = 0; pedir(); };

    irRef.current = (i: number) => {
      const k = ((i % n) + n) % n;
      meta = -k * paso + Math.round((ang + k * paso) / 360) * 360;
      impulso = 0; pausaHasta = performance.now() + 6000; pedir();
    };

    const bajar = (e: PointerEvent) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      arrastre = { x: e.clientX, a: ang, movido: false }; meta = null; impulso = 0;
      pedir();
    };
    const mover = (e: PointerEvent) => {
      if (!arrastre) return;
      const dx = e.clientX - arrastre.x;
      if (!arrastre.movido && Math.abs(dx) < 6) return;
      if (!arrastre.movido) { arrastre.movido = true; escena.classList.add("es-arrastre"); try { escena.setPointerCapture(e.pointerId); } catch { /* opcional */ } }
      ang = arrastre.a + dx * 0.28; pedir();
    };
    const soltar = (e: PointerEvent) => {
      if (!arrastre) return;
      const a = arrastre; arrastre = null; escena.classList.remove("es-arrastre");
      pausaHasta = performance.now() + 5000;
      if (a.movido) { impulso = quieto ? 0 : Math.max(-2.4, Math.min(2.4, (e.clientX - a.x) * 0.008)); if (quieto) irRef.current(actual); }
      else {
        const ficha = (document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null)?.closest<HTMLElement>(".va-card");
        if (ficha?.dataset.i) irRef.current(Number(ficha.dataset.i));
      }
      pedir();
    };
    const entrar = () => { dentro = true; };
    const salir = () => { dentro = false; pedir(); };
    escena.addEventListener("pointerdown", bajar);
    escena.addEventListener("pointermove", mover);
    escena.addEventListener("pointerup", soltar);
    escena.addEventListener("pointercancel", soltar);
    escena.addEventListener("pointerenter", entrar);
    escena.addEventListener("pointerleave", salir);
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; ultimoY = scrollY; if (visible) reanudar(); }, { threshold: 0.15 });
    io.observe(escena);
    const ro = new ResizeObserver(medir); ro.observe(escena);
    const alScroll = () => { if (visible) pedir(); };
    addEventListener("scroll", alScroll, { passive: true });
    document.addEventListener("visibilitychange", reanudar);
    medir();
    escena.classList.add("va--lista");
    return () => {
      cancelAnimationFrame(raf); io.disconnect(); ro.disconnect();
      escena.removeEventListener("pointerdown", bajar); escena.removeEventListener("pointermove", mover);
      escena.removeEventListener("pointerup", soltar); escena.removeEventListener("pointercancel", soltar);
      escena.removeEventListener("pointerenter", entrar); escena.removeEventListener("pointerleave", salir);
      removeEventListener("scroll", alScroll); document.removeEventListener("visibilitychange", reanudar);
    };
  }, [n]);

  if (!d || !n) return null;
  const fem = d.delitos.find(x => x.id === "feminicidio");
  const f = filas[Math.min(frente, n - 1)];
  const pm = f.pct_mujer ?? 0, ph = f.pct_hombre ?? 0, pn = Math.max(0, 100 - pm - ph);
  const etiqueta2026 = d.meta.etiqueta_2026 ?? "parcial";

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
        mujeres entre las víctimas, {d.meta.anios[0]}–{d.meta.anios.at(-1)}. El anillo gira solo: arrástralo o elige un delito de la lista.
      </p>

      <div className="va">
        <div className="va-escena" ref={escenaRef} aria-hidden="true">
          <div className="va-anillo" ref={anilloRef}>
            {filas.map((x, i) => {
              const xm = x.pct_mujer ?? 0, xh = x.pct_hombre ?? 0;
              return (
                <div key={x.id} className="va-card" data-i={i} style={{ "--hue": xm >= 50 ? "var(--vz-muj)" : "var(--vz-hom)" } as CSSProperties}>
                  <span className="va-card__n">{String(i + 1).padStart(2, "0")}</span>
                  <h3 className="va-card__nom">{x.nombre}</h3>
                  <div className="va-dona">
                    {Array.from({ length: CAPAS }, (_, k) => (
                      <i key={k} className="va-dona__capa" style={{ background: conico(xm, xh), "--k": k } as CSSProperties} />
                    ))}
                    <div className="va-dona__centro">
                      <span className="va-dona__pct">{xm.toFixed(xm === 100 ? 0 : 1)}<small>%</small></span>
                      <span className="va-dona__lab">mujeres</span>
                    </div>
                  </div>
                  <p className="va-card__tot">{fEntero(x.total)} <small>víctimas</small></p>
                </div>
              );
            })}
          </div>
          <div className="va-piso" />
          <p className="va-ayuda">Arrastra para girar · toca una ficha para traerla al frente</p>
        </div>

        <div className="va-panel">
          <div className="va-detalle" key={f.id} style={{ "--hue": pm >= 50 ? "var(--vz-muj)" : "var(--vz-hom)" } as CSSProperties}>
            <div className="va-detalle__cab">
              <span className="va-detalle__n">{String(frente + 1).padStart(2, "0")} / {String(n).padStart(2, "0")}</span>
              <div className="va-nav no-imprimir">
                <button type="button" onClick={() => ir(frente - 1)} aria-label="Delito anterior">‹</button>
                <button type="button" onClick={() => ir(frente + 1)} aria-label="Delito siguiente">›</button>
              </div>
            </div>
            <h3 className="va-detalle__nom">{f.nombre}</h3>
            <p className="va-detalle__pct"><strong>{pm.toFixed(pm === 100 ? 0 : 1)}<small> %</small></strong> de las víctimas son mujeres</p>
            <div className="va-barra va-barra--g" aria-hidden="true">
              <i className="va-seg va-seg--muj" style={{ width: `${pm}%` }} /><i className="va-seg va-seg--hom" style={{ width: `${ph}%` }} /><i className="va-seg va-seg--ni" style={{ width: `${pn}%` }} />
            </div>
            <dl className="va-desglose">
              <div><dt><i className="vz-sw vz-sw--muj" /> Mujeres</dt><dd>{fEntero(f.mujer)} <small>{pm.toFixed(1)} %</small></dd></div>
              <div><dt><i className="vz-sw vz-sw--hom" /> Hombres</dt><dd>{fEntero(f.hombre)} <small>{ph.toFixed(1)} %</small></dd></div>
              <div><dt><i className="vz-sw vz-sw--ni" /> No identificado</dt><dd>{fEntero(f.no_identificado)} <small>{pn.toFixed(1)} %</small></dd></div>
              <div><dt>Total {d.meta.anios[0]}–{d.meta.anios.at(-1)}</dt><dd>{fEntero(f.total)}</dd></div>
              {f.pct_menores != null && <div><dt>Menores de edad</dt><dd>{f.pct_menores.toFixed(0)} % <small>de las víctimas</small></dd></div>}
              {f.total_2026 ? <div><dt>Corte 2026 ({etiqueta2026})</dt><dd>{fEntero(f.total_2026)}</dd></div> : null}
            </dl>
          </div>

          <ol className="va-lista" aria-label="Delitos por proporción de víctimas mujeres">
            {filas.map((x, i) => {
              const xm = x.pct_mujer ?? 0, xh = x.pct_hombre ?? 0, xn = Math.max(0, 100 - xm - xh);
              return (
                <li key={x.id}>
                  <button type="button" className={i === frente ? "es-activa" : undefined} aria-current={i === frente ? "true" : undefined}
                    onClick={() => ir(i)}
                    aria-label={`${x.nombre}: ${xm.toFixed(1)} % mujeres, ${xh.toFixed(1)} % hombres, ${xn.toFixed(1)} % no identificado; ${fEntero(x.total)} víctimas`}>
                    <span className="va-lista__nom">{x.nombre}</span>
                    <span className="va-barra" aria-hidden="true">
                      <i className="va-seg va-seg--muj" style={{ width: `${xm}%` }} /><i className="va-seg va-seg--hom" style={{ width: `${xh}%` }} /><i className="va-seg va-seg--ni" style={{ width: `${xn}%` }} />
                    </span>
                    <b>{xm.toFixed(1)} %</b>
                  </button>
                </li>
              );
            })}
          </ol>
          <div className="vz-leyenda" aria-hidden="true">
            <span className="vz-li"><i className="vz-sw vz-sw--muj" /> Mujeres</span>
            <span className="vz-li"><i className="vz-sw vz-sw--hom" /> Hombres</span>
            <span className="vz-li"><i className="vz-sw vz-sw--ni" /> No identificado</span>
          </div>
        </div>
      </div>

      {fem && (
        <p className="nota fd-pie">
          En el periodo se registraron <strong>{fCompacto(fem.total)}</strong> víctimas de feminicidio
          {fem.total_2026 ? <> y <strong>{fEntero(fem.total_2026)}</strong> en el corte parcial de 2026 ({etiqueta2026}, fuente estatal)</> : null}.
          {" "}{d.meta.fuente}
        </p>
      )}
    </section>
  );
}
