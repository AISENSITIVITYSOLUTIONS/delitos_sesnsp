/** Vista 3D: extrusión de polígonos con deck.gl (sin mapa base externo).
 * La altura representa la métrica activa (explícita en la leyenda del
 * contenedor). Controles: inclinación, rotación, restablecer; el cambio a 2D
 * es inmediato desde el conmutador del contenedor. */
import { useCallback, useEffect, useMemo, useState } from "react";
import DeckGL from "@deck.gl/react";
import { PolygonLayer } from "@deck.gl/layers";
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
  const inicial = useMemo(() => vistaInicial(p.territorios), [p.territorios]);
  const [vista, setVista] = useState<MapViewState>(inicial);
  useEffect(() => { setVista(inicial); }, [inicial]);
  const reducirMovimiento = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const datos = useMemo(() => p.territorios.map(t => {
    const d = p.valores[t.cve];
    return { ...t, valor: d?.v ?? null };
  }), [p.territorios, p.valores]);

  const escalaAltura = p.maxV > 0 ? 320_000 / p.maxV : 0;

  const capa = useMemo(() => new PolygonLayer({
    id: "territorios-3d",
    data: datos,
    getPolygon: (d: (typeof datos)[number]) => d.pols,
    extruded: true,
    wireframe: false,
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
  }), [datos, escalaAltura, p.rampa, p.cortes, reducirMovimiento]);

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

  const gira = (delta: number) => setVista(v => ({ ...v, bearing: ((v.bearing ?? 0) + delta) % 360 }));
  const inclina = (delta: number) => setVista(v => ({ ...v, pitch: Math.max(0, Math.min(70, (v.pitch ?? 0) + delta)) }));

  return (
    <div style={{ position: "relative", width: "100%", height: 560 }}>
      <DeckGL
        views={undefined}
        viewState={vista}
        onViewStateChange={({ viewState }) => setVista(viewState as MapViewState)}
        controller={{ dragRotate: true, touchRotate: true, inertia: !reducirMovimiento }}
        layers={[capa]}
        getTooltip={tooltip}
        onClick={(info: PickingInfo) => {
          const d = info.object as (typeof datos)[number] | undefined;
          if (d) p.onSeleccion?.(d.cve);
        }}
        style={{ position: "absolute", inset: "0" }}
      />
      <div style={{ position: "absolute", right: 12, bottom: 12, zIndex: 5, display: "flex", gap: 6 }} className="no-imprimir">
        <button className="boton" onClick={() => inclina(12)} aria-label="Aumentar inclinación">Inclinar ▲</button>
        <button className="boton" onClick={() => inclina(-12)} aria-label="Reducir inclinación">▼</button>
        <button className="boton" onClick={() => gira(-20)} aria-label="Rotar a la izquierda">⟲</button>
        <button className="boton" onClick={() => gira(20)} aria-label="Rotar a la derecha">⟳</button>
        <button className="boton" onClick={() => setVista(inicial)} aria-label="Restablecer vista">Restablecer</button>
      </div>
      <p className="nota" style={{ position: "absolute", left: 12, top: 12, zIndex: 5, maxWidth: 240 }}>
        La <strong>altura</strong> representa {p.metrica === "conteo" ? "el número de delitos registrados" : "la tasa por 100 mil habitantes"} del periodo mostrado (escala lineal desde cero).
      </p>
    </div>
  );
}
