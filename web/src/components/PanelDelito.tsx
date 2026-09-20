import { colorDelito } from "../theme/paleta";
import { useMemo, useRef, useState } from "react";
import Grafica, { tokens } from "./Grafica";
import type { SeriesNacionales, PoblacionAnual } from "../lib/contratos";
import {
  serieMensual, recortar, aAnual, mediaMovil12, hayVentanaCompleta,
  acumulado, comparacionEquivalente, tasaMensual, tasaAnual,
} from "../lib/series";
import { fEntero, fTasa, fPct, fMes, fCompacto, fAcumulado } from "../lib/formato";
import { descargarCSV } from "../lib/datos";
import type { EChartsCoreOption } from "echarts/core";

interface Props {
  sn: SeriesNacionales;
  pob: PoblacionAnual;
  delitoId: string;
  nombre: string;
  colorIdx: number;          // ranura categórica fija del delito (0..4)
  participacion: number;     // participación en el total del periodo del ranking
  etiquetaPeriodo: string;
  desde: string;
  hasta: string;
  fuenteTexto: string;
}

type Vista = "mensual" | "anual";
type Met = "conteo" | "tasa";

export default function PanelDelito(p: Props) {
  const [vista, setVista] = useState<Vista>("mensual");
  const [met, setMet] = useState<Met>("conteo");
  const [mm12, setMm12] = useState(false);
  const [verComposicion, setVerComposicion] = useState(false);
  const tablaRef = useRef<HTMLDialogElement>(null);

  const serie = useMemo(() => recortar(serieMensual(p.sn, p.delitoId), p.desde, p.hasta),
    [p.sn, p.delitoId, p.desde, p.hasta]);
  const anual = useMemo(() => aAnual(serie), [serie]);
  const puedeMM = useMemo(() => hayVentanaCompleta(serie), [serie]);
  const acum = useMemo(() => acumulado(serie), [serie]);
  const ultimo = serie.filter(s => s.v != null).at(-1);
  const comp = useMemo(() => {
    if (!ultimo) return null;
    const iniAnio = `${ultimo.anio}-01`;
    return comparacionEquivalente(serieMensual(p.sn, p.delitoId), iniAnio,
      ultimo.ym, p.sn.meses[0]);
  }, [p.sn, p.delitoId, ultimo]);

  const t = tokens();
  const color = colorDelito(p.delitoId);

  const opcion = useMemo<EChartsCoreOption>(() => {
    if (vista === "mensual") {
      const ejeX = serie.map(s => fMes(s.ym));
      const valores = serie.map(s => met === "conteo" ? s.v : tasaMensual(s, p.pob, null));
      const mm = mm12 && puedeMM
        ? mediaMovil12(serie).map((v, i) => v == null ? null
          : met === "conteo" ? v : tasaMensual({ ...serie[i], v }, p.pob, null))
        : null;
      const seriesE: object[] = [{
        name: p.nombre, type: "line", data: valores, showSymbol: false,
        lineStyle: { width: 2, color }, itemStyle: { color },
        areaStyle: { color, opacity: 0.08 },
        emphasis: { focus: "series" }, connectNulls: false,
        endLabel: {
          show: true, formatter: (d: { value: number | null }) =>
            d.value == null ? "" : (met === "conteo" ? fCompacto(d.value) : fTasa(d.value)),
          color: t.ink, fontSize: 11, fontWeight: 600, distance: 6,
        },
        labelLayout: { moveOverlap: "shiftY" },
      }];
      if (mm) seriesE.push({
        name: "Media móvil 12 meses", type: "line", data: mm, showSymbol: false,
        lineStyle: { width: 2, color: t.deemphasis }, itemStyle: { color: t.deemphasis },
        connectNulls: false,
      });
      return {
        legend: mm ? {
          bottom: 0, icon: "rect", itemWidth: 12, itemHeight: 3,
          textStyle: { color: t.ink2, fontSize: 12 },
        } : undefined,
        grid: { left: 8, right: 74, top: 18, bottom: mm ? 52 : 30, containLabel: true },
        xAxis: { type: "category", data: ejeX, axisLabel: { interval: Math.max(Math.ceil(ejeX.length / 10) - 1, 0) } },
        yAxis: { type: "value", axisLabel: { formatter: (v: number) => met === "conteo" ? fCompacto(v) : fTasa(v) } },
        dataZoom: [{ type: "inside" }, { type: "slider", height: 16, bottom: mm ? 26 : 4, borderColor: "transparent" }],
        tooltip: {
          valueFormatter: (v: unknown) => v == null ? "no publicado"
            : met === "conteo" ? fEntero(v as number) : `${fTasa(v as number)} por 100 mil (tasa mensual)`,
        },
        series: seriesE,
      };
    }
    // anual
    const valores = anual.map(a => met === "conteo" ? a.v : tasaAnual(a.v, a.anio, p.pob, null));
    return {
      grid: { left: 8, right: 16, top: 26, bottom: 8, containLabel: true },
      xAxis: { type: "category", data: anual.map(a => a.meses < 12 ? `${a.anio}*` : String(a.anio)) },
      yAxis: { type: "value", axisLabel: { formatter: (v: number) => met === "conteo" ? fCompacto(v) : fTasa(v) } },
      tooltip: {
        valueFormatter: (v: unknown) => v == null ? "no publicado"
          : met === "conteo" ? fEntero(v as number) : `${fTasa(v as number)} por 100 mil`,
      },
      series: [{
        name: p.nombre, type: "bar", data: valores, barMaxWidth: 24,
        itemStyle: { color, borderRadius: [4, 4, 0, 0] },
        label: {
          show: true, position: "top", color: t.ink2, fontSize: 10.5,
          formatter: (d: { value: number | null }) => d.value == null ? "" :
            met === "conteo" ? fCompacto(d.value) : fTasa(d.value),
        },
      }],
    };
  }, [vista, met, mm12, puedeMM, serie, anual, color, p.nombre, p.pob, t]);

  const jer = p.sn.jerarquia[p.delitoId];
  const notaParcial = anual.some(a => a.meses < 12);

  const exportarCSV = () => {
    const filas = vista === "mensual"
      ? serie.map(s => [s.ym, s.v, met === "tasa" ? tasaMensual(s, p.pob, null)?.toFixed(2) ?? "" : ""])
      : anual.map(a => [String(a.anio), a.v, met === "tasa" ? tasaAnual(a.v, a.anio, p.pob, null)?.toFixed(2) ?? "" : "", a.meses]);
    descargarCSV(
      `${p.delitoId}_${vista}.csv`,
      vista === "mensual" ? ["mes", "cantidad", "tasa_100k_mensual"] : ["anio", "cantidad", "tasa_100k", "meses_publicados"],
      filas,
      {
        delito: p.nombre, universo: "nacional (fuente estatal)",
        periodo: `${p.desde} a ${p.hasta}`, unidad: p.sn.meta.unidad,
        fuente: p.fuenteTexto, corte: p.sn.meta.corte, version: String(p.sn.meta.version),
      },
    );
  };

  return (
    <section className="tarjeta panel-delito" aria-label={`Panel del delito ${p.nombre}`}>
      <div className="fila">
        <span className="punto" style={{ width: 10, height: 10, borderRadius: 999, background: color, display: "inline-block" }} aria-hidden="true" />
        <h3>{p.nombre}</h3>
        <span className="chip" title="Jerarquía del catálogo">{jer ? `${jer.bien} · ${jer.tipo}` : p.sn.metodologia}</span>
        <span className="sep" />
        <div className="seg" role="group" aria-label="Métrica">
          <button aria-pressed={met === "conteo"} onClick={() => setMet("conteo")}>Cantidad</button>
          <button aria-pressed={met === "tasa"} onClick={() => setMet("tasa")}>Tasa por 100 mil</button>
        </div>
        <div className="seg" role="group" aria-label="Vista temporal">
          <button aria-pressed={vista === "mensual"} onClick={() => setVista("mensual")}>Mensual</button>
          <button aria-pressed={vista === "anual"} onClick={() => setVista("anual")}>Anual</button>
        </div>
      </div>

      <dl className="panel-delito__kpis">
        <div className="kpi"><dt>Acumulado del periodo</dt>
          <dd>{fEntero(acum.suma)} <small>{p.etiquetaPeriodo}</small></dd></div>
        <div className="kpi"><dt>Participación en el total</dt>
          <dd>{fPct(p.participacion, false)} <small>del universo del ranking</small></dd></div>
        <div className="kpi"><dt>{ultimo ? `Cambio ${fAcumulado(ultimo.anio, ultimo.mes)} vs mismos meses ${ultimo.anio - 1}` : "Cambio comparable"}</dt>
          <dd>{comp ? fPct(comp.pct) : "no comparable"} <small>{comp ? `${comp.absoluta > 0 ? "+" : ""}${fEntero(comp.absoluta)} registros` : "periodo previo incompleto o de otro instrumento"}</small></dd></div>
        <div className="kpi"><dt>Último mes publicado</dt>
          <dd>{ultimo ? fMes(ultimo.ym) : "—"} <small>{ultimo ? fEntero(ultimo.v) + " registros" : ""}</small></dd></div>
      </dl>

      <Grafica opcion={opcion} alto={300}
        ariaLabel={`${p.nombre}: serie ${vista} de ${met === "conteo" ? "cantidad de delitos registrados" : "tasa por 100 mil habitantes"}, ${p.etiquetaPeriodo}. Los valores exactos están disponibles en la tabla.`} />

      <div className="fila" style={{ marginTop: 8 }}>
        {vista === "mensual" && (
          <label className="leyenda-item" title={puedeMM ? "Superpone la media móvil de 12 meses (solo ventanas completas)" : "Requiere al menos 12 meses completos y comparables"}>
            <input type="checkbox" checked={mm12 && puedeMM} disabled={!puedeMM}
              onChange={e => setMm12(e.target.checked)} /> Media móvil 12 m
          </label>
        )}
        {notaParcial && <span className="nota">* año con meses parciales publicados; se etiqueta, no se anualiza.</span>}
        <span className="sep" />
        <button className="boton" onClick={() => setVerComposicion(v => !v)}>
          {verComposicion ? "Ocultar composición" : "Categorías que lo integran"}
        </button>
        <button className="boton" onClick={() => tablaRef.current?.showModal()}>Ver tabla</button>
        <button className="boton" onClick={exportarCSV}>Descargar CSV</button>
      </div>

      {verComposicion && <Composicion sn={p.sn} delitoId={p.delitoId} color={color} desde={p.desde} hasta={p.hasta} />}

      <dialog ref={tablaRef} className="calculo" aria-label={`Tabla de datos de ${p.nombre}`}>
        <div className="calculo__head"><h3>{p.nombre} — datos</h3>
          <button className="boton" onClick={() => tablaRef.current?.close()}>Cerrar</button></div>
        <div className="calculo__cuerpo" style={{ maxHeight: "60vh", overflow: "auto" }}>
          <table className="datos">
            <thead><tr><th>Periodo</th><th className="num">Cantidad</th><th className="num">Tasa por 100 mil</th></tr></thead>
            <tbody>
              {(vista === "mensual" ? serie.map(s => ({ k: fMes(s.ym), v: s.v, t: tasaMensual(s, p.pob, null) }))
                : anual.map(a => ({ k: a.meses < 12 ? `${a.anio} (${a.meses} meses)` : String(a.anio), v: a.v, t: tasaAnual(a.v, a.anio, p.pob, null) })))
                .map(r => (
                  <tr key={r.k}><td>{r.k}</td>
                    <td className="num">{r.v == null ? "no publicado" : fEntero(r.v)}</td>
                    <td className="num">{r.t == null ? "n. d." : fTasa(r.t)}</td></tr>
                ))}
            </tbody>
          </table>
        </div>
      </dialog>
    </section>
  );
}

