# Laboratorio NI — ampliación del 20 de septiembre de 2026

## Publicación y alcance

Esta entrega amplía la interfaz sobre los JSON estadísticos existentes. No sustituye ni revalida los originales SESNSP, no cambia su corte y no adelanta la fecha de actualización de datos.

Implementado:
- Comparaciones mensuales, interanuales, enero–mes, tres meses contra igual ventana anterior y doce meses móviles contra los doce anteriores. Un mes ausente invalida la ventana; base cero no produce porcentajes.
- Selector explícito de robos con/sin violencia disponibles, junto a su categoría agregada. No se suman padres e hijos ni se certifica una canasta oficial.
- Descomposición anual estatal para cuatro categorías de robo presentes en el producto: vehículo automotor, negocio, casa habitación y transeúnte en vía pública. La comparación exige 32 entidades completas y suma exacta contra la serie nacional en ambos años. 2026 queda excluido de comparaciones anuales completas.
- Tasas estatales anuales, mapa 2D/3D y CSV de contribuciones. La altura representa el nivel elegido, no la diferencia. Control de relieve visual sin modificación de cifras.
- Cuatro indicadores nacionales de contexto ENVIPE 2025, con referencia a hechos de 2024, páginas 6 y 23 del PDF y exportación. No se usan como corrección universal del SESNSP.
- Una ficha de cobertura periodística en el expediente de declaraciones: fuente secundaria identificada, aritmética separada de certificación y revisión primaria pendiente.
- Nueve pruebas de fórmulas, ventanas, corte, ceros, población y conciliación; se ejecutan en el flujo de publicación existente.

## Investigación y bloqueos

El catálogo oficial SESNSP devolvió HTTP 403 en esta revisión. Las búsquedas no permitieron recuperar un documento primario verificable con la composición de la canasta nacional vigente. Esto no demuestra que no exista ni permite sustituirlo por definiciones editoriales o estatales.

El ZIP del proyecto no contiene originales ni series de víctimas. `estatal_anual.json` solo conserva doce subtipos: no incluye los desgloses estatales de homicidio, feminicidio, extorsión y secuestro. No es válido deducirlos de los totales ni repartir cifras nacionales.

La página consultada de mortalidad no suministró una tabla verificable en esta sesión. No se añadieron números de defunciones sin evidencia.

Para completar la verificación integral se requieren: presentación oficial y anexos de cada declaración; catálogo y manuales vigentes; bases de víctimas con unidades y cortes; desgloses estatales/municipales originales; población femenina para tasas específicas; y tablas de mortalidad por ocurrencia/registro. Cada incorporación debe pasar controles de esquema, unidades, cobertura y correspondencias.

No se afirma haber probado dispositivos físicos ni haber alcanzado métricas de rendimiento sin medición. El 3D se mantiene opcional; el navegador de revisión puede ofrecer solo el equivalente 2D.

## Fuentes consultadas

- SESNSP, catálogo: https://www.gob.mx/sesnsp/acciones-y-programas/datos-abiertos-de-incidencia-delictiva?state=published (error de acceso).
- INEGI, presentación nacional ENVIPE 2025: https://www.inegi.org.mx/contenidos/programas/envipe/2025/doc/envipe2025_presentacion_nacional.pdf (lectura directa; páginas indicadas).
- La fuente secundaria y el estado de la ficha constan en `web/src/data/declaraciones.json`.

No se creó ninguna automatización adicional. La publicación de interfaz no acredita un ciclo de actualización mensual de originales.
