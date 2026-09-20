/**
 * Contratos de datos entre el pipeline y la aplicación.
 * Los productos son precalculados por pipeline/src/exportar_web.py y se sirven
 * como archivos estáticos bajo /datos. Cada producto lleva su propio bloque
 * `meta` con fuente, corte, unidad y versión para que las exportaciones
 * conserven los metadatos.
 */

/** Identificador de instrumento de registro. */
export type Metodologia = "NM-2015" | "NR-2026";

export interface MetaProducto {
  fuente: string;              // producto estadístico oficial de origen
  url_fuente: string;
  corte: string;               // "YYYY-MM" último mes publicado del tramo
  descargado_utc: string;      // última consulta a la fuente
  validado_utc: string;        // última actualización validada
  version: number;             // versión de publicación del dashboard
  unidad: string;              // p. ej. "delitos registrados (carpetas: ver diccionario)"
  notas?: string[];
}

export interface Manifiesto {
  version: number;
  generado_utc: string;
  ultima_consulta_fuente: string | null;
  ultima_actualizacion_validada: string | null;
  cortes: { tramo_2015_2025: string; tramo_2026: string };
  fuentes: Array<{
    clave: string; descripcion: string; url: string;
    sha256: string; bytes: number; ultima_descarga_valida: string;
  }>;
  poblacion: { fuente: string; version: string; notas: string };
  cartografia: { fuente: string; version: string };
  cambios: Array<{ ts: string; evento: string; detalle: string }>;
  avisos: string[];
}

/** Serie mensual nacional por categoría delictiva (por tramo metodológico). */
export interface SeriesNacionales {
  meta: MetaProducto;
  metodologia: Metodologia;
  meses: string[];                       // "YYYY-MM", eje común del tramo
  jerarquia: Record<string, { bien: string; tipo: string; subtipo: string }>;
  series: Record<string, (number | null)[]>; // delito_id → cantidades (null = no publicado)
  total: (number | null)[];              // todos los delitos del instrumento
}

export interface PoblacionAnual {
  meta: MetaProducto;
  nacional: Record<string, number>;              // año → población mitad de año
  estatal: Record<string, Record<string, number>>; // cve_ent → año → población
  municipal_disponible: boolean;
  municipal?: Record<string, Record<string, number>>; // cve_mun → año → población
}

export interface EstatalAnual {
  meta: MetaProducto;
  metodologia: Metodologia;
  anios: number[];
  entidades: Record<string, string>;     // cve_ent → nombre
  /** cve_ent → delito_id → [cantidad por año] (null = tramo sin publicar) */
  datos: Record<string, Record<string, (number | null)[]>>;
  total: Record<string, (number | null)[]>;
  meses_publicados: Record<string, number>; // año → meses publicados del tramo
}

export interface MunicipalAnual {
  meta: MetaProducto;
  anios: number[];
  municipios: Array<{
    cve: string; nombre: string; cve_ent: string; entidad: string;
    total: (number | null)[];            // por año, todos los delitos
    meses_ult_anio: number;              // meses publicados del último año
  }>;
  sin_municipio: Array<{ cve_ent: string; total: (number | null)[] }>;
}

export interface TarjetaHallazgo {
  id: string;
  titulo: string;
  cifra: string;                 // formateada es-MX
  unidad: string;
  periodo: string;               // etiqueta exacta del periodo del numerador
  comparacion: string;           // "vs ene–jul 2025", etc.
  interpretacion: string;
  validez: "2015-2025" | "2026" | "completo-homologado";
  mini: { tipo: "linea" | "barras"; etiquetas: string[]; valores: number[] };
  calculo: {
    regla: string;               // regla documentada de selección/cálculo
    formula: string;
    datos: Record<string, unknown>;
    fuente: string;
  };
  insuficiente?: boolean;        // true → el espacio explica la insuficiencia
}

export interface Hallazgos { meta: MetaProducto; tarjetas: TarjetaHallazgo[] }

export interface RankingDelitos {
  meta: MetaProducto;
  criterio: string;              // p. ej. "suma de registros del periodo, subtipos excluyentes"
  periodos: Record<string, {     // clave de periodo → ranking calculado
    etiqueta: string;
    delitos: Array<{ delito_id: string; nombre: string; cantidad: number; participacion: number }>;
  }>;
}

export interface RankingMunicipios {
  meta: MetaProducto;
  regla_empates: string;
  periodos: Record<string, {
    etiqueta: string;
    por_volumen: Array<{
      cve: string; nombre: string; entidad: string; cantidad: number;
      participacion_nacional: number; tasa_100k: number | null;
    }>;
    por_tasa: Array<{
      cve: string; nombre: string; entidad: string; cantidad: number;
      tasa_100k: number; poblacion: number;
    }>;
    umbral_poblacion: number;    // filtro visible y modificable
    excluidos_por_umbral: number;
  }>;
}

export interface Correspondencias {
  meta: MetaProducto;
  filas: Array<{
    categoria_2015_2025: string | null;
    categoria_2026: string | null;
    relacion: "equivalente" | "agregable" | "nueva" | "descontinuada" | "no-homologable";
    transformacion: string;
    vigencia: string;
    fundamento: string;          // documento oficial que lo sustenta
  }>;
  homologadas: string[];         // delito_ids con serie completa válida
}
