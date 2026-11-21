import { useEffect, useRef, useState } from "react";

export interface MesBarra {
  ym: string;            // "2026-10"
  corto: string;         // "oct"
  valor: number | null;  // null = mes no publicado
  diario: number | null;
  variacion: number | null; // % frente al mes previo
}

const nf0 = new Intl.NumberFormat("es-MX", { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat("es-MX", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** Escena WebGL (Three.js) de los registros mensuales: barras con volumen, luz, reflejo en el piso,
 *  cámara con paralaje y selección por cursor. La altura parte de cero. Si WebGL no está disponible
 *  se avisa con `alFallar` para que el contenedor muestre la alternativa en CSS. */
export default function BarrasMes3D({ meses, ultimo, activo, alFallar }: {
  meses: MesBarra[]; ultimo: number; activo: boolean; alFallar: () => void;
}) {
  const cajaRef = useRef<HTMLDivElement>(null);
  const lienzoRef = useRef<HTMLCanvasElement>(null);
  const etiquetasRef = useRef<(HTMLSpanElement | null)[]>([]);
  const valoresRef = useRef<(HTMLSpanElement | null)[]>([]);
  const fichaRef = useRef<HTMLDivElement>(null);
  const activoRef = useRef(activo);
  const selRef = useRef<number | null>(null);
  const [sel, setSel] = useState<number | null>(null);
  activoRef.current = activo;

  useEffect(() => {
    const caja = cajaRef.current, lienzo = lienzoRef.current;
    if (!caja || !lienzo) return;
    const quieto = matchMedia("(prefers-reduced-motion:reduce)").matches;
    let vivo = true, limpiar = () => {};
    import("three").then(THREE => {
      if (!vivo) return;
      let r: import("three").WebGLRenderer;
      try { r = new THREE.WebGLRenderer({ canvas: lienzo, antialias: true, alpha: true, powerPreference: "high-performance" }); }
      catch { alFallar(); return; }
      r.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
      r.setClearColor(0x000000, 0);
      r.outputColorSpace = THREE.SRGBColorSpace;
      r.toneMapping = THREE.ACESFilmicToneMapping;
      r.toneMappingExposure = 1.0;

      const escena = new THREE.Scene();
      const cam = new THREE.PerspectiveCamera(34, 1, 0.1, 120);
      const centro = new THREE.Vector3(0.2, 1.2, 0);

      const tema = () => {
        const cs = getComputedStyle(document.documentElement);
        return new THREE.Color(cs.getPropertyValue("--page").trim() || "#0b141c");
      };

      escena.add(new THREE.HemisphereLight(0xcfe8ff, 0x0a1622, 0.8));
      const clave = new THREE.DirectionalLight(0xffffff, 1.55); clave.position.set(-6, 9, 8); escena.add(clave);
      const contra = new THREE.DirectionalLight(0x56b8ff, 1.1); contra.position.set(8, 4, -6); escena.add(contra);
      const acento = new THREE.PointLight(0x2fd3b0, 2.2, 8, 1.8); escena.add(acento);

      const n = meses.length, PASO = 1, ANCHO = 0.62, ALTO = 3.3;
      const maximo = Math.max(1, ...meses.map(m => m.valor ?? 0));
      const x0 = -((n - 1) * PASO) / 2;
      const geo = new THREE.BoxGeometry(ANCHO, 1, ANCHO); geo.translate(0, 0.5, 0);
      const aristas = new THREE.EdgesGeometry(geo);
      const AZUL = new THREE.Color("#2f8fd8"), VERDE = new THREE.Color("#17a88a");
      const barras: { malla: import("three").Mesh; reflejo: import("three").Mesh; h: number; i: number; base: import("three").Color }[] = [];
      const desechables: { dispose(): void }[] = [geo, aristas];

      meses.forEach((m, i) => {
        const x = x0 + i * PASO;
        if (m.valor == null) {
          const g = new THREE.EdgesGeometry(new THREE.BoxGeometry(ANCHO, 0.02, ANCHO));
          const mat = new THREE.LineDashedMaterial({ color: 0x8fb4d4, transparent: true, opacity: 0.55, dashSize: 0.09, gapSize: 0.07 });
          const linea = new THREE.LineSegments(g, mat); linea.computeLineDistances(); linea.position.set(x, 0.012, 0);
          escena.add(linea); desechables.push(g, mat);
          return;
        }
        const base = i === ultimo ? VERDE : AZUL;
        const mat = new THREE.MeshPhysicalMaterial({
          color: base.clone(), metalness: 0.1, roughness: 0.42, clearcoat: 0.35, clearcoatRoughness: 0.3,
          emissive: base.clone(), emissiveIntensity: i === ultimo ? 0.16 : 0.05,
        });
        const malla = new THREE.Mesh(geo, mat); malla.position.set(x, 0, 0); malla.userData.i = i;
        const matA = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: i === ultimo ? 0.5 : 0.22 });
        malla.add(new THREE.LineSegments(aristas, matA));
        const matR = new THREE.MeshBasicMaterial({ color: base.clone().multiplyScalar(0.7), transparent: true, opacity: 0.2, depthWrite: false });
        const reflejo = new THREE.Mesh(geo, matR); reflejo.position.set(x, 0, 0);
        escena.add(malla, reflejo);
        desechables.push(mat, matA, matR);
        barras.push({ malla, reflejo, h: Math.max(0.03, (m.valor / maximo) * ALTO), i, base });
      });
      if (meses[ultimo]) acento.position.set(x0 + ultimo * PASO + 0.6, 2.6, 2.6);

      // Piso translúcido sobre los reflejos, con retícula.
      const geoPiso = new THREE.PlaneGeometry(n * PASO + 3.4, 4.6);
      const matPiso = new THREE.MeshBasicMaterial({ color: tema(), transparent: true, opacity: 0.62, depthWrite: false });
      const piso = new THREE.Mesh(geoPiso, matPiso); piso.rotation.x = -Math.PI / 2; piso.position.y = -0.001; piso.renderOrder = 1;
      escena.add(piso);
      const pts: number[] = [];
      const mitadX = (n * PASO + 3.4) / 2, mitadZ = 2.3;
      for (let x = -Math.floor(mitadX); x <= Math.floor(mitadX); x += 1) pts.push(x + 0.5, 0, -mitadZ, x + 0.5, 0, mitadZ);
      for (let z = -2; z <= 2; z += 1) pts.push(-mitadX, 0, z, mitadX, 0, z);
      const geoRet = new THREE.BufferGeometry(); geoRet.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
      const matRet = new THREE.LineBasicMaterial({ color: 0x5cc8ff, transparent: true, opacity: 0.16 });
      const ret = new THREE.LineSegments(geoRet, matRet); ret.position.y = 0.002; ret.renderOrder = 2; escena.add(ret);
      desechables.push(geoPiso, matPiso, geoRet, matRet);
      const mo = new MutationObserver(() => { matPiso.color.copy(tema()); pedir(); });
      mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

      const raton = { x: 0, y: 0, tx: 0, ty: 0, dentro: false, px: 0, py: 0 };
      const rayo = new THREE.Raycaster(), ndc = new THREE.Vector2(), v = new THREE.Vector3();
      let w = 1, h = 1, dist = 14;
      const medir = () => {
        w = caja.clientWidth; h = caja.clientHeight;
        if (!w || !h) return;
        r.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix();
        dist = Math.max(11.4, 20.5 / cam.aspect);
        forzar = true; pedir();
      };
      const proyectar = (x: number, y: number, z: number) => {
        v.set(x, y, z).project(cam);
        return [(v.x * 0.5 + 0.5) * w, (-v.y * 0.5 + 0.5) * h] as const;
      };

      let raf = 0, visible = false, forzar = true, t0 = 0, crecido = quieto ? 1 : 0, ultimoSel: number | null = -1;
      const fotograma = (t: number) => {
        raf = 0;
        if ((!visible || document.hidden) && !forzar) return;
        const s = t / 1000;
        // El crecimiento arranca cuando la escena está realmente en pantalla.
        if (visible && activoRef.current && crecido < 1) { if (!t0) t0 = s; }
        forzar = false;
        raton.x += (raton.tx - raton.x) * 0.06; raton.y += (raton.ty - raton.y) * 0.06;
        const az = 0.3 + raton.x * 0.18 + (quieto ? 0 : Math.sin(s * 0.22) * 0.05);
        const el = 0.3 - raton.y * 0.06;
        cam.position.set(centro.x + Math.sin(az) * Math.cos(el) * dist, centro.y + Math.sin(el) * dist, centro.z + Math.cos(az) * Math.cos(el) * dist);
        cam.lookAt(centro);

        let enCurso = false;
        barras.forEach(b => {
          const k = quieto || !t0 ? (quieto ? 1 : 0.0001) : Math.min(1, Math.max(0, (s - t0 - b.i * 0.07) / 0.95));
          const e = 1 - Math.pow(1 - k, 3);
          if (k < 1) enCurso = true;
          const alto = Math.max(0.0001, b.h * e);
          b.malla.scale.y = alto; b.reflejo.scale.y = -alto * 0.85;
          const mat = b.malla.material as import("three").MeshPhysicalMaterial;
          const objetivo = selRef.current === b.i ? 0.34 : b.i === ultimo ? 0.16 : 0.05;
          mat.emissiveIntensity += (objetivo - mat.emissiveIntensity) * 0.15;
          if (Math.abs(objetivo - mat.emissiveIntensity) > 0.005) enCurso = true;
        });
        if (!enCurso && t0) crecido = 1;

        if (raton.dentro) {
          ndc.set((raton.px / w) * 2 - 1, -(raton.py / h) * 2 + 1);
          rayo.setFromCamera(ndc, cam);
          const toque = rayo.intersectObjects(barras.map(b => b.malla), false)[0];
          const i = toque ? (toque.object.userData.i as number) : null;
          if (i !== ultimoSel) { ultimoSel = i; selRef.current = i; setSel(i); lienzo.style.cursor = i == null ? "grab" : "pointer"; }
        }

        r.render(escena, cam);

        // Ficha del mes en foco (el último por defecto); las cifras que quedarían debajo se ocultan.
        const ficha = fichaRef.current, foco = selRef.current ?? ultimo;
        const bf = barras.find(q => q.i === foco);
        let fx = -9999, fmedio = 0;
        if (ficha && bf) {
          const [px, py] = proyectar(x0 + foco * PASO, bf.malla.scale.y + 0.2, 0);
          fmedio = ficha.offsetWidth / 2;
          fx = Math.min(w - fmedio - 6, Math.max(fmedio + 6, px));
          const fy = Math.max(py - 8, ficha.offsetHeight + 4);
          ficha.style.transform = `translate(-50%,-100%) translate(${fx.toFixed(1)}px,${fy.toFixed(1)}px)`;
          ficha.style.setProperty("--flecha", `${(px - fx).toFixed(1)}px`);
          ficha.style.opacity = bf.malla.scale.y > bf.h * 0.9 ? "1" : "0";
        }
        meses.forEach((_m, i) => {
          const x = x0 + i * PASO;
          const et = etiquetasRef.current[i];
          if (et) { const [px, py] = proyectar(x, 0, ANCHO / 2 + 0.42); et.style.transform = `translate(-50%,0) translate(${px.toFixed(1)}px,${py.toFixed(1)}px)`; }
          const va = valoresRef.current[i];
          const b = barras.find(q => q.i === i);
          if (va && b) {
            const [px, py] = proyectar(x, b.malla.scale.y + 0.16, 0);
            va.style.transform = `translate(-50%,-100%) translate(${px.toFixed(1)}px,${py.toFixed(1)}px)`;
            const tapado = Math.abs(px - fx) < fmedio + 14;
            va.style.opacity = !tapado && (crecido || b.malla.scale.y > b.h * 0.9) ? "1" : "0";
          }
        });

        const mover = Math.abs(raton.tx - raton.x) > 0.002 || Math.abs(raton.ty - raton.y) > 0.002;
        if (!quieto || enCurso || mover) pedir();
      };
      function pedir() { if (!raf) raf = requestAnimationFrame(fotograma); }

      const alMover = (e: PointerEvent) => {
        const b = caja.getBoundingClientRect();
        raton.px = e.clientX - b.left; raton.py = e.clientY - b.top; raton.dentro = true;
        if (!quieto) { raton.tx = (raton.px / b.width) * 2 - 1; raton.ty = (raton.py / b.height) * 2 - 1; }
        pedir();
      };
      const alSalir = () => { raton.dentro = false; raton.tx = 0; raton.ty = 0; ultimoSel = null; selRef.current = null; setSel(null); pedir(); };
      caja.addEventListener("pointermove", alMover, { passive: true });
      caja.addEventListener("pointerdown", alMover, { passive: true });
      caja.addEventListener("pointerleave", alSalir);
      const ro = new ResizeObserver(medir); ro.observe(caja);
      const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) pedir(); });
      io.observe(caja);
      document.addEventListener("visibilitychange", pedir);
      medir();
      caja.classList.add("b3d--lista");

      limpiar = () => {
        cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); mo.disconnect();
        caja.removeEventListener("pointermove", alMover); caja.removeEventListener("pointerdown", alMover); caja.removeEventListener("pointerleave", alSalir);
        document.removeEventListener("visibilitychange", pedir);
        desechables.forEach(d => d.dispose()); r.dispose();
      };
    }).catch(() => alFallar());
    return () => { vivo = false; limpiar(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meses, ultimo]);

  const foco = sel ?? ultimo, mf = meses[foco];
  return (
    <div ref={cajaRef} className="b3d" aria-hidden="true">
      <canvas ref={lienzoRef} className="b3d__lienzo" />
      {meses.map((m, i) => (
        <span key={`e${m.ym}`} ref={el => { etiquetasRef.current[i] = el; }}
          className={`b3d__mes${i === ultimo ? " es-ult" : m.valor == null ? " es-np" : ""}${i === foco ? " es-foco" : ""}`}>{m.corto}</span>
      ))}
      {meses.map((m, i) => m.valor != null && i !== foco && (
        <span key={`v${m.ym}`} ref={el => { valoresRef.current[i] = el; }} className="b3d__val">{nf1.format(m.valor / 1000)}</span>
      ))}
      {mf && mf.valor != null && (
        <div ref={fichaRef} className={`b3d__ficha${foco === ultimo ? " es-ult" : ""}`}>
          <span className="b3d__ficha-mes">{mf.corto} {mf.ym.slice(0, 4)}</span>
          <strong>{nf0.format(mf.valor)}</strong>
          <span className="b3d__ficha-pie">
            {mf.diario != null && <>{nf1.format(mf.diario)} al día</>}
            {mf.variacion != null && <b className={mf.variacion > 0 ? "sube" : "baja"}> · {mf.variacion > 0 ? "+" : ""}{nf1.format(mf.variacion)} %</b>}
          </span>
        </div>
      )}
    </div>
  );
}
