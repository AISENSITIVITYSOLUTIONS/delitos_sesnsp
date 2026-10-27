import { useEffect, useRef } from "react";
import { crearVitrina, destruirVitrina, fijarValor, type Vitrina } from "../lib/vitrina3d";

/** Objeto 3D de cada ficha: su altura es la participación relativa del delito. */
export default function Vitrina3D({ valor, color, hover }: { valor: number; color: string; hover: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const vit = useRef<Vitrina | null>(null);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const v = crearVitrina(c, color);
    if (!v) { c.style.display = "none"; return; }
    vit.current = v;
    fijarValor(v, valor);
    v.hover = hover;
    const io = new IntersectionObserver(([e]) => { v.visible = e.isIntersecting; });
    io.observe(c);
    return () => { io.disconnect(); destruirVitrina(v); vit.current = null; };
    // La vitrina se crea una vez por color; valor y hover se actualizan abajo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [color]);

  useEffect(() => { if (vit.current) fijarValor(vit.current, valor); }, [valor]);
  useEffect(() => { if (vit.current) vit.current.hover = hover; }, [hover]);

  return <canvas ref={ref} className="fd-vitrina" aria-hidden="true" />;
}
