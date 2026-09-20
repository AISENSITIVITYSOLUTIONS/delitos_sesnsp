"""Capturas de verificación visual del dashboard (escritorio y móvil)."""
import http.server
import socketserver
import sys
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright

DIST = Path("/home/claude/sesnsp/web/dist")
SALIDA = Path("/home/claude/sesnsp/logs")
PUERTO = 4173


def servir():
    handler = lambda *a, **k: http.server.SimpleHTTPRequestHandler(*a, directory=str(DIST), **k)  # noqa: E731
    with socketserver.TCPServer(("127.0.0.1", PUERTO), handler) as httpd:
        httpd.serve_forever()


def main():
    etiqueta = sys.argv[1] if len(sys.argv) > 1 else "estado"
    espera = int(sys.argv[2]) if len(sys.argv) > 2 else 2500
    t = threading.Thread(target=servir, daemon=True)
    t.start()
    SALIDA.mkdir(exist_ok=True)
    with sync_playwright() as p:
        nav = p.chromium.launch()
        for nombre, vp, oscuro in [
            ("escritorio", {"width": 1440, "height": 940}, False),
            ("escritorio_oscuro", {"width": 1440, "height": 940}, True),
            ("movil", {"width": 390, "height": 844}, False),
        ]:
            ctx = nav.new_context(viewport=vp, color_scheme="dark" if oscuro else "light",
                                  device_scale_factor=2)
            pg = ctx.new_page()
            errores = []
            pg.on("console", lambda m: errores.append(m.text) if m.type == "error" else None)
            pg.goto(f"http://127.0.0.1:{PUERTO}/", wait_until="networkidle")
            pg.wait_for_timeout(espera)
            pg.screenshot(path=str(SALIDA / f"cap_{etiqueta}_{nombre}.png"), full_page=(nombre != "movil"))
            if errores:
                print(f"[{nombre}] errores de consola:", errores[:6])
            ctx.close()
        nav.close()
    print("capturas listas en", SALIDA)


if __name__ == "__main__":
    main()
