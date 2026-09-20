"""Orquestador de actualización: detección de cambios, validación y publicación atómica.

Diseño:
- `estado.json` (manifiesto) guarda por fuente: ETag/Last-Modified, SHA-256,
  bytes, fecha de última consulta y de última versión VÁLIDA, y corte detectado.
- Detección de cambio en dos etapas: (1) encabezados condicionales cuando el
  servidor los ofrece; (2) confirmación por huella SHA-256 del contenido
  descargado a un área temporal. Un cambio de orden/presentación sin cambio de
  cifras se distingue comparando la huella del CONTENIDO CANÓNICO (parquet
  ordenado), no solo la del archivo.
- Publicación atómica: todos los productos se construyen en `work/staging/`;
  solo si TODOS los controles pasan se promueven con un rename de directorio.
- Ante fallo: se conserva la última versión válida, se escribe un incidente en
  `historial.jsonl` y el proceso termina con código ≠ 0.
- Bloqueo de ejecuciones simultáneas con lock de archivo.
- Procesar dos veces el mismo archivo no duplica observaciones: cada corrida
  reconstruye los productos desde los originales (idempotencia por diseño).
"""
from __future__ import annotations

import fcntl
import json
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
ESTADO = RAIZ / "work" / "estado.json"
HISTORIAL = RAIZ / "work" / "historial.jsonl"
STAGING = RAIZ / "work" / "staging"
PUBLICADO = RAIZ / "web" / "public" / "datos"
LOCK = RAIZ / "work" / ".lock"


def ahora() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def cargar_estado() -> dict:
    if ESTADO.exists():
        return json.loads(ESTADO.read_text())
    return {"fuentes": {}, "version": 0, "ultima_actualizacion_validada": None,
            "ultima_consulta_fuente": None}


def guardar_estado(estado: dict) -> None:
    ESTADO.parent.mkdir(parents=True, exist_ok=True)
    tmp = ESTADO.with_suffix(".tmp")
    tmp.write_text(json.dumps(estado, indent=2, ensure_ascii=False))
    tmp.replace(ESTADO)


def registrar(evento: str, detalle: dict) -> None:
    HISTORIAL.parent.mkdir(parents=True, exist_ok=True)
    with open(HISTORIAL, "a") as f:
        f.write(json.dumps({"ts": ahora(), "evento": evento, **detalle},
                           ensure_ascii=False) + "\n")


def hay_cambio(estado: dict, clave: str, sha256: str, etag: str, lastmod: str) -> bool:
    previo = estado["fuentes"].get(clave)
    if previo is None:
        return True
    if etag and previo.get("etag") and etag == previo["etag"]:
        return False
    return sha256 != previo.get("sha256")


def publicar_atomicamente() -> None:
    """Promueve `work/staging/datos` → `web/public/datos` con reemplazo atómico."""
    origen = STAGING / "datos"
    if not origen.exists():
        raise RuntimeError("No hay staging/datos que publicar")
    respaldo = PUBLICADO.with_name("datos_prev")
    if respaldo.exists():
        shutil.rmtree(respaldo)
    if PUBLICADO.exists():
        PUBLICADO.rename(respaldo)
    try:
        shutil.move(str(origen), str(PUBLICADO))
    except Exception:
        if respaldo.exists():
            respaldo.rename(PUBLICADO)  # restaurar última versión válida
        raise


def con_lock(fn):
    def envuelto(*a, **k):
        LOCK.parent.mkdir(parents=True, exist_ok=True)
        with open(LOCK, "w") as lk:
            try:
                fcntl.flock(lk, fcntl.LOCK_EX | fcntl.LOCK_NB)
            except BlockingIOError:
                print("Otra ejecución está en curso; salgo sin tocar nada.")
                return 3
            return fn(*a, **k)
    return envuelto


