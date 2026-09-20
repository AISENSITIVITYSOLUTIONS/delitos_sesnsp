import { useEffect, useMemo, useState } from "react";
import MapaMx, { soportaWebGL, type ValorTerritorio } from "./MapaMx";
import Grafica, { tokens } from "./Grafica";
import type { EstatalAnual, MunicipalAnual, PoblacionAnual } from "../lib/contratos";
import type { GeoColeccion, Territorio } from "../lib/geo";
import { cargar, descargarCSV } from "../lib/datos";
import { useEstado } from "../lib/estado";
import { fEntero, fTasa, fPct } from "../lib/formato";
import type { EChartsCoreOption } from "echarts/core";

interface Props {
  estatal: EstatalAnual;
  municipal: MunicipalAnual;
  pob: PoblacionAnual;
  aniosVisibles: number[];   // según el periodo global seleccionado
  etiquetaPeriodo: string;
}

interface BienAnual { anios: number[]; bienes: string[]; datos: Record<string, Record<string, (number | null)[]>> }

/** Composición delictiva del municipio seleccionado, por bien jurídico. */
function ComposicionMunicipio({ cveMun, municipal, aniosVisibles, etiquetaPeriodo }: {
  cveMun: string; municipal: MunicipalAnual; aniosVisibles: number[]; etiquetaPeriodo: string;
}) {
  const [bien, setBien] = useState<BienAnual | null>(null);
  const t = tokens();
  useEffect(() => { cargar<BienAnual>("municipal_bien_anual.json").then(setBien).catch(() => setBien(null)); }, []);
  const mun = municipal.municipios.find(m => m.cve === cveMun);
  if (!mun) return null;
  if (!bien) return <p className="nota" style={{ marginTop: 12 }}>Cargando composición…</p>;

  const d = bien.datos[cveMun] ?? {};
  const filas = bien.bienes.map((nombre, i) => {
    const arr = d[String(i)] ?? [];
    let s = 0;
    for (const a of aniosVisibles) {
      const v = arr[bien.anios.indexOf(a)];
      if (v != null) s += v;
    }
    return { nombre, v: s };
  }).filter(f => f.v > 0).sort((a, b) => b.v - a.v);
  const total = filas.reduce((s, f) => s + f.v, 0) || 1;

  const opcion: EChartsCoreOption = {
    grid: { left: 8, right: 92, top: 6, bottom: 6, containLabel: true },
    xAxis: { type: "value", axisLabel: { formatter: (v: number) => fEntero(v) } },
    yAxis: { type: "category", data: filas.map(f => f.nombre).reverse(), axisLabel: { width: 250, overflow: "truncate", fontSize: 11.5 } },
    tooltip: { trigger: "item", valueFormatter: (v: unknown) => fEntero(v as number) },
    series: [{
      type: "bar", data: filas.map(f => f.v).reverse(), barMaxWidth: 16,
      itemStyle: { color: t.series[0], borderRadius: [0, 4, 4, 0] },
      label: {
        show: true, position: "right", fontSize: 10.5, color: t.ink2,
        formatter: (p: { value: number }) => `${fEntero(p.value)} · ${(p.value / total * 100).toFixed(1).replace(".", ",")} %`,
      },
    }],
  };
  return (
    <div className="tarjeta" style={{ padding: 18, marginTop: 16 }}>
      <div className="fila">
        <h3>Composición delictiva: {mun.nombre}, {mun.entidad}</h3>
        <span className="chip" style={{ fontFamily: "var(--mono)" }}>{cveMun}</span>
        <span className="universo">por bien jurídico afectado · {etiquetaPeriodo} · todos los delitos</span>
      </div>
      <Grafica opcion={opcion} alto={Math.max(filas.length * 32 + 40, 120)}
        ariaLabel={`Composición delictiva de ${mun.nombre} por bien jurídico; valores exactos en las etiquetas`} />
      <p className="nota">Los bienes jurídicos agregan los subtipos del catálogo vigente en cada tramo; los totales coinciden con el conteo municipal del periodo.</p>
    </div>
  );
}

