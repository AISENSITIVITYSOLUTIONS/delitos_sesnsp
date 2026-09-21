# Gráficos 3D: implementación y límites

## Entregado
- React 19.2.8, deck.gl 9.4.0 (core, layers, react); versiones resueltas en package-lock.json. Sin nuevas dependencias.
- Mapa3D.tsx: iluminación mate AmbientLight + DirectionalLight, transición de elevación 650 ms Cinemático / 220 ms Estándar / inmediata Apagado; interpolación smoothstep.
- Contorno de selección PolygonLayer, sin bloom que altere la rampa estadística.
- Cámara a vista plana y perspectiva con transición de pitch/bearing; se conserva MapView para mantener georreferenciación.
- IntersectionObserver + Page Visibility liberan el canvas fuera de pantalla; la cámara React permanece guardada. Remontar implica recrear recursos, no es pooling.
- DPR limitado a 1–1.5 según modo, memoria/núcleos y puntero. Estas señales son heurísticas, no un benchmark de GPU.
- Pérdida de contexto activa 2D. Botón de reintento reconstruye 3D conservando datos, filtros, selección y cámara en el componente padre; no hay restauración automática garantizada del contexto perdido.
- Cifras KPI inmóviles; iluminación del contenedor sigue el puntero.
- Modos dataset: cinematico / estandar / apagado. Preferencia antigua suave migra a estandar. Movimiento reducido prevalece inicialmente; elegir Cinemático explícitamente en la sesión permite animaciones de mapa y escena.

## No implementado y por qué
- R3F/Three.js no estaban instalados. SSAO, bloom selectivo, TAA y DOF no se añadieron: no existen escenas R3F; tarjetas HTML no pueden recibir ese postprocesado directamente. DOF no debe ocultar valores.
- No se añadieron shaders propios GLSL, compute WebGPU, worker, LOD, pooling ni nuevas capas de instancias. No se afirma soporte WebGPU por detección de navigator.gpu.
- Hexágonos requieren una asignación geográfica válida de observaciones; no repartir totales municipales arbitrariamente.
- Arcos requieren datos de relación o flujo; correlaciones no son flujos.
- Sin partículas, stagger geográfico artificial ni cámara vinculada al scroll: evitan distraer o interferir con la exploración.
- Sin interpolación de colores entre clases: conserva correspondencia exacta con la leyenda.

## Validación
Compilación TypeScript/Vite. No se midieron FPS en Intel Iris Xe ni se ejecutó una prueba de pérdida de contexto en hardware real. Objetivo futuro: medir frame times p50/p95, memoria y filtros con la cartografía municipal completa; no garantizar 60 FPS.

Código completo: web/src/components/Mapa3D.tsx, MapaMx.tsx, Efectos3D.tsx y web/src/efectos.css.
Documentación de API: https://deck.gl/docs/api-reference/core/layer y https://deck.gl/docs/developer-guide/animations-and-transitions
