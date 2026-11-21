import { useEffect, useRef, useState } from "react";

export interface PuntoMes { ym: string; v: number | null }
interface Props {
  puntos: PuntoMes[];      // serie mensual en la métrica elegida
  actual: string;          // mes de análisis
  base: string;            // mes de comparación
  color: string;           // color del delito
  formato: (v: number | null) => string;
  alElegir: (ym: string) => void;
}
interface Estado extends Props { clave: string }

const CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const mesCorto = (ym: string) => `${CORTOS[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`;

/** Relieve temporal (WebGL, Three.js): cada franja es un año y cada punto un mes, con altura desde cero.
 *  Marca el mes de análisis y el de comparación; al señalar un mes muestra su valor y al hacer clic lo
 *  fija como mes de análisis. Es otra vista de la misma serie: no agrega ni transforma cifras. */
export default function RelieveTemporal(props: Props) {
  const cajaRef = useRef<HTMLDivElement>(null);
  const lienzoRef = useRef<HTMLCanvasElement>(null);
  const capaRef = useRef<HTMLDivElement>(null);
  const fichaRef = useRef<HTMLDivElement>(null);
  const aRef = useRef<HTMLSpanElement>(null);
  const bRef = useRef<HTMLSpanElement>(null);
  const [foco, setFoco] = useState<PuntoMes | null>(null);
  const [fallo, setFallo] = useState(false);
  const estado = useRef<Estado>({ ...props, clave: "" });
  const aplicar = useRef<() => void>(() => {});
  const clave = `${props.color}|${props.puntos.length}|${props.puntos.map(p => p.v ?? "x").join(",")}`;
  estado.current = { ...props, clave };

  useEffect(() => {
    const caja = cajaRef.current, lienzo = lienzoRef.current, capa = capaRef.current;
    if (!caja || !lienzo || !capa) return;
    const quieto = matchMedia("(prefers-reduced-motion:reduce)").matches;
    let vivo = true, limpiar = () => {};
    import("three").then(THREE => {
      if (!vivo) return;
      let r: import("three").WebGLRenderer;
      try { r = new THREE.WebGLRenderer({ canvas: lienzo, antialias: true, alpha: true, powerPreference: "high-performance" }); }
      catch { setFallo(true); return; }
      r.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
      r.setClearColor(0x000000, 0);
      r.outputColorSpace = THREE.SRGBColorSpace;

      const escena = new THREE.Scene();
      const cam = new THREE.PerspectiveCamera(32, 1, 0.1, 160);
      escena.add(new THREE.HemisphereLight(0xd6ecff, 0x08121c, 1.0));
      const clave1 = new THREE.DirectionalLight(0xffffff, 1.5); clave1.position.set(-5, 10, 9); escena.add(clave1);
      const contra = new THREE.DirectionalLight(0x56b8ff, 0.8); contra.position.set(9, 5, -8); escena.add(contra);

      let ALTO = 2.5, AZ0 = -0.36, EL0 = 0.6;
      const NAVY = new THREE.Color("#0c2740");
      let grupo = new THREE.Group(); escena.add(grupo);
      let desechables: { dispose(): void }[] = [];
      let nube: { ym: string; v: number; p: import("three").Vector3 }[] = [];
      let etiquetas: { el: HTMLSpanElement; p: import("three").Vector3 }[] = [];
      let PASO_X = 1, ancho = false, centro = new THREE.Vector3(5.5, 1, 0), fondo = 6, crece = quieto ? 1 : 0, t0 = 0, construida = "";
      let marcaA: import("three").Mesh | null = null, marcaB: import("three").Mesh | null = null, arco: import("three").Line | null = null, cursor3d: import("three").Mesh | null = null;
      const geoMarca = new THREE.SphereGeometry(0.13, 20, 16);
      const matA = new THREE.MeshStandardMaterial({ color: 0x2fd3b0, emissive: 0x2fd3b0, emissiveIntensity: 0.7 });
      const matB = new THREE.MeshStandardMaterial({ color: 0xffb454, emissive: 0xffb454, emissiveIntensity: 0.6 });
      const matC = new THREE.MeshBasicMaterial({ color: 0xffffff });

      const construir = () => {
        const e = estado.current;
        escena.remove(grupo); desechables.forEach(d => d.dispose()); desechables = [];
        etiquetas.forEach(x => x.el.remove()); etiquetas = [];
        grupo = new THREE.Group(); escena.add(grupo);
        nube = [];
        // En lienzos apaisados los meses se separan más y los años menos, para aprovechar el ancho.
        ancho = caja.clientWidth / Math.max(1, caja.clientHeight) > 1.8; PASO_X = ancho ? 1.5 : 1;
        ALTO = ancho ? 3.9 : 2.6; AZ0 = ancho ? -0.25 : -0.36; EL0 = ancho ? 0.68 : 0.6;
        const anios = [...new Set(e.puntos.map(p => p.ym.slice(0, 4)))].sort();
        const filas = anios.length, DZ = Math.min(ancho ? 0.92 : 1.0, (ancho ? 9.0 : 9.4) / Math.max(1, filas));
        const maximo = Math.max(1e-9, ...e.puntos.map(p => p.v ?? 0));
        const y = (v: number) => (v / maximo) * ALTO;
        const base = new THREE.Color(e.color || "#38baff");
        fondo = (filas - 1) * DZ;
        centro = new THREE.Vector3(5.5 * PASO_X + 0.4, ALTO * 0.36, -fondo / 2 + 0.25);
        anios.forEach((anio, f) => {
          const z = -(filas - 1 - f) * DZ;                 // el año más reciente queda al frente
          const k = filas > 1 ? f / (filas - 1) : 1;
          const tono = base.clone().lerp(NAVY, (1 - k) * 0.45);
          const mat = new THREE.MeshStandardMaterial({ color: tono, roughness: 0.5, metalness: 0.05, transparent: true, opacity: 0.16 + 0.3 * k, side: THREE.DoubleSide, depthWrite: false });
          const matL = new THREE.LineBasicMaterial({ color: base.clone().lerp(new THREE.Color("#ffffff"), 0.3 + 0.35 * k), transparent: true, opacity: 0.55 + 0.45 * k });
          desechables.push(mat, matL);
          // Tramos consecutivos con dato: un mes sin dato corta la franja (no se interpola).
          let tramo: { x: number; h: number }[] = [];
          const cerrar = () => {
            if (!tramo.length) return;
            const pts = tramo.length === 1 ? [{ x: tramo[0].x - 0.18, h: tramo[0].h }, { x: tramo[0].x + 0.18, h: tramo[0].h }] : tramo;
            const forma = new THREE.Shape();
            forma.moveTo(pts[0].x, 0); pts.forEach(q => forma.lineTo(q.x, q.h)); forma.lineTo(pts.at(-1)!.x, 0); forma.closePath();
            const g = new THREE.ExtrudeGeometry(forma, { depth: 0.1, bevelEnabled: false, curveSegments: 1 });
            const malla = new THREE.Mesh(g, mat); malla.position.z = z - 0.05; grupo.add(malla);
            const gl = new THREE.BufferGeometry().setFromPoints(pts.map(q => new THREE.Vector3(q.x, q.h + 0.006, z + 0.056)));
            grupo.add(new THREE.Line(gl, matL));
            desechables.push(g, gl);
            tramo = [];
          };
          for (let m = 1; m <= 12; m++) {
            const ym = `${anio}-${String(m).padStart(2, "0")}`;
            const p = e.puntos.find(q => q.ym === ym);
            if (!p || p.v == null) { cerrar(); continue; }
            const x = (m - 1) * PASO_X, h = y(p.v);
            tramo.push({ x, h });
            nube.push({ ym, v: p.v, p: new THREE.Vector3(x, h, z) });
          }
          cerrar();
          if (filas <= 8 || f === filas - 1 || (filas - 1 - f) % 2 === 0) {
            const el = document.createElement("span"); el.className = "rt__anio"; el.textContent = anio;
            capa.append(el); etiquetas.push({ el, p: new THREE.Vector3(11 * PASO_X + 0.85, 0, z) });
          }
        });
        CORTOS.forEach((c, i) => {
          const el = document.createElement("span"); el.className = "rt__mes"; el.textContent = c;
          capa.append(el); etiquetas.push({ el, p: new THREE.Vector3(i * PASO_X, 0, 0.62) });
        });
        // Piso con retícula mensual.
        const pts: number[] = [];
        for (let i = 0; i < 12; i++) pts.push(i * PASO_X, 0, 0.3, i * PASO_X, 0, -fondo - 0.3);
        anios.forEach((_a, f) => { const z = -(filas - 1 - f) * DZ; pts.push(-0.4, 0, z, 11 * PASO_X + 0.4, 0, z); });
        const gr = new THREE.BufferGeometry(); gr.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
        const mr = new THREE.LineBasicMaterial({ color: 0x5cc8ff, transparent: true, opacity: 0.14 });
        grupo.add(new THREE.LineSegments(gr, mr)); desechables.push(gr, mr);
        marcaA = new THREE.Mesh(geoMarca, matA); marcaB = new THREE.Mesh(geoMarca, matB);
        cursor3d = new THREE.Mesh(geoMarca, matC); cursor3d.scale.setScalar(0.7); cursor3d.visible = false;
        grupo.add(marcaA, marcaB, cursor3d);
        arco = null;
        construida = e.clave;
        crece = quieto ? 1 : 0; t0 = 0;
        marcar();
        medir();
      };

      let claveMarcas = "";
      const marcar = () => {
        const e = estado.current;
        const pa = nube.find(q => q.ym === e.actual), pb = nube.find(q => q.ym === e.base);
        if (marcaA) { marcaA.visible = !!pa; if (pa) marcaA.position.copy(pa.p); }
        if (marcaB) { marcaB.visible = !!pb && e.base !== e.actual; if (pb) marcaB.position.copy(pb.p); }
        if (arco) { grupo.remove(arco); arco.geometry.dispose(); (arco.material as import("three").Material).dispose(); arco = null; }
        if (pa && pb && e.base !== e.actual) {
          const medio = pa.p.clone().add(pb.p).multiplyScalar(0.5); medio.y = Math.max(pa.p.y, pb.p.y) + 0.9;
          const curva = new THREE.QuadraticBezierCurve3(pb.p, medio, pa.p);
          const g = new THREE.BufferGeometry().setFromPoints(curva.getPoints(36));
          const m = new THREE.LineDashedMaterial({ color: 0xffffff, transparent: true, opacity: 0.75, dashSize: 0.14, gapSize: 0.1 });
          arco = new THREE.Line(g, m); arco.computeLineDistances(); grupo.add(arco);
        }
        claveMarcas = `${e.actual}|${e.base}`;
      };
      aplicar.current = () => { pedir(); };

      const raton = { x: 0, y: 0, tx: 0, ty: 0, dentro: false, px: 0, py: 0 };
      const v = new THREE.Vector3();
      let w = 1, h = 1, dist = 18, raf = 0, visible = false, forzar = true, focoYm = "";
      const medir = () => {
        w = caja.clientWidth; h = caja.clientHeight;
        if (!w || !h) return;
        if ((w / h > 1.8) !== ancho && construida) { construida = ""; }
        r.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix();
        // Encuadre: la menor distancia a la que todo el volumen (con rótulos) cabe en el lienzo.
        for (dist = 9; dist < 60; dist += 0.5) {
          cam.position.set(centro.x + Math.sin(AZ0) * Math.cos(EL0) * dist, centro.y + Math.sin(EL0) * dist, centro.z + Math.cos(AZ0) * Math.cos(EL0) * dist);
          cam.lookAt(centro); cam.updateMatrixWorld();
          let cabe = true;
          for (const x of [-0.7, 11 * PASO_X + 1.6]) for (const yy of [0, ALTO * 1.12]) for (const z of [1.0, -fondo - 0.4]) {
            v.set(x, yy, z).project(cam);
            if (Math.abs(v.x) > 0.95 || v.y < -0.9 || v.y > 0.9) cabe = false;
          }
          if (cabe) break;
        }
        forzar = true; pedir();
      };
      const proyectar = (p: import("three").Vector3, escalaY = 1) => {
        v.set(p.x, p.y * escalaY, p.z).project(cam);
        return [(v.x * 0.5 + 0.5) * w, (-v.y * 0.5 + 0.5) * h] as const;
      };
      const colocar = (el: HTMLElement | null, p: import("three").Vector3 | null, k: number, dy: number) => {
        if (!el) return;
        if (!p) { el.style.opacity = "0"; return; }
        const [px, py] = proyectar(p, k);
        const medio = el.offsetWidth / 2;
        const cx = Math.min(w - medio - 4, Math.max(medio + 4, px));
        el.style.transform = `translate(-50%,-100%) translate(${cx.toFixed(1)}px,${Math.max(el.offsetHeight + 2, py + dy).toFixed(1)}px)`;
        el.style.opacity = k > 0.9 ? "1" : "0";
      };

      const fotograma = (t: number) => {
        raf = 0;
        if ((!visible || document.hidden) && !forzar) return;
        forzar = false;
        const e = estado.current, s = t / 1000;
        if (e.clave !== construida) construir();
        if (`${e.actual}|${e.base}` !== claveMarcas) marcar();
        if (visible && crece < 1) { if (!t0) t0 = s; crece = Math.min(1, (s - t0) / 1.1); }
        const k = 1 - Math.pow(1 - crece, 3);
        grupo.scale.y = Math.max(0.0001, k);
        raton.x += (raton.tx - raton.x) * 0.06; raton.y += (raton.ty - raton.y) * 0.06;
        const az = AZ0 + raton.x * 0.2 + (quieto ? 0 : Math.sin(s * 0.2) * 0.045);
        const el = EL0 - raton.y * 0.07;
        cam.position.set(centro.x + Math.sin(az) * Math.cos(el) * dist, centro.y + Math.sin(el) * dist, centro.z + Math.cos(az) * Math.cos(el) * dist);
        cam.lookAt(centro);
        cam.updateMatrixWorld();

        // Mes más cercano al cursor en pantalla (no se interpola entre meses).
        let cerca: typeof nube[number] | null = null;
        if (raton.dentro && k > 0.95) {
          let mejor = 20 * 20;
          for (const q of nube) {
            const [px, py] = proyectar(q.p, k);
            const d = (px - raton.px) ** 2 + (py - raton.py) ** 2;
            if (d < mejor) { mejor = d; cerca = q; }
          }
        }
        const ym = cerca?.ym ?? "";
        if (ym !== focoYm) { focoYm = ym; setFoco(cerca ? { ym: cerca.ym, v: cerca.v } : null); lienzo.style.cursor = cerca ? "pointer" : "grab"; }
        if (cursor3d) { cursor3d.visible = !!cerca; if (cerca) cursor3d.position.copy(cerca.p); }

        r.render(escena, cam);

        etiquetas.forEach(x => { const [px, py] = proyectar(x.p); x.el.style.transform = `translate(-50%,-50%) translate(${px.toFixed(1)}px,${py.toFixed(1)}px)`; });
        const pa = nube.find(q => q.ym === e.actual), pb = nube.find(q => q.ym === e.base && e.base !== e.actual);
        // Si las dos marcas quedan juntas en pantalla, la de referencia sube para no encimarse.
        let subeB = -14;
        if (pa && pb) { const [ax, ay] = proyectar(pa.p, k), [bx, by] = proyectar(pb.p, k); if (Math.abs(ay - by) < 30 && Math.abs(ax - bx) < 230) subeB = -14 - (30 - (ay - by)); }
        colocar(aRef.current, pa?.p ?? null, k, -14);
        colocar(bRef.current, pb?.p ?? null, k, subeB);
        colocar(fichaRef.current, cerca?.p ?? null, k, -12);

        const mover = Math.abs(raton.tx - raton.x) > 0.002 || Math.abs(raton.ty - raton.y) > 0.002;
        if (!quieto || crece < 1 || mover) pedir();
      };
      function pedir() { if (!raf) raf = requestAnimationFrame(fotograma); }

      const alMover = (ev: PointerEvent) => {
        const b = caja.getBoundingClientRect();
        raton.px = ev.clientX - b.left; raton.py = ev.clientY - b.top; raton.dentro = true;
        if (!quieto && ev.pointerType === "mouse") { raton.tx = (raton.px / b.width) * 2 - 1; raton.ty = (raton.py / b.height) * 2 - 1; }
        pedir();
      };
      const alSalir = () => { raton.dentro = false; raton.tx = 0; raton.ty = 0; pedir(); };
      const alClic = () => { if (focoYm) estado.current.alElegir(focoYm); };
      caja.addEventListener("pointermove", alMover, { passive: true });
      caja.addEventListener("pointerdown", alMover, { passive: true });
      caja.addEventListener("pointerleave", alSalir);
      caja.addEventListener("click", alClic);
      const ro = new ResizeObserver(medir); ro.observe(caja);
      const io = new IntersectionObserver(([en]) => { visible = en.isIntersecting; if (visible) pedir(); });
      io.observe(caja);
      document.addEventListener("visibilitychange", pedir);
      construir();
      caja.classList.add("rt--lista");

      limpiar = () => {
        cancelAnimationFrame(raf); ro.disconnect(); io.disconnect();
        caja.removeEventListener("pointermove", alMover); caja.removeEventListener("pointerdown", alMover);
        caja.removeEventListener("pointerleave", alSalir); caja.removeEventListener("click", alClic);
        document.removeEventListener("visibilitychange", pedir);
        etiquetas.forEach(x => x.el.remove());
        desechables.forEach(d => d.dispose()); geoMarca.dispose(); matA.dispose(); matB.dispose(); matC.dispose();
        if (arco) { arco.geometry.dispose(); (arco.material as import("three").Material).dispose(); }
        r.dispose();
      };
    }).catch(() => setFallo(true));
    return () => { vivo = false; limpiar(); };
  }, []);

  // Cualquier cambio de datos o de meses elegidos pide un fotograma; la escena se reconstruye sola si cambió la serie.
  useEffect(() => { aplicar.current(); }, [clave, props.actual, props.base]);

  if (fallo) return null;
  const va = props.puntos.find(p => p.ym === props.actual)?.v ?? null;
  const vb = props.puntos.find(p => p.ym === props.base)?.v ?? null;
  return (
    <div ref={cajaRef} className="rt" aria-hidden="true">
      <canvas ref={lienzoRef} className="rt__lienzo" />
      <div ref={capaRef} className="rt__capa" />
      <span ref={bRef} className="rt__marca rt__marca--b"><i />Referencia · {mesCorto(props.base)} · <b>{props.formato(vb)}</b></span>
      <span ref={aRef} className="rt__marca rt__marca--a"><i />Análisis · {mesCorto(props.actual)} · <b>{props.formato(va)}</b></span>
      <div ref={fichaRef} className="rt__ficha">
        {foco && <><span>{mesCorto(foco.ym)}</span><strong>{props.formato(foco.v)}</strong><em>clic: fijar como mes de análisis</em></>}
      </div>
    </div>
  );
}
