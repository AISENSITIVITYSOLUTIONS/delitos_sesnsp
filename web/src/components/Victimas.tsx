import { useEffect, useMemo, useState } from "react";
import { cargar } from "../lib/datos";
import { fEntero, fCompacto } from "../lib/formato";

interface DelitoVic {
  id: string; nombre: string; total: number;
  mujer: number; hombre: number; no_identificado: number;
  pct_mujer: number | null; pct_hombre: number | null;
  menores: number; adultos: number; pct_menores: number | null;
  serie_mujer: number[]; serie_hombre: number[];
  total_2026: number | null; mujer_2026: number | null;
}
interface Datos { meta: { fuente: string; universo: string; anios: string[] }; delitos: DelitoVic[] }

// Delitos con interpretación clara de víctimas (se excluyen residuales «Otros…»).
const CURADOS = new Set([
  "feminicidio", "trata-de-personas", "corrupcion-de-menores", "lesiones-dolosas",
  "extorsion", "secuestro", "lesiones-culposas", "rapto", "homicidio-culposo",
  "homicidio-doloso", "trafico-de-menores",
]);

export default function Victimas() {
  const [d, setD] = useState<Datos | null>(null);
  const [animar, setAnimar] = useState(false);
  useEffect(() => { cargar<Datos>("victimas.json").then(setD).catch(() => setD(null)); }, []);
  useEffect(() => { if (d) { const t = setTimeout(() => setAnimar(true), 60); return () => clearTimeout(t); } }, [d]);

  const filas = useMemo(() => {
    if (!d) return [];
    return d.delitos.filter(x => CURADOS.has(x.id) && x.total > 0 && x.pct_mujer != null)
      .sort((a, b) => (b.pct_mujer ?? 0) - (a.pct_mujer ?? 0));
  }, [d]);

  if (!d || !filas.length) return null;

  const totalFem = d.delitos.find(x => x.id === "feminicidio");
  const maxTotal = Math.max(...filas.map(f => f.total));

  return (
    <section className="seccion victimas" id="victimas" aria-labelledby="t-victimas">
      <p className="ni-eyebrow">Observatorio · Víctimas</p>
      <div className="seccion__head">
        <span className="seccion__num">◈</span>
        <h2 id="t-victimas">Quién es víctima: composición por sexo</h2>
      </div>
      <p className="seccion__desc">
        A diferencia del resto del tablero, aquí la unidad es la <strong>víctima</strong>, no la carpeta de investigación —un universo distinto que el SESNSP reporta por separado para ciertos delitos—.
        Ordenados de mayor a menor proporción de mujeres entre las víctimas, {d.meta.anios[0]}–{d.meta.anios.at(-1)}.
        El feminicidio es, por definición, una categoría de víctimas mujeres.
      </p>

      <div className="vz-leyenda" aria-hidden="true">
        <span className="vz-li"><i className="vz-sw vz-sw--muj" /> Mujeres</span>
        <span className="vz-li"><i className="vz-sw vz-sw--hom" /> Hombres</span>
        <span className="vz-li"><i className="vz-sw vz-sw--ni" /> No identificado</span>
      </div>

      <div className="vz-lista">
        {filas.map(f => {
          const pm = f.pct_mujer ?? 0, ph = f.pct_hombre ?? 0, pn = Math.max(0, 100 - pm - ph);
          return (
            <div className="vz-fila" key={f.id}>
              <div className="vz-cab">
                <span className="vz-nombre">{f.nombre}</span>
                <span className="vz-total num">{fEntero(f.total)} <small>víctimas</small></span>
              </div>
              <div className="vz-barra" role="img"
                aria-label={`${f.nombre}: ${pm.toFixed(1)}% mujeres, ${ph.toFixed(1)}% hombres, ${pn.toFixed(1)}% no identificado.`}>
                <span className="vz-seg vz-muj" style={{ width: animar ? `${pm}%` : 0 }} />
                <span className="vz-seg vz-hom" style={{ width: animar ? `${ph}%` : 0 }} />
                <span className="vz-seg vz-ni" style={{ width: animar ? `${pn}%` : 0 }} />
              </div>
              <div className="vz-meta">
                <span className="vz-pct">{pm.toFixed(1)}% mujeres</span>
                {f.pct_menores != null && f.pct_menores >= 1 && <span className="vz-chip">{f.pct_menores.toFixed(0)}% menores de edad</span>}
                <span className="vz-rel" style={{ width: `${(f.total / maxTotal) * 100}%` }} aria-hidden="true" />
              </div>
            </div>
          );
        })}
      </div>

      {totalFem && (
        <p className="nota vz-pie">
          En el periodo se registraron <strong>{fCompacto(totalFem.total)}</strong> víctimas de feminicidio
          {totalFem.total_2026 ? <> y <strong>{fEntero(totalFem.total_2026)}</strong> en el corte parcial de 2026 (ene–sep, suma municipal)</> : null}.
          El homicidio doloso, en contraste, tiene víctimas mayoritariamente hombres. {d.meta.fuente}
        </p>
      )}
    </section>
  );
}
