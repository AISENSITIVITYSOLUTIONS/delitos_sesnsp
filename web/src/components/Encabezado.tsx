import { useEffect, useRef } from "react";
import type { Manifiesto } from "../lib/contratos";
import { fFechaHora, fMesLargo } from "../lib/formato";
import { alternarTema } from "../lib/estado";

/** Canvas animado con partículas flotantes sobre el encabezado. */
function AuroraCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let W = 0, H = 0, raf = 0;
    const PARTICLES = 55;
    const pts: { x: number; y: number; vx: number; vy: number; r: number; a: number; da: number }[] = [];

    function resize() {
      W = canvas!.width = canvas!.offsetWidth;
      H = canvas!.height = canvas!.offsetHeight;
    }

    function init() {
      pts.length = 0;
      for (let i = 0; i < PARTICLES; i++) {
        pts.push({
          x: Math.random() * W, y: Math.random() * H,
          vx: (Math.random() - 0.5) * 0.35, vy: (Math.random() - 0.5) * 0.25,
          r: Math.random() * 2.2 + 0.5,
          a: Math.random(), da: (Math.random() - 0.5) * 0.008,
        });
      }
    }

    function draw() {
      ctx!.clearRect(0, 0, W, H);
      // Aurora blob azul eléctrico
      const grad = ctx!.createRadialGradient(W * 0.78, H * -0.5, 0, W * 0.78, H * -0.5, W * 0.95);
      grad.addColorStop(0, "rgba(26,127,232,0.22)");
      grad.addColorStop(0.45, "rgba(8,60,180,0.12)");
      grad.addColorStop(1, "transparent");
      ctx!.fillStyle = grad;
      ctx!.fillRect(0, 0, W, H);

      // Segunda nube aurora (izquierda)
      const grad2 = ctx!.createRadialGradient(W * 0.1, H * -0.3, 0, W * 0.1, H * -0.3, W * 0.55);
      grad2.addColorStop(0, "rgba(0,100,200,0.12)");
      grad2.addColorStop(1, "transparent");
      ctx!.fillStyle = grad2;
      ctx!.fillRect(0, 0, W, H);

      // Partículas azul claro
      for (const p of pts) {
        p.x += p.vx; p.y += p.vy; p.a += p.da;
        if (p.x < 0) p.x = W; if (p.x > W) p.x = 0;
        if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;
        if (p.a < 0.04) p.da = Math.abs(p.da);
        if (p.a > 0.65) p.da = -Math.abs(p.da);
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(90,170,255,${p.a.toFixed(3)})`;
        ctx!.fill();
      }
      raf = requestAnimationFrame(draw);
    }

    const ro = new ResizeObserver(() => { resize(); init(); });
    ro.observe(canvas);
    resize(); init(); draw();

    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);

  return <canvas ref={canvasRef} className="encabezado__aurora" aria-hidden="true" />;
}

export default function Encabezado({ manifiesto }: { manifiesto: Manifiesto | null }) {
  return (
    <header className="encabezado" role="banner">
      <AuroraCanvas />
      <div className="contenedor encabezado__inner">
        <div className="encabezado__marca">
          <div className="encabezado__sello" aria-hidden="true">
            <svg width="34" height="34" viewBox="0 0 34 34" fill="none">
              <rect x="3" y="14" width="6" height="14" rx="2" fill="currentColor" opacity="0.55" />
              <rect x="12" y="8" width="6" height="20" rx="2" fill="currentColor" opacity="0.8" />
              <rect x="21" y="3" width="6" height="25" rx="2" fill="currentColor" />
            </svg>
          </div>
          <div>
            <p className="encabezado__kicker">Secretariado Ejecutivo del Sistema Nacional de Seguridad Pública · datos abiertos</p>
            <h1 className="encabezado__titulo">Incidencia delictiva del fuero común en México</h1>
            <p className="encabezado__sub">
              Observatorio analítico de los delitos registrados en carpetas de investigación,
              {manifiesto
                ? ` de enero de 2015 a ${fMesLargo(manifiesto.cortes.tramo_2026 || manifiesto.cortes.tramo_2015_2025)}.`
                : " desde enero de 2015 hasta el último corte oficial publicado."}
            </p>
          </div>
        </div>
        <div className="encabezado__estado" aria-label="Estado de actualización">
          <button className="tema-btn no-imprimir" onClick={alternarTema} aria-label="Cambiar tema claro u oscuro" title="Tema claro/oscuro">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M12 3a9 9 0 1 0 9 9 7 7 0 0 1-9-9Z" />
            </svg>
          </button>
          <dl className="estado-lista">
            <div>
              <dt>Último mes cubierto</dt>
              <dd>{manifiesto ? fMesLargo(manifiesto.cortes.tramo_2026 || manifiesto.cortes.tramo_2015_2025) : "—"}</dd>
            </div>
            <div>
              <dt>Última consulta a la fuente</dt>
              <dd>{fFechaHora(manifiesto?.ultima_consulta_fuente ?? null)}</dd>
            </div>
            <div>
              <dt>Última actualización validada</dt>
              <dd>{fFechaHora(manifiesto?.ultima_actualizacion_validada ?? null)}</dd>
            </div>
          </dl>
        </div>
      </div>
      <nav className="encabezado__nav no-imprimir" aria-label="Secciones">
        <div className="contenedor">
          <a href="#hallazgos">Hallazgos</a>
          <a href="#delitos">Delitos de mayor incidencia</a>
          <a href="#municipios">Ranking municipal</a>
          <a href="#explorador">Explorador territorial</a>
          <a href="#metodologia">Metodología y fuentes</a>
        </div>
      </nav>
    </header>
  );
}
