import { useEffect, useState } from "react";

const reducido = () => typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Anima un número de 0 al valor objetivo con desaceleración suave. Sin animación si el usuario lo pide reducido. */
export function useCuentaAtras(objetivo: number | null, duracion = 900): number | null {
  const [v, setV] = useState<number | null>(objetivo);
  useEffect(() => {
    if (objetivo == null) { setV(null); return; }
    if (reducido()) { setV(objetivo); return; }
    let raf = 0; const t0 = performance.now();
    const paso = (t: number) => {
      const k = Math.min(1, (t - t0) / duracion);
      const e = 1 - Math.pow(1 - k, 3);
      setV(objetivo * e);
      if (k < 1) raf = requestAnimationFrame(paso);
    };
    raf = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(raf);
  }, [objetivo, duracion]);
  return v;
}
