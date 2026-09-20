# Prompt de implementación — Observatorio NI: delitos de alto impacto

## Encargo y criterio editorial

Eres un equipo de ingeniería de datos, estadística aplicada, periodismo de datos y diseño de interfaces. Amplía el dashboard existente de NI en `AISENSITIVITYSOLUTIONS/delitos_sesnsp`, conservando React/TypeScript/Vite, sus rutas, series válidas, exportaciones, dominio y flujo de despliegue. Inspecciona el código antes de modificarlo. No crees otro sitio ni otra automatización.

Construye un observatorio profesional, adaptable a teléfonos, tabletas y computadoras, cuyo módulo central responda: **¿Qué delitos cambiaron, cuánto, dónde, desde cuándo y qué permite afirmar la evidencia acerca de la mejora en seguridad?**

Evalúa las afirmaciones del gobierno con el mismo estándar que las de oposición, medios y organizaciones. No busques confirmar ni refutar de antemano una narrativa. Distingue con claridad: cambio observado, consistencia entre fuentes y atribución causal. Una reducción reproducible debe reconocerse; sus límites deben explicarse sin descalificarla por anticipado.

## 1. Definición y catálogo verificable

No presentes una lista editorial como una definición nacional universal de «alto impacto». Crea dos catálogos separados:

- **Canasta oficial de la declaración:** transcribe la composición exacta del documento o presentación que se verifica; conserva fecha, autoridad, enlace, página, unidades y reglas de agregación. Si la lista o ponderaciones no están documentadas, marca «definición pendiente» y no reconstruyas un total supuesto.
- **Selección analítica NI:** homicidio doloso, feminicidio, extorsión, secuestro y modalidades de robo relevantes; incorpora violación como categoría adicional explícita. Justifica esta selección editorial por su relevancia para daños graves y debate público, sin afirmar que sea la canasta oficial.

Para robo, distingue vehículo automotor, negocio, casa habitación, transeúnte, transportista y transporte público, según disponibilidad. Separa con/sin violencia cuando los originales permitan hacerlo; no llames «robo con violencia» a un agregado que no conserva esa modalidad. No sumes padres con subcategorías.

Para cada concepto almacena: identificador, nombre, instrumento, vigencia, fuente, unidad, alcance territorial, códigos originales, modalidades incluidas/excluidas, tentativas, fuero y nota de comparabilidad. Toda correspondencia entre 2015–2025 y 2026 debe estar documentada. En particular, audita las nuevas subcategorías y tentativas de extorsión, homicidio y feminicidio. La coincidencia del nombre no acredita equivalencia. Categorías no mapeadas bloquean el agregado afectado.

## 2. Cinco enfoques analíticos complementarios

### A. Evolución y persistencia: ¿la mejora es sostenida?

Para cada delito presenta serie mensual completa, cambio absoluto, variación porcentual, promedio diario con días reales, tasa poblacional y acumulado enero–último mes frente al mismo periodo anterior. Añade promedio móvil de 3 y 12 meses, y total móvil de 12 meses solamente con ventanas completas, unidades compatibles y meses sin ausencias. Conserva la serie original junto al suavizado.

Distingue una caída mensual de una caída interanual y de un cambio de tendencia. Evalúa estacionalidad con historia suficiente. No anualices un acumulado parcial como si fuera el total observado. Para tasas de ventanas que abarcan varios años, documenta el denominador y exposición utilizados; no sumes indiscriminadamente tasas con distintos denominadores.

Visuales: pequeños múltiples 2D con fechas alineadas, índices base 100 y valores absolutos accesibles. Los índices no se calculan con base cero. Mostrar la fecha inicial y final reales de cada comparación.

### B. Auditoría del punto de partida: ¿cuánto depende de la comparación?

Ofrece una matriz de sensibilidad con bases predefinidas: mismo periodo anterior, año previo completo, 2018, 2019, 2024 y periodo previo al inicio de la administración, cuando sean comparables. Para el inicio de la administración verifica documentalmente la fecha y separa septiembre de 2024 como posible referencia de octubre de 2024 como inicio del periodo de gobierno. No confundas ambos conceptos.

Reproduce la comparación exacta de cada anuncio y después muestra alternativas comparables. Usa meses equivalentes y ventanas de igual duración; identifica meses excepcionalmente altos o bajos sin ocultarlos. No escojas la base que maximice el resultado. Muestra valores de origen, fórmula y revisiones.

Visuales: matriz de bases, líneas indexadas y gráfico de diferencias. Conclusión editorial: «la dirección se mantiene», «la magnitud depende de la base» o «no comparable», con regla explícita; no inferir causalidad.

### C. Distribución territorial y composición: ¿dónde y en qué delitos cambia?

Descompón el cambio nacional en contribuciones estatales para cada delito y, donde haya datos válidos, municipales. La suma de diferencias absolutas territoriales debe conciliar con el cambio nacional; explica residuos o registros sin ubicación. No promedies porcentajes estatales para calcular el cambio nacional.

