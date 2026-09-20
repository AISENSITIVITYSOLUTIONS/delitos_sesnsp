import { colorDelito } from "./theme/paleta";
import Efectos3D from "./components/Efectos3D";
import TerritorioImpacto from "./components/TerritorioImpacto";
import AltoImpacto from "./components/AltoImpacto";
import Resumen from "./components/Resumen";
import { useEffect, useMemo, useState } from "react";
import Encabezado from "./components/Encabezado";
import TarjetaHallazgo from "./components/TarjetaHallazgo";
import PanelDelito from "./components/PanelDelito";
import RankingMunicipios from "./components/RankingMunicipios";
import Explorador from "./components/Explorador";
import Metodologia from "./components/Metodologia";
import { cargar } from "./lib/datos";
import { useEstado } from "./lib/estado";
import { useState as useStateReact } from "react";
import { fEntero } from "./lib/formato";



function SelectorPaneles({ ranking, sn, pob, desde, hasta, fuenteTexto }: {
  ranking: { etiqueta: string; delitos: Array<{ delito_id: string; nombre: string; cantidad: number; participacion: number }> };
  sn: SeriesNacionales; pob: PoblacionAnual; desde: string; hasta: string; fuenteTexto: string;
}) {
  const top5 = ranking.delitos.slice(0, 5);
  const [sel, setSel] = useStateReact(0);
  const d = top5[Math.min(sel, top5.length - 1)];
  const esResidual = (n: string) => /^otros\b/i.test(n);
  return (
    <>
      <div className="tabs-delitos" role="tablist" aria-label="Delitos de mayor incidencia">
        {top5.map((t, i) => (
          <button key={t.delito_id} role="tab" className="tab-delito"
            aria-selected={i === sel} onClick={() => setSel(i)}>
            <span className="punto" style={{ background: colorDelito(t.delito_id) }} aria-hidden="true" />
            <span>{i + 1}. {t.nombre}{esResidual(t.nombre) ? " ⁽ᴿ⁾" : ""}</span>
            <span className="nota" style={{ color: "inherit", opacity: 0.75 }}>{fEntero(t.cantidad)}</span>
          </button>
        ))}
      </div>
      {top5.some(t => esResidual(t.nombre)) && (
        <p className="nota" style={{ marginTop: 6 }}>⁽ᴿ⁾ Categoría residual del catálogo oficial: agrega conductas diversas y se conserva identificada como tal, sin desagregación adicional.</p>
      )}
      <PanelDelito key={d.delito_id} sn={sn} pob={pob}
        delitoId={d.delito_id} nombre={d.nombre} colorIdx={sel}
        participacion={d.participacion} etiquetaPeriodo={ranking.etiqueta}
        desde={desde} hasta={hasta} fuenteTexto={fuenteTexto} />
    </>
  );
}
import type {
  Manifiesto, Hallazgos, SeriesNacionales, PoblacionAnual,
  EstatalAnual, MunicipalAnual, RankingDelitos, RankingMunicipios as RM, Correspondencias,
} from "./lib/contratos";

interface Datos {
  manifiesto: Manifiesto;
  hallazgos: Hallazgos;
  nacionalNM: SeriesNacionales;
  nacionalNR: SeriesNacionales | null;
  pob: PoblacionAnual;
  estatal: EstatalAnual;
  municipal: MunicipalAnual;
  rankingDelitos: RankingDelitos;
  rankingMunicipios: RM;
  correspondencias: Correspondencias | null;
}

