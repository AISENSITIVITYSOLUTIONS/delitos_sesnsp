import { useEffect, useRef } from "react";

/** Campo de partículas suspendidas (WebGL, Three.js). Adaptado del «polvo» del hero de Decroly:
 *  puntos suaves que ascienden despacio y responden al cursor con paralaje. Es decorativo: no
 *  representa datos. Solo dibuja mientras está en pantalla y con la pestaña visible. */
export default function CampoParticulas({ densidad = 150 }: { densidad?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const lienzo = ref.current;
    const caja = lienzo?.parentElement;
    if (!lienzo || !caja) return;
    const quieto = matchMedia("(prefers-reduced-motion:reduce)").matches;
    let vivo = true, limpiar = () => {};
    import("three").then(THREE => {
      if (!vivo) return;
      let r: import("three").WebGLRenderer;
      try { r = new THREE.WebGLRenderer({ canvas: lienzo, antialias: false, alpha: true, powerPreference: "low-power" }); }
      catch { lienzo.style.display = "none"; return; }
      const DPR = Math.min(devicePixelRatio || 1, 1.75);
      r.setPixelRatio(DPR);
      r.setClearColor(0x000000, 0);
      const escena = new THREE.Scene();
      const cam = new THREE.PerspectiveCamera(55, 1, 0.1, 50);
      cam.position.z = 3;
      const n = matchMedia("(max-width:820px)").matches ? Math.round(densidad * 0.4) : densidad;
      const ext = { x: 11, y: 6, z: 5, z0: 1.5 };
      const capa = (cuantos: number, color: string, escala: number) => {
        const g = new THREE.BufferGeometry();
        const pos = new Float32Array(cuantos * 3), sem = new Float32Array(cuantos);
        for (let i = 0; i < cuantos; i++) {
          pos[i * 3] = (Math.random() - 0.5) * ext.x;
          pos[i * 3 + 1] = (Math.random() - 0.5) * ext.y;
          pos[i * 3 + 2] = -Math.random() * ext.z + ext.z0;
          sem[i] = Math.random();
        }
        g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
        g.setAttribute("semilla", new THREE.BufferAttribute(sem, 1));
        const m = new THREE.ShaderMaterial({
          transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
          uniforms: { t: { value: 0 }, color: { value: new THREE.Color(color) }, dpr: { value: DPR }, alto: { value: ext.y }, escala: { value: escala } },
          vertexShader: `uniform float t,dpr,alto,escala; attribute float semilla; varying float vA;
            void main(){ vec3 p=position; p.y=mod(p.y+t*(.04+semilla*.09)+alto*.5,alto)-alto*.5;
              p.x+=sin(t*.25+semilla*30.)*.22; vec4 mv=modelViewMatrix*vec4(p,1.);
              gl_PointSize=(4.+semilla*11.)*escala*dpr*(3./-mv.z); vA=.18+.5*semilla; gl_Position=projectionMatrix*mv; }`,
          fragmentShader: `uniform vec3 color; varying float vA;
            void main(){ float d=length(gl_PointCoord-.5); float a=smoothstep(.5,0.,d); gl_FragColor=vec4(color,a*a*vA); }`,
        });
        const pts = new THREE.Points(g, m);
        escena.add(pts);
        return pts;
      };
      const capas = [capa(n, "#4fc3ff", 1), capa(Math.round(n * 0.35), "#3fe0bd", 1.25)];
      const raton = { x: 0, y: 0, tx: 0, ty: 0 };
      const mover = (e: PointerEvent) => {
        const b = caja.getBoundingClientRect();
        raton.tx = ((e.clientX - b.left) / b.width) * 2 - 1;
        raton.ty = -(((e.clientY - b.top) / b.height) * 2 - 1);
      };
      const medir = () => {
        const w = caja.clientWidth, h = caja.clientHeight;
        if (!w || !h) return;
        r.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix();
      };
      medir();
      const ro = new ResizeObserver(medir); ro.observe(caja);
      let visible = false, raf = 0;
      const t0 = performance.now();
      const ciclo = () => {
        raf = 0;
        if (!visible || document.hidden) return;
        const t = (performance.now() - t0) / 1000;
        raton.x += (raton.tx - raton.x) * 0.05; raton.y += (raton.ty - raton.y) * 0.05;
        capas.forEach((c, i) => {
          (c.material as import("three").ShaderMaterial).uniforms.t.value = t * (i ? 0.7 : 1);
          c.rotation.y = raton.x * (0.1 + i * 0.05); c.rotation.x = -raton.y * (0.07 + i * 0.03);
        });
        r.render(escena, cam);
        if (!quieto) raf = requestAnimationFrame(ciclo);
      };
      const arrancar = () => { if (!raf) raf = requestAnimationFrame(ciclo); };
      const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) arrancar(); });
      io.observe(caja);
      if (!quieto) caja.addEventListener("pointermove", mover, { passive: true });
      document.addEventListener("visibilitychange", arrancar);
      limpiar = () => {
        cancelAnimationFrame(raf); io.disconnect(); ro.disconnect();
        caja.removeEventListener("pointermove", mover); document.removeEventListener("visibilitychange", arrancar);
        capas.forEach(c => { c.geometry.dispose(); (c.material as import("three").ShaderMaterial).dispose(); });
        r.dispose();
      };
    }).catch(() => { lienzo.style.display = "none"; });
    return () => { vivo = false; limpiar(); };
  }, [densidad]);
  return <canvas ref={ref} className="campo-particulas" aria-hidden="true" />;
}
