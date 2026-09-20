"""Verificación funcional de la interfaz: interacciones clave y capturas."""
import http.server
import socketserver
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright

DIST = Path("/home/claude/sesnsp/web/dist")
SALIDA = Path("/home/claude/sesnsp/logs")
PUERTO = 4174


def servir():
    handler = lambda *a, **k: http.server.SimpleHTTPRequestHandler(*a, directory=str(DIST), **k)  # noqa: E731
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("127.0.0.1", PUERTO), handler) as httpd:
        httpd.serve_forever()


def main():
    threading.Thread(target=servir, daemon=True).start()
    SALIDA.mkdir(exist_ok=True)
    resultados = []
    with sync_playwright() as p:
        nav = p.chromium.launch(args=["--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
        ctx = nav.new_context(viewport={"width": 1440, "height": 940}, device_scale_factor=2)
        pg = ctx.new_page()
        errores = []
        pg.on("pageerror", lambda e: errores.append(str(e)))
        pg.goto(f"http://127.0.0.1:{PUERTO}/", wait_until="networkidle")
        pg.wait_for_timeout(3000)

        # 1. Cambio de pestaña de delito
        tabs = pg.locator(".tab-delito")
        resultados.append(("pestañas de delito", tabs.count()))
        tabs.nth(3).click()
        pg.wait_for_timeout(900)
        resultados.append(("pestaña 4 activa", tabs.nth(3).get_attribute("aria-selected")))

        # 2. Cambio a tasa
        pg.locator(".filtros .seg button", has_text="Tasa /100 mil").click()
        pg.wait_for_timeout(700)

        # 3. Explorador: clic en un estado (path del SVG con aria-label de Jalisco)
        pg.locator("#explorador").scroll_into_view_if_needed()
        pg.wait_for_timeout(600)
        jal = pg.locator("#explorador svg path[aria-label*='Jalisco']").first
        jal.click(force=True)
        pg.wait_for_timeout(1800)
        migas = pg.locator("#explorador", has_text="Municipios de Jalisco").count()
        resultados.append(("drill a municipios de Jalisco", migas))
        pg.locator("#explorador").screenshot(path=str(SALIDA / "ver_explorador_municipios.png"))

        # 4. Vista 3D
        boton3d = pg.locator("#explorador .seg button", has_text="3D").first
        if boton3d.is_enabled():
            boton3d.click()
            pg.wait_for_timeout(4000)
            pg.locator("#explorador").screenshot(path=str(SALIDA / "ver_explorador_3d.png"))
            resultados.append(("vista 3D activada", "sí"))
            pg.locator("#explorador .seg button", has_text="2D").first.click()
            pg.wait_for_timeout(800)
        else:
            resultados.append(("vista 3D activada", "WebGL no disponible"))

        # 5. Tramo 2026
        pg.locator("#tramo").select_option("2026")
        pg.wait_for_timeout(1200)
        primera_tab = pg.locator(".tab-delito").first.inner_text()
        resultados.append(("tramo 2026, primer delito", primera_tab.replace("\n", " ")[:60]))
        pg.locator("#hallazgos").screenshot(path=str(SALIDA / "ver_hallazgos.png"))
        pg.locator("#delitos").screenshot(path=str(SALIDA / "ver_panel_2026.png"))

        # 6. Enlace con estado (hash)
        resultados.append(("hash de la URL", pg.url.split("#")[-1][:80] if "#" in pg.url else "(sin hash)"))

        # 7. Ranking municipal por tasa
        pg.locator("#tramo").select_option("2015-2025")
        pg.wait_for_timeout(900)
        pg.locator("#municipios .seg button", has_text="Por tasa").click()
        pg.wait_for_timeout(900)
        pg.locator("#municipios").screenshot(path=str(SALIDA / "ver_ranking_tasa.png"))

        resultados.append(("errores de página", errores or "ninguno"))
        ctx.close()
        nav.close()
    for r in resultados:
        print("·", r[0], "→", r[1])


if __name__ == "__main__":
    main()