@con_lock
def ciclo(forzar: bool = False) -> int:
    """Un ciclo completo: consultar → detectar → reconstruir → validar → publicar."""
    import descarga  # local
    import yaml

    cfg = yaml.safe_load((RAIZ / "pipeline" / "config" / "fuentes.yaml").read_text())
    estado = cargar_estado()
    estado["ultima_consulta_fuente"] = ahora()

    cambios, fallos = [], []
    for clave, meta in cfg["fuentes"].items():
        res = descarga.descargar(clave, meta["url"], cfg["descarga"])
        if not res.ok:
            fallos.append({"fuente": clave, "error": res.error})
            registrar("fallo_descarga", {"fuente": clave, "error": res.error})
            continue
        if forzar or hay_cambio(estado, clave, res.sha256, res.etag, res.last_modified):
            cambios.append((clave, res))
        else:
            Path(res.ruta).unlink(missing_ok=True)  # sin cambios: descartar tmp

    if fallos and not cambios:
        guardar_estado(estado)
        print(f"Fallos de consulta sin cambios detectados: {fallos}")
        return 2
    if not cambios:
        guardar_estado(estado)
        registrar("sin_cambios", {})
        print("Sin cambios en las fuentes.")
        return 0

    # Promoción de descargas validadas al área raw (con instantánea del ZIP)
    import zipfile
    instantaneas = RAIZ / "raw" / "instantaneas" / datetime.now(timezone.utc).strftime("%Y%m%d")
    instantaneas.mkdir(parents=True, exist_ok=True)
    import construir
    for clave, res in cambios:
        origen = Path(res.ruta)
        shutil.copy2(origen, instantaneas / f"{clave}.zip")
        destino_csv = RAIZ / "raw" / construir.FUENTES[clave]["archivo"]
        if zipfile.is_zipfile(origen):
            with zipfile.ZipFile(origen) as z:
                csvs = [n for n in z.namelist() if n.lower().endswith(".csv")]
                if len(csvs) != 1:
                    registrar("fallo_promocion", {"fuente": clave, "detalle": f"CSV en ZIP: {csvs}"})
                    return 1
                destino_csv.write_bytes(z.read(csvs[0]))
        else:
            shutil.copy2(origen, destino_csv)
        origen.unlink(missing_ok=True)

    # Reconstrucción completa en staging (nunca sobre lo publicado)
    try:
        controles: list[dict] = []
        avisos: list[str] = []
        construir.transformar_todo(controles, avisos)
        import duckdb
        con = duckdb.connect()
        con.execute("SET threads TO 2; SET memory_limit='3GB';")
        detalle = construir.controles_duckdb(con, controles, avisos)
        resumen = construir.construir_productos(con, controles, avisos, estado["version"] + 1)
        construir.manifiesto(controles, avisos, detalle, estado["version"] + 1, resumen)
        if any(c["resultado"] == "fallo" for c in controles):
            raise RuntimeError(f"Controles en fallo: {[c for c in controles if c['resultado'] == 'fallo']}")
    except Exception as e:  # noqa: BLE001
        registrar("fallo_construccion", {"error": repr(e), "cambios": [c[0] for c in cambios]})
        print(f"Construcción fallida; se conserva la última versión válida. {e!r}")
        return 1

    construir.publicar()
    estado["version"] += 1
    estado["ultima_actualizacion_validada"] = ahora()
    for clave, res in cambios:
        estado["fuentes"][clave] = {
            "sha256": res.sha256, "etag": res.etag, "last_modified": res.last_modified,
            "bytes": res.bytes, "ultima_descarga_valida": ahora(),
        }
    guardar_estado(estado)
    registrar("publicacion", {"version": estado["version"], "resumen": resumen,
                              "fuentes_cambiadas": [c[0] for c in cambios]})
    print(f"Publicada versión {estado['version']}: {resumen}")
    return 0


if __name__ == "__main__":
    sys.exit(ciclo(forzar="--forzar" in sys.argv))
