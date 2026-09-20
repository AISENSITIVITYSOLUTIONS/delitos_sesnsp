# Incidencia Delictiva MX — dashboard analítico del fuero común

Observatorio de los delitos registrados del fuero común en México (SESNSP), de enero de 2015 al último corte oficial publicado (actual: agosto de 2026), con comparabilidad documentada entre el instrumento CNSP/38/15 (2015-2025) y el RNID vigente desde 2026, tasas con población oficial CONAPO, exploración territorial 2D/3D y circuito de actualización automática.

## Estructura

```
pipeline/
  config/fuentes.yaml      # URLs oficiales y parámetros de descarga
  src/
    descarga.py            # descarga verificada (huellas, HTML nunca es dato)
    esquema.py             # contratos de columnas por instrumento
    transformacion.py      # ancho→largo canónico; cero vs no publicado
    validacion.py          # controles y conciliación
    correspondencias.py    # homologación CNSP/38/15 ↔ RNID (documentada)
    poblacion_carga.py     # denominadores CONAPO + validación
    metricas.py            # definiciones centralizadas (SQL/fórmulas)
    construir.py           # orquestador: canónico → controles → productos
    hallazgos.py           # reglas R1–R5 de los cinco hallazgos
    exportar_web.py        # productos JSON con metadatos
    geo.py                 # cartografía simplificada reproducible
    actualizar.py          # ciclo: detectar → reconstruir → publicar atómico
  tests/test_circuito.py   # mes nuevo / corrección / archivo inválido (sintéticos)
web/                       # React 19 + TypeScript + Vite; ECharts; deck.gl (3D)
  src/theme/paleta.ts      # paleta validada (CVD, contraste) claro/oscuro
  public/datos/            # productos publicados (JSON + geo)
docs/                      # diccionario, runbook, costes y despliegue
.github/workflows/actualizar.yml  # actualización automática + Pages
```

## Arranque rápido

Ver `docs/costes_y_despliegue.md` (reproducible, sin secretos). Requisitos: Python 3.11+ (polars, duckdb, pyarrow, pyyaml), Node 20+.

## Principios verificables

Totales nacionales siempre desde la fuente estatal del periodo (la municipal desagrega; conciliación exacta verificada: diferencia 0 en entidad-año en el corte actual); categorías del mismo nivel, sin sumar subtotales con partes; residuales «Otros…» identificados; registros sin municipio fuera de rankings pero dentro de conciliación; 0 ≠ no publicado ≠ no comparable; comparaciones solo entre meses equivalentes; tasas de periodo con exposición poblacional acumulada; media móvil de 12 meses solo con ventanas completas; hallazgos recalculados por reglas documentadas con «Ver cálculo».

Fuentes oficiales, documentación metodológica y limitaciones: sección «Metodología» del tablero y `docs/diccionario_datos.md`.