Muestra conteos y tasas por separado, concentración, número de territorios con aumento/descenso y población que representan. Conserva ceros y faltantes diferenciados. Para municipios permite un umbral poblacional visible y advierte la inestabilidad de cantidades pequeñas. Mantén claves INEGI y documenta cambios territoriales, sin empalmes por similitud de nombres.

Presenta un mapa 2D/3D y barras de contribución. No concluyas desplazamiento delictivo solo porque una entidad baja y otra sube. No interpretes volumen como riesgo individual ni frecuencia como gravedad. No fabriques un índice de severidad con ponderaciones arbitrarias.

### D. Calidad y contraste de fuentes: ¿cambió la violencia o su registro?

Distingue delitos registrados, carpetas, víctimas, llamadas de emergencia, detenciones y sentencias. No sustituyas una unidad por otra. Para homicidio incorpora SESNSP-víctimas y defunciones por homicidio INEGI con sus definiciones, fecha de ocurrencia/registro, cobertura, rezagos y revisiones. Las diferencias entre fuentes no prueban por sí mismas ocultamiento.

Para violencia letal contra mujeres muestra feminicidio y homicidio doloso de mujeres, separados y, solo si son compatibles y mutuamente excluyentes, agregados. Utiliza población femenina para la tasa específica; si no está integrada, no etiquetes la tasa sobre población total como tasa de mujeres.

Añade ENVIPE para victimización y denuncia, ENVE para establecimientos y ENSU para percepción urbana, cada una con su universo, año de referencia, errores de muestreo y límites territoriales. No extrapoles ENSU a todos los municipios. No multipliques todos los delitos por un único factor de cifra negra. Desapariciones se presentan en un módulo propio y nunca se suman mecánicamente a homicidios.

Distingue intervalos de muestreo de incertidumbre de registro. No atribuyas márgenes de error de encuesta a registros administrativos. Si se modela incertidumbre estadística, explicita distribución, sobredispersión y supuestos. Vigila revisiones históricas, cambios de códigos, ausencias y saltos de cobertura.

### E. Verificación pública y evaluación de política: ¿qué sostiene la afirmación?

Crea fichas con: cita exacta breve, emisor, fecha, fuente primaria y página, porcentaje anunciado, unidad, delito/canasta, territorio, fechas de comparación, versión de datos, cálculo reproducido y diferencia frente al anuncio. Enlaza al documento completo, sin copiarlo íntegramente.

Clasifica con reglas auditables: **reproducible**, **reproducible con matices**, **no comparable** o **evidencia insuficiente**. Una discrepancia de redondeo no es falsedad. Una caída comprobable no demuestra que toda la seguridad mejoró. Diferencia magnitud de descenso, nivel persistente y composición.

Para evaluar políticas, ofrece series temporales interrumpidas, comparación territorial o diferencias en diferencias únicamente cuando haya tratamiento y fecha definidos, controles defendibles, tendencias previas compatibles y datos suficientes. Preespecifica resultados, covariables, estacionalidad, autocorrelación, pruebas placebo y sensibilidad; controla comparaciones múltiples. Si no se cumplen los supuestos, entrega análisis descriptivo y explica que no identifica causalidad. No adjudiques automáticamente tendencias previas a una administración.

## 3. Cinco insights en la portada

Genera cinco tarjetas con prioridad analítica, no por conveniencia narrativa:
1. Magnitud y persistencia del cambio en homicidio doloso, con unidad exacta.
2. Categoría prioritaria con deterioro o menor mejoría, sin ocultar aumentos.
3. Concentración territorial de la disminución y territorios que divergen.
4. Sensibilidad de la conclusión a las bases de comparación.
5. Fortaleza y límites de la evidencia: fuentes coincidentes, revisiones o comparabilidad pendiente.

Cada tarjeta debe incluir valor, fechas, denominador, comparación, fuente y enlace «Ver cálculo». No fuerces cinco conclusiones si faltan datos: sustituye el resultado por una explicación concreta de qué falta. Separa resultados calculados de hipótesis. Conserva los cinco delitos nacionales de mayor incidencia y los cinco municipios por todos los delitos solicitados originalmente.

## 4. Interfaz profesional adaptable y efectos 3D

Respeta la referencia elegida: grafito, azul eléctrico, texto claro, encabezado compacto, barra lateral en escritorio, menú accesible en móvil, filtros legibles, tarjetas breves y paneles en dos columnas que se apilan en pantallas estrechas. Las explicaciones extensas van en desplegables. Usa identidad NI; no simules identidad institucional del Gobierno.

Conserva React/TypeScript/Vite. Aprovecha ECharts para comparaciones exactas y deck.gl para cartografía; incorpora otra biblioteca solo si resuelve una necesidad demostrable, sin duplicar motores 3D.

Implementa profundidad por capas, bordes iluminados, degradados sutiles, sombras de contacto, reflejos suaves, microelevación y perspectiva leve de tarjetas con ratón. En el mapa: extrusión lineal desde cero, iluminación ambiental y direccional, material con brillo controlado, selección resaltada y transiciones suaves. Añade controles de inclinación, giro, reinicio, escala vertical y equivalente 2D. Evita rotación automática.

