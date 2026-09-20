# Adaptabilidad — 20 de septiembre de 2026

Cambios: controles de formulario y botones de al menos 44 px, rejillas de una columna en móvil, filtros que se reorganizan, menú con desplazamiento propio, tablas con desplazamiento local y leyenda territorial fuera del mapa. Consulta territorial mediante selector nativo, teclado y tacto. Se conservan Cinemático, Suave y Sin efectos.

Mapa 3D: exige WebGL 2; limita densidad de renderizado según memoria disponible, procesadores, puntero táctil y modo de efectos. Ante error de renderizado/carga o pérdida de contexto vuelve a 2D conservando los valores. La detección de capacidad es heurística, no un benchmark de GPU.

## Verificación realizada
- Instalación de dependencias y compilación TypeScript/Vite: correctas.
- Nueve pruebas existentes de métricas y conciliación territorial: correctas.
- Datos estadísticos y fechas de corte: sin modificaciones.

## Verificación visual pendiente
No se ha completado la prueba visual de esta revisión a 320 px, zoom nativo al 200 %, orientaciones vertical/horizontal ni la matriz Chrome, Safari, Firefox y Edge. Tampoco se ha provocado una pérdida real de contexto GPU. Las reglas CSS y mecanismos de recuperación están implementados; esto no equivale a compatibilidad universal verificada.

Protocolo: comprobar a 320, 360, 390, 768, 1024 y 1440 px; repetir con zoom de navegador al 200 %; recorrer todos los apartados; abrir menú, filtros, diálogos y tablas; navegar con Tab/Enter y tacto; confirmar ausencia de desbordamiento global. Probar los tres modos y desactivar WebGL para comprobar que datos y selección siguen accesibles. Registrar versión de navegador, dispositivo y resultados antes de declarar cada caso verificado.
