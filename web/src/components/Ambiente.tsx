import { useEffect } from "react";
import "./ambiente.css";

/** Capa de ambiente, adaptada del sitio de Decroly a un tablero de datos:
 *  1) barra de progreso de lectura, 2) luz tenue que sigue al cursor (tema oscuro),
 *  3) revelado de secciones al entrar en pantalla, 4) entrada escalonada en 3D de las fichas.
 *  No altera cifras ni interacción; con «reducir movimiento» solo queda la barra de progreso. */
export default function Ambiente() {
  useEffect(() => {
    const root = document.documentElement;
    const quieto = matchMedia("(prefers-reduced-motion:reduce)").matches;
    const fino = matchMedia("(pointer:fine)").matches;

    const barra = document.createElement("div");
    barra.className = "amb-progreso"; barra.setAttribute("aria-hidden", "true");
    document.body.append(barra);
    let luz: HTMLDivElement | null = null;
    if (!quieto && fino) {
      luz = document.createElement("div");
      luz.className = "amb-luz"; luz.setAttribute("aria-hidden", "true");
      document.body.append(luz);
    }

    let raf = 0, mx = -9999, my = -9999;
    const pintar = () => {
      raf = 0;
      const max = root.scrollHeight - innerHeight;
      barra.style.transform = `scaleX(${max > 0 ? Math.min(1, scrollY / max) : 0})`;
      if (luz) luz.style.transform = `translate3d(${mx}px,${my}px,0)`;
    };
    const pedir = () => { if (!raf) raf = requestAnimationFrame(pintar); };
    const mover = (e: PointerEvent) => { if (e.pointerType === "mouse") { mx = e.clientX; my = e.clientY; pedir(); } };
    addEventListener("scroll", pedir, { passive: true });
    addEventListener("resize", pedir);
    if (luz) addEventListener("pointermove", mover, { passive: true });
    pedir();

    let io: IntersectionObserver | null = null, mo: MutationObserver | null = null;
    if (!quieto && "IntersectionObserver" in window) {
      root.classList.add("amb");
      const vistos = new WeakSet<Element>();
      io = new IntersectionObserver(es => es.forEach(e => {
        if (!e.isIntersecting) return;
        e.target.classList.remove("amb-espera"); e.target.classList.add("amb-visto");
        io!.unobserve(e.target);
      }), { rootMargin: "0px 0px -8% 0px", threshold: 0 });
      const registrar = (el: Element) => {
        if (vistos.has(el)) return;
        vistos.add(el);
        // Lo que ya está en pantalla al cargar no se oculta.
        if (el.getBoundingClientRect().top > innerHeight * 0.92) el.classList.add("amb-espera");
        io!.observe(el);
      };
      const descubrir = () => {
        document.querySelectorAll("#contenido > section:not(#corte-reciente):not(.iso)").forEach(registrar);
        document.querySelectorAll<HTMLElement>("#contenido .fd-strip").forEach(tira => {
          tira.querySelectorAll<HTMLElement>(":scope > .fd-scene").forEach((c, i) => c.style.setProperty("--amb-i", String(i)));
          registrar(tira);
        });
      };
      descubrir();
      const main = document.getElementById("contenido");
      if (main) { mo = new MutationObserver(descubrir); mo.observe(main, { childList: true }); }
    }

    return () => {
      cancelAnimationFrame(raf);
      removeEventListener("scroll", pedir); removeEventListener("resize", pedir); removeEventListener("pointermove", mover);
      io?.disconnect(); mo?.disconnect();
      barra.remove(); luz?.remove();
      root.classList.remove("amb");
      document.querySelectorAll(".amb-espera").forEach(e => e.classList.remove("amb-espera"));
    };
  }, []);
  return null;
}
