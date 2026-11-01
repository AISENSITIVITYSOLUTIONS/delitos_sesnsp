import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { EstatalAnual, PoblacionAnual, SeriesNacionales } from "../lib/contratos";
import { Motor, type Etiqueta, type Pieza } from "../iso/motor";
import { construirMapa, construirTorres, type Torre } from "../iso/vistas";
import {
  TODOS, aniosCompletos, anualNacional, cambioPct, delitosEstatales, matrizMensual,
  posiciones, serieEntidad, valoresEstatales, alturas,
} from "../iso/datos";
import { cargar } from "../lib/datos";
import { useEstado } from "../lib/estado";
import { SECUENCIAL, colorDelito } from "../theme/paleta";
import { clase, cortesCuantiles, type GeoColeccion, type Territorio } from "../lib/geo";
import { fCompacto, fEntero, fPct, fTasa } from "../lib/formato";
import "../iso/iso.css";

type Vista = "territorio" | "delitos" | "tiempo" | "victimas";
interface RankingPeriodo { etiqueta: string; delitos: Array<{ delito_id: string; nombre: string; cantidad: number; participacion: number }> }
interface VictimaDelito {
  id: string; nombre: string; total: number; mujer: number; hombre: number; no_identificado: number;
  pct_mujer: number | null; pct_hombre: number | null; pct_menores: number | null;
}
interface DatosVictimas { meta: { fuente: string; anios: string[] }; delitos: VictimaDelito[] }

