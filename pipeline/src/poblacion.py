"""Población oficial para denominadores de tasas.

Fuentes previstas (se registran versión y URL exactas al descargar):
- Estatal y nacional: CONAPO, Proyecciones de la Población de México y de las
  Entidades Federativas (conciliación demográfica vigente), población a mitad de año.
- Municipal: CONAPO, Proyecciones de población municipal vigentes; si el año
  requerido no está cubierto por una proyección defendible, la tasa municipal
  se marca como no disponible (se conserva el conteo).

Reglas:
- Denominador = población a mitad de año del territorio y año del numerador.
- Tasas mensuales: se reportan como tasa mensual por 100 mil (numerador del mes,
  denominador del año correspondiente), etiquetadas como tales.
- Acumulados multianuales: tasa anual media con exposición poblacional
  acumulada (suma de poblaciones anuales; años parciales ponderados por meses
  publicados). Nunca dividir un acumulado plurianual entre la población de un
  solo año.
"""
from __future__ import annotations

from pathlib import Path

import polars as pl

RAIZ = Path(__file__).resolve().parents[2]
DIR_POB = RAIZ / "raw" / "poblacion"


def cargar_poblacion_estatal(archivo: Path) -> pl.DataFrame:
    """Normaliza a: anio, cve_ent ('00' = nacional), poblacion. El parseo exacto
    se fija tras inspeccionar el archivo oficial descargado (estructura CONAPO)."""
    raise NotImplementedError("Se implementa contra el archivo oficial real descargado.")


def tasa_100k(conteo: pl.Expr, poblacion: pl.Expr) -> pl.Expr:
    return (conteo / poblacion * 100_000)


def exposicion_acumulada(pob_por_anio: pl.DataFrame, meses_por_anio: dict[int, int]) -> float:
    """Exposición poblacional para tasas de periodo multianual:
    sum(poblacion_anio * meses_publicados/12). Devuelve 'años-persona' efectivos."""
    total = 0.0
    for fila in pob_por_anio.iter_rows(named=True):
        m = meses_por_anio.get(fila["anio"], 0)
        total += fila["poblacion"] * (m / 12.0)
    return total
