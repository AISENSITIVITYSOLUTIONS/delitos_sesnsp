import { useEffect, useRef } from "react";
import { crearVitrina, destruirVitrina, fijarPuntero, fijarSerie, type Vitrina } from "../lib/vitrina3d";

/** Terreno 3D de fondo de la ficha: la serie anual del delito como cordillera inmersiva. */
export default function Vitrina3D({ serie, color, hover }: { serie: number[]; color: string; hover: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const vit = useRef<Vitrina | null>(null);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const v = crearVitrina(c, color, serie);
    if (!v) { c.style.display = "none"; return; }
    vit.current = v;
    fijarSerie(v, serie);
    const io = new IntersectionObserver(([e]) => { v.visible = e.isIntersecting; });
    io.observe(c);
    const tarjeta = c.closest(".fd-scene");
    const mover = (e: Event) => {
      const pe = e as PointerEvent; const r = (tarjeta as HTMLElement).getBoundingClientRect();
      fijarPuntero(v, ((pe.clientX - r.left) / r.width) * 2 - 1, ((pe.clientY - r.top) / r.height) * 2 - 1);
    };
    const salir = () => fijarPuntero(v, 0, 0);
    tarjeta?.addEventListener("pointermove", mover);
    tarjeta?.addEventListener("pointerleave", salir);
    return () => {
      io.disconnect(); tarjeta?.removeEventListener("pointermove", mover); tarjeta?.removeEventListener("pointerleave", salir);
      destruirVitrina(v); vit.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [color]);

  useEffect(() => { if (vit.current) fijarSerie(vit.current, serie); }, [serie]);
  useEffect(() => { if (vit.current) vit.current.hover = hover; }, [hover]);

  return <canvas ref={ref} className="fd-vitrina" aria-hidden="true" />;
}