export default function App() {
  const [datos, setDatos] = useState<Datos | null>(null);
  const [error, setError] = useState<string | null>(null);
  const est = useEstado();

  useEffect(() => {
    (async () => {
      try {
        const manifiesto = await cargar<Manifiesto>("manifiesto.json");
        const [hallazgos, nacionalNM, pob, estatal, municipal, rankingDelitos, rankingMunicipios] =
          await Promise.all([
            cargar<Hallazgos>("hallazgos.json"),
            cargar<SeriesNacionales>("nacional_mensual_nm.json"),
            cargar<PoblacionAnual>("poblacion.json"),
            cargar<EstatalAnual>("estatal_anual.json"),
            cargar<MunicipalAnual>("municipal_anual.json"),
            cargar<RankingDelitos>("ranking_delitos.json"),
            cargar<RM>("ranking_municipios.json"),
          ]);
        let nacionalNR: SeriesNacionales | null = null;
        try { nacionalNR = await cargar<SeriesNacionales>("nacional_mensual_nr.json"); } catch { nacionalNR = null; }
        let correspondencias: Correspondencias | null = null;
        try { correspondencias = await cargar<Correspondencias>("correspondencias.json"); } catch { correspondencias = null; }
        setDatos({ manifiesto, hallazgos, nacionalNM, nacionalNR, pob, estatal, municipal, rankingDelitos, rankingMunicipios, correspondencias });
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
  }, []);

  const tramoSel = est.tramo;
  const sn = useMemo(() => {
    if (!datos) return null;
    if (tramoSel === "2026") return datos.nacionalNR;
    return datos.nacionalNM;
  }, [datos, tramoSel]);

  const periodoRanking = tramoSel === "2026" ? "2026" : tramoSel === "completo" ? "completo" : "2015-2025";
  const ranking = datos?.rankingDelitos.periodos[periodoRanking]
    ?? datos?.rankingDelitos.periodos["2015-2025"];

  const aniosVisibles = useMemo(() => {
    if (!datos) return [];
    const [d, h] = [est.desde.slice(0, 4), est.hasta.slice(0, 4)].map(Number);
    return datos.estatal.anios.filter(a => a >= d && a <= h);
  }, [datos, est.desde, est.hasta]);

  if (error) {
    return (
      <>
        <Encabezado manifiesto={null} />
        <main className="contenedor">
          <div className="tarjeta aviso-datos" role="status">
            <h2>Los datos oficiales aún no están disponibles en esta publicación</h2>
            <p>
              La interfaz está lista, pero los productos de datos no se han publicado todavía
              ({error}). Ninguna cifra se muestra porque este tablero no presenta datos de ejemplo
              como resultados. En cuanto el pipeline valide las bases del SESNSP, esta página se
              actualizará con el corte correspondiente.
            </p>
          </div>
        </main>
      </>
    );
  }

  if (!datos || !sn || !ranking) {
    return (
      <>
        <Encabezado manifiesto={datos?.manifiesto ?? null} />
        <main className="contenedor">
          <div className="tarjeta aviso-datos" role="status" aria-live="polite">
            <h2>Cargando datos oficiales…</h2>
            <p>Verificando manifiesto, series y cartografía.</p>
          </div>
        </main>
      </>
    );
  }

  const m = datos.manifiesto;
  const tramoEtiqueta = tramoSel === "2026"
    ? `enero–${m.cortes.tramo_2026} de 2026 (registro vigente desde 2026)`
    : tramoSel === "completo"
      ? "2015–2026, solo series homologadas"
      : "enero 2015 – diciembre 2025 (instrumento de 53 delitos)";

  return (
    <>
      <a className="visualmente-oculto" href="#contenido">Saltar al contenido</a>
      <Encabezado manifiesto={m} />
      <Efectos3D/>

      <div className="filtros no-imprimir" role="region" aria-label="Filtros globales">
        <div className="contenedor">
          <label htmlFor="tramo">Periodo y metodología</label>
          <select id="tramo" className="control" value={est.tramo}
            onChange={e => {
              const v = e.target.value as typeof est.tramo;
              est.set({
                tramo: v,
                desde: v === "2026" ? "2026-01" : "2015-01",
                hasta: v === "2026" ? m.cortes.tramo_2026 : v === "completo" ? m.cortes.tramo_2026 : "2025-12",
              });
            }}>
            <option value="2015-2025">2015–2025 · instrumento de 53 delitos</option>
            <option value="2026">2026 en adelante · registro nuevo</option>
            <option value="completo">Periodo completo · solo series homologadas</option>
          </select>
          <div className="seg" role="group" aria-label="Métrica global">
            <button aria-pressed={est.metrica === "conteo"} onClick={() => est.set({ metrica: "conteo" })}>Cantidad</button>
            <button aria-pressed={est.metrica === "tasa"} onClick={() => est.set({ metrica: "tasa" })}>Tasa /100 mil</button>
          </div>
          <span className="sep" />
          <span className="nota">{tramoEtiqueta}</span>
          <button className="boton" onClick={est.reiniciar}>Reiniciar filtros</button>
        </div>
      </div>

      <main id="contenido" className="contenedor">
        <AltoImpacto nm={datos.nacionalNM} nr={datos.nacionalNR} pob={datos.pob} />
        <TerritorioImpacto estatal={datos.estatal} sn={datos.nacionalNM} pob={datos.pob}/>
        <section className="seccion" id="hallazgos" aria-labelledby="t-hallazgos">
          <div className="seccion__head">
            <span className="seccion__num">01</span>
            <h2 id="t-hallazgos">Cinco hallazgos del periodo</h2>
          </div>
          <p className="seccion__desc">
            Seleccionados con reglas documentadas tras procesar los datos; cada tarjeta expone su cálculo,
            su periodo exacto y su fuente. Se recalculan con cada actualización.
          </p>
          <div className="hallazgos-grid">
            {datos.hallazgos.tarjetas.map(t => <TarjetaHallazgo key={t.id} t={t} />)}
          </div>
        </section>

        <Resumen sn={sn} estatal={datos.estatal} pob={datos.pob} ranking={ranking}
          municipios={datos.rankingMunicipios.periodos[periodoRanking]} completo={tramoSel === "completo"} />
        <section className="seccion detalle-seccion" id="delitos" aria-labelledby="t-delitos">
          <div className="seccion__head">
            <span className="seccion__num">02</span>
            <h2 id="t-delitos">Los cinco delitos de mayor incidencia</h2>
          </div>
          <p className="seccion__desc">
            Ranking calculado sobre categorías mutuamente excluyentes del mismo nivel del catálogo
            ({datos.rankingDelitos.criterio}). Los cinco delitos permanecen fijos durante la comparación temporal.
            Comparten denominador poblacional en un mismo periodo nacional, por lo que su orden por tasa
            coincide con el orden por volumen; la frecuencia no equivale a gravedad.
          </p>
          <p className="universo">Universo: nacional (fuente estatal) · {ranking.etiqueta}</p>
          <SelectorPaneles ranking={ranking} sn={sn} pob={datos.pob}
            desde={est.desde} hasta={est.hasta}
            fuenteTexto={m.fuentes.map(f => f.descripcion).join(" · ")} />
        </section>

        <section className="seccion" id="municipios" aria-labelledby="t-municipios">
          <div className="seccion__head">
            <span className="seccion__num">03</span>
            <h2 id="t-municipios">Municipios con mayor incidencia registrada</h2>
          </div>
          <p className="seccion__desc">
            Por defecto este módulo conserva «todos los delitos», aunque en otros paneles se explore un
            delito específico; los filtros que le aplican son el periodo y la metodología globales.
          </p>
          <RankingMunicipios
            ranking={datos.rankingMunicipios} municipal={datos.municipal} pob={datos.pob}
            periodoClave={periodoRanking}
            onVerMunicipio={(cve) => {
              est.set({ cveEnt: cve.slice(0, 2), cveMun: cve });
              document.getElementById("explorador")?.scrollIntoView({ behavior: "smooth" });
            }}
          />
        </section>

        <section className="seccion" id="explorador" aria-labelledby="t-explorador">
          <div className="seccion__head">
            <span className="seccion__num">04</span>
            <h2 id="t-explorador">Explorador territorial</h2>
          </div>
          <p className="seccion__desc">
            Cartografía oficial compatible con las claves del INEGI. Alterna entre conteos y tasas y entre
            la vista plana y la extrusión 3D; el cero reportado y la ausencia de información se distinguen
            visualmente. Los enlaces de esta página conservan tu selección.
          </p>
          <Explorador estatal={datos.estatal} municipal={datos.municipal} pob={datos.pob}
            aniosVisibles={aniosVisibles}
            etiquetaPeriodo={aniosVisibles.length ? `${aniosVisibles[0]}–${aniosVisibles.at(-1)}` : ""} />
        </section>

        <section className="seccion" id="metodologia" aria-labelledby="t-metodologia">
          <div className="seccion__head">
            <span className="seccion__num">05</span>
            <h2 id="t-metodologia">Metodología, fuentes y controles</h2>
          </div>
          <Metodologia manifiesto={m} correspondencias={datos.correspondencias} />
        </section>

        <footer className="pie">
          <div className="fila">
            <p>
              Elaborado con datos abiertos del SESNSP (incidencia delictiva del fuero común) y proyecciones
              de población oficiales. Versión de publicación {m.version} · generada {m.generado_utc.slice(0, 10)}.
            </p>
          </div>
          <p style={{ marginTop: 6 }}>
            La incidencia registrada no equivale a la delincuencia total ocurrida. Las comparaciones entre
            territorios y periodos respetan las restricciones metodológicas descritas en la sección 05.
          </p>
        </footer>
      </main>
    </>
  );
}