export default function Explorador({ estatal, municipal, pob, aniosVisibles, etiquetaPeriodo }: Props) {
  const { metrica, cveEnt, cveMun, vistaMapa, comparacion, set } = useEstado();
  const [geoEdos, setGeoEdos] = useState<Territorio[] | null>(null);
  const [geoMun, setGeoMun] = useState<Territorio[] | null>(null);
  const t = tokens();

  useEffect(() => {
    cargar<GeoColeccion>("geo/estados.json").then(g => setGeoEdos(g.territorios)).catch(() => setGeoEdos([]));
    // El 3D es la vista de arranque cuando el dispositivo lo soporta y el
    // enlace no trae una preferencia explícita; el cambio a 2D es inmediato.
    if (soportaWebGL && !window.location.hash.includes("v=") &&
        !matchMedia("(prefers-reduced-motion: reduce)").matches) {
      set({ vistaMapa: "3d" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!cveEnt) { setGeoMun(null); return; }
    setGeoMun(null);
    cargar<GeoColeccion>(`geo/municipios_${cveEnt}.json`)
      .then(g => setGeoMun(g.territorios)).catch(() => setGeoMun([]));
  }, [cveEnt]);

  const idxAnios = useMemo(() =>
    estatal.anios.map((a, i) => aniosVisibles.includes(a) ? i : -1).filter(i => i >= 0),
    [estatal.anios, aniosVisibles]);

  const sumaPeriodo = (porAnio: (number | null)[] | undefined): { v: number | null } => {
    if (!porAnio) return { v: null };
    let s = 0, hay = false;
    for (const i of idxAnios) { const x = porAnio[i]; if (x != null) { s += x; hay = true; } }
    return { v: hay ? s : null };
  };

  /** Población media del periodo para tasas de periodo (exposición anual media). */
  const tasaDe = (suma: number | null, cve: string, esMun: boolean): number | null => {
    if (suma == null) return null;
    let exp = 0;
    for (const a of aniosVisibles) {
      const base = esMun ? pob.municipal?.[cve]?.[String(a)] : pob.estatal[cve]?.[String(a)];
      if (base) exp += base;
    }
    return exp > 0 ? suma / exp * 100_000 : null;
  };

  const valoresEdos = useMemo<Record<string, ValorTerritorio>>(() => {
    const out: Record<string, ValorTerritorio> = {};
    for (const cve of Object.keys(estatal.entidades)) {
      const { v } = sumaPeriodo(estatal.total[cve]);
      const val = metrica === "conteo" ? v : tasaDe(v, cve, false);
      out[cve] = { v: val, etiqueta: etiquetaPeriodo };
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estatal, metrica, idxAnios, etiquetaPeriodo]);

  const valoresMun = useMemo<Record<string, ValorTerritorio>>(() => {
    if (!cveEnt) return {};
    const out: Record<string, ValorTerritorio> = {};
    for (const m of municipal.municipios) {
      if (m.cve_ent !== cveEnt) continue;
      const idx = municipal.anios.map((a, i) => aniosVisibles.includes(a) ? i : -1).filter(i => i >= 0);
      let s = 0, hay = false;
      for (const i of idx) { const x = m.total[i]; if (x != null) { s += x; hay = true; } }
      const v = hay ? s : null;
      out[m.cve] = { v: metrica === "conteo" ? v : tasaDe(v, m.cve, true), etiqueta: etiquetaPeriodo };
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [municipal, cveEnt, metrica, aniosVisibles, etiquetaPeriodo]);

  const nivelMunicipal = !!cveEnt && geoMun !== null;
  const territorios = nivelMunicipal ? (geoMun ?? []) : (geoEdos ?? []);
  const valores = nivelMunicipal ? valoresMun : valoresEdos;
  const tituloUniverso = nivelMunicipal
    ? `Municipios de ${estatal.entidades[cveEnt!] ?? cveEnt} · todos los delitos · ${etiquetaPeriodo}`
    : `Entidades federativas · todos los delitos · ${etiquetaPeriodo}`;

  const alternarComparacion = (cve: string) => {
    const ya = comparacion.includes(cve);
    if (ya) set({ comparacion: comparacion.filter(c => c !== cve) });
    else if (comparacion.length < 5) set({ comparacion: [...comparacion, cve] });
  };

  const opcionComparacion = useMemo<EChartsCoreOption | null>(() => {
    if (!comparacion.length) return null;
    const nombres: string[] = [];
    const series = comparacion.map((cve, i) => {
      const esMun = cve.length === 5;
      const nombre = esMun
        ? municipal.municipios.find(m => m.cve === cve)?.nombre ?? cve
        : estatal.entidades[cve] ?? cve;
      nombres.push(nombre);
      const datos = aniosVisibles.map(a => {
        if (esMun) {
          const m = municipal.municipios.find(x => x.cve === cve);
          const idx = municipal.anios.indexOf(a);
          const v = idx >= 0 ? m?.total[idx] ?? null : null;
          if (metrica === "conteo") return v;
          const base = pob.municipal?.[cve]?.[String(a)];
          return v != null && base ? v / base * 100_000 : null;
        }
        const idx = estatal.anios.indexOf(a);
        const v = idx >= 0 ? estatal.total[cve]?.[idx] ?? null : null;
        if (metrica === "conteo") return v;
        const base = pob.estatal[cve]?.[String(a)];
        return v != null && base ? v / base * 100_000 : null;
      });
      return {
        name: nombre, type: "line" as const, data: datos, showSymbol: false,
        lineStyle: { width: 2, color: t.series[i] }, itemStyle: { color: t.series[i] },
        connectNulls: false,
        endLabel: comparacion.length <= 4 ? {
          show: true, formatter: nombre.length > 14 ? `${nombre.slice(0, 13)}…` : nombre,
          color: t.ink2, fontSize: 11, distance: 6,
        } : undefined,
        labelLayout: { moveOverlap: "shiftY" as const },
      };
    });
    return {
      legend: { bottom: 0, icon: "rect", itemWidth: 12, itemHeight: 3, textStyle: { color: t.ink2, fontSize: 12 } },
      grid: { left: 8, right: comparacion.length <= 4 ? 96 : 20, top: 16, bottom: 44, containLabel: true },
      xAxis: { type: "category", data: aniosVisibles.map(String) },
      yAxis: { type: "value", axisLabel: { formatter: (v: number) => metrica === "conteo" ? fEntero(v) : fTasa(v) } },
      tooltip: { valueFormatter: (v: unknown) => v == null ? "n. d." : metrica === "conteo" ? fEntero(v as number) : `${fTasa(v as number)} /100 mil` },
      series,
    };
  }, [comparacion, aniosVisibles, metrica, estatal, municipal, pob, t]);

  const filasTabla = useMemo(() => territorios
    .map(te => ({ cve: te.cve, nombre: te.nombre, v: valores[te.cve]?.v ?? null }))
    .sort((a, b) => (b.v ?? -1) - (a.v ?? -1)), [territorios, valores]);

  const totalNivel = filasTabla.reduce((s, f) => s + (f.v ?? 0), 0);

  return (
    <div>
      <div className="fila" style={{ marginTop: 14 }}>
        {cveEnt && (
          <button className="boton" onClick={() => set({ cveEnt: null, cveMun: null })}>
            ← República Mexicana
          </button>
        )}
        <span className="universo">{tituloUniverso}</span>
        <span className="sep" />
        <span className="nota">clic en un territorio: entrar / seleccionar · «Comparar»: hasta 5 territorios</span>
      </div>

      <div className="explorador-layout">
        <MapaMx
          territorios={territorios}
          valores={valores}
          metrica={metrica}
          titulo={tituloUniverso}
          modo={vistaMapa}
          onModo={(m) => set({ vistaMapa: m })}
          seleccionado={cveMun}
          onSeleccion={(cve) => {
            if (!nivelMunicipal) set({ cveEnt: cve, cveMun: null });
            else set({ cveMun: cve === cveMun ? null : cve });
          }}
        />

        <div className="tarjeta" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
          <div className="fila">
            <h3>{nivelMunicipal ? "Municipios" : "Entidades"} del periodo</h3>
            <span className="sep" />
            <button className="boton" onClick={() => descargarCSV(
              `explorador_${nivelMunicipal ? "municipios_" + cveEnt : "entidades"}.csv`,
              ["clave", "territorio", metrica === "conteo" ? "delitos" : "tasa_100k", "participacion_pct"],
              filasTabla.map(f => [f.cve, f.nombre, f.v ?? "", f.v != null && totalNivel > 0 ? (f.v / totalNivel * 100).toFixed(2) : ""]),
              { universo: tituloUniverso, metrica, fuente: "SESNSP; población CONAPO", nota: "cero = cero reportado; vacío = sin información" },
            )}>CSV</button>
          </div>
          <div style={{ maxHeight: 430, overflow: "auto" }}>
            <table className="datos">
              <thead><tr><th>Territorio</th>
                <th className="num">{metrica === "conteo" ? "Delitos" : "Tasa /100 mil"}</th>
                {metrica === "conteo" && <th className="num">Part.</th>}
                <th className="no-imprimir" aria-label="Comparar" />
              </tr></thead>
              <tbody>
                {filasTabla.map(f => (
                  <tr key={f.cve}>
                    <td>{f.nombre}</td>
                    <td className="num">{f.v == null ? "sin información" : metrica === "conteo" ? fEntero(f.v) : fTasa(f.v)}</td>
                    {metrica === "conteo" && <td className="num nota">{f.v != null && totalNivel > 0 ? fPct(f.v / totalNivel * 100, false) : "—"}</td>}
                    <td className="no-imprimir">
                      <button className="ver-calculo" onClick={() => alternarComparacion(f.cve)}
                        aria-pressed={comparacion.includes(f.cve)}
                        disabled={!comparacion.includes(f.cve) && comparacion.length >= 5}>
                        {comparacion.includes(f.cve) ? "Quitar" : "Comparar"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {cveMun && <ComposicionMunicipio cveMun={cveMun} municipal={municipal}
        aniosVisibles={aniosVisibles} etiquetaPeriodo={etiquetaPeriodo} />}

      {opcionComparacion && (
        <div className="tarjeta" style={{ padding: 18, marginTop: 16 }}>
          <div className="fila">
            <h3>Comparación de territorios ({comparacion.length}/5)</h3>
            <span className="nota">series anuales · {metrica === "conteo" ? "cantidad" : "tasa por 100 mil (población del territorio y año)"}</span>
            <span className="sep" />
            <button className="boton" onClick={() => set({ comparacion: [] })}>Limpiar</button>
          </div>
          <Grafica opcion={opcionComparacion} alto={300}
            ariaLabel={`Comparación anual de ${comparacion.length} territorios; valores exactos disponibles al pasar el cursor y en las tablas del explorador`} />
          {metrica === "conteo" && <p className="nota">Al comparar territorios de tamaños distintos, considera la vista de tasas; las poblaciones provienen de las proyecciones oficiales y son compatibles entre territorios.</p>}
        </div>
      )}
    </div>
  );
}
