"""Descarga verificada de las fuentes oficiales del SESNSP.

Reglas:
- Descargar a un área temporal; nunca sobre la versión vigente.
- Una respuesta HTML de error jamás se procesa como datos.
- Registrar hash SHA-256, tamaño, ETag/Last-Modified y fecha de consulta.
- Reintentos limitados con espera; sin reintentos ante denegación de política (403 de proxy).
"""
from __future__ import annotations

import hashlib
import json
import shutil
import subprocess
import time
from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from pathlib import Path

import yaml

RAIZ = Path(__file__).resolve().parents[2]
CONFIG = RAIZ / "pipeline" / "config" / "fuentes.yaml"
DIR_RAW = RAIZ / "raw"
DIR_TMP = RAIZ / "work" / "tmp_descarga"


@dataclass
class ResultadoDescarga:
    clave: str
    url: str
    ruta: str
    ok: bool
    http_code: str
    content_type: str
    bytes: int
    sha256: str
    etag: str
    last_modified: str
    consultado_utc: str
    error: str = ""


def _sha256(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def _es_html(path: Path) -> bool:
    with open(path, "rb") as f:
        inicio = f.read(2048).lstrip().lower()
    return inicio.startswith(b"<!doctype html") or inicio.startswith(b"<html")


def url_directa(url: str, extra: str) -> str:
    sep = "&" if "?" in url else "?"
    return f"{url}{sep}{extra}" if extra else url


def descargar(clave: str, url: str, cfg: dict) -> ResultadoDescarga:
    DIR_TMP.mkdir(parents=True, exist_ok=True)
    destino_tmp = DIR_TMP / f"{clave}.bin"
    headers_file = DIR_TMP / f"{clave}.headers"
    u = url_directa(url, cfg.get("parametro_descarga_directa", ""))
    intentos = int(cfg.get("reintentos", 3))
    consultado = datetime.now(timezone.utc).isoformat()

    for intento in range(1, intentos + 1):
        cmd = [
            "curl", "-sS", "-L", "--fail-with-body",
            "--max-time", str(cfg.get("timeout_s", 900)),
            "-A", cfg.get("user_agent", "Mozilla/5.0"),
            "-D", str(headers_file),
            "-o", str(destino_tmp),
            "-w", "%{http_code}|%{content_type}|%{size_download}",
            u,
        ]
        p = subprocess.run(cmd, capture_output=True, text=True)
        partes = (p.stdout or "||").split("|")
        http_code, ctype = partes[0], partes[1] if len(partes) > 1 else ""
        if "response 403" in (p.stderr or "") or "response 407" in (p.stderr or ""):
            # Denegación de política de salida: no reintentar, reportar.
            return ResultadoDescarga(clave, url, "", False, "403-proxy", "", 0, "", "", "",
                                     consultado, "Denegación de la política de red (proxy 403/407)")
        if p.returncode == 0 and destino_tmp.exists() and destino_tmp.stat().st_size > 0:
            if _es_html(destino_tmp):
                err = "La respuesta es una página HTML, no el archivo de datos; no se procesa."
            else:
                etag, lastmod = "", ""
                if headers_file.exists():
                    for linea in headers_file.read_text(errors="replace").splitlines():
                        low = linea.lower()
                        if low.startswith("etag:"):
                            etag = linea.split(":", 1)[1].strip()
                        elif low.startswith("last-modified:"):
                            lastmod = linea.split(":", 1)[1].strip()
                return ResultadoDescarga(
                    clave, url, str(destino_tmp), True, http_code, ctype,
                    destino_tmp.stat().st_size, _sha256(destino_tmp), etag, lastmod, consultado,
                )
        else:
            err = f"curl rc={p.returncode} http={http_code} stderr={(p.stderr or '')[-300:]}"
        if intento < intentos:
            time.sleep(int(cfg.get("espera_entre_reintentos_s", 30)))
    return ResultadoDescarga(clave, url, "", False, http_code, ctype, 0, "", "", "", consultado, err)


def promover(res: ResultadoDescarga, nombre_final: str) -> Path:
    """Mueve la descarga validada al área raw versionada (promoción atómica)."""
    DIR_RAW.mkdir(parents=True, exist_ok=True)
    destino = DIR_RAW / nombre_final
    shutil.move(res.ruta, destino)
    return destino


def main() -> int:
    cfg = yaml.safe_load(CONFIG.read_text())
    resultados = []
    for clave, meta in cfg["fuentes"].items():
        res = descargar(clave, meta["url"], cfg["descarga"])
        resultados.append(asdict(res))
        estado = "OK" if res.ok else f"FALLO: {res.error}"
        print(f"[{clave}] {estado} ({res.bytes} bytes, sha256={res.sha256[:12]})")
    salida = DIR_RAW / "descargas.json"
    salida.parent.mkdir(parents=True, exist_ok=True)
    salida.write_text(json.dumps(resultados, indent=2, ensure_ascii=False))
    return 0 if all(r["ok"] for r in resultados) else 1


if __name__ == "__main__":
    raise SystemExit(main())
