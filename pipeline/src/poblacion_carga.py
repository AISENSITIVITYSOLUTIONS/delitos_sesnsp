"""Carga y validación de población oficial (CONAPO).

Productos de origen:
- Entidades y nacional: CONAPO, "Población a mitad de año" de las Proyecciones
  de la Población de México y de las Entidades Federativas (serie larga a 2070).
- Municipios: CONAPO, "Reconstrucción y proyecciones de la población de los
  municipios de México 1990-2040" (población a mitad de año).
Obtenidos de un espejo público verificado (lapanquecita/poblacion-estimada);
la validación de consistencia se ejecuta aquí y se registra en el manifiesto.
"""
from __future__ import annotations

import unicodedata
from pathlib import Path

import polars as pl

RAIZ = Path(__file__).resolve().parents[2]
DIR = RAIZ / "raw" / "poblacion-estimada"

ALIAS = {
    "coahuila": "05", "michoacan": "16", "veracruz": "30",
    "mexico": "15", "estado de mexico": "15", "ciudad de mexico": "09",
    "distrito federal": "09", "nuevo leon": "19", "queretaro": "22",
    "san luis potosi": "24", "yucatan": "31", "baja california": "02",
    "baja california sur": "03", "quintana roo": "23", "nayarit": "18",
}


def _norm(s: str) -> str:
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower().strip()
    return " ".join(s.split())


def mapa_entidades(nombres_sesnsp: dict[str, str]) -> dict[str, str]:
    """nombre normalizado → cve_ent, construido desde el propio archivo SESNSP
    (pareo canónico clave-nombre) más alias frecuentes de CONAPO."""
    m = { _norm(nombre): cve for cve, nombre in nombres_sesnsp.items() }
    for alias, cve in ALIAS.items():
        m.setdefault(alias, cve)
    # prefijos: "coahuila de zaragoza" ya está; CONAPO usa formas cortas
    return m


def cargar_estatal(nombres_sesnsp: dict[str, str], anios: list[int]) -> pl.DataFrame:
    df = pl.read_csv(DIR / "poblacion_entidad" / "total.csv")
    m = mapa_entidades(nombres_sesnsp)
    filas = []
    faltantes = []
    for r in df.iter_rows(named=True):
        clave = m.get(_norm(r["ENTIDAD"]))
        if clave is None:
            faltantes.append(r["ENTIDAD"])
            continue
        for a in anios:
            v = r.get(str(a))
            if v is not None:
                filas.append({"cve_ent": clave, "anio": a, "poblacion": int(v)})
    if faltantes:
        raise ValueError(f"Entidades CONAPO sin mapear: {faltantes}")
    out = pl.DataFrame(filas)
    if out.get_column("cve_ent").n_unique() != 32:
        raise ValueError("No se mapearon las 32 entidades")
    return out


def cargar_municipal(anios: list[int]) -> pl.DataFrame:
    df = pl.read_csv(DIR / "poblacion_municipal" / "total.csv",
                     schema_overrides={"CVE": pl.Utf8})
    filas = []
    for r in df.iter_rows(named=True):
        cve = str(r["CVE"]).zfill(5)
        for a in anios:
            v = r.get(str(a))
            if v is not None:
                filas.append({"cve_mun": cve, "anio": a, "poblacion": int(v)})
    return pl.DataFrame(filas)


def validar(estatal: pl.DataFrame, municipal: pl.DataFrame) -> list[str]:
    """Controles de plausibilidad; devuelve avisos para el manifiesto."""
    avisos = []
    nac_2025 = estatal.filter(pl.col("anio") == 2025).get_column("poblacion").sum()
    if not (125_000_000 < nac_2025 < 140_000_000):
        raise ValueError(f"Población nacional 2025 fuera de rango plausible: {nac_2025}")
    # coherencia municipal vs estatal por año común (productos distintos: se admite brecha <2 %)
    for a in (2015, 2020, 2025):
        e = estatal.filter(pl.col("anio") == a).get_column("poblacion").sum()
        mm = municipal.filter(pl.col("anio") == a).get_column("poblacion").sum()
        brecha = abs(e - mm) / e * 100
        if brecha > 2:
            avisos.append(f"Población {a}: brecha estatal vs municipal de {brecha:.2f} % (productos CONAPO de distinta vigencia)")
        else:
            avisos.append(f"Población {a}: suma municipal difiere {brecha:.2f} % de la estatal (dentro de tolerancia)")
    return avisos
