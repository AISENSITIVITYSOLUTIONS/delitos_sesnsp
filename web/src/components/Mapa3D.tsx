/** Vista 3D: extrusión de polígonos con deck.gl (sin mapa base externo).
 * La altura representa la métrica activa (explícita en la leyenda del
 * contenedor). Controles: inclinación, rotación, restablecer; el cambio a 2D
 * es inmediato desde el conmutador del contenedor. */
import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import DeckGL from "@deck.gl/react";
import { PolygonLayer } from "@deck.gl/layers";
import { AmbientLight, DirectionalLight, LightingEffect, MapView, LinearInterpolator } from "@deck.gl/core";
import type { PickingInfo, MapViewState } from "@deck.gl/core";
import type { Territorio } from "../lib/geo";
import { clase } from "../lib/geo";
import type { ValorTerritorio } from "./MapaMx";

interface Props {
  territorios: Territorio[];
  valores: Record<string, ValorTerritorio>;
  rampa: readonly string[];
  cortes: number[];
  maxV: number;
  metrica: "conteo" | "tasa";
  onSeleccion?: (cve: string) => void;
  onFallo: () => void;
  fmt: (v: number | null) => string;
}

function vistaInicial(territorios: Territorio[]): MapViewState {
  let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;
  for (const t of territorios) for (const an of t.pols) for (const [lon, lat] of an) {
    if (lon < minLon) minLon = lon; if (lon > maxLon) maxLon = lon;
    if (lat < minLat) minLat = lat; if (lat > maxLat) maxLat = lat;
  }
  if (!isFinite(minLon)) return { longitude: -102.2, latitude: 23.8, zoom: 4.15, pitch: 46, bearing: -12, minZoom: 3.2, maxZoom: 10, maxPitch: 70 };
  const dLon = Math.max(maxLon - minLon, 0.2), dLat = Math.max(maxLat - minLat, 0.2);
  const zoom = Math.min(Math.max(Math.log2(300 / Math.max(dLon, dLat * 1.5)) , 3.4), 8.6);
  return {
    longitude: (minLon + maxLon) / 2, latitude: (minLat + maxLat) / 2 - dLat * 0.06,
    zoom, pitch: 46, bearing: -12, minZoom: 3.2, maxZoom: 10, maxPitch: 70,
  };
}

const hexARgb = (hex: string): [number, number, number] => {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
};

