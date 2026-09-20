"""Construcción de los productos precalculados del dashboard (JSON bajo datos/).

Todas las cifras nacionales provienen de la fuente ESTATAL del periodo; la
municipal alimenta la desagregación territorial. Cero = cero reportado;
null = mes no publicado (RNID: meses posteriores al corte llegan como 0 en el
archivo oficial y aquí se enmascaran a null usando el corte)."""
from __future__ import annotations

import json
import unicodedata
from datetime import datetime, timezone
from pathlib import Path

import polars as pl

from esquema import MESES

RAIZ = Path(__file__).resolve().parents[2]


def slug(s: str) -> str:
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower()
    return "-".join("".join(c if c.isalnum() else " " for c in s).split())


def ahora() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def meta(fuente: str, url: str, corte: str, unidad: str, version: int,
         descargado: str, notas: list[str] | None = None) -> dict:
    return {"fuente": fuente, "url_fuente": url, "corte": corte,
            "descargado_utc": descargado, "validado_utc": ahora(),
            "version": version, "unidad": unidad, "notas": notas or []}


UNIDAD = "delitos registrados en carpetas de investigación (no equivale a carpetas ni a víctimas)"


# ---------------------------------------------------------------- series ----
def eje_meses(anio_ini: int, anio_fin: int) -> list[str]:
    return [f"{a}-{m:02d}" for a in range(anio_ini, anio_fin + 1) for m in range(1, 13)]


def series_nacionales(largo: pl.DataFrame, metodologia: str, anio_ini: int, anio_fin: int,
                      corte: str, m: dict) -> dict:
    """Producto SeriesNacionales: subtipos + modalidades + total, nivel nacional."""
    meses = eje_meses(anio_ini, anio_fin)
    idx = {ym: i for i, ym in enumerate(meses)}
    est = largo.filter(pl.col("nivel") == "estatal")

    agg = [pl.col("cantidad").sum().alias("v"), pl.col("cantidad").count().alias("n")]
    sub = est.group_by(["bien_juridico", "tipo", "subtipo", "anio", "mes"]).agg(agg)
    mod = est.group_by(["bien_juridico", "tipo", "subtipo", "modalidad", "anio", "mes"]).agg(agg)
    tot = est.group_by(["anio", "mes"]).agg(agg)

    jerarquia: dict = {}
    series: dict[str, list] = {}

    subtipos = sub.select(["bien_juridico", "tipo", "subtipo"]).unique()
    ids = {}
    for b, t, s in subtipos.iter_rows():
        sid = slug(s)
        if sid in ids and ids[sid] != (b, t, s):
            sid = f"{slug(t)}--{slug(s)}"
        ids[sid] = (b, t, s)
        jerarquia[sid] = {"bien": b, "tipo": t, "subtipo": s}
        series[sid] = [None] * len(meses)
    sub_id_por_nombre = {v[2]: k for k, v in ids.items()}

    for r in sub.iter_rows(named=True):
        sid = sub_id_por_nombre[r["subtipo"]]
        pos = idx.get(f"{r['anio']}-{r['mes']:02d}")
        if pos is not None:
            series[sid][pos] = r["v"] if r["n"] > 0 else None

    for r in mod.iter_rows(named=True):
        sid = sub_id_por_nombre[r["subtipo"]]
        mid = f"{sid}/{slug(r['modalidad'])}"
        if mid not in series:
            series[mid] = [None] * len(meses)
        pos = idx.get(f"{r['anio']}-{r['mes']:02d}")
        if pos is not None:
            series[mid][pos] = r["v"] if r["n"] > 0 else None

    total = [None] * len(meses)
    for r in tot.iter_rows(named=True):
        pos = idx.get(f"{r['anio']}-{r['mes']:02d}")
        if pos is not None:
            total[pos] = r["v"] if r["n"] > 0 else None

    return {"meta": m, "metodologia": metodologia, "meses": meses,
            "jerarquia": jerarquia, "series": series, "total": total,
            "_sub_id_por_nombre": sub_id_por_nombre}


def serie_homologada(nm: dict, nr: dict, mapeo_final: dict[str, list[str]],
                     corte_nr: str, m: dict, nota_total: str) -> dict:
    """Periodo completo 2015-2026 solo para series homologadas + total."""
    meses = nm["meses"] + nr["meses"]
    n_nm, n_nr = len(nm["meses"]), len(nr["meses"])
    jer, series = {}, {}
    nr_por_nombre = nr["_sub_id_por_nombre"]
    for nm_nombre, rnid_nombres in mapeo_final.items():
        nm_id = nm["_sub_id_por_nombre"].get(nm_nombre)
        if nm_id is None:
            continue
        tramo1 = nm["series"][nm_id]
        tramo2 = [None] * n_nr
        ok = True
        for nombre in rnid_nombres:
            rid = nr_por_nombre.get(nombre)
            if rid is None:
                ok = False
                break
            for i, v in enumerate(nr["series"][rid]):
                if v is not None:
                    tramo2[i] = (tramo2[i] or 0) + v
        if not ok:
            continue
        series[nm_id] = tramo1 + tramo2
        jer[nm_id] = nm["jerarquia"][nm_id]
    total = nm["total"] + nr["total"]
    m2 = dict(m)
    m2["notas"] = list(m.get("notas", [])) + [nota_total]
    return {"meta": m2, "metodologia": "homologado", "meses": meses,
            "jerarquia": jer, "series": series, "total": total}


