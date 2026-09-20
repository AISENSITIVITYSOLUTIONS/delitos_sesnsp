"""Esquema canónico y contratos de columnas por instrumento de registro.

Los nombres de columnas esperados se VERIFICAN contra el archivo real al
ejecutar; si el archivo no coincide con ningún contrato conocido, el pipeline
se detiene con un error de esquema en lugar de adivinar.
"""
from __future__ import annotations

MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
         "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]

MES_NUM = {m: i + 1 for i, m in enumerate(MESES)}

# Contratos de columnas dimensionales conocidos (se comparan tras normalizar
# espacios/BOM). La lista real del archivo manda: cualquier desviación se
# reporta antes de transformar.
CONTRATOS = {
    ("estatal", "NM-2015"): {
        "dimensiones": ["Año", "Clave_Ent", "Entidad", "Bien jurídico afectado",
                         "Tipo de delito", "Subtipo de delito", "Modalidad"],
    },
    ("municipal", "NM-2015"): {
        "dimensiones": ["Año", "Clave_Ent", "Entidad", "Cve. Municipio", "Municipio",
                         "Bien jurídico afectado", "Tipo de delito", "Subtipo de delito", "Modalidad"],
    },
    # El instrumento 2026 (71 delitos) se contrasta al inspeccionar los archivos
    # reales; si su estructura difiere, se registra aquí tras el diagnóstico.
    ("estatal", "NR-2026"): {
        "dimensiones": None,  # se fija tras la inspección del archivo real
    },
    ("municipal", "NR-2026"): {
        "dimensiones": None,
    },
}

# Esquema canónico de la tabla larga `incidencia`
COLUMNAS_CANONICAS = [
    "anio", "mes", "nivel", "cve_ent", "entidad", "cve_mun", "municipio",
    "bien_juridico", "tipo", "subtipo", "modalidad",
    "cantidad", "metodologia", "fuente", "corte", "version_datos",
]

ENTIDADES_VALIDAS = {f"{i:02d}" for i in range(1, 33)}
