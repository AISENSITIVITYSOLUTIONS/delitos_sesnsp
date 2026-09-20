# Diccionario de datos

## Unidad de observación

La cifra elemental de todo el proyecto es el **delito registrado**: presunto delito contenido en carpetas de investigación iniciadas por las fiscalías estatales y reportado mensualmente al SESNSP (incidencia delictiva del fuero común). No equivale a **carpetas** (una carpeta puede contener varios delitos) ni a **víctimas** (producto estadístico distinto del SESNSP); estas unidades no se combinan en ninguna cifra del tablero. «Todos los delitos» = todas las categorías del instrumento vigente en cada tramo.

## Fuentes primarias (corte verificado: agosto de 2026)

| Clave | Producto oficial | Instrumento | Periodo | Filas |
|---|---|---|---|---|
| estatal_2015_2025 | Cifras de Incidencia Delictiva Estatal | CNSP/38/15 («53 delitos»; 55 subtipos y 98 modalidades en archivo) | ene 2015 – dic 2025 | 34 496 |
| municipal_2015_2025 | Cifras de Incidencia Delictiva Municipal | CNSP/38/15 | ene 2015 – dic 2025 | 2 562 994 |
| estatal_2026 | RNID Estatal | RNID/Acuerdo 11/L/2024 («71 delitos»; 79 subtipos y 114 modalidades en archivo) | ene 2026 – corte | 3 648 |
| municipal_2026 | RNID Municipal | RNID/Acuerdo 11/L/2024 | ene 2026 – corte | 286 140 |

Codificación: 2015-2025 en cp1252; RNID 2026 en UTF-8 con BOM. Formato ancho: una columna por mes (Enero…Diciembre). El SESNSP advierte que el CSV municipal 2015-2025 no debe abrirse en hoja de cálculo (se trunca); este pipeline lo procesa con Polars/DuckDB.

## Esquema canónico `incidencia` (Parquet, formato largo)

| Columna | Tipo | Descripción |
|---|---|---|
| anio | int16 | Año calendario |
| mes | int8 | 1–12 |
| nivel | str | `estatal` \| `municipal` |
| cve_ent | str(2) | Clave INEGI de entidad, ceros preservados («01»–«32») |
| entidad | str | Nombre oficial de la entidad |
| cve_mun | str(5) \| null | Clave INEGI de municipio (p. ej. «01001»); null en fuente estatal |
| municipio | str \| null | Nombre; incluye pseudorregistros «No Especificado» |
| bien_juridico | str | Nivel 1 del catálogo (7 categorías, idénticas en ambos instrumentos) |
| tipo | str | Nivel 2 (40 en CNSP/38/15; 47 en RNID) |
| subtipo | str | Nivel 3 — **nivel de análisis de los rankings** (55 / 79) |
| modalidad | str | Nivel 4, hoja del catálogo (98 / 114 combinaciones) |
| cantidad | int32 \| null | Delitos registrados. **0 = cero reportado; null = mes no publicado** |
| metodologia | str | `NM-2015` (CNSP/38/15) \| `NR-2026` (RNID) |
| fuente | str | Clave de la fuente primaria |
| corte | str | «YYYY-MM» del tramo |
| version_datos | str | Fecha de construcción (huella de la corrida) |

Clave única: (anio, mes, nivel, cve_ent, cve_mun, bien_juridico, tipo, subtipo, modalidad, metodologia) — verificada sin duplicados en las cuatro fuentes.

Semántica de vacíos: **cero reportado** (0 publicado), **no publicado** (meses posteriores al corte; el RNID los distribuye como 0 y el pipeline los enmascara a null tras verificar que no exista actividad después del corte), **no aplicable** (cve_mun en fuente estatal), **no comparable** (series no homologadas entre instrumentos; se muestran por tramos), **faltante** (null dentro del periodo publicado; 0 casos en el corte actual).

Casos especiales verificados: 2 celdas negativas (−1) en municipal 2015-2025 (Jonuta, Tabasco, may 2018; Iztacalco, CDMX, sep 2017), correcciones del archivo oficial que se conservan tal cual; pseudorregistros «No Especificado» (claves XX998/XX999 en 2015-2025; XX999 estandarizado en RNID) que suman 80 947 delitos (0.37 %) en 2015-2025 y 6 372 (0.47 %) en 2026 — se conservan en conciliación y **nunca** compiten en rankings; 2 478 municipios reales en ambos tramos (sin cambios territoriales entre instrumentos).

## Denominadores de población

- Nacional y estatal: CONAPO, población a mitad de año (proyecciones vigentes).
- Municipal: CONAPO, Reconstrucción y proyecciones de la población de los municipios de México 1990-2040.
- Obtenidos de espejo público verificado (`lapanquecita/poblacion-estimada`); consistencia validada (suma municipal vs estatal < 2 % de brecha por año). Sustituir por descarga directa CONAPO cuando la red del entorno lo permita.
- Sin proyección oficial (tasa = n. d.): 24059 Villa de Pozos, 25019 Eldorado, 25020 Juan José Ríos (municipios de creación reciente).

Fórmulas: tasa = cantidad ÷ población del territorio y año × 100 000. Tasas mensuales: numerador mensual, denominador anual, etiquetadas «tasa mensual». Periodos multianuales: numerador acumulado ÷ **exposición poblacional acumulada** (Σ población_año × meses_publicados/12) × 100 000. Variación % no calculable si el denominador es 0. Comparaciones interanuales solo entre meses equivalentes.

## Cartografía

División política estatal y municipal 1:250 000 (CONABIO/INEGI), versión 2023, simplificada para web (mapshaper, `interval=280 m` municipal). Claves CVEGEO compatibles con las bases del SESNSP; 3 municipios recientes sin polígono (solo tablas). Formato: `{cve, nombre, pols: [anillos exteriores [lon,lat]]}`.

## Productos publicados (web/public/datos/)

| Archivo | Contenido |
|---|---|
| manifiesto.json | Versión, cortes, huellas SHA-256 de fuentes, controles, conciliación, avisos, historial |
| nacional_mensual_nm.json / _nr.json | Series mensuales nacionales por subtipo y modalidad + total, por instrumento |
| nacional_mensual_homologado.json | Periodo completo, solo 51 series homologadas + total (con nota de discontinuidad) |
| correspondencias.json | Tabla de correspondencias CNSP/38/15 ↔ RNID (relación, transformación, vigencia, fundamento) |
| poblacion.json | Denominadores nacional/estatal/municipal por año |
| estatal_anual.json | Totales anuales por entidad + desglose de los 12 subtipos homologados de mayor volumen |
| municipal_anual.json | Totales anuales por municipio (todos los delitos) + registros sin municipio |
| municipal_bien_anual.json | Composición municipal por bien jurídico y año |
| ranking_delitos.json | Rankings de subtipos por periodo (2015-2025, 2026, completo homologado) |
| ranking_municipios.json | Rankings municipales por volumen y por tasa (con población, para umbrales) |
| hallazgos.json | Cinco hallazgos con regla, fórmula, datos de entrada y fuente |
| geo/ | estados.json + municipios_XX.json (32) |

Todo producto lleva `meta` con fuente, URL, corte, unidad, versión y notas; las exportaciones CSV del tablero anteponen esos metadatos como comentarios `#`.