La altura debe representar una métrica identificada, con unidad y escala visibles; fija la escala cuando se comparen mapas. No uses volumen de esferas, perspectiva o profundidad decorativa para distorsionar proporciones. Las líneas y barras comparativas se mantienen 2D. No agregues partículas, bloom intenso, desenfoque de cifras ni contadores ficticios que dificulten la lectura.

Ofrece calidad adaptable, carga diferida, límite de resolución del canvas y degradación 2D ante ausencia/pérdida de WebGL. Respeta `prefers-reduced-motion`, teclado, foco visible, lectores de pantalla, zoom 200 %, contraste y controles táctiles de al menos 44 px. No dependas de hover para información esencial. Los efectos no deben alterar valores ni exportaciones.

Prueba 360, 390, 768, 1024 y 1440 px, orientación horizontal, Safari/iOS y Chrome/Android cuando estén disponibles. Sin desbordamiento horizontal de la página; tablas con desplazamiento localizado y alternativa accesible. Objetivos: LCP <2.5 s, INP <200 ms y CLS <0.1 bajo un perfil de prueba declarado, no afirmados sin medición.

## 5. Datos, actualización y publicación

Lee primero la documentación operativa REAL del repositorio. No presupongas que coincide con la de otro Site. Verifica catálogo y notas oficiales, no reutilices enlaces antiguos por costumbre. Descarga originales fuera del repo, conserva SHA-256 y versiones. No deduzcas el corte por ceros. Distingue última consulta, última actualización validada y publicación de interfaz.

Valida claves únicas, unidades, meses, códigos, integridad territorial, correspondencias y conciliación nacional. Detecta correcciones históricas, eliminaciones de meses/claves y negativos nuevos. No cambies excepciones para hacer pasar datos inválidos. Usa bloqueo y sustitución atómica; conserva la última versión válida ante error. Cambios de orden de filas no son una revisión estadística.

Cada CSV/JSON debe identificar unidad, filtros, periodo, fuente, corte, versión, población y cálculo. Las exportaciones reflejan exactamente lo visible y preservan faltantes. Publica en el mismo sitio; antes verifica que no haya commits remotos nuevos y evita sobrescribirlos.

## 6. Pruebas y criterios de aceptación

- Fórmulas con base cero, nulos, años bisiestos, población ausente y ventanas incompletas.
- No comparar unidades diferentes ni sumar categorías solapadas.
- No empalmar 2025/2026 por coincidencia de etiquetas.
- Conciliación entre serie, tabla, tarjeta y exportación.
- Caso de afirmación reproducible, caso con unidad errónea y caso sin fuente.
- Accesibilidad, móvil, movimiento reducido, modo claro/oscuro y fallback 2D.
- Compilación y flujo de publicación correctos; revisión de datos y fecha de generación sin cambios para una modificación solo visual.

Entrega código, pruebas, diccionario, fuentes versionadas, registro de cambios, capturas de tamaños probados y una lista explícita de módulos implementados frente a los que requieren nuevas fuentes. No declares «verificado» ni «actualizado» lo que no completó su cadena de evidencia.

## Evidencia y alcance de esta especificación — 20 de septiembre de 2026

- El repositorio inspeccionado contiene series nacionales de **delitos registrados**, no víctimas, con meta de corte 2025-12 y 2026-08. Esto es evidencia del contenido del sitio, no una nueva certificación de los originales oficiales.
- El catálogo SESNSP y páginas metodológicas devolvieron HTTP 403 durante esta revisión. La composición nacional vigente de la canasta oficial de alto impacto queda pendiente de verificación primaria; la selección NI no debe anunciarse como oficial.
- ENVIPE 2025, presentación nacional, páginas 1–3: población de 18 años y más; victimización enero–diciembre de 2024; percepción marzo–abril de 2025. Referencia verificada, no presentada como la edición más reciente.
  https://www.inegi.org.mx/contenidos/programas/envipe/2025/doc/envipe2025_presentacion_nacional.pdf
- Localizadores para la ampliación: catálogo SESNSP https://www.gob.mx/sesnsp/acciones-y-programas/datos-abiertos-de-incidencia-delictiva?state=published ; Gabinete https://gabinetedeseguridad.gob.mx/ ; mortalidad INEGI https://www.inegi.org.mx/programas/mortalidad/ . Abrir una página de programa no equivale a haber contrastado sus microdatos.

## Implementado en esta entrega

Laboratorio nacional con selección editorial separada por instrumento, cálculo mensual en registros/promedio diario/tasa, comparación entre meses, sensibilidad al mismo mes de años anteriores, tabla de categorías y exportación de serie. Protocolo público de verificación y referencias externas con estado pendiente. Superficies con profundidad y mapa con iluminación mejorada.

Pendiente de nuevas fuentes y desarrollo: registro poblado de declaraciones verificadas, víctimas, triangulación numérica INEGI/encuestas, descomposición territorial específica de alto impacto, modelos causales y todas las pruebas físicas de dispositivos. No presentar el laboratorio inicial como la implementación completa de esta especificación.
