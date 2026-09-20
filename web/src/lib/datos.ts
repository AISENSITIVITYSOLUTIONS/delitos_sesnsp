/** Carga y caché de productos precalculados (estáticos, bajo ./datos). */

const cache = new Map<string, Promise<unknown>>();

export function cargar<T>(nombre: string): Promise<T> {
  if (!cache.has(nombre)) {
    const p = fetch(`datos/${nombre}`, { cache: "no-cache" }).then((r) => {
      if (!r.ok) throw new Error(`No se pudo cargar datos/${nombre}: HTTP ${r.status}`);
      const ct = r.headers.get("content-type") ?? "";
      if (ct.includes("text/html")) throw new Error(`datos/${nombre} devolvió HTML; no se procesa como datos.`);
      return r.json();
    });
    cache.set(nombre, p);
    p.catch(() => cache.delete(nombre));
  }
  return cache.get(nombre) as Promise<T>;
}

function aviso(texto: string): void {
  let n = document.getElementById("aviso-flotante");
  if (!n) {
    n = document.createElement("div");
    n.id = "aviso-flotante";
    n.setAttribute("role", "status");
    n.style.cssText = "position:fixed;bottom:18px;left:50%;transform:translateX(-50%);" +
      "background:var(--header);color:#F2EFE7;padding:9px 16px;border-radius:10px;" +
      "font-size:13px;z-index:99;box-shadow:var(--sombra-3);max-width:90vw;text-align:center";
    document.body.appendChild(n);
  }
  n.textContent = texto;
  n.style.opacity = "1";
  setTimeout(() => { if (n) n.style.opacity = "0"; }, 3800);
}

/** Exporta CSV conservando metadatos (fuente, corte, filtros, unidad, versión).
 * En entornos que bloquean descargas iniciadas por la página, copia el CSV al
 * portapapeles; en despliegues propios descarga el archivo. */
export function descargarCSV(nombreArchivo: string, encabezados: string[],
  filas: (string | number | null)[][], metadatos: Record<string, string>): void {
  const esc = (v: string | number | null): string => {
    if (v == null) return "";
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lineasMeta = Object.entries(metadatos).map(([k, v]) => `# ${k}: ${v}`);
  const cuerpo = [...lineasMeta, encabezados.map(esc).join(","),
    ...filas.map((f) => f.map(esc).join(","))].join("\n");
  try {
    const blob = new Blob(["﻿" + cuerpo], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = nombreArchivo;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  } catch { /* descarga no disponible */ }
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(cuerpo).then(
      () => aviso(`CSV con metadatos copiado al portapapeles (${nombreArchivo}); si tu entorno lo permite, también se descargó.`),
      () => aviso("Tu visor bloquea descargas y portapapeles; usa «Ver tabla» para consultar y copiar los valores."),
    );
  }
}
