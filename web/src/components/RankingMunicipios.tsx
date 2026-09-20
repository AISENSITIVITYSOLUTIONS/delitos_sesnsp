import { useMemo, useState } from "react";
import Grafica, { tokens } from "./Grafica";
import type { MunicipalAnual, PoblacionAnual, RankingMunicipios as RM } from "../lib/contratos";
import { fEntero, fPct, fTasa, fCompacto } from "../lib/formato";
import { descargarCSV } from "../lib/datos";
import type { EChartsCoreOption } from "echarts/core";

interface Props {
  ranking: RM;
  municipal: MunicipalAnual;
  pob: PoblacionAnual;
  periodoClave: string;
  onVerMunicipio: (cve: string) => void;
}

export default function RankingMunicipios({ ranking, municipal, periodoClave, onVerMunicipio }: Props) {
  const [modo, setModo] = useState<"volumen" | "tasa">("volumen");
  const [umbral, setUmbral] = useState<number>(20000);
  const [busqueda, setBusqueda] = useState("");
  const t = tokens();

  const periodo = ranking.periodos[periodoClave] ?? Object.values(ranking.periodos)[0];
  if (!periodo) return null;

  const top = modo === "volumen" ? periodo.por_volumen.slice(0, 5)
    : periodo.por_tasa.filter(m => m.poblacion >= umbral).slice(0, 5);

  const opcion = useMemo<EChartsCoreOption>(() => {
    const datos = [...top].reverse();
    return {
      grid: { left: 8, right: 96, top: 8, bottom: 8, containLabel: true },
      xAxis: {
        type: "value",
        axisLabel: { formatter: (v: number) => modo === "volumen" ? fCompacto(v) : fTasa(v) },
      },
      yAxis: {
        type: "category",
        data: datos.map(d => `${d.nombre} (${d.entidad})`),
        axisLabel: { width: 230, overflow: "truncate", color: t.ink2, fontSize: 12 },
      },
      tooltip: {
        trigger: "item",
        formatter: (par: { dataIndex: number }) => {
          const d = datos[par.dataIndex];
          if (modo === "volumen") {
            const dv = d as RM["periodos"][string]["por_volumen"][number];
            return `<strong>${dv.nombre}</strong>, ${dv.entidad}<br/>Clave: ${dv.cve}<br/>` +
              `Delitos registrados: <strong>${fEntero(dv.cantidad)}</strong><br/>` +
              `Participación nacional: ${fPct(dv.participacion_nacional, false)}<br/>` +
              `Tasa: ${dv.tasa_100k == null ? "n. d." : fTasa(dv.tasa_100k) + " por 100 mil"}`;
          }
          const dt = d as RM["periodos"][string]["por_tasa"][number];
          return `<strong>${dt.nombre}</strong>, ${dt.entidad}<br/>Clave: ${dt.cve}<br/>` +
            `Tasa: <strong>${fTasa(dt.tasa_100k)}</strong> por 100 mil<br/>` +
            `Registros: ${fEntero(dt.cantidad)} · Población: ${fEntero(dt.poblacion)}`;
        },
      },
      series: [{
        type: "bar",
        data: datos.map(d => modo === "volumen"
          ? (d as { cantidad: number }).cantidad
          : (d as { tasa_100k: number }).tasa_100k),
        barMaxWidth: 22,
        itemStyle: { color: t.series[0], borderRadius: [0, 4, 4, 0] },
        label: {
          show: true, position: "right", color: t.ink, fontWeight: 600, fontSize: 11.5,
          formatter: (d: { value: number }) => modo === "volumen" ? fEntero(d.value) : fTasa(d.value),
        },
      }],
    };
  }, [top, modo, t]);

  const idxUltimo = municipal.anios.length - 1;
  const filasTabla = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return municipal.municipios
      .map(m => ({
        cve: m.cve, nombre: m.nombre, entidad: m.entidad,
        total: m.total.reduce((s: number, v) => s + (v ?? 0), 0),
        ultimo: m.total[idxUltimo],
      }))
      .filter(m => !q || m.nombre.toLowerCase().includes(q) || m.entidad.toLowerCase().includes(q) || m.cve.includes(q))
      .sort((a, b) => b.total - a.total || a.cve.localeCompare(b.cve))
      .slice(0, 60);
  }, [municipal, busqueda, idxUltimo]);

  const exportar = () => {
    const lista = modo === "volumen" ? periodo.por_volumen : periodo.por_tasa;
    descargarCSV(`ranking_municipal_${modo}.csv`,
      modo === "volumen"
        ? ["clave", "municipio", "entidad", "delitos", "participacion_nacional_pct", "tasa_100k"]
        : ["clave", "municipio", "entidad", "tasa_100k", "delitos", "poblacion"],
      lista.map(d => modo === "volumen"
        ? [d.cve, d.nombre, d.entidad, (d as { cantidad: number }).cantidad,
           (d as { participacion_nacional: number }).participacion_nacional.toFixed(3),
           (d as { tasa_100k: number | null }).tasa_100k?.toFixed(1) ?? ""]
        : [d.cve, d.nombre, d.entidad, (d as { tasa_100k: number }).tasa_100k.toFixed(1),
           (d as { cantidad: number }).cantidad, (d as { poblacion: number }).poblacion]),
      {
        universo: "todos los delitos del fuero común, sin doble conteo",
        periodo: periodo.etiqueta, criterio: modo,
        umbral_poblacion: modo === "tasa" ? String(umbral) : "no aplica",
        regla_empates: ranking.regla_empates,
        fuente: ranking.meta.fuente, corte: ranking.meta.corte, version: String(ranking.meta.version),
      });
  };

  return (
    <div className="ranking-layout">
      <div className="tarjeta" style={{ padding: 18 }}>
        <div className="fila">
          <h3>{modo === "volumen" ? "Cinco municipios con más delitos registrados" : "Cinco municipios con mayor tasa"}</h3>
          <span className="sep" />
          <div className="seg" role="group" aria-label="Criterio de ordenamiento">
            <button aria-pressed={modo === "volumen"} onClick={() => setModo("volumen")}>Por volumen</button>
            <button aria-pressed={modo === "tasa"} onClick={() => setModo("tasa")}>Por tasa</button>
          </div>
        </div>
        <p className="universo">
          Universo: todos los delitos del fuero común · {periodo.etiqueta} · incidencia registrada
          {modo === "tasa" && <> · municipios con ≥ <strong>{fEntero(umbral)}</strong> habitantes</>}
        </p>
        {modo === "tasa" && (
          <div className="fila" style={{ margin: "8px 0 0" }}>
            <label htmlFor="umbral">Umbral de población (tasas municipales inestables por debajo):</label>
            <select id="umbral" className="control" value={umbral} onChange={e => setUmbral(+e.target.value)}>
              <option value={0}>Sin umbral</option>
              <option value={10000}>10 000</option>
              <option value={20000}>20 000</option>
              <option value={50000}>50 000</option>
              <option value={100000}>100 000</option>
            </select>
            <span className="nota">
              excluye {fEntero(periodo.por_tasa.filter(m => m.poblacion < umbral).length)} municipios
            </span>
          </div>
        )}
        <Grafica opcion={opcion} alto={252}
          ariaLabel={`Cinco municipios con mayor ${modo === "volumen" ? "número de delitos registrados" : "tasa por 100 mil habitantes"}; valores exactos en las etiquetas y en la tabla`} />
        <div className="fila">
          <p className="nota" style={{ maxWidth: 560 }}>
            Este ranking mide <strong>incidencia registrada</strong> ante fiscalías, no la violencia total ocurrida:
            la denuncia, la calidad del registro, la población flotante y la cobertura varían entre territorios.
            Los registros sin municipio identificado se conservan en los controles de conciliación y no compiten aquí.
          </p>
          <span className="sep" />
          <button className="boton" onClick={() => onVerMunicipio(top[0]?.cve ?? "")}>Ver composición</button>
          <button className="boton" onClick={exportar}>Descargar CSV</button>
        </div>
      </div>

      <div className="tarjeta" style={{ padding: 18 }}>
        <div className="fila">
          <h3>Tabla nacional</h3>
          <span className="sep" />
          <div className="buscador">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
            <input className="control" placeholder="Buscar municipio, entidad o clave…"
              value={busqueda} onChange={e => setBusqueda(e.target.value)}
              aria-label="Buscar municipio" />
          </div>
        </div>
        <p className="nota" style={{ marginTop: 4 }}>
          Acumulado {municipal.anios[0]}–{municipal.anios[idxUltimo]} y último año publicado. Empates: {ranking.regla_empates}
        </p>
        <div style={{ maxHeight: 330, overflow: "auto", marginTop: 8 }}>
          <table className="datos">
            <thead><tr><th>Clave</th><th>Municipio</th><th>Entidad</th>
              <th className="num">Acumulado</th><th className="num">Último año</th></tr></thead>
            <tbody>
              {filasTabla.map(m => (
                <tr key={m.cve} style={{ cursor: "pointer" }} onClick={() => onVerMunicipio(m.cve)}
                  title="Ver en el explorador territorial">
                  <td style={{ fontFamily: "var(--mono)", fontSize: 12 }}>{m.cve}</td>
                  <td><button className="boton municipio-enlace" onClick={e=>{e.stopPropagation();onVerMunicipio(m.cve);}} aria-label={`Explorar ${m.nombre}`}>{m.nombre}</button></td><td>{m.entidad}</td>
                  <td className="num">{fEntero(m.total)}</td>
                  <td className="num">{m.ultimo == null ? "no publicado" : fEntero(m.ultimo)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="nota" style={{ marginTop: 6 }}>Se muestran los 60 primeros resultados; el CSV completo está disponible en Metodología y descargas.</p>
      </div>
    </div>
  );
}
