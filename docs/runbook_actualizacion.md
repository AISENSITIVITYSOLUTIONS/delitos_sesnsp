# Runbook de actualización

## Qué hace un ciclo (pipeline/src/actualizar.py)

1. **Consulta** las cuatro URL oficiales (fuentes.yaml) con reintentos limitados; registra ETag/Last-Modified cuando existen y calcula SHA-256 del contenido descargado a un área temporal. Una respuesta HTML de error jamás se procesa como datos.
2. **Detecta cambios** comparando huellas contra `work/estado.json` (procesar dos veces el mismo archivo no duplica nada: cada corrida reconstruye desde los originales).
3. **Promueve** los ZIP validados a `raw/` (con instantánea fechada en `raw/instantaneas/`), extrae el CSV canónico de cada fuente.
4. **Reconstruye TODO en staging**: transformación al esquema canónico (corte detectado por cobertura, meses posteriores → no publicado), controles (contrato de columnas, duplicados, 32 entidades, negativos, conciliación estatal-municipal, corte vs cobertura), productos JSON, hallazgos recalculados y manifiesto. Cualquier control en `fallo` aborta.
5. **Publica atómicamente**: el directorio publicado solo se reemplaza si todo el staging se construyó y validó; la versión anterior queda en `work/datos_prev`. `historial.jsonl` registra cada evento (publicación, sin_cambios, fallo_descarga, fallo_construccion).
6. Bloqueo de ejecuciones simultáneas por lock de archivo. Salidas: 0 = publicado o sin cambios; 1 = fallo de construcción (se conserva la última versión válida); 2 = fallo de consulta; 3 = otra corrida en curso.

Estados visibles en el tablero (encabezado): **último mes cubierto** (corte), **última consulta a la fuente**, **última actualización validada** — tres fechas independientes.

## Dónde corre

- **GitHub Actions** (recomendado; `.github/workflows/actualizar.yml`): diario 09:10 CDMX + cada 6 h los días 15–31; publica el frontal en GitHub Pages. Requiere: repositorio con este código, Pages activado (Settings → Pages → GitHub Actions). Sin secretos: todas las fuentes son públicas.
- **En Claude (esta conversación)**: con la política de red actual de la cuenta, el entorno de Claude **no puede** alcanzar SharePoint/gob.mx, por lo que la actualización aquí es **asistida**: coloca los ZIP nuevos en la carpeta conectada (o adjúntalos) y pide «actualiza con el corte de <mes>»; el pipeline valida, reconstruye y republica el artefacto en la misma URL. Si algún día se habilita la red, `actualizar.py` funciona sin cambios también aquí.

## Calendario y detección

No se asume que los cambios lleguen solo a fin de mes: el ciclo diario cubre todo el mes y se refuerza cada 6 h en la segunda quincena. La detección usa ETag/Last-Modified cuando el servidor los ofrece y siempre confirma por huella del contenido; los cambios de cifras se distinguen de cambios de presentación comparando el contenido canónico (parquet ordenado). No hay notificaciones push de SharePoint (Microsoft Graph exige permisos que un enlace público no otorga); con consultas periódicas, la demora máxima esperada es de 24 h (6 h en la segunda quincena).

## Cambios previsibles y cómo actuar

- **Nuevo mes del RNID**: automático; el corte se detecta por cobertura y todos los productos, hallazgos y etiquetas se recalculan.
- **Correcciones a meses anteriores**: automáticas (huella distinta → reconstrucción completa); `manifiesto.cambios` documenta qué cambió y cuánto.
- **Año nuevo (p. ej. RNID 2027)**: el SESNSP publica archivos nuevos por año. Añadir las dos URL nuevas a `pipeline/config/fuentes.yaml` y a `FUENTES` en `construir.py` (estatal_2027 / municipal_2027, metodología NR-2026). El código deriva años y cortes de los datos: no hay más constantes que tocar.
- **Cambio de URL**: localizar el reemplazo en el catálogo oficial de datos abiertos del SESNSP y verificar que corresponda al mismo producto estadístico (nombre del producto, cobertura, unidad) antes de sustituirla.
- **Nuevos delitos / cambio de catálogo**: el contrato de columnas y el control de subtipos detectan la novedad y detienen la publicación; actualizar `correspondencias.py` con el fundamento documental y re-ejecutar.
- **Cambios geográficos** (municipio nuevo): aparece automáticamente en tablas; para el mapa, regenerar cartografía cuando INEGI publique la versión que lo incluya (`pipeline/src/geo.py`).

## Incidencias

- Descarga fallida o esquema incompatible → el tablero conserva la última versión válida y el encabezado muestra la fecha de la última consulta; revisar `work/historial.jsonl` y el artefacto de bitácora del workflow.
- Pruebas del circuito: `python pipeline/tests/test_circuito.py` (mes nuevo, corrección histórica, archivo inválido, idempotencia, cero vs no publicado) — sintéticas y separadas de los datos oficiales.
