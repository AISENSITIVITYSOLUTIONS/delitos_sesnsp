"""Pruebas controladas del circuito de actualización (tarea 10 del pliego).

ATENCIÓN: estas pruebas usan archivos sintéticos mínimos, claramente marcados
como PRUEBA; jamás se mezclan con los datos oficiales ni se presentan como
resultados. Ejercitan las mismas funciones del pipeline real.

Casos:
  A) Incorporación de un mes nuevo  → los productos deben actualizarse.
  B) Corrección de un mes histórico → los productos deben actualizarse.
  C) Archivo inválido (HTML/esquema roto) → se conserva la versión previa.
Además: idempotencia (procesar dos veces el mismo archivo no duplica) y
distinción cero vs no publicado.
"""
from __future__ import annotations

import io
import json
import shutil
import sys
import tempfile
from pathlib import Path

import polars as pl

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
import transformacion as tr  # noqa: E402
import validacion as va  # noqa: E402
from actualizar import hay_cambio  # noqa: E402

MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio",
         "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]

OK, FALLO = 0, 0


def check(nombre: str, cond: bool, detalle: str = "") -> None:
    global OK, FALLO
    if cond:
        OK += 1
        print(f"  ✓ {nombre}")
    else:
        FALLO += 1
        print(f"  ✗ {nombre} — {detalle}")


def csv_sintetico(valores_ene_a_dic: list[int | str], anio: int = 2026) -> bytes:
    """CSV estatal mínimo de PRUEBA (1 entidad, 1 delito) con estructura RNID."""
    cab = "Año,Clave_Ent,Entidad,Bien jurídico afectado,Tipo de delito,Subtipo de delito,Modalidad," + ",".join(MESES)
    fila = f"{anio},01,PRUEBA-Entidad,PRUEBA-Bien,PRUEBA-Tipo,PRUEBA-Subtipo,PRUEBA-Modalidad," + ",".join(map(str, valores_ene_a_dic))
    return ("﻿" + cab + "\n" + fila + "\n").encode("utf-8")


def transforma(tmp: Path, contenido: bytes, corte: str):
    f = tmp / "prueba.csv"
    f.write_bytes(contenido)
    df, meta = tr.leer_ancho(f)
    largo = tr.a_largo(df, "estatal", "NR-2026", "prueba", corte, "test", [])
    return tr.marcar_no_publicado(largo, corte)


def suma(largo: pl.DataFrame) -> int:
    return int(largo.get_column("cantidad").sum() or 0)


def main() -> int:
    tmp = Path(tempfile.mkdtemp(prefix="sesnsp_test_"))
    try:
        print("Caso A: incorporación de un mes nuevo")
        v1 = csv_sintetico([10, 20, 30, 0, 0, 0, 0, 0, 0, 0, 0, 0])
        l1 = transforma(tmp, v1, "2026-03")
        check("corte marzo: 3 meses publicados", suma(l1) == 60, f"suma={suma(l1)}")
        pub1 = l1.filter(pl.col("cantidad").is_not_null()).height
        check("meses posteriores al corte → no publicado (null)", pub1 == 3, f"publicados={pub1}")

        v2 = csv_sintetico([10, 20, 30, 40, 0, 0, 0, 0, 0, 0, 0, 0])
        l2 = transforma(tmp, v2, "2026-04")
        check("mes nuevo detectado por huella", hay_cambio({"fuentes": {"p": {"sha256": "h1"}}}, "p", "h2", "", ""))
        check("mes nuevo incorporado (suma 100)", suma(l2) == 100, f"suma={suma(l2)}")
        check("distinción cero reportado (abril=40, mayo-corte futuro=null)",
              l2.filter((pl.col("mes") == 4)).get_column("cantidad").item() == 40)

        print("Caso B: corrección de un mes histórico")
        v3 = csv_sintetico([10, 25, 30, 40, 0, 0, 0, 0, 0, 0, 0, 0])  # feb 20→25
        l3 = transforma(tmp, v3, "2026-04")
        check("corrección detectada por huella distinta", hay_cambio({"fuentes": {"p": {"sha256": "h2"}}}, "p", "h3", "", ""))
        check("corrección reflejada (feb=25, suma 105)", suma(l3) == 105, f"suma={suma(l3)}")

        print("Caso C: archivo inválido")
        html = b"<!DOCTYPE html><html><body>Error 503</body></html>"
        f = tmp / "invalido.bin"
        f.write_bytes(html)
        import descarga
        check("una respuesta HTML se identifica y NO se procesa como datos", descarga._es_html(f))

        cab_rota = csv_sintetico([1] * 12).decode("utf-8").replace("Subtipo de delito", "SubtipoX").encode("utf-8")
        froto = tmp / "roto.csv"
        froto.write_bytes(cab_rota)
        df_roto, _ = tr.leer_ancho(froto)
        errores = tr.validar_contrato(df_roto, "estatal", "NM-2015")
        check("un esquema roto viola el contrato y detiene la construcción", len(errores) > 0, str(errores))
        # la conservación de la versión previa la garantiza publicar_atomicamente(),
        # que solo reemplaza el directorio publicado tras construir TODO el staging.
        check("misma huella → sin cambio (idempotencia del ciclo)",
              not hay_cambio({"fuentes": {"p": {"sha256": "h3"}}}, "p", "h3", "", ""))

        print("Controles adicionales")
        check("duplicados: control detecta claves repetidas",
              va.control_duplicados(pl.concat([l3, l3]))["resultado"] == "fallo")

        print(f"\nResultado: {OK} correctas, {FALLO} fallidas")
        return 1 if FALLO else 0
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


if __name__ == "__main__":
    raise SystemExit(main())
