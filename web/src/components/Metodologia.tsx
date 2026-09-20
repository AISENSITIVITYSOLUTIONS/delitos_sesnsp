import type { Manifiesto, Correspondencias } from "../lib/contratos";
import { fFechaHora } from "../lib/formato";

interface Props { manifiesto: Manifiesto; correspondencias: Correspondencias | null }

export default function Metodologia({ manifiesto, correspondencias }: Props) {
  return (
    <div className="metodologia">
      <details className="bloque" open>
        <summary>Fuentes, unidad de observación y qué mide este tablero</summary>
        <div className="bloque__cuerpo">
          <p>
            Este tablero analiza la <strong>incidencia delictiva del fuero común</strong>: los presuntos
            delitos registrados en carpetas de investigación iniciadas por las fiscalías estatales,
            reportados mensualmente al SESNSP. La unidad contada aquí es el <strong>delito registrado</strong>;
            no equivale a carpetas (una carpeta puede contener varios delitos) ni a víctimas (producto
            estadístico distinto), y estas cantidades no se combinan entre sí en ninguna cifra del tablero.
          </p>
          <p>
            «Todos los delitos» significa todas las categorías incluidas en las bases oficiales del
            instrumento correspondiente. La incidencia registrada subestima la delincuencia ocurrida
            (cifra negra) y su magnitud varía por delito y territorio.
          </p>
          <p style={{ marginTop: 8 }}><strong>Archivos fuente verificados en la última actualización:</strong></p>
          <table className="datos" style={{ marginTop: 6 }}>
            <thead><tr><th>Fuente</th><th>SHA-256</th><th className="num">Bytes</th><th>Descargada</th></tr></thead>
            <tbody>
              {manifiesto.fuentes.map(f => (
                <tr key={f.clave}>
                  <td>{f.descripcion}</td>
                  <td style={{ fontFamily: "var(--mono)", fontSize: 11 }}>{f.sha256.slice(0, 16)}…</td>
                  <td className="num">{f.bytes.toLocaleString("es-MX")}</td>
                  <td>{fFechaHora(f.ultima_descarga_valida)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

      <details className="bloque">
        <summary>Comparabilidad 2015–2025 frente al registro vigente desde 2026</summary>
        <div className="bloque__cuerpo">
          <p>
            De enero de 2015 a diciembre de 2025 rige el instrumento aprobado por el CNSP en 2015
            (Manual CNSP/38/15, jerarquía bien jurídico → tipo → subtipo → modalidad). Desde enero de 2026
            rige el registro derivado del Acuerdo 11/L/2024 del Consejo Nacional de Seguridad Pública,
            alineado con la Norma Técnica de Clasificación de Delitos del INEGI, con un catálogo más
            desagregado. Las series solo se unen cuando la tabla de correspondencias documenta una
            equivalencia; en cualquier otro caso los tramos se muestran por separado y la discontinuidad
            se señala. Un subconjunto comparable nunca se presenta como el total del catálogo.
          </p>
          {correspondencias ? (
            <>
              <p style={{ margin: "8px 0 6px" }}><strong>Tabla de correspondencias</strong> (transformación, vigencia y fundamento documental):</p>
              <div style={{ maxHeight: 320, overflow: "auto" }}>
                <table className="datos">
                  <thead><tr><th>Categoría 2015–2025</th><th>Categoría 2026</th><th>Relación</th><th>Transformación</th><th>Fundamento</th></tr></thead>
                  <tbody>
                    {correspondencias.filas.map((f, i) => (
                      <tr key={i}>
                        <td>{f.categoria_2015_2025 ?? "—"}</td>
                        <td>{f.categoria_2026 ?? "—"}</td>
                        <td><span className="chip">{f.relacion}</span></td>
                        <td className="nota">{f.transformacion}</td>
                        <td className="nota">{f.fundamento}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <p className="nota">La tabla de correspondencias se publica junto con los datos procesados.</p>
          )}
        </div>
      </details>

      <details className="bloque">
        <summary>Conciliación estatal–municipal y registros sin municipio</summary>
        <div className="bloque__cuerpo">
          <p>
            Los totales nacionales se construyen siempre desde la fuente <strong>estatal</strong> del periodo
            y se contrastan con la suma municipal. Las diferencias —incluidos los registros con municipio
            «No especificado»— se cuantifican y se publican con los datos; esos registros nunca aparecen
            como un municipio en los rankings. Las fuentes estatal y municipal representan los mismos
            hechos en dos niveles: no se suman entre sí.
          </p>
          {manifiesto.avisos.length > 0 && (
            <ul style={{ margin: "8px 0 0 18px" }}>
              {manifiesto.avisos.map((a, i) => <li key={i} className="nota">{a}</li>)}
            </ul>
          )}
        </div>
      </details>

      <details className="bloque">
        <summary>Población y tasas</summary>
        <div className="bloque__cuerpo">
          <p>
            Denominadores: {manifiesto.poblacion.fuente} (versión {manifiesto.poblacion.version}).
            Tasa = cantidad ÷ población del territorio y año × 100 000. Las tasas mensuales se etiquetan
            como mensuales; los acumulados multianuales usan exposición poblacional acumulada con años
            parciales ponderados por meses publicados. Las tasas municipales de poblaciones pequeñas son
            inestables: el umbral del ranking es visible y modificable, e informa cuántos municipios excluye.
            {" "}{manifiesto.poblacion.notas}
          </p>
        </div>
      </details>

      <details className="bloque">
        <summary>Historial de actualizaciones</summary>
        <div className="bloque__cuerpo">
          {manifiesto.cambios.length === 0 ? <p className="nota">Sin eventos registrados aún.</p> : (
            <table className="datos">
              <thead><tr><th>Fecha</th><th>Evento</th><th>Detalle</th></tr></thead>
              <tbody>
                {manifiesto.cambios.slice(0, 30).map((c, i) => (
                  <tr key={i}><td>{fFechaHora(c.ts)}</td><td><span className="chip">{c.evento}</span></td><td className="nota">{c.detalle}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </details>

      <details className="bloque">
        <summary>Descargas y reproducibilidad</summary>
        <div className="bloque__cuerpo">
          <p>
            Todos los productos del tablero (JSON) se sirven bajo <code>datos/</code> con su bloque de
            metadatos (fuente, corte, unidad, versión). Cada gráfico ofrece su CSV con los filtros aplicados.
            El código del pipeline (Python + Polars + DuckDB) y de esta aplicación (React + TypeScript + Vite),
            junto con el diccionario de datos y el runbook de actualización, se entregan en el repositorio del proyecto.
          </p>
          <p className="nota" style={{ marginTop: 6 }}>
            Catálogo oficial: gob.mx/sesnsp → Datos abiertos de incidencia delictiva. Si un enlace cambia,
            el reemplazo se localiza en ese catálogo y se verifica que corresponda al mismo producto estadístico.
          </p>
        </div>
      </details>
    </div>
  );
}
