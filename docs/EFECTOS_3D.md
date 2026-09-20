# Efectos visuales — 20 de septiembre de 2026

Selector «Experiencia 3D»: Cinemático, Suave y Sin efectos; preferencia local persistente. Predeterminado cinemático con puntero preciso y suave en dispositivos táctiles. Movimiento reducido del sistema tiene prioridad.

Cinemático: tarjetas KPI con perspectiva sensible al cursor, reflejo radial dinámico, elevación y sombras multicapa; cifras en una capa adelantada; anillos orbitales decorativos en el encabezado del laboratorio; sello con oscilación tridimensional. Los gráficos de comparación no se inclinan. Superficies con gráficos SVG/canvas se excluyen del seguimiento de puntero.

Los ornamentos animados solo se activan cuando son visibles. Se pausan al ocultarse la pestaña. El seguimiento del cursor usa requestAnimationFrame, sin bucle continuo, y limpia listeners al desmontar. No hay nuevas dependencias ni cambios estadísticos.

Mapa: iluminación ambiental y direccional existente, nuevo modo de malla, resaltado de selección por cursor, alternancia perspectiva/ortográfica y transición de giro. Relieve regulable existente. El modo 3D requiere WebGL; la cartografía 2D sigue disponible. Las preferencias de apariencia no modifican valores ni denominadores.

No se anuncian efectos de ray tracing, oclusión ambiental ni simulaciones físicas no implementadas. Las órbitas del encabezado son decorativas, no representan datos.
