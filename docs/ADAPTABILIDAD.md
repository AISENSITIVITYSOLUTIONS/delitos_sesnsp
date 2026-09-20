# Adaptabilidad — revisión Grafito y zafiro, 20 septiembre 2026

## Cambios aplicados
Controles de botones/formularios >=44 px; etiquetas largas y métricas reorganizadas; navegación municipal mediante botón con teclado; acercar/alejar mapa 3D mediante botones. Tablas de fuentes e historial con desplazamiento local. Corrección de la anchura mínima de la rejilla de metodología, que provocaba un desbordamiento global de 419 px en el marco de 320 px. Se mantienen los tres modos visuales, calidad adaptativa y recuperación a 2D por ausencia de WebGL 2, error o pérdida de contexto. Datos estadísticos sin cambios.

## Pruebas realizadas
- Compilación TypeScript/Vite y 11 pruebas automatizadas: correctas.
- Chrome remoto, sitio publicado, marcos de 320×740, 360×800, 390×844, 740×320, 768×1024, 1024×768 y 1440×900. Anchuras útiles 305, 345, 375, 725, 753, 1009 y 1425 px (barra vertical ocupa 15 px). En cada caso scrollWidth = clientWidth: sin desbordamiento global en el estado inicial cargado.
- En esos estados, ningún botón ni selector habilitado visible midió menos de 44×44 px. No es una auditoría completa de todos los vínculos, gráficos SVG, diálogos y estados posibles.
- Captura visual de cabecera/filtros a 320 px revisada.
- Menú abierto/cerrado mediante Enter; Cinemático, Suave y Sin efectos activados mediante Enter, comprobando aria-pressed.
- WebGL 2 no disponible en este navegador: aviso de 2D observado y selector territorial accesible.
- Ampliación CSS 200 % dentro de marco 768×1024: sin desbordamiento global. NO equivale a zoom nativo del navegador.

## Pendientes y límites
Safari, Firefox y Edge no ejecutados; tampoco dispositivos físicos, zoom nativo al 200 %, renderizado real GPU 3D o pérdida de contexto inducida. El atajo de zoom de navegador no modificó la anchura de esta sesión y no se considera una prueba superada. No se declara compatibilidad universal. La prueba de marcos comprueba distribución CSS; no emula un motor diferente ni características táctiles del hardware.

## Reproducir
Abrir /qa-responsive.html. Elegir tamaño y pulsar «Medir contenido» después de cargar los datos. «Recargar dashboard» evita reutilizar una versión de entrada antigua. La página está marcada noindex y no forma parte de la navegación del producto. El desplazamiento del contenedor de prueba en escritorio permite marcos más anchos que la ventana y no pertenece al dashboard. Para cerrar la matriz, repetir navegación, filtros, tablas, diálogos y mapas en los cuatro navegadores con zoom nativo 200 % y dispositivo táctil real.