const VISTAS: Array<{ id: Vista; nombre: string }> = [
  { id: "victimas", nombre: "Víctimas" },
  { id: "delitos", nombre: "Diez delitos" },
  { id: "tiempo", nombre: "Tiempo" },
  { id: "territorio", nombre: "Territorio" },
];
const MESES = ["E", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
const MESES_LARGOS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const CURADOS = ["feminicidio", "rapto", "trata-de-personas", "corrupcion-de-menores", "lesiones-dolosas",
  "extorsion", "lesiones-culposas", "secuestro", "homicidio-culposo", "homicidio-doloso"];

const oscuro = () => document.documentElement.getAttribute("data-theme") !== "light";
const colorVar = (n: string, r: string) => {
  const v = getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  return /^#[0-9a-f]{3,8}$/i.test(v) ? v : r;
};
const corto = (s: string, n = 24) => s.length > n ? s.slice(0, n - 1) + "…" : s;

interface Props { estatal: EstatalAnual; pob: PoblacionAnual; sn: SeriesNacionales; ranking: RankingPeriodo }

export default function Isometrico({ estatal, pob, sn, ranking }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const capaRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const barraRef = useRef<HTMLDivElement>(null);
  const motorRef = useRef<Motor | null>(null);
  const piezasRef = useRef<Map<string, Pieza>>(new Map());
  const [fallo, setFallo] = useState(false);
  const [vista, setVista] = useState<Vista>("victimas");
  const [delito, setDelito] = useState<string>(TODOS);
  const anios = useMemo(() => aniosCompletos(estatal), [estatal]);
  const [anio, setAnio] = useState<number>(() => anios[anios.length - 1]);
  const [reproduciendo, setReproduciendo] = useState(false);
  const [sel, setSel] = useState<string | null>(null);
  const [hov, setHov] = useState<{ id: string; x: number; y: number } | null>(null);
  const [geo, setGeo] = useState<Territorio[] | null>(null);
  const [vic, setVic] = useState<DatosVictimas | null>(null);
  const [version, setVersion] = useState(0);
  const metrica = useEstado(s => s.metrica);
  const setGlobal = useEstado(s => s.set);

  useEffect(() => {
    cargar<GeoColeccion>("geo/estados.json").then(g => setGeo(g.territorios)).catch(() => setGeo([]));
    cargar<DatosVictimas>("victimas.json").then(setVic).catch(() => setVic(null));
  }, []);

  // Motor: una sola instancia durante la vida del componente.
  useEffect(() => {
    const host = hostRef.current, capa = capaRef.current;
    if (!host || !capa) return;
    let m: Motor;
    try {
      m = new Motor(host, capa, {
        onHover: (p, x, y) => setHov(p ? { id: p.id, x, y } : null),
        onClick: p => setSel(p ? p.id : null),
        obstaculos: () => {
          const base = host.getBoundingClientRect();
          return [panelRef.current, barraRef.current].filter((e): e is HTMLElement => !!e).map(e => {
            const r = e.getBoundingClientRect();
            return [r.left - base.left, r.top - base.top, r.right - base.left, r.bottom - base.top] as [number, number, number, number];
          });
        },
      });
    } catch { setFallo(true); return; }
    motorRef.current = m;
    return () => { m.dispose(); motorRef.current = null; };
  }, []);

  /* ---------- Datos derivados ---------- */
  const nombreDelito = (id: string) => id === TODOS ? "Todos los delitos" : sn.jerarquia[id]?.subtipo ?? ranking.delitos.find(d => d.delito_id === id)?.nombre ?? id;
  const opcionesTerritorio = useMemo(() => [TODOS, ...delitosEstatales(estatal)], [estatal]);
  const opcionesTiempo = useMemo(() => {
    const ids = [TODOS, ...ranking.delitos.slice(0, 10).map(d => d.delito_id), ...delitosEstatales(estatal)];
    return [...new Set(ids)].filter(id => id === TODOS || sn.series[id]);
  }, [ranking, estatal, sn]);
  const delitoTerritorio = opcionesTerritorio.includes(delito) ? delito : TODOS;
  const delitoTiempo = opcionesTiempo.includes(delito) ? delito : TODOS;

  const valores = useMemo(() => valoresEstatales(estatal, pob, delitoTerritorio, anio, metrica), [estatal, pob, delitoTerritorio, anio, metrica]);
  const rangos = useMemo(() => posiciones(valores), [valores]);
  const rampa = SECUENCIAL[oscuro() ? "dark" : "light"];
  const cortesMapa = useMemo(() => cortesCuantiles(Object.values(valores).filter((v): v is number => v != null && v > 0), 7), [valores]);

  const top10 = ranking.delitos.slice(0, 10);
  const matriz = useMemo(() => matrizMensual(sn, delitoTiempo), [sn, delitoTiempo]);
  const anualTiempo = useMemo(() => anualNacional(sn, delitoTiempo), [sn, delitoTiempo]);
  const victimas = useMemo(() => {
    if (!vic) return [];
    const ix = new Set(CURADOS);
    return vic.delitos.filter(d => ix.has(d.id) && d.total > 0 && d.pct_mujer != null)
      .sort((a, b) => (b.pct_mujer ?? 0) - (a.pct_mujer ?? 0));
  }, [vic]);

  const fmtValor = (v: number | null) => v == null ? "sin dato" : metrica === "tasa" ? `${fTasa(v)} por 100 mil` : `${fEntero(v)} delitos`;

  /* ---------- Construcción de escenas ---------- */
  // Clave de escena: el mapa no se reconstruye al cambiar delito/año (solo anima); el tiempo sí.
  const claveEscena = vista === "tiempo" ? `tiempo:${delitoTiempo}` : vista;
  useEffect(() => {
    const m = motorRef.current;
    if (!m) return;
    setSel(null); setHov(null);
    let hecho: ReturnType<typeof construirTorres> | null = null;

    if (vista === "territorio") {
      if (!geo || !geo.length) return;
      hecho = construirMapa(geo, 100);
    } else if (vista === "delitos") {
      const max = Math.max(...top10.map(d => d.cantidad), 1);
      const torres: Torre[] = top10.map((d, i) => ({
        id: d.delito_id, x: (i - (top10.length - 1) / 2) * 8.2, z: 0,
        altura: Math.max(0.6, d.cantidad / max * 30), retardo: i * 0.07,
        segmentos: [{ frac: 1, color: colorDelito(d.delito_id) }],
      }));
      hecho = construirTorres(torres, 5.2, 48, new THREE.Vector3(0, 13, 0));
      const ets: Etiqueta[] = top10.map((d, i) => ({
        id: d.delito_id, pieza: hecho!.piezas.get(d.delito_id), offset: 1.2, clase: "iso-et--torre",
        lineas: [{ texto: `#${i + 1}`, clase: "iso-et__rango" }, { texto: corto(d.nombre, 22) }, { texto: fCompacto(d.cantidad), clase: "iso-et__cifra" }],
      }));
      hecho.contenido.etiquetas = ets;
    } else if (vista === "tiempo") {
      const vals = matriz.filas.flat().filter((v): v is number => v != null);
      const max = Math.max(...vals, 1);
      const cortes = cortesCuantiles(vals, 7);
      const paso = 3.1, nA = matriz.anios.length;
      const torres: Torre[] = [];
      matriz.anios.forEach((a, r) => matriz.filas[r].forEach((v, c) => torres.push({
        id: `${a}-${c}`, x: (c - 5.5) * paso, z: (r - (nA - 1) / 2) * paso,
        altura: v == null ? 0.12 : Math.max(0.25, v / max * 17), retardo: (r + c) * 0.028,
        segmentos: [{ frac: 1, color: v == null ? "#3a4656" : rampa[Math.min(clase(v, cortes), rampa.length - 1)] }],
      })));
      hecho = construirTorres(torres, 2.5, 26, new THREE.Vector3(0, 5, 0));
      const ets: Etiqueta[] = [];
      matriz.anios.forEach((a, r) => ets.push({
        id: `a-${a}`, fija: new THREE.Vector3(6.6 * paso, 0, (r - (nA - 1) / 2) * paso), clase: "iso-et--eje",
        lineas: [{ texto: String(a) }],
      }));
      MESES.forEach((mes, c) => ets.push({
        id: `m-${c}`, fija: new THREE.Vector3((c - 5.5) * paso, 0, ((nA - 1) / 2 + 1.2) * paso), clase: "iso-et--eje",
        lineas: [{ texto: mes }],
      }));
      let mejor: { r: number; c: number; v: number } | null = null;
      matriz.filas.forEach((f, r) => f.forEach((v, c) => { if (v != null && (!mejor || v > mejor.v)) mejor = { r, c, v }; }));
      if (mejor) {
        const b = mejor as { r: number; c: number; v: number };
        ets.push({
          id: "max", pieza: hecho.piezas.get(`${matriz.anios[b.r]}-${b.c}`), offset: 1.4, clase: "iso-et--max",
          lineas: [{ texto: "Máximo", clase: "iso-et__rango" }, { texto: `${MESES_LARGOS[b.c]} ${matriz.anios[b.r]}` }, { texto: fEntero(b.v), clase: "iso-et__cifra" }],
        });
      }
      hecho.contenido.etiquetas = ets;
    } else if (vista === "victimas") {
      if (!victimas.length) return;
      const cM = colorVar("--vz-muj", "#e488b4"), cH = colorVar("--vz-hom", "#78b0e6"), cN = colorVar("--vz-ni", "#6d7d90");
      const torres: Torre[] = victimas.map((d, i) => {
        const pm = (d.pct_mujer ?? 0) / 100, ph = (d.pct_hombre ?? 0) / 100;
        return {
          id: d.id, x: (i - (victimas.length - 1) / 2) * 7.6, z: 0, altura: 20, retardo: i * 0.07,
          segmentos: [{ frac: pm, color: cM }, { frac: ph, color: cH }, { frac: Math.max(0, 1 - pm - ph), color: cN }],
        };
      });
      hecho = construirTorres(torres, 4.8, 42, new THREE.Vector3(0, 8, 0));
      hecho.contenido.etiquetas = victimas.map(d => ({
        id: d.id, pieza: hecho!.piezas.get(d.id), offset: 1.2, clase: "iso-et--torre",
        lineas: [{ texto: corto(d.nombre, 20) }, { texto: `${(d.pct_mujer ?? 0).toFixed(1)} % mujeres`, clase: "iso-et__cifra" }],
      }));
    }
    if (!hecho) return;
    if (vista === "territorio" && (hostRef.current?.clientWidth ?? 0) < 760) hecho.contenido.centro.set(6, 3, -6);
    piezasRef.current = hecho.piezas;
    m.setContenido(hecho.contenido, true);
    setVersion(v => v + 1);
    // Reconstruye al cambiar de vista o de serie; el mapa se actualiza aparte.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claveEscena, geo, victimas, ranking]);

  // Mapa: alturas, colores y etiquetas de las tres entidades mayores.
  useEffect(() => {
    const m = motorRef.current;
    if (!m || vista !== "territorio" || !version) return;
    const h = alturas(valores, 22);
    for (const [cve, p] of piezasRef.current) {
      const v = valores[cve];
      p.objetivo = h[cve] ?? 0.12;
      p.colorObjetivo[0].set(v == null ? "#3a4656" : v === 0 ? "#26384a" : rampa[Math.min(clase(v, cortesMapa), rampa.length - 1)]);
    }
    const top = Object.entries(rangos).filter(([, r]) => r <= 3).sort((a, b) => a[1] - b[1]);
    m.setEtiquetas(top.map(([cve, r]) => ({
      id: cve, pieza: piezasRef.current.get(cve), offset: 1, clase: "iso-et--torre",
      lineas: [{ texto: `#${r}`, clase: "iso-et__rango" }, { texto: estatal.entidades[cve] ?? cve }, { texto: metrica === "tasa" ? fTasa(valores[cve]) : fCompacto(valores[cve] ?? 0), clase: "iso-et__cifra" }],
    })));
    m.refrescar();
  }, [vista, version, valores, rangos, cortesMapa, rampa, metrica, estatal]);

  useEffect(() => { motorRef.current?.setSeleccion(sel); }, [sel, version]);

  // Recorrido automático de años.
  useEffect(() => {
    if (!reproduciendo) return;
    const id = setInterval(() => {
      setAnio(a => {
        const i = anios.indexOf(a);
        if (i >= anios.length - 1) { setReproduciendo(false); return a; }
        return anios[i + 1];
      });
    }, 1300);
    return () => clearInterval(id);
  }, [reproduciendo, anios]);

  /* ---------- HUD ---------- */
  const foco = hov?.id ?? sel;
  const panel = (() => {
    if (vista === "territorio") {
      const cve = foco && estatal.entidades[foco] ? foco : null;
      if (!cve) {
        const orden = Object.entries(rangos).sort((a, b) => a[1] - b[1]);
        const mayor = orden[0]?.[0], menor = orden[orden.length - 1]?.[0];
        return {
          titulo: `${nombreDelito(delitoTerritorio)} · ${anio}`,
          cifra: null as string | null,
          filas: [
            ["Mayor", mayor ? `${estatal.entidades[mayor]} · ${fmtValor(valores[mayor])}` : "—"],
            ["Menor", menor ? `${estatal.entidades[menor]} · ${fmtValor(valores[menor])}` : "—"],
          ] as Array<[string, string]>,
          serie: null as number[] | null,
          nota: "Toca un estado para ver su trayectoria.",
        };
      }
      const s = serieEntidad(estatal, pob, cve, delitoTerritorio, metrica).filter(x => x.anio <= anio);
      const c = cambioPct(s);
      return {
        titulo: estatal.entidades[cve],
        cifra: fmtValor(valores[cve]),
        filas: [
          ["Posición", rangos[cve] ? `${rangos[cve]} de ${Object.keys(rangos).length}` : "—"],
          [`Cambio ${anios[0]}→${anio}`, c == null ? "sin dato" : fPct(c)],
        ] as Array<[string, string]>,
        serie: s.map(x => x.v ?? 0),
        nota: `${nombreDelito(delitoTerritorio)} · ${anio}`,
      };
    }
    if (vista === "delitos") {
      const d = top10.find(x => x.delito_id === foco);
      if (!d) return { titulo: "Diez delitos más frecuentes", cifra: null, filas: [["Periodo", ranking.etiqueta]] as Array<[string, string]>, serie: null, nota: "Altura: delitos registrados. Toca una torre." };
      const a = anualNacional(sn, d.delito_id);
      const c = cambioPct(a);
      return {
        titulo: d.nombre, cifra: `${fEntero(d.cantidad)} delitos`,
        filas: [["Participación", `${fPct(d.participacion, false)} del total`], [`Cambio ${a[0]?.anio}→${a.filter(x => x.v != null).at(-1)?.anio}`, c == null ? "sin dato" : fPct(c)]] as Array<[string, string]>,
        serie: a.map(x => x.v ?? 0), nota: ranking.etiqueta,
      };
    }
    if (vista === "tiempo") {
      if (foco && /^\d{4}-\d+$/.test(foco)) {
        const [a, c] = foco.split("-").map(Number);
        const v = matriz.filas[matriz.anios.indexOf(a)]?.[c] ?? null;
        return { titulo: `${MESES_LARGOS[c]} de ${a}`, cifra: v == null ? "sin dato" : `${fEntero(v)} delitos`, filas: [] as Array<[string, string]>, serie: null, nota: nombreDelito(delitoTiempo) };
      }
      const c = cambioPct(anualTiempo);
      const total = anualTiempo.reduce((s, x) => s + (x.v ?? 0), 0);
      return {
        titulo: nombreDelito(delitoTiempo), cifra: `${fCompacto(total)} delitos`,
        filas: [[`Cambio ${anualTiempo[0]?.anio}→${anualTiempo.at(-1)?.anio}`, c == null ? "sin dato" : fPct(c)]] as Array<[string, string]>,
        serie: anualTiempo.map(x => x.v ?? 0), nota: "Cada torre es un mes. Filas: años; columnas: meses.",
      };
    }
    const d = victimas.find(x => x.id === foco);
    if (!d) return { titulo: "Quién es víctima", cifra: null, filas: [["Unidad", "víctimas registradas"]] as Array<[string, string]>, serie: null, nota: vic ? `${vic.meta.anios[0]}–${vic.meta.anios.at(-1)} · composición por sexo` : "" };
    return {
      titulo: d.nombre, cifra: `${fEntero(d.total)} víctimas`,
      filas: [
        ["Mujeres", `${fEntero(d.mujer)} · ${(d.pct_mujer ?? 0).toFixed(1)} %`],
        ["Hombres", `${fEntero(d.hombre)} · ${(d.pct_hombre ?? 0).toFixed(1)} %`],
        ["No identificado", fEntero(d.no_identificado)],
        ...(d.pct_menores != null ? [["Menores de edad", `${d.pct_menores.toFixed(0)} %`] as [string, string]] : []),
      ] as Array<[string, string]>,
      serie: null, nota: "Toca otra torre para comparar.",
    };
  })();

  const tooltip = (() => {
    if (!hov) return null;
    if (vista === "territorio") return estatal.entidades[hov.id] ? `${estatal.entidades[hov.id]} · ${fmtValor(valores[hov.id])}` : null;
    if (vista === "delitos") { const d = top10.find(x => x.delito_id === hov.id); return d ? `${d.nombre} · ${fEntero(d.cantidad)}` : null; }
    if (vista === "tiempo") { const [a, c] = hov.id.split("-").map(Number); const v = matriz.filas[matriz.anios.indexOf(a)]?.[c]; return `${MESES_LARGOS[c]} ${a} · ${v == null ? "sin dato" : fEntero(v)}`; }
    const d = victimas.find(x => x.id === hov.id); return d ? `${d.nombre} · ${(d.pct_mujer ?? 0).toFixed(1)} % mujeres` : null;
  })();

  const filasTabla: Array<[string, string]> = vista === "territorio"
    ? Object.entries(valores).sort((a, b) => (b[1] ?? -1) - (a[1] ?? -1)).map(([cve, v]) => [estatal.entidades[cve], fmtValor(v)])
    : vista === "delitos" ? top10.map(d => [d.nombre, fEntero(d.cantidad)])
    : vista === "tiempo" ? anualTiempo.map(x => [String(x.anio), x.v == null ? "sin dato" : fEntero(x.v)])
    : victimas.map(d => [d.nombre, `${(d.pct_mujer ?? 0).toFixed(1)} % mujeres · ${fEntero(d.total)} víctimas`]);

  const leyenda = vista === "victimas"
    ? <div className="iso-ley"><i style={{ background: "var(--vz-muj)" }} />Mujeres<i style={{ background: "var(--vz-hom)" }} />Hombres<i style={{ background: "var(--vz-ni)" }} />No identificado</div>
    : vista === "delitos"
      ? <div className="iso-ley">Altura: delitos registrados · {ranking.etiqueta}</div>
      : <div className="iso-ley"><span>{vista === "territorio" ? (metrica === "tasa" ? "Tasa /100 mil" : "Delitos") : "Delitos por mes"}</span><span className="iso-rampa">{rampa.map(c => <i key={c} style={{ background: c }} />)}</span><span>menor → mayor</span></div>;

  return (
    <section className="seccion iso" id="isometrico" aria-labelledby="t-iso">
      <div className="iso-cab">
        <div>
          <p className="ni-eyebrow">Observatorio · Vista isométrica</p>
          <h2 id="t-iso">Incidencia en el espacio</h2>
        </div>
        <div className="iso-tabs" role="tablist" aria-label="Vistas isométricas">
          {VISTAS.map(v => (
            <button key={v.id} role="tab" aria-selected={vista === v.id} className="iso-tab"
              onClick={() => { setReproduciendo(false); setVista(v.id); }}>{v.nombre}</button>
          ))}
        </div>
      </div>

      <div className="iso-escenario">
        <div className="iso-vista">
          <div className="iso-host" ref={hostRef} />
          <div className="iso-capa" ref={capaRef} aria-hidden="true" />
          <p className="iso-ayuda">Arrastra para girar · Ctrl + rueda para acercar · doble clic restablece</p>
          {tooltip && hov && <div className="iso-tip" style={{ transform: `translate(${hov.x + 14}px, ${hov.y + 14}px)` }}>{tooltip}</div>}
          {fallo && <p className="iso-fallo" role="status">Este dispositivo no admite WebGL; los datos de la vista están en la tabla de abajo.</p>}
        </div>

        <div className="iso-sup">
        <div className="iso-barra" ref={barraRef}>
          {(vista === "territorio" || vista === "tiempo") && (
            <select className="control iso-ctl" aria-label="Delito" value={vista === "territorio" ? delitoTerritorio : delitoTiempo}
              onChange={e => setDelito(e.target.value)}>
              {(vista === "territorio" ? opcionesTerritorio : opcionesTiempo).map(id => <option key={id} value={id}>{nombreDelito(id)}</option>)}
            </select>
          )}
          {vista === "territorio" && <>
            <div className="seg iso-ctl" role="group" aria-label="Métrica">
              <button aria-pressed={metrica === "conteo"} onClick={() => setGlobal({ metrica: "conteo" })}>Cantidad</button>
              <button aria-pressed={metrica === "tasa"} onClick={() => setGlobal({ metrica: "tasa" })}>Tasa</button>
            </div>
            <div className="iso-anio">
              <button className="iso-btn" aria-label={reproduciendo ? "Pausar recorrido" : "Recorrer años"}
                onClick={() => { if (!reproduciendo && anio === anios[anios.length - 1]) setAnio(anios[0]); setReproduciendo(r => !r); }}>
                {reproduciendo
                  ? <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14M16 5v14" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" /></svg>
                  : <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5l11 7-11 7z" fill="currentColor" /></svg>}
              </button>
              <input type="range" min={anios[0]} max={anios[anios.length - 1]} step={1} value={anio} aria-label="Año"
                onChange={e => { setReproduciendo(false); setAnio(Number(e.target.value)); }} />
              <output className="iso-anio__v">{anio}</output>
            </div>
          </>}
        </div>
        {leyenda}
        </div>

        <div className="iso-camara" role="group" aria-label="Cámara">
          <button className="iso-btn" aria-label="Girar a la izquierda" onClick={() => motorRef.current?.girar(Math.PI / 4)}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 1 0 3-6.2M4 4v5h5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg></button>
          <button className="iso-btn" aria-label="Girar a la derecha" onClick={() => motorRef.current?.girar(-Math.PI / 4)}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12a8 8 0 1 1-3-6.2M20 4v5h-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg></button>
          <button className="iso-btn" aria-label="Acercar" onClick={() => motorRef.current?.acercarPaso(1.25)}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg></button>
          <button className="iso-btn" aria-label="Alejar" onClick={() => motorRef.current?.acercarPaso(0.8)}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg></button>
          <button className="iso-btn" aria-label="Restablecer vista" onClick={() => motorRef.current?.restablecer()}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9zM12 12l8-4.5M12 12v9M12 12L4 7.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /></svg></button>
        </div>

        <aside className="iso-panel" aria-live="polite" ref={panelRef}>
          <p className="iso-panel__t">{panel.titulo}</p>
          {panel.cifra && <p className="iso-panel__c">{panel.cifra}</p>}
          {panel.filas.length > 0 && <dl className="iso-panel__f">{panel.filas.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>}
          {panel.serie && panel.serie.length > 1 && <MiniSerie valores={panel.serie} />}
          {panel.nota && <p className="iso-panel__n">{panel.nota}</p>}
        </aside>

      </div>

      <details className="iso-datos" open={fallo}>
        <summary>Datos de la vista</summary>
        <table>
          <tbody>{filasTabla.map(([a, b], i) => <tr key={`${a}-${i}`}><th scope="row">{a}</th><td>{b}</td></tr>)}</tbody>
        </table>
      </details>
    </section>
  );
}

function MiniSerie({ valores }: { valores: number[] }) {
  const W = 220, H = 46, P = 3;
  const min = Math.min(...valores), max = Math.max(...valores);
  const y = (v: number) => max === min ? H / 2 : H - P - (v - min) / (max - min) * (H - 2 * P);
  const x = (i: number) => P + i * (W - 2 * P) / (valores.length - 1);
  const d = valores.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  return (
    <svg className="iso-mini" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
      <path d={`${d} L${x(valores.length - 1)},${H} L${P},${H} Z`} className="iso-mini__a" />
      <path d={d} className="iso-mini__l" />
      <circle cx={x(valores.length - 1)} cy={y(valores[valores.length - 1])} r={3} />
    </svg>
  );
}
