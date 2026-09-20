# Laboratorio de evidencia — implementación septiembre 2026

Se añade una entrada de navegación y un laboratorio sobre los productos existentes, sin alterar originales ni JSON estadísticos.

## Funciones incorporadas

- Calendario años × meses: cantidad, promedio diario con días reales y desviación respecto al promedio diario del mismo mes en años completos del mismo instrumento. No es una desestacionalización. Tabla y exportación CSV con metadatos.
- Comparación mensual por administración en un único instrumento. Peña Nieto comienza en diciembre de 2012 y la cobertura de enero de 2015 corresponde a su mes 26; AMLO comienza en diciembre de 2018 y Sheinbaum en octubre de 2024. No se empalman series. Se exportan los meses sin dato vacíos.
- Composición delictiva con condición de conciliación exacta de todas las categorías frente al total.
- Comparador de hasta tres entidades, ocho categorías disponibles y años completos anteriores a 2026, con tasas por población estatal anual. No constituye índice sintético.
- Trayectorias municipales 2021–2025 en cantidades, sobre bloques completos. Clasificación por signos de todas las variaciones anuales. No representa persistencia en tasas altas. Tabla limitada a 100 filas por rendimiento; descarga de todos los resultados filtrados.
- Historial existente y huellas de fuentes. No inventa revisiones antes de la primera captura.
- Seis ambientes visuales de vista previa en el laboratorio; colores estadísticos estables. Se conservan mapas 2D/3D existentes.
- La preferencia de movimiento reducido ahora inhibe también los efectos de inclinación del modo cinematográfico.

## Dependencias pendientes, no resultados activados

Víctimas por sexo, población femenina y mortalidad; ENSU y desgloses históricos ENVIPE; presupuestos, covariables e indicadores internacionales; validación temporal de pronósticos, inferencia de quiebres, matrices espaciales y agrupamientos robustos. La pantalla de nuevas fuentes indica estas necesidades. No sustituye su incorporación ni afirma haber completado los nueve módulos y trece ampliaciones en su totalidad.

Las funciones existentes de alto impacto, descomposición estatal, comparación temporal, ENVIPE de contexto, declaraciones, mapa y exportaciones se conservan. No se ha reactivado ninguna automatización pausada.

## Verificación

Ejecutar `node --test tests/*.test.mjs` desde web y `npm run build`. Las nuevas pruebas comprueban años bisiestos, nulos, cobertura parcial, base cero y meses de mandato. La compilación no equivale a prueba visual en Safari, Firefox, Edge ni dispositivos físicos. Los controles táctiles tienen una altura mínima de 44 px; tablas y calendario poseen desplazamiento local.