# ------------------------------------------------------------- rankings ----
def ranking_delitos(sn: dict, etiqueta: str, hasta_idx: int | None = None) -> dict:
    """Top de subtipos mutuamente excluyentes del mismo nivel, por suma del periodo."""
    filas = []
    total_periodo = sum(v for v in sn["total"][:hasta_idx] if v is not None)
    for sid, vals in sn["series"].items():
        if "/" in sid:  # modalidades fuera: el ranking es a nivel subtipo
            continue
        s = sum(v for v in vals[:hasta_idx] if v is not None)
        filas.append({"delito_id": sid, "nombre": sn["jerarquia"][sid]["subtipo"],
                      "cantidad": int(s),
                      "participacion": (s / total_periodo * 100) if total_periodo else 0.0})
    filas.sort(key=lambda x: (-x["cantidad"], x["delito_id"]))
    return {"etiqueta": etiqueta, "delitos": filas[:12]}


# ------------------------------------------------------------ municipal ----
def municipal_anual(largo_m: pl.DataFrame, anios: list[int]) -> tuple[dict, pl.DataFrame]:
    """Totales anuales por municipio (todos los delitos, sin doble conteo:
    solo filas de modalidad, que son el nivel hoja)."""
    base = (largo_m.group_by(["cve_mun", "anio"])
            .agg(pl.col("cantidad").sum().alias("v")))
    nombres = (largo_m.sort("anio", descending=True)
               .group_by("cve_mun")
               .agg(pl.col("municipio").first().alias("nombre"),
                    pl.col("entidad").first().alias("entidad"),
                    pl.col("cve_ent").first().alias("cve_ent")))
    es_pseudo = pl.col("nombre").str.contains(r"(?i)no especificado|otros municipios")
    reales = nombres.filter(~es_pseudo)
    pseudo = nombres.filter(es_pseudo)

    idx = {a: i for i, a in enumerate(anios)}
    por_mun: dict[str, list] = {}
    for r in base.iter_rows(named=True):
        arr = por_mun.setdefault(r["cve_mun"], [None] * len(anios))
        pos = idx.get(r["anio"])
        if pos is not None:
            arr[pos] = int(r["v"]) if r["v"] is not None else None

    municipios = []
    for r in reales.sort("cve_mun").iter_rows(named=True):
        municipios.append({
            "cve": r["cve_mun"], "nombre": r["nombre"], "cve_ent": r["cve_ent"],
            "entidad": r["entidad"], "total": por_mun.get(r["cve_mun"], [None] * len(anios)),
        })
    sin_muni = []
    for r in pseudo.sort("cve_mun").iter_rows(named=True):
        sin_muni.append({"cve_ent": r["cve_ent"], "cve": r["cve_mun"],
                         "total": por_mun.get(r["cve_mun"], [None] * len(anios))})
    return {"municipios": municipios, "sin_municipio": sin_muni}, reales


def ranking_municipios_producto(muni_prod: dict, pob_mun: dict, total_nacional: dict[str, int],
                                anios: list[int], periodos: dict[str, tuple[list[int], str]],
                                regla_empates: str, m: dict) -> dict:
    """Rankings municipales canónicos (por volumen; por tasa con exposición)."""
    out = {"meta": m, "regla_empates": regla_empates, "periodos": {}}
    idx = {a: i for i, a in enumerate(anios)}
    for clave, (anios_p, etiqueta) in periodos.items():
        filas = []
        for mu in muni_prod["municipios"]:
            s, meses_pub = 0, 0
            for a in anios_p:
                v = mu["total"][idx[a]]
                if v is not None:
                    s += v
                    meses_pub += 12 if a != 2026 else 8
            exp = 0.0
            for a in anios_p:
                p = pob_mun.get(mu["cve"], {}).get(str(a))
                if p:
                    exp += p * ((8 if a == 2026 else 12) / 12)
            tasa = (s / exp * 100_000) if exp > 0 else None
            filas.append({"cve": mu["cve"], "nombre": mu["nombre"], "entidad": mu["entidad"],
                          "cantidad": int(s), "tasa_100k": tasa,
                          "poblacion": int(pob_mun.get(mu["cve"], {}).get(str(anios_p[-1]), 0)) or None})
        tot_nac = total_nacional[clave]
        for f in filas:
            f["participacion_nacional"] = f["cantidad"] / tot_nac * 100 if tot_nac else 0.0
        vol = sorted(filas, key=lambda x: (-x["cantidad"], x["cve"]))[:100]
        tasa_l = sorted([f for f in filas if f["tasa_100k"] is not None and f["poblacion"]],
                        key=lambda x: (-x["tasa_100k"], x["cve"]))
        out["periodos"][clave] = {
            "etiqueta": etiqueta,
            "por_volumen": [{k: f[k] for k in ("cve", "nombre", "entidad", "cantidad",
                                               "participacion_nacional", "tasa_100k")} for f in vol],
            "por_tasa": [{k: f[k] for k in ("cve", "nombre", "entidad", "cantidad",
                                            "tasa_100k", "poblacion")} for f in tasa_l],
            "umbral_poblacion": 20000,
            "excluidos_por_umbral": sum(1 for f in tasa_l if (f["poblacion"] or 0) < 20000),
        }
    return out


def escribir(dir_datos: Path, nombre: str, obj: dict) -> None:
    dir_datos.mkdir(parents=True, exist_ok=True)
    obj = {k: v for k, v in obj.items() if not k.startswith("_")}
    (dir_datos / nombre).write_text(json.dumps(obj, ensure_ascii=False, separators=(",", ":"),
                                               allow_nan=False))
