/**
 * Motor isométrico (Three.js). Cámara ortográfica con elevación isométrica real
 * (atan(1/√2) ≈ 35.26°), luz de tres tonos, sombras suaves, giro por arrastre,
 * selección por clic y etiquetas HTML proyectadas desde el espacio 3D.
 * Renderiza bajo demanda: solo mientras hay animación o interacción.
 */
import * as THREE from "three";

export const ELEVACION_ISO = Math.atan(1 / Math.SQRT2);
const AZIMUT_ISO = Math.PI / 4;

export interface Pieza {
  id: string;
  grupo: THREE.Group;
  mallas: THREE.Mesh[];
  mats: THREE.MeshStandardMaterial[];
  bordes: THREE.Line[];
  /** Paredes laterales de tono plano (estilo isométrico), derivadas del color superior. */
  lados?: THREE.MeshBasicMaterial[];
  altura: number;
  objetivo: number;
  retardo: number;
  colorObjetivo: THREE.Color[];
  /** Punto superior en coordenadas de mundo (y se toma de la altura animada). */
  ancla: THREE.Vector3;
}

export interface LineaEtiqueta { texto: string; clase?: string }
export interface Etiqueta {
  id: string;
  lineas: LineaEtiqueta[];
  clase?: string;
  pieza?: Pieza;
  fija?: THREE.Vector3;
  offset?: number;
}

export interface Contenido {
  grupo: THREE.Group;
  piezas: Pieza[];
  etiquetas: Etiqueta[];
  radio: number;
  centro: THREE.Vector3;
  /** Azimut preferido de la escena (por defecto, isométrico a 45°). */
  azimut?: number;
  /** Elevación preferida (por defecto, isométrica 35.26°). */
  elevacion?: number;
  geometrias: THREE.BufferGeometry[];
  materiales: THREE.Material[];
}

export interface Eventos {
  onHover: (p: Pieza | null, x: number, y: number) => void;
  onClick: (p: Pieza | null) => void;
  /** Rectángulos del HUD (relativos al escenario) que las etiquetas deben evitar. */
  obstaculos?: () => Array<[number, number, number, number]>;
}

const reducido = () => typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
const acercar = (a: number, b: number, k: number) => a + (b - a) * k;

export class Motor {
  readonly renderer: THREE.WebGLRenderer;
  private escena = new THREE.Scene();
  private camara = new THREE.OrthographicCamera(-1, 1, 1, -1, -2000, 4000);
  private raiz = new THREE.Group();
  private luz: THREE.DirectionalLight;
  private suelo: THREE.Mesh;
  private rejilla: THREE.LineSegments;
  private host: HTMLElement;
  private capa: HTMLElement;
  private ev: Eventos;
  private contenido: Contenido | null = null;
  private mallas: THREE.Mesh[] = [];
  private nodos = new Map<string, HTMLDivElement>();

  private az = AZIMUT_ISO; private azObj = AZIMUT_ISO; private azBase = AZIMUT_ISO; private elBase = ELEVACION_ISO;
  private el = ELEVACION_ISO; private elObj = ELEVACION_ISO;
  private zoom = 1; private zoomObj = 1;
  private vista = 80; private vistaObj = 80;
  private centro = new THREE.Vector3(); private centroObj = new THREE.Vector3();

  private tiempo = 0;
  private tPrev = 0;
  private raf = 0;
  private sucio = true;
  private visible = true;
  private hover: Pieza | null = null;
  private seleccion: string | null = null;
  private movimiento = !reducido();
  private arrastre: { x: number; y: number; ix: number; iy: number; movido: boolean } | null = null;
  private io: IntersectionObserver;
  private ro: ResizeObserver;
  private ray = new THREE.Raycaster();
  private ptr = new THREE.Vector2();
  private tmp = new THREE.Vector3();

