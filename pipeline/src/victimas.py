"""Producto de Víctimas del fuero común (SESNSP) — composición nacional por sexo.

A diferencia del resto del tablero (carpetas de investigación), la unidad aquí
es la VÍCTIMA, universo que el SESNSP reporta por separado para ciertos delitos
(feminicidio, homicidio, lesiones, secuestro, trata, etc.), con desglose por
sexo y rango de edad.

- Total nacional 2015–2025: de la fuente ESTATAL (autoritativa).
- Corte parcial 2026: suma del archivo MUNICIPAL RNID (ene–sep); provisional,
  con el leve faltante de registros «sin municipio», por lo que se etiqueta.

Uso:  python victimas.py <estatal_2015_2025.csv> <municipal_2026.csv> <salida.json>
Genera web/public/datos/victimas.json por defecto si no se pasan rutas.
"""
from __future__ import annotations

import csv
import io
import json
import re
import sys
import unicodedata
from datetime import datetime, timezone
from pathlib import Path

MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio",
         "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]
RAIZ = Path(__file__).resolve().parents[2]


def leer(path: str):
    data = Path(path).read_bytes()
    try:
        txt = data.decode("utf-8-sig")
    except UnicodeDecodeError:
        txt = data.decode("latin-1")
    return csv.reader(io.StringIO(txt))


def slug(s: str) -> str:
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")


def construir(estatal_csv: str, municipal_2026_csv: str | None, salida: str) -> None:
    r = leer(estatal_csv)
    h = next(r)
    hi = {c.strip(): i for i, c in enumerate(h)}
    iMes = [hi[m] for m in MESES]
    iSub, iSexo, iEdad, iAnio = hi["Subtipo de delito"], hi["Sexo"], hi["Rango de edad"], hi["Año"]

    tot: dict = {}
    anioSexo: dict = {}
    menores: dict = {}
    for row in r:
        sub, sexo, edad, anio = row[iSub].strip(), row[iSexo].strip(), row[iEdad].strip(), row[iAnio].strip()
        v = 0
        for j in iMes:
            try:
                v += int(float(row[j] or 0))
            except ValueError:
                pass
        if v == 0:
            continue
        tot.setdefault(sub, {}).setdefault(sexo, 0)
        tot[sub][sexo] += v
        anioSexo.setdefault(sub, {}).setdefault(sexo, {}).setdefault(anio, 0)
        anioSexo[sub][sexo][anio] += v
        gk = "menores" if edad.startswith("Menores") else "adultos" if edad.startswith("Adultos") else "otro"
        menores.setdefault(sub, {}).setdefault(gk, 0)
        menores[sub][gk] += v

    tot26: dict = {}
    if municipal_2026_csv and Path(municipal_2026_csv).exists():
        r2 = leer(municipal_2026_csv)
        h2 = next(r2)
        hj = {c.strip(): i for i, c in enumerate(h2)}
        jMes = [hj[m] for m in MESES]
        jSub, jSexo = hj["Subtipo de delito"], hj["Sexo"]
        for row in r2:
            sub, sexo = row[jSub].strip(), row[jSexo].strip()
            v = 0
            for j in jMes:
                try:
                    v += int(float(row[j] or 0))
                except ValueError:
                    pass
            if v == 0:
                continue
            tot26.setdefault(sub, {}).setdefault(sexo, 0)
            tot26[sub][sexo] += v

    anios = [str(a) for a in range(2015, 2026)]
    delitos = []
    for sub in sorted(tot, key=lambda s: -sum(tot[s].values())):
        bs = tot[sub]
        total = sum(bs.values())
        muj, hom, ni = bs.get("Mujer", 0), bs.get("Hombre", 0), bs.get("No identificado", 0)
        men = menores.get(sub, {})
        delitos.append({
            "id": slug(sub), "nombre": sub, "total": total,
            "mujer": muj, "hombre": hom, "no_identificado": ni,
            "pct_mujer": round(muj / total * 100, 1) if total else None,
            "pct_hombre": round(hom / total * 100, 1) if total else None,
            "menores": men.get("menores", 0), "adultos": men.get("adultos", 0),
            "pct_menores": round(men.get("menores", 0) / total * 100, 1) if total else None,
            "serie_mujer": [anioSexo[sub].get("Mujer", {}).get(a, 0) for a in anios],
            "serie_hombre": [anioSexo[sub].get("Hombre", {}).get(a, 0) for a in anios],
            "total_2026": sum(tot26.get(sub, {}).values()) if tot26 else None,
            "mujer_2026": tot26.get(sub, {}).get("Mujer") if tot26 else None,
        })

    out = {
        "meta": {
            "generado_utc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "fuente": "SESNSP — Víctimas del fuero común (estatal, instrumento 2015–2025); corte parcial 2026 sumado del municipal RNID (ene–sep).",
            "universo": "Víctimas registradas (no carpetas). Nacional, fuente estatal 2015–2025.",
            "anios": anios,
        },
        "delitos": delitos,
    }
    Path(salida).parent.mkdir(parents=True, exist_ok=True)
    json.dump(out, open(salida, "w"), ensure_ascii=False)
    print(f"victimas.json escrito: {len(delitos)} delitos → {salida}")


if __name__ == "__main__":
    est = sys.argv[1] if len(sys.argv) > 1 else "raw_victimas/Estatal-Victimas-2015-2025.csv"
    mun = sys.argv[2] if len(sys.argv) > 2 else None
    sal = sys.argv[3] if len(sys.argv) > 3 else str(RAIZ / "web" / "public" / "datos" / "victimas.json")
    construir(est, mun, sal)
