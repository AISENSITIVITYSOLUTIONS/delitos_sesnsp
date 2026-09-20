"""Definiciones centralizadas de métricas (una sola fuente de verdad).

Estas definiciones alimentan los productos precalculados del dashboard; la
aplicación web replica exactamente estas fórmulas (documentadas en
web/src/lib/metricas.ts) para que gráficos, tablas y exportaciones coincidan.

Reglas de comparación (contrato):
- Totales nacionales: SIEMPRE desde la fuente estatal compatible del periodo.
- Año en curso vs mismos meses de años anteriores (nunca acumulado parcial
  contra año completo; nunca anualizar periodos incompletos).
- Variación % con denominador cero → no calculable (null), no infinito.
- Tasa = cantidad / población * 100 000, denominador del territorio y año del
  numerador; acumulados multianuales usan exposición poblacional acumulada.
- Cero reportado ≠ faltante ≠ no publicado: los agregados suman solo valores
  publicados y registran meses_publicados para etiquetar el periodo exacto.
"""
from __future__ import annotations

import duckdb
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
DB = RAIZ / "work" / "sesnsp.duckdb"


def conectar() -> duckdb.DuckDBPyConnection:
    con = duckdb.connect(str(DB))
    con.execute("SET threads TO 4;")
    return con


def crear_vistas(con: duckdb.DuckDBPyConnection) -> None:
    con.execute(f"""
        CREATE OR REPLACE VIEW incidencia AS
        SELECT * FROM read_parquet('{RAIZ}/work/parquet/incidencia_*.parquet');
    """)


# --- Agregados básicos -----------------------------------------------------

SQL_NACIONAL_MENSUAL_SUBTIPO = """
SELECT metodologia, anio, mes, bien_juridico, tipo, subtipo,
       SUM(cantidad) AS cantidad,
       COUNT(*) FILTER (WHERE cantidad IS NOT NULL) AS celdas_publicadas
FROM incidencia
WHERE nivel = 'estatal'
GROUP BY ALL
ORDER BY metodologia, anio, mes, bien_juridico, tipo, subtipo
"""

SQL_ESTATAL_ANUAL_SUBTIPO = """
SELECT metodologia, anio, cve_ent, any_value(entidad) AS entidad,
       bien_juridico, tipo, subtipo,
       SUM(cantidad) AS cantidad,
       COUNT(DISTINCT mes) FILTER (WHERE cantidad IS NOT NULL) AS meses_publicados
FROM incidencia
WHERE nivel = 'estatal'
GROUP BY ALL
"""

SQL_ESTATAL_MENSUAL_TOTAL = """
SELECT metodologia, anio, mes, cve_ent, any_value(entidad) AS entidad,
       SUM(cantidad) AS cantidad
FROM incidencia
WHERE nivel = 'estatal'
GROUP BY ALL
"""

SQL_MUNICIPAL_ANUAL_TOTAL = """
SELECT metodologia, anio, cve_ent, cve_mun, any_value(municipio) AS municipio,
       any_value(entidad) AS entidad,
       SUM(cantidad) AS cantidad,
       COUNT(DISTINCT mes) FILTER (WHERE cantidad IS NOT NULL) AS meses_publicados
FROM incidencia
WHERE nivel = 'municipal'
GROUP BY ALL
"""

SQL_MUNICIPAL_ANUAL_BIEN = """
SELECT metodologia, anio, cve_ent, cve_mun, bien_juridico,
       SUM(cantidad) AS cantidad
FROM incidencia
WHERE nivel = 'municipal'
GROUP BY ALL
"""


def variacion_pct(actual: float | None, anterior: float | None) -> float | None:
    """Variación porcentual; no calculable si el denominador es cero o falta."""
    if actual is None or anterior is None or anterior == 0:
        return None
    return (actual - anterior) / anterior * 100.0


def tasa_100k(cantidad: float | None, poblacion: float | None) -> float | None:
    if cantidad is None or poblacion is None or poblacion <= 0:
        return None
    return cantidad / poblacion * 100_000.0