export default function Mapa3D(p: Props) {
  const contenedor=useRef<HTMLDivElement>(null);
  const [calidad,setCalidad]=useState(1);
  useEffect(()=>{
    const node=contenedor.current;
    const perdido=()=>p.onFallo();
    node?.addEventListener("webglcontextlost",perdido,true);
    const ajustar=()=>{const n=navigator as Navigator & {deviceMemory?:number};const limitada=matchMedia("(pointer:coarse)").matches||(n.deviceMemory!=null&&n.deviceMemory<=4)||navigator.hardwareConcurrency<=4;setCalidad(document.documentElement.dataset.efectos==="cinematico"&&!limitada?Math.min(devicePixelRatio||1,1.5):1);};
    ajustar();const obs=new MutationObserver(ajustar);obs.observe(document.documentElement,{attributes:true,attributeFilter:["data-efectos"]});window.addEventListener("resize",ajustar);
    return()=>{node?.removeEventListener("webglcontextlost",perdido,true);obs.disconnect();window.removeEventListener("resize",ajustar);};
  },[p.onFallo]);
  const luces = useMemo(() => [new LightingEffect({
    ambiente: new AmbientLight({ color: [215, 232, 255], intensity: 1.1 }),
    principal: new DirectionalLight({ color: [255, 255, 255], intensity: 1.8, direction: [-2, -3, -4] }),
    relleno: new DirectionalLight({ color: [80, 170, 255], intensity: 0.6, direction: [3, 1, -2] }),
  })], []);
  const [malla, setMalla] = useState(false);
  const [ortografica, setOrtografica] = useState(false);
  const [relieve, setRelieve] = useState(1);
  const inicial = useMemo(() => vistaInicial(p.territorios), [p.territorios]);
  const [vista, setVista] = useState<MapViewState>(inicial);
  useEffect(() => { setVista(inicial); }, [inicial]);
  const reducirMovimiento = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const datos = useMemo(() => p.territorios.map(t => {
    const d = p.valores[t.cve];
    return { ...t, valor: d?.v ?? null };
  }), [p.territorios, p.valores]);

  const escalaAltura = p.maxV > 0 ? 320_000 * relieve / p.maxV : 0;

  const capa = useMemo(() => new PolygonLayer({
    id: "territorios-3d",
    data: datos,
    getPolygon: (d: (typeof datos)[number]) => d.pols,
    extruded: true,
    wireframe: malla,
    autoHighlight: true,
    highlightColor: [90, 200, 255, 100],
    pickable: true,
    getElevation: (d: (typeof datos)[number]) => d.valor == null ? 0 : d.valor * escalaAltura,
    getFillColor: (d: (typeof datos)[number]): [number, number, number, number] => {
      if (d.valor == null) return [140, 140, 135, 90];
      if (d.valor === 0) return [...hexARgb(p.rampa[0]), 70] as [number, number, number, number];
      return [...hexARgb(p.rampa[Math.min(clase(d.valor, p.cortes), p.rampa.length - 1)]), 235] as [number, number, number, number];
    },
    getLineColor: [255, 255, 255, 60],
    material: { ambient: 0.42, diffuse: 0.75, shininess: 26, specularColor: [80, 90, 100] },
    transitions: reducirMovimiento ? undefined : { getElevation: 420 },
    updateTriggers: { getElevation: [escalaAltura], getFillColor: [p.rampa, p.cortes] },
  }), [datos, escalaAltura, p.rampa, p.cortes, reducirMovimiento, malla]);

  const tooltip = useCallback((info: PickingInfo) => {
    const d = info.object as (typeof datos)[number] | undefined;
    if (!d) return null;
    return {
      text: `${d.nombre} (${d.cve})\n${p.fmt(d.valor)}`,
      style: {
        backgroundColor: "var(--surface)", color: "var(--ink)",
        border: "1px solid var(--border-strong)", borderRadius: "10px",
        fontSize: "12px", fontFamily: "var(--sans)", padding: "8px 10px",
      },
    };
  }, [p]);

  const gira = (delta: number) => setVista(v => ({ ...v, transitionDuration: reducirMovimiento ? 0 : 650, transitionInterpolator: new LinearInterpolator(["bearing"]), bearing: ((v.bearing ?? 0) + delta) % 360 }));
  const inclina = (delta: number) => setVista(v => ({ ...v, pitch: Math.max(0, Math.min(70, (v.pitch ?? 0) + delta)) }));

  return (
    <div className="mapa-3d-escena" ref={contenedor} style={{ position: "relative", width: "100%", height: "clamp(360px, 55vw, 560px)" }}>
      <label className="mapa-relieve no-imprimir" style={{position:"absolute",left:12,bottom:64,zIndex:5,background:"var(--surface)",padding:8,borderRadius:8}}>Relieve visual <input aria-label="Intensidad del relieve 3D" type="range" min="0" max="1" step="0.1" value={relieve} onChange={e=>setRelieve(Number(e.target.value))}/></label>
      <DeckGL
        views={new MapView({ orthographic: ortografica })}
        viewState={vista}
        onViewStateChange={({ viewState }) => setVista(viewState as MapViewState)}
        controller={{ dragRotate: true, touchRotate: true, inertia: !reducirMovimiento }}
        layers={[capa]}
        effects={luces}
        useDevicePixels={calidad}
        onError={()=>p.onFallo()}
        getTooltip={tooltip}
        onClick={(info: PickingInfo) => {
          const d = info.object as (typeof datos)[number] | undefined;
          if (d) p.onSeleccion?.(d.cve);
        }}
        style={{ position: "absolute", inset: "0" }}
      />
      <div style={{ position: "absolute", right: 12, bottom: 12, zIndex: 5, display: "flex", flexWrap: "wrap", justifyContent: "flex-end", maxWidth: "calc(100% - 24px)", gap: 6 }} className="no-imprimir mapa-3d-actions">
        <button className="boton" aria-pressed={malla} onClick={()=>setMalla(!malla)}>Malla 3D</button>
        <button className="boton" aria-pressed={ortografica} onClick={()=>setOrtografica(!ortografica)}>{ortografica?"Ortográfica":"Perspectiva"}</button>
        <button className="boton" onClick={() => inclina(12)} aria-label="Aumentar inclinación">Inclinar ▲</button>
        <button className="boton" onClick={() => inclina(-12)} aria-label="Reducir inclinación">▼</button>
        <button className="boton" onClick={() => gira(-20)} aria-label="Rotar a la izquierda">⟲</button>
        <button className="boton" onClick={() => gira(20)} aria-label="Rotar a la derecha">⟳</button>
        <button className="boton" onClick={() => setVista(inicial)} aria-label="Restablecer vista">Restablecer</button>
      </div>
      <p className="nota" style={{ position: "absolute", left: 12, top: 12, zIndex: 5, maxWidth: 240 }}>
        La <strong>altura</strong> representa {p.metrica === "conteo" ? "el número de delitos registrados" : "la tasa por 100 mil habitantes"} del periodo mostrado (escala lineal desde cero). Máximo visible: {p.fmt(p.maxV)}. El control de relieve modifica la representación, no los valores.
      </p>
    </div>
  );
}
