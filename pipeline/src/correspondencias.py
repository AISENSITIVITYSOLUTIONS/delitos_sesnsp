"""Tabla de correspondencias entre el instrumento CNSP/38/15 (2015-2025, 55
subtipos en archivo; "53 delitos" en la difusión oficial) y el RNID vigente
desde 2026 (79 subtipos en archivo; "71 delitos" en la difusión oficial).

Construida contrastando los catálogos REALES de ambos archivos oficiales
(corte agosto 2026) con el marco normativo:
- Acuerdo 11/L/2024 del Consejo Nacional de Seguridad Pública (dic. 2024):
  adopción del nuevo registro (RNID) desde enero de 2026, alineado con la
  Norma Técnica para la Clasificación de los Delitos del Fuero Común para
  Fines Estadísticos (INEGI).
- Manual de llenado CNSP/38/15 (v2.4, ene. 2018): regla de clasificación de
  tentativas dentro del delito que se pretendía cometer (sustenta sumar las
  tentativas separadas del RNID al comparar con 2015-2025).
Pendiente de contraste fino: Manual metodológico del RNID (el acceso de red
de este entorno no permite descargarlo; verificado indirectamente con la
estructura del propio archivo oficial).

Regla general: una serie se homologa SOLO si aparece aquí; los residuales
("Otros…") cuyo alcance cambió se muestran como tramos separados.
"""
from __future__ import annotations

# nm_subtipo → (subtipos RNID que lo integran, relación, transformación, fundamento)
MAPEO = {
    # 1:1 exactos se generan automáticamente para los 47 subtipos idénticos
    # (menos los residuales afectados listados abajo). Aquí, los no triviales:
    "Extorsión": (
        ["Extorsión presencial", "Extorsión por otros medios",
         "Tentativa de extorsión presencial", "Tentativa de extorsión por otros medios"],
        "agregable",
        "Suma de las 4 desagregaciones del RNID (incluye tentativas, que el instrumento 2015-2025 registraba dentro del delito intentado).",
        "Acuerdo 11/L/2024; regla de tentativas del Manual CNSP/38/15 §clasificación",
    ),
    "Robo de maquinaria": (
        ["Robo de maquinaria - Cables, tubos y otros objetos destinados a servicios públicos",
         "Robo de maquinaria - Herramienta industrial o agrícola",
         "Robo de maquinaria - Tractores y/o montacargas"],
        "agregable",
        "Suma de 3 subtipos RNID que antes eran modalidades del subtipo 2015-2025.",
        "Correspondencia nominal exacta de modalidades→subtipos en ambos catálogos oficiales",
    ),
    "Robo de vehículo automotor": (
        ["Robo de vehículo automotor - Coche de 4 ruedas",
         "Robo de vehículo automotor - Embarcaciones",
         "Robo de vehículo automotor - Motocicleta"],
        "agregable",
        "Suma de 3 subtipos RNID que antes eran modalidades del subtipo 2015-2025.",
        "Correspondencia nominal exacta de modalidades→subtipos en ambos catálogos oficiales",
    ),
    "Violación simple": (["Violación simple"], "equivalente",
        "Mismo subtipo; en RNID reagrupado bajo el tipo 'Violación'.",
        "Identidad nominal del subtipo en ambos catálogos"),
    "Violación equiparada": (["Violación equiparada"], "equivalente",
        "Mismo subtipo; en RNID reagrupado bajo el tipo 'Violación'.",
        "Identidad nominal del subtipo en ambos catálogos"),
    "Trata de personas": (
        ["Trata de personas con fines de explotación sexual",
         "Trata de personas con fines de trabajo o servicios forzados",
         "Trata de personas con fines de tráfico de órganos",
         "Trata de personas con otros fines"],
        "agregable",
        "Suma de los 4 fines desagregados por el RNID.",
        "Acuerdo 11/L/2024 (desagregación de trata por fines)",
    ),
    "Secuestro": (
        ["Secuestro extorsivo", "Secuestro con calidad de rehén",
         "Secuestro exprés", "Secuestro para causar daño"],
        "agregable-con-nota",
        "Suma de 4 subtipos RNID que antes eran modalidades. La modalidad 2015-2025 'Otro tipo de secuestros' no tiene contraparte en RNID (posible reclasificación hacia 'Privación ilegal de la libertad'); la serie homologada puede subestimar marginalmente el tramo 2026.",
        "Comparación de catálogos oficiales; el RNID introduce 'Privación ilegal de la libertad' como categoría separada",
    ),
    "Narcomenudeo": (
        ["Narcomenudeo con fines de venta", "Narcomenudeo posesión simple"],
        "agregable",
        "Suma de las 2 desagregaciones del RNID.",
        "Acuerdo 11/L/2024 (desagregación de narcomenudeo)",
    ),
    "Homicidio doloso": (
        ["Homicidio doloso", "Tentativa de homicidio doloso"],
        "agregable-con-tentativa",
        "El RNID separa la tentativa; el instrumento 2015-2025 la registraba dentro de 'Homicidio doloso'. Serie comparable = consumado + tentativa. Se publica también la serie RNID de consumados por separado.",
        "Regla de tentativas del Manual CNSP/38/15",
    ),
    "Feminicidio": (
        ["Feminicidio", "Tentativa de feminicidio"],
        "agregable-con-tentativa",
        "El RNID separa la tentativa; serie comparable = consumado + tentativa.",
        "Regla de tentativas del Manual CNSP/38/15",
    ),
}

# Residuales 2015-2025 cuyo alcance cambia en 2026 (el RNID extrajo categorías):
NO_HOMOLOGABLES = {
    "Otros delitos que atentan contra la libertad personal":
        "El RNID extrae 'Privación ilegal de la libertad' y 'Retención o sustracción de menores e incapaces'; el residual 2026 no cubre el mismo alcance.",
    "Otros delitos contra la sociedad":
        "El RNID extrae 'Discriminación' y 'Pornografía infantil'; alcance distinto entre tramos.",
    "Otros delitos del Fuero Común":
        "El RNID extrae 'Tortura', 'Suplantación y usurpación de identidad' y 'Delitos contra la administración de justicia'; alcance distinto entre tramos.",
    "Otros delitos que atentan contra la libertad y la seguridad sexual":
        "El RNID extrae 'Violación a la intimidad sexual'; alcance distinto entre tramos.",
}

# Categorías nuevas del RNID sin serie previa (consulta solo desde 2026):
NUEVAS_RNID = [
    "Violación a la intimidad sexual", "Discriminación", "Pornografía infantil",
    "Privación ilegal de la libertad", "Retención o sustracción de menores e incapaces",
    "Delitos contra la administración de justicia",
    "Suplantación y usurpación de identidad", "Tortura",
    "Tentativa de homicidio doloso", "Tentativa de feminicidio",
]

NOTA_TOTAL = (
    "El total 'todos los delitos' es comparable entre tramos: el RNID desagrega y "
    "extrae categorías que antes se registraban dentro de residuales del mismo "
    "universo (fuero común), y las tentativas ya contaban dentro del delito "
    "intentado. El cambio de instrumento puede alterar prácticas de registro; la "
    "discontinuidad de enero de 2026 se señala en todas las series del periodo completo."
)

FUNDAMENTO_GENERAL = (
    "Acuerdo 11/L/2024 del CNSP (dic. 2024); Norma Técnica para la Clasificación de los "
    "Delitos del Fuero Común para Fines Estadísticos (INEGI); Manual de llenado CNSP/38/15 "
    "v2.4 (2018); catálogos de los archivos oficiales con corte a agosto de 2026."
)
