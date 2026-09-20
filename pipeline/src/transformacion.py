"""Transformación de los CSV oficiales (formato ancho mensual) al esquema canónico largo.

Principios:
- La estructura del archivo real manda: se valida contra el contrato del
  instrumento y cualquier desviación detiene el proceso con diagnóstico.
- Claves territoriales como texto con ceros preservados (cve_ent "01".."32",
  cve_mun de 5 dígitos).
- Distinción explícita entre 0 (cero reportado) y null (mes no publicado).
- Los originales se conservan intactos en `raw/`; lo procesado va a `work/`.
"""
from __future__ import annotations

import io
import unicodedata
import zipfile
from pathlib import Path

import polars as pl

from esquema import MESES, CONTRATOS

RAIZ = Path(__file__).resolve().parents[2]


def _limpia_nombre(c: str) -> str:
    c = c.replace("﻿", "").strip()
    return " ".join(c.split())


def detectar_codificacion(muestra: bytes) -> str:
    """Los CSV del SESNSP históricamente llegan en cp1252/latin-1; algunos cortes en UTF-8."""
    for enc in ("utf-8-sig", "utf-8"):
        try:
            muestra.decode(enc)
            return enc
        except UnicodeDecodeError:
            pass
    return "cp1252"


def abrir_csv_fuente(ruta: Path) -> tuple[bytes, str]:
    """Devuelve los bytes del CSV (extrayéndolo del ZIP si procede) y el nombre interno."""
    if zipfile.is_zipfile(ruta):
        with zipfile.ZipFile(ruta) as z:
            candidatos = [n for n in z.namelist() if n.lower().endswith(".csv")]
            if len(candidatos) != 1:
                raise ValueError(f"{ruta.name}: se esperaba exactamente 1 CSV dentro del ZIP; hay {candidatos}")
            return z.read(candidatos[0]), candidatos[0]
    return ruta.read_bytes(), ruta.name


def leer_ancho(ruta: Path) -> tuple[pl.DataFrame, dict]:
    crudo, nombre_interno = abrir_csv_fuente(ruta)
    enc = detectar_codificacion(crudo[:400_000])
    df = pl.read_csv(io.BytesIO(crudo), encoding=enc if enc != "cp1252" else "windows-1252",
                     infer_schema_length=2000, null_values=["", "NA", "N/A"])
    df = df.rename({c: _limpia_nombre(c) for c in df.columns})
    meta = {"nombre_interno": nombre_interno, "codificacion": enc,
            "filas": df.height, "columnas": df.columns}
    return df, meta


def validar_contrato(df: pl.DataFrame, nivel: str, metodologia: str) -> list[str]:
    contrato = CONTRATOS.get((nivel, metodologia), {})
    dims = contrato.get("dimensiones")
    errores = []
    if dims is None:
        return [f"Contrato no fijado aún para ({nivel}, {metodologia}); requiere inspección manual."]
    faltantes = [c for c in dims if c not in df.columns]
    if faltantes:
        errores.append(f"Faltan columnas dimensionales: {faltantes}")
    meses_faltantes = [m for m in MESES if m not in df.columns]
    if meses_faltantes:
        errores.append(f"Faltan columnas de mes: {meses_faltantes}")
    extras = [c for c in df.columns if c not in dims + MESES]
    if extras:
        errores.append(f"Columnas no previstas por el contrato: {extras}")
    return errores


def a_largo(df: pl.DataFrame, nivel: str, metodologia: str, fuente: str,
            corte: str, version_datos: str, dims: list[str]) -> pl.DataFrame:
    """Pivote ancho→largo con claves preservadas y tipos canónicos.

    Para contener memoria (el municipal produce >30 M de filas), las columnas
    de texto se convierten a Categorical ANTES del unpivot y las claves se
    normalizan en el marco ancho."""
    ren = {"Año": "anio", "Clave_Ent": "cve_ent", "Entidad": "entidad",
           "Bien jurídico afectado": "bien_juridico", "Tipo de delito": "tipo",
           "Subtipo de delito": "subtipo", "Modalidad": "modalidad",
           "Cve. Municipio": "cve_mun", "Municipio": "municipio"}
    presentes = {k: v for k, v in ren.items() if k in df.columns}
    ancho = df.rename(presentes)

    prep = [
        pl.col("anio").cast(pl.Int16),
        pl.col("cve_ent").cast(pl.Int32).cast(pl.Utf8).str.zfill(2),
    ]
    if "cve_mun" in ancho.columns:
        prep.append(pl.col("cve_mun").cast(pl.Int64, strict=False).cast(pl.Utf8).str.zfill(5))
    for c in ("bien_juridico", "tipo", "subtipo", "modalidad", "entidad", "municipio"):
        if c in ancho.columns:
            prep.append(pl.col(c).cast(pl.Utf8).str.strip_chars().cast(pl.Categorical).alias(c))
    prep += [pl.col(m).cast(pl.Int32, strict=False) for m in MESES]
    ancho = ancho.with_columns(prep)

    largo = (
        ancho.unpivot(index=list(presentes.values()), on=MESES,
                      variable_name="mes_nombre", value_name="cantidad")
        .with_columns([
            pl.col("mes_nombre").replace_strict({m: i + 1 for i, m in enumerate(MESES)},
                                                return_dtype=pl.Int8).alias("mes"),
            pl.lit(nivel).alias("nivel"),
            pl.lit(metodologia).alias("metodologia"),
            pl.lit(fuente).alias("fuente"),
            pl.lit(corte).alias("corte"),
            pl.lit(version_datos).alias("version_datos"),
        ])
        .drop("mes_nombre")
    )
    if "cve_mun" not in largo.columns:
        largo = largo.with_columns([pl.lit(None, dtype=pl.Utf8).alias("cve_mun"),
                                    pl.lit(None, dtype=pl.Utf8).alias("municipio")])
    return largo


def marcar_no_publicado(largo: pl.DataFrame, corte: str) -> pl.DataFrame:
    """En el año del corte, los meses posteriores al corte son 'no publicado' (null).

    Regla: corte = 'YYYY-MM' determinado por metadatos de publicación y cobertura.
    Un null dentro del periodo publicado se conserva como null (faltante) y se
    reporta en los controles; no se convierte en cero.
    """
    anio_c, mes_c = int(corte[:4]), int(corte[5:7])
    return largo.with_columns(
        pl.when((pl.col("anio") == anio_c) & (pl.col("mes") > mes_c))
        .then(pl.lit(None, dtype=pl.Int32))
        .when((pl.col("anio") > anio_c))
        .then(pl.lit(None, dtype=pl.Int32))
        .otherwise(pl.col("cantidad"))
        .alias("cantidad")
    )


def cobertura_maxima(largo: pl.DataFrame) -> tuple[int, int]:
    """Último (año, mes) con al menos un valor no nulo — insumo (no sustituto)
    de la determinación del corte."""
    nn = largo.filter(pl.col("cantidad").is_not_null())
    ult = nn.select(pl.struct(["anio", "mes"]).max()).item()
    return ult["anio"], ult["mes"]