  constructor(host: HTMLElement, capa: HTMLElement, ev: Eventos) {
    this.host = host; this.capa = capa; this.ev = ev;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    const cv = this.renderer.domElement;
    cv.className = "iso-lienzo";
    cv.style.touchAction = "pan-y";
    host.appendChild(cv);

    // Luz de tres tonos: cara superior clara, frontal media, lateral oscura.
    this.escena.add(new THREE.HemisphereLight(0xd6e6ff, 0x0b1220, 1.15));
    this.luz = new THREE.DirectionalLight(0xffffff, 2.3);
    this.luz.position.set(30, 90, 55);
    this.luz.castShadow = true;
    this.luz.shadow.mapSize.set(2048, 2048);
    this.luz.shadow.bias = -0.0004;
    this.luz.shadow.normalBias = 0.02;
    this.escena.add(this.luz, this.luz.target);
    const contra = new THREE.DirectionalLight(0x7cc4ff, 0.55);
    contra.position.set(-70, 40, -60);
    this.escena.add(contra);

    this.suelo = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), new THREE.ShadowMaterial({ opacity: 0.32 }));
    this.suelo.rotation.x = -Math.PI / 2;
    this.suelo.receiveShadow = true;
    this.escena.add(this.suelo);
    this.rejilla = Motor.crearRejilla(240, 6);
    this.escena.add(this.rejilla);
    this.escena.add(this.raiz);

    cv.addEventListener("pointerdown", this.alPresionar);
    cv.addEventListener("pointermove", this.alMover);
    cv.addEventListener("pointerup", this.alSoltar);
    cv.addEventListener("pointerleave", this.alSalir);
    cv.addEventListener("wheel", this.alRueda, { passive: false });
    cv.addEventListener("dblclick", this.restablecer);
    cv.addEventListener("webglcontextlost", e => e.preventDefault());

    this.ro = new ResizeObserver(() => this.redimensionar());
    this.ro.observe(host);
    this.io = new IntersectionObserver(([e]) => { this.visible = e.isIntersecting; this.sucio = true; });
    this.io.observe(host);
    document.addEventListener("visibilitychange", this.alVisibilidad);
    this.redimensionar();
    this.tPrev = performance.now();
    this.raf = requestAnimationFrame(this.cuadro);
  }

  private static crearRejilla(tam: number, paso: number): THREE.LineSegments {
    const pts: number[] = [];
    for (let v = -tam / 2; v <= tam / 2; v += paso) {
      pts.push(-tam / 2, 0, v, tam / 2, 0, v, v, 0, -tam / 2, v, 0, tam / 2);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    const m = new THREE.LineBasicMaterial({ color: 0x2a4258, transparent: true, opacity: 0.32 });
    const l = new THREE.LineSegments(g, m);
    l.position.y = -0.02;
    return l;
  }

  /* ---------- Contenido ---------- */

  setContenido(c: Contenido, animar = true) {
    this.quitarContenido();
    this.contenido = c;
    this.raiz.add(c.grupo);
    this.mallas = c.piezas.flatMap(p => p.mallas);
    for (const p of c.piezas) {
      for (const m of p.mallas) { m.castShadow = true; m.receiveShadow = true; m.userData.pieza = p; }
      if (!animar || !this.movimiento) p.altura = p.objetivo;
      p.grupo.scale.y = Math.max(0.001, p.altura);
    }
    this.tiempo = 0;
    this.azBase = c.azimut ?? AZIMUT_ISO;
    this.elBase = c.elevacion ?? ELEVACION_ISO;
    this.azObj = this.azBase; this.elObj = this.elBase; this.zoomObj = 1;
    this.centroObj.copy(c.centro);
    this.vistaObj = c.radio * 2.15;
    if (!animar) { this.centro.copy(c.centro); this.vista = this.vistaObj; }
    const s = c.radio * 1.7;
    const sc = this.luz.shadow.camera;
    sc.left = -s; sc.right = s; sc.top = s; sc.bottom = -s; sc.near = 1; sc.far = 400;
    sc.updateProjectionMatrix();
    this.rejilla.position.x = c.centro.x; this.rejilla.position.z = c.centro.z;
    this.crearEtiquetas(c.etiquetas);
    this.sucio = true;
  }

  /** Avisar que cambiaron objetivos de altura o color. */
  refrescar() { this.sucio = true; }

  setSeleccion(id: string | null) { this.seleccion = id; this.sucio = true; }

  setEtiquetas(ets: Etiqueta[]) {
    if (!this.contenido) return;
    this.contenido.etiquetas = ets;
    this.crearEtiquetas(ets);
    this.sucio = true;
  }

  girar(delta: number) { this.azObj += delta; this.sucio = true; }
  acercarPaso(f: number) { this.zoomObj = Math.min(3.2, Math.max(0.6, this.zoomObj * f)); this.sucio = true; }
  restablecer = () => { this.azObj = this.azBase; this.elObj = this.elBase; this.zoomObj = 1; this.sucio = true; };

  private quitarContenido() {
    if (!this.contenido) return;
    this.raiz.remove(this.contenido.grupo);
    this.contenido.geometrias.forEach(g => g.dispose());
    this.contenido.materiales.forEach(m => m.dispose());
    this.contenido = null;
    this.mallas = [];
    this.hover = null;
    this.capa.replaceChildren();
    this.nodos.clear();
  }

  private crearEtiquetas(ets: Etiqueta[]) {
    this.capa.replaceChildren();
    this.nodos.clear();
    for (const e of ets) {
      const n = document.createElement("div");
      n.className = `iso-et ${e.clase ?? ""}`;
      for (const l of e.lineas) {
        const s = document.createElement("span");
        if (l.clase) s.className = l.clase;
        s.textContent = l.texto;
        n.appendChild(s);
      }
      this.capa.appendChild(n);
      this.nodos.set(e.id, n);
    }
  }

  /* ---------- Bucle ---------- */

  private cuadro = (t: number) => {
    this.raf = requestAnimationFrame(this.cuadro);
    const dt = Math.min(0.05, (t - this.tPrev) / 1000);
    this.tPrev = t;
    if (!this.visible || document.hidden) return;
    this.tiempo += dt;
    const k = this.movimiento ? 1 - Math.exp(-dt * 7) : 1;
    let anim = false;

    const mover = (a: number, b: number) => { const n = acercar(a, b, k); if (Math.abs(n - b) > 1e-4) anim = true; else return b; return n; };
    this.az = mover(this.az, this.azObj);
    this.el = mover(this.el, this.elObj);
    this.zoom = mover(this.zoom, this.zoomObj);
    this.vista = mover(this.vista, this.vistaObj);
    if (this.centro.distanceToSquared(this.centroObj) > 1e-6) { this.centro.lerp(this.centroObj, k); anim = true; }

    if (this.contenido) {
      const kh = this.movimiento ? 1 - Math.exp(-dt * 5.5) : 1;
      const kc = this.movimiento ? 1 - Math.exp(-dt * 6) : 1;
      for (const p of this.contenido.piezas) {
        if (this.tiempo >= p.retardo || !this.movimiento) {
          const d = p.objetivo - p.altura;
          if (Math.abs(d) > 1e-3) { p.altura += d * kh; anim = true; } else p.altura = p.objetivo;
        } else anim = true;
        p.grupo.scale.y = Math.max(0.001, p.altura);
        const sel = this.seleccion === p.id, hov = this.hover === p;
        const elev = (sel ? 1.4 : 0) + (hov ? 0.6 : 0);
        const ny = acercar(p.grupo.position.y, elev, kc);
        if (Math.abs(ny - elev) > 1e-3) anim = true;
        p.grupo.position.y = Math.abs(ny - elev) > 1e-3 ? ny : elev;
        p.mats.forEach((m, i) => {
          const obj = p.colorObjetivo[i];
          if (obj) {
            const dc = Math.abs(m.color.r - obj.r) + Math.abs(m.color.g - obj.g) + Math.abs(m.color.b - obj.b);
            if (dc > 0.002) { m.color.lerp(obj, kc); anim = true; } else m.color.copy(obj);
          }
          m.emissive.copy(m.color);
          m.emissiveIntensity = sel ? 0.42 : hov ? 0.26 : 0.04;
        });
        p.lados?.forEach(l => l.color.copy(p.mats[0].color).multiplyScalar(sel ? 0.8 : hov ? 0.7 : 0.5));
        const atenuar = this.seleccion !== null && !sel;
        p.bordes.forEach(b => {
          const lm = b.material as THREE.LineBasicMaterial;
          lm.color.set(sel ? 0xffffff : 0x0a1422);
          lm.opacity = sel ? 0.95 : atenuar ? 0.25 : 0.55;
        });
      }
    }

    if (anim || this.sucio) {
      this.actualizarCamara();
      this.renderer.render(this.escena, this.camara);
      this.ubicarEtiquetas();
      this.sucio = false;
    }
  };

  private actualizarCamara() {
    const w = this.host.clientWidth || 1, h = this.host.clientHeight || 1;
    const asp = w / h;
    const r = this.vista / 2;
    const mitadAlto = Math.max(r * 0.78, (r * 1.02) / asp);
    this.camara.left = -mitadAlto * asp; this.camara.right = mitadAlto * asp;
    this.camara.top = mitadAlto; this.camara.bottom = -mitadAlto;
    this.camara.zoom = this.zoom;
    const d = 600;
    this.camara.position.set(
      this.centro.x + d * Math.cos(this.el) * Math.sin(this.az),
      this.centro.y + d * Math.sin(this.el),
      this.centro.z + d * Math.cos(this.el) * Math.cos(this.az),
    );
    this.camara.lookAt(this.centro);
    this.camara.updateProjectionMatrix();
    this.luz.target.position.copy(this.centro);
    this.luz.position.set(this.centro.x + 30, 90, this.centro.z + 55);
  }

  private ubicarEtiquetas() {
    if (!this.contenido) return;
    const w = this.host.clientWidth, h = this.host.clientHeight;
    const ocupadas: Array<[number, number, number, number]> = [...(this.ev.obstaculos?.() ?? [])];
    for (const e of this.contenido.etiquetas) {
      const n = this.nodos.get(e.id);
      if (!n) continue;
      if (e.pieza) {
        const p = e.pieza;
        this.tmp.set(p.ancla.x, p.altura * p.ancla.y + p.grupo.position.y + (e.offset ?? 0.8), p.ancla.z);
        n.style.opacity = p.altura > 0.2 ? "1" : "0";
      } else if (e.fija) this.tmp.copy(e.fija);
      else continue;
      this.tmp.project(this.camara);
      const x = (this.tmp.x + 1) / 2 * w, y = (1 - this.tmp.y) / 2 * h;
      if (!e.pieza) {
        n.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -50%)`;
        continue;
      }
      // Etiqueta sobre la pieza: si choca con otra ya colocada, sube y alarga su línea guía.
      const ew = n.offsetWidth || 90, eh = n.offsetHeight || 34;
      const libre = (dx: number, t: number) => y - t - eh >= 4 && !ocupadas.some(([a, b, c, d]) =>
        x + dx - ew / 2 < c + 4 && x + dx + ew / 2 > a - 4 && y - t - eh < d + 3 && y - t > b - 3);
      // Candidatos: subir la etiqueta; si no cabe, desplazarla a un lado (la guía sigue cayendo a su pieza).
      let dx = 0, tallo = 8, hallado = false;
      for (let t = 8; t < 240 && !hallado; t += 6) if (libre(0, t)) { tallo = t; hallado = true; }
      for (const lado of [ew * 0.42, -ew * 0.42]) for (let t = 8; t < 140 && !hallado; t += 6) {
        if (libre(lado, t)) { dx = lado; tallo = t; hallado = true; }
      }
      ocupadas.push([x + dx - ew / 2, y - tallo - eh, x + dx + ew / 2, y - tallo]);
      n.style.setProperty("--tallo", `${tallo}px`);
      n.style.setProperty("--dx", `${dx.toFixed(1)}px`);
      n.style.transform = `translate3d(${(x + dx).toFixed(1)}px, ${(y - tallo).toFixed(1)}px, 0) translate(-50%, -100%)`;
      n.classList.toggle("es-sel", !!e.pieza && e.pieza.id === this.seleccion);
    }
  }

  /* ---------- Interacción ---------- */

  private elegir(cx: number, cy: number): Pieza | null {
    const r = this.renderer.domElement.getBoundingClientRect();
    this.ptr.set((cx - r.left) / r.width * 2 - 1, -(cy - r.top) / r.height * 2 + 1);
    this.ray.setFromCamera(this.ptr, this.camara);
    const hit = this.ray.intersectObjects(this.mallas, false)[0];
    return (hit?.object.userData.pieza as Pieza | undefined) ?? null;
  }

  private alPresionar = (e: PointerEvent) => {
    this.arrastre = { x: e.clientX, y: e.clientY, ix: e.clientX, iy: e.clientY, movido: false };
  };
  private alMover = (e: PointerEvent) => {
    const a = this.arrastre;
    if (a) {
      const dx = e.clientX - a.x, dy = e.clientY - a.y;
      a.x = e.clientX; a.y = e.clientY;
      if (!a.movido && Math.hypot(e.clientX - a.ix, e.clientY - a.iy) > 5) {
        a.movido = true;
        this.renderer.domElement.setPointerCapture(e.pointerId);
      }
      if (a.movido) {
        this.azObj -= dx * 0.0065;
        this.elObj = Math.min(1.15, Math.max(0.28, this.elObj + dy * 0.004));
        this.sucio = true;
        return;
      }
    }
    const p = this.elegir(e.clientX, e.clientY);
    if (p !== this.hover) { this.hover = p; this.sucio = true; }
    const r = this.host.getBoundingClientRect();
    this.ev.onHover(p, e.clientX - r.left, e.clientY - r.top);
    this.renderer.domElement.style.cursor = p ? "pointer" : "grab";
  };
  private alSoltar = (e: PointerEvent) => {
    const a = this.arrastre;
    this.arrastre = null;
    if (a && !a.movido) this.ev.onClick(this.elegir(e.clientX, e.clientY));
  };
  private alSalir = () => {
    this.arrastre = null;
    if (this.hover) { this.hover = null; this.sucio = true; }
    this.ev.onHover(null, 0, 0);
  };
  private alRueda = (e: WheelEvent) => {
    // No secuestra el desplazamiento de la página: el zoom requiere Ctrl/⌘ (o pellizco).
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    this.acercarPaso(Math.exp(-e.deltaY * 0.0022));
  };
  private alVisibilidad = () => { this.sucio = true; this.tPrev = performance.now(); };

  redimensionar() {
    const w = this.host.clientWidth, h = this.host.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = `${w}px`;
    this.renderer.domElement.style.height = `${h}px`;
    this.sucio = true;
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.ro.disconnect(); this.io.disconnect();
    document.removeEventListener("visibilitychange", this.alVisibilidad);
    const cv = this.renderer.domElement;
    cv.removeEventListener("pointerdown", this.alPresionar);
    cv.removeEventListener("pointermove", this.alMover);
    cv.removeEventListener("pointerup", this.alSoltar);
    cv.removeEventListener("pointerleave", this.alSalir);
    cv.removeEventListener("wheel", this.alRueda);
    cv.removeEventListener("dblclick", this.restablecer);
    this.quitarContenido();
    this.suelo.geometry.dispose(); (this.suelo.material as THREE.Material).dispose();
    this.rejilla.geometry.dispose(); (this.rejilla.material as THREE.Material).dispose();
    this.renderer.dispose();
    cv.remove();
  }
}