/** Composición por modalidades del delito (parte-a-todo, barras apiladas horizontales). */
function Composicion({ sn, delitoId, color, desde, hasta }:
  { sn: SeriesNacionales; delitoId: string; color: string; desde: string; hasta: string }) {
  const t = tokens();
  const hijos = useMemo(() => {
    const pref = `${delitoId}/`;
    return Object.keys(sn.series).filter(k => k.startsWith(pref));
  }, [sn, delitoId]);

  const datos = useMemo(() => hijos.map(h => {
    const s = recortar(serieMensual(sn, h), desde, hasta);
    return { id: h, nombre: h.slice(delitoId.length + 1), total: acumulado(s).suma };
  }).sort((a, b) => b.total - a.total), [hijos, sn, delitoId, desde, hasta]);

  if (!datos.length) return <p className="nota" style={{ marginTop: 8 }}>Este delito no tiene desagregación adicional en el instrumento.</p>;

  const total = datos.reduce((s, d) => s + d.total, 0) || 1;
  const opcion: EChartsCoreOption = {
    grid: { left: 8, right: 60, top: 6, bottom: 6, containLabel: true },
    xAxis: { type: "value", axisLabel: { formatter: (v: number) => fCompacto(v) } },
    yAxis: { type: "category", data: datos.map(d => d.nombre).reverse(), axisLabel: { width: 210, overflow: "truncate" } },
    tooltip: { trigger: "item", valueFormatter: (v: unknown) => fEntero(v as number) },
    series: [{
      type: "bar", data: datos.map(d => d.total).reverse(), barMaxWidth: 18,
      itemStyle: { color, borderRadius: [0, 4, 4, 0] },
      label: {
        show: true, position: "right", fontSize: 10.5, color: t.ink2,
        formatter: (d: { value: number }) => `${fCompacto(d.value)} · ${(d.value / total * 100).toFixed(1).replace(".", ",")} %`,
      },
    }],
  };
  return (
    <div style={{ marginTop: 10 }}>
      <p className="nota">Modalidades que integran la categoría en el periodo seleccionado (mismo nivel del instrumento; suman el total sin doble conteo).</p>
      <Grafica opcion={opcion} alto={Math.max(datos.length * 34 + 40, 120)}
        ariaLabel={`Composición por modalidades del delito, valores exactos en las etiquetas`} />
    </div>
  );
}
