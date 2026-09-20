"""Controles de calidad y conciliación sobre la tabla canónica.

Cada control produce un registro (control, alcance, resultado, detalle) que se
publica junto con los datos; el dashboard los expone en Metodología.
"""
from __future__ import annotations

import polars as pl

from esquema import ENTIDADES_VALIDAS


def control_duplicados(largo: pl.DataFrame) -> dict:
    claves = ["anio", "mes", "nivel", "cve_ent", "cve_mun",
              "bien_juridico", "tipo", "subtipo", "modalidad", "metodologia"]
    dup = largo.group_by(claves).len().filter(pl.col("len") > 1)
    return {"control": "duplicados_clave_unica", "resultado": "ok" if dup.height == 0 else "fallo",
            "detalle": f"{dup.height} combinaciones duplicadas"}


def control_entidades(largo: pl.DataFrame) -> dict:
    presentes = set(largo.get_column("cve_ent").unique().to_list())
    faltan = ENTIDADES_VALIDAS - presentes
    extra = presentes - ENTIDADES_VALIDAS
    ok = not faltan and not extra
    return {"control": "claves_entidad", "resultado": "ok" if ok else "fallo",
            "detalle": f"faltan={sorted(faltan)} extra={sorted(extra)}"}


def control_negativos(largo: pl.DataFrame) -> dict:
    n = largo.filter(pl.col("cantidad") < 0).height
    return {"control": "cantidades_negativas", "resultado": "ok" if n == 0 else "fallo",
            "detalle": f"{n} registros negativos"}


def control_nulos_en_periodo_publicado(largo: pl.DataFrame, corte: str) -> dict:
    anio_c, mes_c = int(corte[:4]), int(corte[5:7])
    publicado = largo.filter(
        (pl.col("anio") < anio_c) | ((pl.col("anio") == anio_c) & (pl.col("mes") <= mes_c))
    )
    n = publicado.filter(pl.col("cantidad").is_null()).height
    return {"control": "nulos_en_periodo_publicado", "resultado": "ok" if n == 0 else "aviso",
            "detalle": f"{n} celdas nulas dentro del periodo publicado (faltante ≠ cero)"}


def totales_por_anio(largo: pl.DataFrame) -> pl.DataFrame:
    return (largo.group_by("anio").agg(pl.col("cantidad").sum().alias("total"))
            .sort("anio"))


def conciliacion_estatal_municipal(estatal: pl.DataFrame, municipal: pl.DataFrame) -> pl.DataFrame:
    """Diferencias total estatal vs suma municipal por entidad-año.

    El total nacional del dashboard se construye SIEMPRE desde la fuente
    estatal del periodo; la municipal se usa para desagregación. Esta tabla
    cuantifica la brecha (incluye municipio 'No Especificado' del lado municipal).
    """
    e = (estatal.group_by(["anio", "cve_ent"]).agg(pl.col("cantidad").sum().alias("total_estatal")))
    m = (municipal.group_by(["anio", "cve_ent"]).agg(pl.col("cantidad").sum().alias("suma_municipal")))
    return (e.join(m, on=["anio", "cve_ent"], how="full", coalesce=True)
            .with_columns((pl.col("suma_municipal") - pl.col("total_estatal")).alias("diferencia"))
            .sort(["anio", "cve_ent"]))


def registros_sin_municipio(municipal: pl.DataFrame) -> pl.DataFrame:
    """Municipios 'No Especificado' u homólogos: se conservan para conciliación,
    nunca aparecen en rankings municipales."""
    patron = r"(?i)no especificado|otros municipios"
    return (municipal.filter(pl.col("municipio").str.contains(patron))
            .group_by(["anio", "cve_ent", "municipio"]).agg(pl.col("cantidad").sum().alias("total"))
            .sort(["anio", "cve_ent"]))
