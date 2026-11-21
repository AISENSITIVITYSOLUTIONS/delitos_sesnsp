# Efectos visuales — 20 de septiembre de 2026

Selector «Experiencia 3D»: Cinemático, Suave y Sin efectos; preferencia local persistente. Predeterminado cinemático con puntero preciso y suave en dispositivos táctiles. Movimiento reducido del sistema tiene prioridad.

Cinemático: tarjetas KPI con perspectiva sensible al cursor, reflejo radial dinámico, elevación y sombras multicapa; cifras en una capa adelantada; anillos orbitales decorativos en el encabezado del laboratorio; sello con oscilación tridimensional. Los gráficos de comparación no se inclinan. Superficies con gráficos SVG/canvas se excluyen del seguimiento de puntero.

Los ornamentos animados solo se activan cuando son visibles. Se pausan al ocultarse la pestaña. El seguimiento del cursor usa requestAnimationFrame, sin bucle continuo, y limpia listeners al desmontar. No hay nuevas dependencias ni cambios estadísticos.

Mapa: iluminación ambiental y direccional existente, nuevo modo de malla, resaltado de selección por cursor, alternancia perspectiva/ortográfica y transición de giro. Relieve regulable existente. El modo 3D requiere WebGL; la cartografía 2D sigue disponible. Las preferencias de apariencia no modifican valores ni denominadores.

No se anuncian efectos de ray tracing, oclusión ambiental ni simulaciones físicas no implementadas. Las órbitas del encabezado son decorativas, no representan datos.

## Adaptaciones del sitio Decroly — 21 de noviembre de 2026

Se adoptaron solo los efectos compatibles con un tablero de datos: barra de progreso de lectura, luz tenue que sigue al cursor (tema oscuro), revelado de secciones al entrar en pantalla, entrada escalonada en 3D de las fichas, título por palabras y un campo de partículas WebGL en la sección «Último corte» (`Ambiente.tsx`, `CampoParticulas.tsx`). Las partículas son decorativas y no representan datos.

No se adoptaron: desplazamiento suavizado (Lenis), porque interfiere con el zoom de mapas y gráficas; el carrusel en anillo, porque oculta la mayoría de las cifras a la vez; ni las transiciones de fotografía, que no aplican. Sin dependencias nuevas (no se añadió GSAP).

## «Último corte» ampliado — 21 de noviembre de 2026

Las barras mensuales pasan a una escena WebGL (`BarrasMes3D.tsx`, Three.js): volumen con luz, reflejo en el piso, paralaje de cámara y selección por cursor o toque con ficha del mes (registros, promedio diario y variación). La altura parte de cero. Si WebGL no está disponible se muestra la versión anterior en CSS con el eje de meses. La lista de meses se conserva oculta visualmente para lectores de pantalla e impresión. Las fichas de indicadores suman minigráficos (escala propia de cada ficha) y la lista de delitos del mes muestra cinco con su participación.

## «Quién es víctima» en anillo — 21 de noviembre de 2026

Adaptación del carrusel «Año decroliano»: las diez fichas forman un anillo 3D (CSS) que gira solo, se arrastra, acelera con el desplazamiento de la página y trae al frente la ficha elegida. Las donas tienen grosor (capas apiladas en Z). El anillo es decorativo para lectores de pantalla: la lista ordenada con barras apiladas muestra siempre los diez delitos y sirve de navegación; el panel de detalle sustituye al reverso de las fichas. Con «reducir movimiento» el anillo no gira solo.

## «Evolución y comparación de delitos» — 21 de noviembre de 2026

Se añade el «relieve temporal» (`RelieveTemporal.tsx`, Three.js): cada franja es un año y cada punto un mes de la serie y métrica elegidas, con altura desde cero; un mes sin dato corta la franja (no se interpola). Marca el mes de análisis y el de referencia y los une con un arco; al señalar un mes muestra su valor y un clic lo fija como mes de análisis. Es otra vista de la misma serie de la pestaña «Evolución»: no agrega ni transforma cifras. Sin WebGL no se muestra y quedan la gráfica y la tabla. El comparador suma una escala referencia→análisis que parte de cero; las pestañas tienen indicador deslizante. Los textos, fórmulas y advertencias metodológicas no cambiaron.
