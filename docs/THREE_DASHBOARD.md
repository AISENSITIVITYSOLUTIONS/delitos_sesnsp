# Exploración territorial con Three.js

La vista 3D de `MapaMx` ahora carga de forma diferida una escena Three.js. Mantiene las propiedades de datos, cuantiles, máximo de referencia, selección y retorno a 2D del componente existente. No modifica fuentes, cálculos ni productos del pipeline.

## Interacción

- OrbitControls: rotación, zoom y desplazamiento; botones para acercar, alejar, vista superior y restablecer.
- Polígonos exteriores independientes: cada anillo del contrato `Territorio.pols` genera su propia extrusión, incluyendo islas. No se interpreta la lista como anillos interiores.
- Mercator local centrado y escalado uniformemente; altura lineal respecto al máximo recibido.
- Cero: superficie clara; ausencia: gris; ambos conservan una base mínima visual de 0.12 unidades, sin representar un conteo positivo.
- Selección mediante raycasting, o mediante el selector accesible existente. Arrastrar más de 5 píxeles no selecciona un territorio.
- Cámara conservada al alternar 2D/3D únicamente si coincide el conjunto territorial.
- Vista superior en perspectiva, no proyección ortográfica.
- No hay animación continua, giro automático ni interpolación de cifras. Render bajo demanda; suspensión fuera de pantalla o con pestaña oculta.
- Pérdida de contexto o fallo de creación del renderer activa el retorno a 2D existente.
- Desmontar libera geometrías, materiales, controles, observadores y renderer.

## Verificación

`npm run build` y `node --test tests/*.test.mjs` desde `web/`.
Las pruebas adicionales triangulan la cartografía real nacional y municipal de CDMX y Oaxaca y verifican coordenadas finitas y orientación de la extrusión. No sustituyen una prueba visual WebGL.

El navegador remoto de esta sesión no pudo alcanzar el servidor local (ERR_CONNECTION_REFUSED). Pendientes: revisión visual en escritorio/móvil, prueba táctil, pérdida de contexto y medición de rendimiento en hardware real. No se garantiza una tasa de cuadros por segundo.

La publicación existente se dispara con cambios en master. Revisar esta rama antes de fusionarla.
