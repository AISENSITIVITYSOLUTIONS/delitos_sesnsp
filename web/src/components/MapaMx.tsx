import { lazy, Suspense, useCallback, useMemo, useState } from "react";
import Limite3D from "./Limite3D";
import type { Territorio } from "../lib/geo";
import { cortesCuantiles, clase } from "../lib/geo";
import { SECUENCIAL, DIVERGENTE, indiceCambio } from "../theme/paleta";
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
  /** Escala fija opcional (máximo del periodo completo en comparaciones). */
  maxFijo?: number;
  notaEscala?: string;
  variacion?: boolean;
}

export const soportaWebGL = (() => {
  try {
    const c = document.createElement("canvas");
    const gl = c.getContext("webgl2");
    if (!gl) return false;
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch { return false; }
})();

/** Mapa territorial exclusivamente tridimensional (Three.js). Sin WebGL 2 se muestra la lista accesible de valores. */
export default function MapaMx(p: Props) {
  const [fallo3D, setFallo3D] = useState(false);
  const [consulta, setConsulta] = useState("");
  const fallo = useCallback(() => setFallo3D(true), []);
  const oscuro = document.documentElement.getAttribute("data-theme") === "dark" ||
    (!document.documentElement.getAttribute("data-theme") && matchMedia("(prefers-color-scheme: dark)").matches);
  const rampa = (p.variacion ? DIVERGENTE : SECUENCIAL)[oscuro ? "dark" : "light"];

  const valoresNum = useMemo(() =>
    Object.values(p.valores).map(d => d.v).filter((v): v is number => v != null && (p.variacion || v > 0)),
    [p.valores, p.variacion]);
  const cortes = useMemo(() => cortesCuantiles(valoresNum, 7), [valoresNum]);
  const maxV = p.maxFijo ?? (valoresNum.length ? Math.max(...valoresNum.map(Math.abs)) : 0);

  // Colores en hexadecimal: Three.js no resuelve variables CSS.
  const colorDe = (cve: string): string => {
    const d = p.valores[cve];
    if (!d || d.v == null) return "#8c8c87";
    if (p.variacion) return rampa[indiceCambio(d.v, maxV)];
    if (d.v === 0) return "#e2e8f0";
    return rampa[Math.min(clase(d.v, cortes), rampa.length - 1)];
  };

  const fmt = (v: number | null) => v == null ? "sin información"
    : p.variacion ? `${v > 0 ? "↑ +" : v < 0 ? "↓ " : "↔ "}${fEntero(v)} delitos · ${v > 0 ? "aumento" : v < 0 ? "descenso" : "sin cambio"}`
    : p.metrica === "conteo" ? `${fEntero(v)} delitos` : `${fTasa(v)} por 100 mil`;

  const el3D = soportaWebGL && !fallo3D;
  const seleccionado = p.seleccionado ?? consulta;

  return (
    <div className="tarjeta mapa-caja" aria-label={p.titulo}>
      {el3D ? (
        <Limite3D onFallo={fallo}>
          <Suspense fallback={<p className="nota" style={{ padding: 20 }}>Cargando vista 3D…</p>}>
            <Mapa3D territorios={p.territorios} valores={p.valores} rampa={rampa} cortes={cortes} maxV={maxV}
              metrica={p.metrica} colorDe={colorDe} onSeleccion={p.onSeleccion} seleccionado={seleccionado}
              fmt={fmt} onFallo={fallo} />
          </Suspense>
        </Limite3D>
      ) : (
        <div>
          <p className="nota" role="status">
            {fallo3D ? "La vista 3D no pudo mantenerse en este dispositivo." : "Este dispositivo no admite WebGL 2, necesario para la vista 3D."}
            {" "}Los valores se muestran en la lista accesible.
          </p>
          <ul className="lista-territorios" aria-label={`${p.titulo}: valores por territorio`}>
            {p.territorios.map(t => (
              <li key={t.cve}>
                <button className="boton" aria-pressed={seleccionado === t.cve}
                  onClick={() => p.onSeleccion?.(t.cve)}>
                  {t.nombre}: {fmt(p.valores[t.cve]?.v ?? null)}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mapa-consulta"><label htmlFor="mapa-consulta">Consultar o seleccionar territorio</label><select id="mapa-consulta" className="control" value={p.territorios.some(t => t.cve === consulta) ? consulta : ""} onChange={e => { setConsulta(e.target.value); if (e.target.value) p.onSeleccion?.(e.target.value); }}><option value="">Selecciona un territorio</option>{p.territorios.map(t => <option key={t.cve} value={t.cve}>{t.nombre}</option>)}</select><output aria-live="polite">{consulta && p.territorios.some(t => t.cve === consulta) ? `${p.territorios.find(t => t.cve === consulta)?.nombre}: ${fmt(p.valores[consulta]?.v ?? null)}` : "Disponible también con teclado."}</output></div>
      <div className="mapa-leyenda">
        <strong style={{ fontSize: 11, color: "var(--ink-2)" }}>
          {p.variacion ? "Cambio absoluto del registro · centro 0" : p.metrica === "conteo" ? "Delitos registrados" : "Tasa por 100 mil hab."}
        </strong>
        <div className="escala" aria-hidden="true">{rampa.map(c => <i key={c} style={{ background: c }} />)}</div>
        <div className="extremos"><span>{p.variacion ? `−${fEntero(maxV)} · descenso` : p.metrica === "conteo" ? "1" : "> 0"}</span><span>{p.variacion ? `+${fEntero(maxV)} · aumento` : p.metrica === "conteo" ? fEntero(maxV) : fTasa(maxV)}</span></div>
        <div className="fila" style={{ gap: 12, marginTop: 6 }}>
          <span className="leyenda-item"><i style={{ width: 11, height: 11, borderRadius: 3, background: p.variacion ? rampa[3] : "#e2e8f0", border: "1px solid var(--axis)", display: "inline-block" }} /> {p.variacion ? "sin cambio (0)" : "cero reportado"}</span>
          <span className="leyenda-item"><i className="sin-dato-swatch" /> sin información</span>
        </div>
        <p className="nota" style={{ marginTop: 4, maxWidth: 220 }}>
          {p.variacion ? "Intervalos simétricos alrededor de cero; turquesa: descenso, terracota: aumento." : "Clases por cuantiles del periodo mostrado."}{p.notaEscala ? ` ${p.notaEscala}` : ""}
        </p>
      </div>
    </div>
  );
}
