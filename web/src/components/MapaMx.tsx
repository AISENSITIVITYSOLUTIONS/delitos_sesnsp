import { lazy, Suspense, useId, useMemo, useRef, useState } from "react";
import type { Territorio } from "../lib/geo";
import { marcoDe, rutaSVG, cortesCuantiles, clase } from "../lib/geo";
import { SECUENCIAL } from "../theme/paleta";
import { fEntero, fTasa } from "../lib/formato";

const Mapa3D = lazy(() => import("./Mapa3D"));

export interface ValorTerritorio { v: number | null; esCero?: boolean; etiqueta?: string }

interface Props {
  territorios: Territorio[];
  valores: Record<string, ValorTerritorio>;
  metrica: "conteo" | "tasa";
  titulo: string;
  onSeleccion?: (cve: string) => void;
  seleccionado?: string | null;
  modo: "2d" | "3d";
  onModo: (m: "2d" | "3d") => void;
  /** Escala fija opcional (máximo del periodo completo en comparaciones). */
  maxFijo?: number;
  notaEscala?: string;
}

export const soportaWebGL = (() => {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch { return false; }
})();

export default function MapaMx(p: Props) {
  const uid = useId().replace(/:/g, "");
  const sinDatoId = `sin-dato-${uid}`, relieveId = `relieve-${uid}`;
  const oscuro = document.documentElement.getAttribute("data-theme") === "dark" ||
    (!document.documentElement.getAttribute("data-theme") && matchMedia("(prefers-color-scheme: dark)").matches);
  const rampa = SECUENCIAL[oscuro ? "dark" : "light"];
  const marco = useMemo(() => marcoDe(p.territorios), [p.territorios]);
  const [hover, setHover] = useState<{ cve: string; x: number; y: number } | null>(null);
  const cajaRef = useRef<HTMLDivElement>(null);

  const valoresNum = useMemo(() =>
    Object.values(p.valores).map(d => d.v).filter((v): v is number => v != null && v > 0),
    [p.valores]);
  const cortes = useMemo(() => cortesCuantiles(valoresNum, 7), [valoresNum]);
  const maxV = p.maxFijo ?? (valoresNum.length ? Math.max(...valoresNum) : 0);

  const colorDe = (cve: string): string => {
    const d = p.valores[cve];
    if (!d || d.v == null) return `url(#${sinDatoId})`;
    if (d.v === 0) return "var(--surface)";
    return rampa[Math.min(clase(d.v, cortes), rampa.length - 1)];
  };

  const W = 920, H = 560;
  const fmt = (v: number | null) => v == null ? "sin información"
    : p.metrica === "conteo" ? `${fEntero(v)} delitos` : `${fTasa(v)} por 100 mil`;

  const el3D = p.modo === "3d" && soportaWebGL;

  return (
    <div className="tarjeta mapa-caja" ref={cajaRef} aria-label={p.titulo}>
      <div className="mapa-controles no-imprimir">
        <div className="seg" role="group" aria-label="Modo de vista del mapa">
          <button aria-pressed={p.modo === "2d"} onClick={() => p.onModo("2d")}>2D</button>
          <button aria-pressed={p.modo === "3d"} onClick={() => p.onModo("3d")}
            disabled={!soportaWebGL}
            title={soportaWebGL ? "Extrusión 3D" : "WebGL no disponible en este dispositivo; se conserva la vista 2D"}>3D</button>
        </div>
      </div>

      {el3D ? (
        <Suspense fallback={<p className="nota" style={{ padding: 20 }}>Cargando vista 3D…</p>}>
          <Mapa3D territorios={p.territorios} valores={p.valores} rampa={rampa}
            cortes={cortes} maxV={maxV} metrica={p.metrica}
            onSeleccion={p.onSeleccion} fmt={fmt} />
        </Suspense>
      ) : (
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }}
          role="group" aria-label={`${p.titulo}. Mapa coroplético; los valores exactos están en la tabla adjunta.`}>
          <defs>
            <pattern id={sinDatoId} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="6" height="6" fill="var(--surface)" />
              <line x1="0" y1="0" x2="0" y2="6" stroke="var(--axis)" strokeWidth="1.4" />
            </pattern>
            <filter id={relieveId} x="-4%" y="-4%" width="108%" height="108%">
              <feDropShadow dx="0" dy="1.2" stdDeviation="1.4" floodColor="#14212E" floodOpacity={oscuro ? 0.5 : 0.18} />
            </filter>
          </defs>
          <g filter={`url(#${relieveId})`}>
            {p.territorios.map(t => (
              <path key={t.cve}
                d={rutaSVG(t, marco, W, H)}
                fill={colorDe(t.cve)}
                stroke={p.seleccionado === t.cve ? "var(--ink)" : "var(--surface)"}
                strokeWidth={p.seleccionado === t.cve ? 2 : 0.8}
                style={{ cursor: p.onSeleccion ? "pointer" : "default", transition: "opacity 140ms" }}
                opacity={hover && hover.cve !== t.cve ? 0.82 : 1}
                tabIndex={p.territorios.length <= 40 ? 0 : -1}
                role="img"
                aria-label={`${t.nombre}: ${fmt(p.valores[t.cve]?.v ?? null)}`}
                onMouseMove={(e) => {
                  const r = cajaRef.current?.getBoundingClientRect();
                  setHover({ cve: t.cve, x: e.clientX - (r?.left ?? 0), y: e.clientY - (r?.top ?? 0) });
                }}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover({ cve: t.cve, x: 20, y: 20 })}
                onBlur={() => setHover(null)}
                onClick={() => p.onSeleccion?.(t.cve)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); p.onSeleccion?.(t.cve); } }}
              />
            ))}
          </g>
        </svg>
      )}

      {hover && !el3D && (() => {
        const t = p.territorios.find(x => x.cve === hover.cve);
        const d = p.valores[hover.cve];
        if (!t) return null;
        return (
          <div role="tooltip" style={{
            position: "absolute", left: Math.min(hover.x + 14, (cajaRef.current?.clientWidth ?? 400) - 190),
            top: hover.y + 12, zIndex: 6, pointerEvents: "none",
            background: "var(--surface)", border: "1px solid var(--border-strong)",
            borderRadius: 10, boxShadow: "var(--sombra-2)", padding: "8px 11px", maxWidth: 200,
          }}>
            <p style={{ fontSize: 12.5, fontWeight: 600 }}>{t.nombre}</p>
            <p style={{ fontSize: 12, color: "var(--ink-2)" }}>
              <strong style={{ color: "var(--ink)" }}>{fmt(d?.v ?? null)}</strong>
              {d?.etiqueta ? <><br />{d.etiqueta}</> : null}
            </p>
            <p className="nota" style={{ fontFamily: "var(--mono)", fontSize: 10.5 }}>{t.cve}</p>
          </div>
        );
      })()}

      <div className="mapa-leyenda">
        <strong style={{ fontSize: 11, color: "var(--ink-2)" }}>
          {p.metrica === "conteo" ? "Delitos registrados" : "Tasa por 100 mil hab."}
        </strong>
        <div className="escala" aria-hidden="true">{rampa.map(c => <i key={c} style={{ background: c }} />)}</div>
        <div className="extremos"><span>{p.metrica === "conteo" ? "1" : "> 0"}</span><span>{p.metrica === "conteo" ? fEntero(maxV) : fTasa(maxV)}</span></div>
        <div className="fila" style={{ gap: 12, marginTop: 6 }}>
          <span className="leyenda-item"><i style={{ width: 11, height: 11, borderRadius: 3, background: "var(--surface)", border: "1px solid var(--axis)", display: "inline-block" }} /> cero reportado</span>
          <span className="leyenda-item"><i className="sin-dato-swatch" /> sin información</span>
        </div>
        <p className="nota" style={{ marginTop: 4, maxWidth: 220 }}>
          Clases por cuantiles del periodo mostrado.{p.notaEscala ? ` ${p.notaEscala}` : ""}
        </p>
      </div>
    </div>
  );
}
