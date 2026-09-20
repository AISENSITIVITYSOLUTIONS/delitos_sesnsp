# Costes estimados y despliegue

## Supuestos

- 4 fuentes; descarga mensual efectiva ≈ 180 MB (el municipal 2015-2025 domina); ~35 ciclos de verificación al mes (diario + refuerzo quincenal), de los cuales ~1–3 descargan y reconstruyen.
- Reconstrucción completa: ~2 min de cómputo (Polars + DuckDB, 8 GB RAM); frontal: ~1 min de build.
- Tráfico del tablero: productos estáticos ≈ 9 MB por visitante nuevo (con gzip ≈ 2.5 MB); sin API de servidor.

## Opción recomendada: GitHub Actions + GitHub Pages — 0 USD/mes

| Concepto | Uso estimado | Límite gratuito | Coste |
|---|---|---|---|
| Actions (repos públicos) | ~35 corridas × ~4 min ≈ 140 min/mes | ilimitado en público (2 000 min/mes en privado) | $0 |
| Pages (hosting estático) | ~9 MB por build | 100 GB/mes de banda | $0 |
| Almacenamiento de instantáneas | ~180 MB/mes en artefactos con retención 30 días | 500 MB–1 GB | $0 |

Supuesto crítico: los enlaces públicos de SharePoint del CNI siguen sirviendo el binario sin autenticación. Si el SESNSP endurece el acceso, el paso de descarga requerirá ajuste (no hay coste, sí mantenimiento).

## Alternativas

- **VPS pequeño** (si se prefiere control total): 1 vCPU/2 GB (≈ 5–7 USD/mes) + cron + nginx. Único coste real.
- **Vercel/Netlify** (frontal) + GitHub Actions (datos): $0 en planes libres; mismo perfil que Pages.
- **Publicación como artefacto de Claude** (URL actual): sin coste de hosting; la actualización consume uso del plan de Claude al pedirla («actualiza…»), con datos aportados por el usuario mientras la política de red siga cerrada.

## Despliegue reproducible (sin secretos)

```bash
# 1) Datos (requiere los 4 ZIP oficiales en raw/ o red abierta hacia el SESNSP)
pip install polars duckdb pyarrow pyyaml
python pipeline/src/construir.py          # transforma, valida, publica web/public/datos
python pipeline/tests/test_circuito.py    # pruebas del circuito (sintéticas)

# 2) Cartografía (una vez, o al cambiar de versión INEGI/CONABIO)
npm i -g mapshaper
git clone --depth 1 https://github.com/PhantomInsights/mexico-geojson raw/mexico-geojson
python pipeline/src/geo.py && cp -r work/geo_export/* web/public/datos/geo/

# 3) Frontal
cd web && npm ci && npm run build         # produce web/dist (estático, autocontenida)

# 4) Hosting: cualquier servidor estático (Pages/Vercel/nginx). No hay credenciales:
#    todas las fuentes son públicas y el repositorio no contiene secretos.
```

## Decisión de arquitectura (resumen)

React + TypeScript con **Vite** (no Next.js): el producto es 100 % estático —precálculo en Python, sin SSR ni API—, así que Vite da build más simple, hosting universal (Pages/artefacto de Claude) y menor superficie de mantenimiento; Next solo aportaría complejidad de servidor que este proyecto no usa. ECharts cubre todos los gráficos estadísticos; deck.gl (solo core+layers, carga diferida) cubre la extrusión 3D; el 2D usa SVG propio (ligero, accesible y sin dependencia WebGL, sirviendo además de alternativa cuando WebGL no está disponible). Sin mapa base de teselas: la política de contenido del hosting del artefacto bloquea hosts externos y el coroplético puro es más sobrio y rápido; la cartografía oficial se sirve como archivos propios.
