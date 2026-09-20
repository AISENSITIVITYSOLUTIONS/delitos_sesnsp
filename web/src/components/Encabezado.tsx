import type { Manifiesto } from "../lib/contratos";
import { fFechaHora, fMesLargo } from "../lib/formato";
import { alternarTema } from "../lib/estado";

export default function Encabezado({ manifiesto }: { manifiesto: Manifiesto | null }) {
  return (
    <header className="encabezado" role="banner">
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
