"""Preparación de cartografía (reproducible).

Fuente: división política estatal y municipal 1:250 000 (CONABIO/INEGI),
versión 2023, vía espejo verificado github.com/PhantomInsights/mexico-geojson
(carpeta 2023/states, 2 475 municipios, claves CVEGEO/CVE_ENT/NOMGEO).
Cuando la política de red permita descargar el Marco Geoestadístico del INEGI
directamente, sustituir la fuente aquí y regenerar.

Pasos (requiere `npm i -g mapshaper` y el repo clonado en raw/mexico-geojson):
 1. Simplificación municipal: mapshaper -simplify interval=280 keep-shapes
    (sin -clean: elimina features en polígonos con recubrimientos COV_).
 2. Estados: -dissolve fields=CVE_ENT copy-fields=NOM_ENT -simplify weighted 4%.
 3. Conversión a formato compacto {cve, nombre, pols[anillos exteriores]}
    con 4 decimales (municipal) y 3 (estatal), a work/geo_export/.

Municipios sin geometría 2023 (posteriores al corte cartográfico): se listan
en el manifiesto y aparecen solo en tablas.
"""
from __future__ import annotations

import json
import subprocess
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
FUENTE = RAIZ / "raw" / "mexico-geojson" / "2023" / "states"
TRABAJO = RAIZ / "work" / "geo"
SALIDA = RAIZ / "work" / "geo_export"


def anillos(geom: dict | None, dec: int = 4) -> list:
    if not geom:
        return []
    polys = ([geom["coordinates"]] if geom["type"] == "Polygon"
             else geom["coordinates"] if geom["type"] == "MultiPolygon" else [])
    out = []
    for p in polys:
        if p and p[0] and len(p[0]) >= 4:
            out.append([[round(x, dec), round(y, dec)] for x, y in p[0]])
    return out


def preparar() -> None:
    mun_dir = TRABAJO / "mun"
    edo_dir = TRABAJO / "edo"
    mun_dir.mkdir(parents=True, exist_ok=True)
    edo_dir.mkdir(parents=True, exist_ok=True)
    for f in sorted(FUENTE.glob("*.json")):
        subprocess.run(["mapshaper", str(f), "-simplify", "interval=280", "keep-shapes",
                        "-o", "precision=0.0001", str(mun_dir / f.name)], check=True,
                       capture_output=True)
        subprocess.run(["mapshaper", str(f), "-dissolve", "fields=CVE_ENT", "copy-fields=NOM_ENT",
                        "-simplify", "weighted", "4%", "keep-shapes", "-clean",
                        "-o", "precision=0.001", str(edo_dir / f.name)], check=True,
                       capture_output=True)

    SALIDA.mkdir(parents=True, exist_ok=True)
    por_ent: dict[str, list] = {}
    vistos: dict[tuple, dict] = {}
    for f in sorted(mun_dir.glob("*.json")):
        d = json.loads(f.read_text())
        for ft in d["features"]:
            cve, ent = ft["properties"]["CVEGEO"], ft["properties"]["CVE_ENT"]
            an = anillos(ft.get("geometry"))
            if not an:
                continue
            key = (ent, cve)
            if key in vistos:
                vistos[key]["pols"] += an
            else:
                t = {"cve": cve, "nombre": ft["properties"]["NOMGEO"], "pols": an}
                vistos[key] = t
                por_ent.setdefault(ent, []).append(t)
    for ent, ts in por_ent.items():
        ts.sort(key=lambda t: t["cve"])
        (SALIDA / f"municipios_{ent}.json").write_text(
            json.dumps({"territorios": ts}, ensure_ascii=False, separators=(",", ":")))

    terr = []
    for f in sorted(edo_dir.glob("*.json")):
        d = json.loads(f.read_text())
        for ft in d["features"]:
            an = anillos(ft.get("geometry"), dec=3)
            if an:
                terr.append({"cve": ft["properties"]["CVE_ENT"],
                             "nombre": ft["properties"].get("NOM_ENT") or ft["properties"]["CVE_ENT"],
                             "pols": an})
    terr.sort(key=lambda t: t["cve"])
    (SALIDA / "estados.json").write_text(
        json.dumps({"territorios": terr}, ensure_ascii=False, separators=(",", ":")))
    print(f"geo listo: {len(terr)} estados, {sum(len(v) for v in por_ent.values())} municipios")


if __name__ == "__main__":
    preparar()
