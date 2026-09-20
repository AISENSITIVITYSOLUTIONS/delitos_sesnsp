"""Orquestador de construcción: originales → canónico → controles → productos.

Los archivos municipales producen >30 M de observaciones; la transformación
usa Categorical y las agregaciones pesadas corren en DuckDB sobre Parquet
para operar dentro de la memoria del contenedor.
"""
from __future__ import annotations

import gc
import hashlib
import json
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path

import duckdb
import polars as pl

sys.path.insert(0, str(Path(__file__).parent))
from esquema import MESES, CONTRATOS  # noqa: E402
import transformacion as tr  # noqa: E402
import exportar_web as ex  # noqa: E402
import poblacion_carga as pc  # noqa: E402
import hallazgos as hz  # noqa: E402
import correspondencias as co  # noqa: E402

RAIZ = Path(__file__).resolve().parents[2]
RAW = RAIZ / "raw"
WORK = RAIZ / "work"
PQ = WORK / "parquet"
STAGING = WORK / "staging" / "datos"
PUBLICADO = RAIZ / "web" / "public" / "datos"
UPLOADS = Path("/mnt/user-data/uploads/ARTICULO DELITOS")

FUENTES = {
    "estatal_2015_2025": {
        "archivo": "Estatal-Delitos-2015-2025_ago2026.csv",
        "zip": "Estatal-Delitos-2015-2025_ago2026.zip",
        "nivel": "estatal", "metodologia": "NM-2015",
        "descripcion": "Cifras de Incidencia Delictiva Estatal 2015-2025, SESNSP (instrumento CNSP/38/15)",
        "url": "https://sspcgob-my.sharepoint.com/:u:/g/personal/cni_sspc_gob_mx/IQDbKVoKKhp4SrgMtPRM-FILARntV1yA0s8T7nu84A_HF70",
    },
    "municipal_2015_2025": {
        "archivo": "Municipal-Delitos-2015-2025_ago2026.csv",
        "zip": "Municipal-Delitos-2015-2025_ago2026 (4).zip",
        "nivel": "municipal", "metodologia": "NM-2015",
        "descripcion": "Cifras de Incidencia Delictiva Municipal 2015-2025, SESNSP (instrumento CNSP/38/15)",
        "url": "https://sspcgob-my.sharepoint.com/:u:/g/personal/cni_sspc_gob_mx/IQCIHz1ZZoXjRZ3IySsQQqgFAYKdzEOXXK1YXfhhEhyDMcs",
    },
    "estatal_2026": {
        "archivo": "RNID-Delitos_Estatal-2026-ago2026.csv",
        "zip": "RNID-Delitos_Estatal-2026-ago2026.zip",
        "nivel": "estatal", "metodologia": "NR-2026",
        "descripcion": "RNID: Incidencia Delictiva Estatal 2026, SESNSP (registro vigente desde ene. 2026)",
        "url": "https://sspcgob-my.sharepoint.com/:u:/g/personal/cni_sspc_gob_mx/IQBBP0Bh8YBEQpdct54JoLbkAfsR_nJJ5RJa03UwlgRmA2E",
    },
    "municipal_2026": {
        "archivo": "RNID-Delitos_Municipal-2026-ago2026.csv",
        "zip": "RNID-Delitos_Municipal-2026-ago2026.zip",
        "nivel": "municipal", "metodologia": "NR-2026",
        "descripcion": "RNID: Incidencia Delictiva Municipal 2026, SESNSP (registro vigente desde ene. 2026)",
        "url": "https://sspcgob-my.sharepoint.com/:u:/g/personal/cni_sspc_gob_mx/IQAUYyl5NobOT4SHGj0O54aJATRtcR7qsQmNHWj_EOOzP-M",
    },
}

CORTE_NM = "2025-12"          # instrumento cerrado: el tramo termina aquí por definición
CORTES: dict[str, str] = {}   # cortes efectivos detectados en esta corrida
VERSION_DATOS = datetime.now(timezone.utc).strftime("%Y%m%d")


def detectar_corte(df_ancho: pl.DataFrame) -> str:
    """Último (año, mes) con AL MENOS una celda distinta de cero en todo el
    archivo. Se contrasta con el nombre del producto publicado; nunca se asume
    que los cambios llegan solo a fin de mes."""
    ult = None
    for anio in sorted(df_ancho.get_column("Año").unique().to_list()):
        sub = df_ancho.filter(pl.col("Año") == anio)
        for i, mes in enumerate(MESES, start=1):
            col = sub.get_column(mes).cast(pl.Int64, strict=False)
            if ((col != 0) & col.is_not_null()).any():
                ult = (int(anio), i)
    if ult is None:
        raise RuntimeError("Archivo sin ningún valor distinto de cero; no se puede fijar corte")
    return f"{ult[0]}-{ult[1]:02d}"


def _sha(p: Path) -> str:
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for ch in iter(lambda: f.read(1 << 20), b""):
            h.update(ch)
    return h.hexdigest()


def log(msg: str) -> None:
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}", flush=True)


# ------------------------------------------------------------------ fase 1 --
def transformar_todo(controles: list[dict], avisos: list[str]) -> None:
    PQ.mkdir(parents=True, exist_ok=True)
    for clave, meta in FUENTES.items():
        log(f"transformando {clave}")
        df, _info = tr.leer_ancho(RAW / meta["archivo"])
        contrato = CONTRATOS.get((meta["nivel"], meta["metodologia"]), {}).get("dimensiones")
        if contrato:
            errores = tr.validar_contrato(df, meta["nivel"], meta["metodologia"])
            if errores:
                raise RuntimeError(f"{clave}: contrato de columnas violado: {errores}")
        detectado = detectar_corte(df)
        if meta["metodologia"] == "NM-2015":
            if detectado != CORTE_NM:
                avisos.append(f"{clave}: cobertura detectada {detectado} distinta del fin del instrumento ({CORTE_NM}); revisar.")
            corte = CORTE_NM
            CORTES["NM"] = CORTE_NM
        else:
            previo = CORTES.get("NR")
            if previo and previo != detectado:
                raise RuntimeError(f"Cortes RNID inconsistentes entre fuentes: {previo} vs {detectado}")
            CORTES["NR"] = detectado
            corte = detectado
            controles.append({"control": f"corte_detectado:{clave}", "resultado": "ok",
                              "detalle": f"corte por cobertura: {detectado}"})
        largo = tr.a_largo(df, meta["nivel"], meta["metodologia"], clave, corte,
                           VERSION_DATOS, [])
        del df
        gc.collect()
        if meta["metodologia"] == "NR-2026":
            anio_c, mes_c = int(corte[:4]), int(corte[5:7])
            no_cero = largo.filter(((pl.col("anio") == anio_c) & (pl.col("mes") > mes_c)) &
                                   (pl.col("cantidad") != 0)).height
            controles.append({"control": f"corte_vs_cobertura:{clave}",
                              "resultado": "ok" if no_cero == 0 else "fallo",
                              "detalle": f"{no_cero} celdas ≠ 0 después de {corte}"})
            if no_cero:
                raise RuntimeError(f"{clave}: datos después del corte {corte}")
            largo = tr.marcar_no_publicado(largo, corte)
        largo.write_parquet(PQ / f"incidencia_{clave}.parquet")
        del largo
        gc.collect()


# ------------------------------------------------------------------ fase 2 --
def controles_duckdb(con: duckdb.DuckDBPyConnection, controles: list[dict], avisos: list[str]) -> dict:
    log("controles y conciliación (DuckDB)")
    for clave in FUENTES:
        dup = con.sql(f"""
            SELECT COUNT(*) FROM (
              SELECT anio, mes, cve_ent, cve_mun, bien_juridico, tipo, subtipo, modalidad, COUNT(*) c
              FROM read_parquet('{PQ}/incidencia_{clave}.parquet')
              GROUP BY ALL HAVING COUNT(*) > 1)
        """).fetchone()[0]
        controles.append({"control": f"duplicados:{clave}", "resultado": "ok" if dup == 0 else "fallo",
                          "detalle": f"{dup} claves duplicadas"})
        if dup:
            raise RuntimeError(f"{clave}: {dup} duplicados de clave única")
        ents = con.sql(f"SELECT COUNT(DISTINCT cve_ent) FROM read_parquet('{PQ}/incidencia_{clave}.parquet')").fetchone()[0]
        controles.append({"control": f"entidades:{clave}", "resultado": "ok" if ents == 32 else "fallo",
                          "detalle": f"{ents} entidades"})
        neg = con.sql(f"SELECT COUNT(*) FROM read_parquet('{PQ}/incidencia_{clave}.parquet') WHERE cantidad < 0").fetchone()[0]
        if neg:
            controles.append({"control": f"negativos:{clave}", "resultado": "aviso",
                              "detalle": f"{neg} celdas negativas del archivo oficial (correcciones del SESNSP); se conservan"})
            avisos.append(f"{clave}: {neg} celdas negativas presentes en el archivo oficial; se conservan tal cual.")
        else:
            controles.append({"control": f"negativos:{clave}", "resultado": "ok", "detalle": "0"})

    detalle = {}
    for e, m, tag in (("estatal_2015_2025", "municipal_2015_2025", "NM"),
                      ("estatal_2026", "municipal_2026", "NR")):
        conc = con.sql(f"""
            WITH ee AS (SELECT anio, cve_ent, SUM(cantidad) t FROM read_parquet('{PQ}/incidencia_{e}.parquet') GROUP BY ALL),
                 mm AS (SELECT anio, cve_ent, SUM(cantidad) t FROM read_parquet('{PQ}/incidencia_{m}.parquet') GROUP BY ALL)
            SELECT MAX(ABS(COALESCE(mm.t,0) - COALESCE(ee.t,0))) FROM ee FULL JOIN mm USING (anio, cve_ent)
        """).fetchone()[0] or 0
        controles.append({"control": f"conciliacion_estatal_municipal:{tag}",
                          "resultado": "ok" if conc == 0 else "aviso",
                          "detalle": f"máxima diferencia entidad-año: {conc}"})
        sinm, tot = con.sql(f"""
            SELECT SUM(CASE WHEN regexp_matches(lower(municipio), 'no especificado|otros municipios') THEN cantidad ELSE 0 END),
                   SUM(cantidad)
            FROM read_parquet('{PQ}/incidencia_{m}.parquet')
        """).fetchone()
        detalle[tag] = {"max_dif": int(conc), "sin_municipio": int(sinm or 0),
                        "pct_sin_municipio": round((sinm or 0) / tot * 100, 3) if tot else 0}
        avisos.append(f"Registros sin municipio identificado ({tag}): {int(sinm or 0):,} "
                      f"({detalle[tag]['pct_sin_municipio']} % del tramo); en conciliación, fuera de rankings.".replace(",", " "))
    return detalle


# ------------------------------------------------------------------ fase 3 --
def construir_productos(con: duckdb.DuckDBPyConnection, controles: list[dict],
                        avisos: list[str], version: int) -> dict:
    STAGING.mkdir(parents=True, exist_ok=True)
    for f in STAGING.glob("*.json"):
        f.unlink()
    ahora = ex.ahora()
    CORTE_NR = CORTES["NR"]
    anio_nr, mes_nr = int(CORTE_NR[:4]), int(CORTE_NR[5:7])
    anios_todos = list(range(2015, anio_nr + 1))
    idx_a = {a: i for i, a in enumerate(anios_todos)}
    meses_de = lambda a: 12 if a < anio_nr else mes_nr  # noqa: E731
    et_nr = f"enero – {['','enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'][mes_nr]} {anio_nr}"

    est_nm = pl.read_parquet(PQ / "incidencia_estatal_2015_2025.parquet")
    est_nr = pl.read_parquet(PQ / "incidencia_estatal_2026.parquet")
    nombres_ent = {str(c): str(e) for c, e in
                   est_nm.select(["cve_ent", "entidad"]).unique().rows()}

    # población
    log("población")
    pob_est_df = pc.cargar_estatal(nombres_ent, anios_todos)
    pob_mun_df = pc.cargar_municipal(anios_todos)
    avisos += pc.validar(pob_est_df, pob_mun_df)
    pob_est: dict = {}
    for r in pob_est_df.iter_rows(named=True):
        pob_est.setdefault(r["cve_ent"], {})[str(r["anio"])] = r["poblacion"]
    pob_nac = {str(r["anio"]): r["poblacion"] for r in
               pob_est_df.group_by("anio").agg(pl.col("poblacion").sum()).iter_rows(named=True)}
    pob_mun: dict = {}
    for r in pob_mun_df.iter_rows(named=True):
        pob_mun.setdefault(r["cve_mun"], {})[str(r["anio"])] = r["poblacion"]
    m_pob = ex.meta("CONAPO: proyecciones estatales (población a mitad de año) y reconstrucción/proyección municipal 1990-2040",
                    "https://www.gob.mx/conapo", CORTE_NR, "personas (población a mitad de año)", version, ahora,
                    ["Espejo verificado (github.com/lapanquecita/poblacion-estimada); sustituir por descarga directa de CONAPO cuando la política de red lo permita.",
                     "Municipios sin proyección oficial: tasa marcada como no disponible."])
    ex.escribir(STAGING, "poblacion.json", {"meta": m_pob, "nacional": pob_nac, "estatal": pob_est,
                                            "municipal_disponible": True, "municipal": pob_mun})

    # series nacionales
    log("series nacionales")
    m_nm = ex.meta(FUENTES["estatal_2015_2025"]["descripcion"], FUENTES["estatal_2015_2025"]["url"],
                   CORTE_NM, ex.UNIDAD, version, ahora)
    sn_nm = ex.series_nacionales(est_nm, "NM-2015", 2015, 2025, CORTE_NM, m_nm)
    m_nr = ex.meta(FUENTES["estatal_2026"]["descripcion"], FUENTES["estatal_2026"]["url"],
                   CORTE_NR, ex.UNIDAD, version, ahora,
                   ["Meses posteriores al corte: el archivo oficial los publica como 0; aquí se muestran como 'no publicado'."])
    sn_nr = ex.series_nacionales(est_nr, "NR-2026", anio_nr, anio_nr, CORTE_NR, m_nr)

    auto = {}
    for sid, jer in sn_nm["jerarquia"].items():
        nombre = jer["subtipo"]
        if nombre in co.MAPEO or nombre in co.NO_HOMOLOGABLES:
            continue
        if nombre in sn_nr["_sub_id_por_nombre"]:
            auto[nombre] = [nombre]
    mapeo_final = {**auto, **{k: v[0] for k, v in co.MAPEO.items()}}
    m_h = ex.meta("SESNSP, IDFC 2015-2025 + RNID 2026 (series homologadas)",
                  FUENTES["estatal_2015_2025"]["url"], CORTE_NR, ex.UNIDAD, version, ahora)
    sn_h = ex.serie_homologada(sn_nm, sn_nr, mapeo_final, CORTE_NR, m_h, co.NOTA_TOTAL)

    ex.escribir(STAGING, "nacional_mensual_nm.json", sn_nm)
    ex.escribir(STAGING, "nacional_mensual_nr.json", sn_nr)
    ex.escribir(STAGING, "nacional_mensual_homologado.json", sn_h)

    # correspondencias
    filas_corr = []
    for nombre in sorted(auto):
        filas_corr.append({"categoria_2015_2025": nombre, "categoria_2026": nombre,
                           "relacion": "equivalente", "transformacion": "Identidad nominal del subtipo en ambos catálogos.",
                           "vigencia": "2015-01 → corte", "fundamento": co.FUNDAMENTO_GENERAL})
    for nombre, (rnid, rel, transf, fund) in co.MAPEO.items():
        filas_corr.append({"categoria_2015_2025": nombre, "categoria_2026": " + ".join(rnid),
                           "relacion": "agregable" if rel.startswith("agregable") else rel,
                           "transformacion": transf, "vigencia": "2015-01 → corte", "fundamento": fund})
    for nombre, motivo in co.NO_HOMOLOGABLES.items():
        filas_corr.append({"categoria_2015_2025": nombre, "categoria_2026": nombre,
                           "relacion": "no-homologable", "transformacion": motivo,
                           "vigencia": "tramos separados", "fundamento": co.FUNDAMENTO_GENERAL})
    for nombre in co.NUEVAS_RNID:
        filas_corr.append({"categoria_2015_2025": None, "categoria_2026": nombre,
                           "relacion": "nueva", "transformacion": "Categoría sin serie previa; consulta desde 2026.",
                           "vigencia": "2026-01 → corte", "fundamento": co.FUNDAMENTO_GENERAL})
    ex.escribir(STAGING, "correspondencias.json", {
        "meta": ex.meta("Correspondencias CNSP/38/15 ↔ RNID", FUENTES["estatal_2026"]["url"],
                        CORTE_NR, "tabla de homologación", version, ahora, [co.NOTA_TOTAL]),
        "filas": filas_corr, "homologadas": sorted(sn_h["series"].keys()),
    })

    # estatal anual
    log("estatal anual")
    est_tot: dict[str, list] = {c: [None] * len(anios_todos) for c in nombres_ent}
    for tag in ("estatal_2015_2025", "estatal_2026"):
        for cve, anio, v in con.sql(f"""
            SELECT cve_ent, anio, SUM(cantidad) FROM read_parquet('{PQ}/incidencia_{tag}.parquet')
            GROUP BY ALL HAVING SUM(cantidad) IS NOT NULL""").fetchall():
            est_tot[str(cve)][idx_a[int(anio)]] = int(v)
    top12 = sorted(((sid, sum(v for v in sn_h["series"][sid] if v is not None))
                    for sid in sn_h["series"]), key=lambda x: -x[1])[:12]
    top12_ids = {sid for sid, _ in top12}
    datos_est: dict[str, dict[str, list]] = {c: {} for c in nombres_ent}
    for tag, instr in (("estatal_2015_2025", "nm"), ("estatal_2026", "nr")):
        inverso: dict[str, str] = {}
        for nm_nombre, rnid_lista in mapeo_final.items():
            nm_id = sn_nm["_sub_id_por_nombre"][nm_nombre]
            if nm_id not in top12_ids:
                continue
            if instr == "nm":
                inverso[nm_nombre] = nm_id
            else:
                for rn in rnid_lista:
                    inverso[rn] = nm_id
        for cve, subtipo, anio, v in con.sql(f"""
            SELECT cve_ent, subtipo, anio, SUM(cantidad) FROM read_parquet('{PQ}/incidencia_{tag}.parquet')
            GROUP BY ALL HAVING SUM(cantidad) IS NOT NULL""").fetchall():
            sid = inverso.get(str(subtipo))
            if sid is None:
                continue
            arr = datos_est[str(cve)].setdefault(sid, [None] * len(anios_todos))
            pos = idx_a[int(anio)]
            arr[pos] = (arr[pos] or 0) + int(v)
    ex.escribir(STAGING, "estatal_anual.json", {
        "meta": ex.meta("SESNSP, IDFC estatal 2015-2025 + RNID estatal 2026",
                        FUENTES["estatal_2015_2025"]["url"], CORTE_NR, ex.UNIDAD, version, ahora,
                        [f"{anio_nr} cubre {et_nr}; los totales de {anio_nr} son parciales y se etiquetan así.",
                         "El desglose por delito cubre los 12 subtipos homologados de mayor volumen."]),
        "metodologia": "homologado", "anios": anios_todos, "entidades": nombres_ent,
        "datos": datos_est, "total": est_tot,
        "meses_publicados": {str(a): meses_de(a) for a in anios_todos},
    })

    # municipal anual + composición por bien jurídico (DuckDB)
    log("municipal anual")
    mun_glob = f"read_parquet(['{PQ}/incidencia_municipal_2015_2025.parquet','{PQ}/incidencia_municipal_2026.parquet'])"
    nombres_mun = con.sql(f"""
        SELECT cve_mun, arg_max(municipio, anio) nombre, arg_max(entidad, anio) entidad, arg_max(cve_ent, anio) cve_ent
        FROM {mun_glob} GROUP BY cve_mun""").fetchall()
    tot_mun = con.sql(f"""
        SELECT cve_mun, anio, SUM(cantidad) FROM {mun_glob} GROUP BY ALL HAVING SUM(cantidad) IS NOT NULL""").fetchall()
    por_mun: dict[str, list] = {}
    for cve, anio, v in tot_mun:
        por_mun.setdefault(str(cve), [None] * len(anios_todos))[idx_a[int(anio)]] = int(v)
    import re as _re
    patron = _re.compile(r"no especificado|otros municipios", _re.I)
    municipios, sin_muni = [], []
    for cve, nombre, entidad, cve_ent in sorted(nombres_mun, key=lambda x: str(x[0])):
        fila = {"cve": str(cve), "nombre": str(nombre), "cve_ent": str(cve_ent),
                "entidad": str(entidad), "total": por_mun.get(str(cve), [None] * len(anios_todos)),
                "meses_ult_anio": mes_nr}
        if patron.search(str(nombre)):
            sin_muni.append({"cve_ent": str(cve_ent), "cve": str(cve), "total": fila["total"]})
        else:
            municipios.append(fila)
    muni_prod = {"municipios": municipios, "sin_municipio": sin_muni}
    ex.escribir(STAGING, "municipal_anual.json", {
        "meta": ex.meta("SESNSP, IDFC municipal 2015-2025 + RNID municipal 2026",
                        FUENTES["municipal_2015_2025"]["url"], CORTE_NR, ex.UNIDAD, version, ahora,
                        ["Totales municipales de todos los delitos (nivel hoja del catálogo, sin subtotales duplicados)."]),
        "anios": anios_todos, **muni_prod,
    })

    log("composición municipal por bien jurídico")
    bienes = [str(b[0]) for b in con.sql(f"SELECT DISTINCT bien_juridico FROM {mun_glob} ORDER BY 1").fetchall()]
    b_idx = {b: i for i, b in enumerate(bienes)}
    comp: dict[str, dict[str, list]] = {}
    for cve, bien, anio, v in con.sql(f"""
        SELECT cve_mun, bien_juridico, anio, SUM(cantidad) FROM {mun_glob}
        GROUP BY ALL HAVING SUM(cantidad) IS NOT NULL""").fetchall():
        d = comp.setdefault(str(cve), {})
        arr = d.setdefault(str(b_idx[str(bien)]), [None] * len(anios_todos))
        arr[idx_a[int(anio)]] = int(v)
    ex.escribir(STAGING, "municipal_bien_anual.json", {
        "meta": ex.meta("SESNSP, composición municipal por bien jurídico",
                        FUENTES["municipal_2015_2025"]["url"], CORTE_NR, ex.UNIDAD, version, ahora),
        "anios": anios_todos, "bienes": bienes, "datos": comp,
    })

    # rankings
    log("rankings")
    m_rk = ex.meta("SESNSP, IDFC/RNID (fuente estatal para totales nacionales)",
                   FUENTES["estatal_2015_2025"]["url"], CORTE_NR, ex.UNIDAD, version, ahora)
    rk = {"meta": m_rk,
          "criterio": "suma de registros del periodo por subtipo (categorías mutuamente excluyentes del mismo nivel del catálogo vigente en cada tramo)",
          "periodos": {
              "2015-2025": ex.ranking_delitos(sn_nm, "acumulado enero 2015 – diciembre 2025"),
              "2026": ex.ranking_delitos(sn_nr, f"{et_nr} (registro RNID)"),
              "completo": ex.ranking_delitos(sn_h, f"enero 2015 – {et_nr.split('– ')[-1]}, series homologadas"),
          }}
    ex.escribir(STAGING, "ranking_delitos.json", rk)

    tot_nm = sum(v for v in sn_nm["total"] if v is not None)
    tot_nr = sum(v for v in sn_nr["total"] if v is not None)
    rkm = ex.ranking_municipios_producto(
        muni_prod, pob_mun,
        {"2015-2025": tot_nm, "2026": tot_nr, "completo": tot_nm + tot_nr},
        anios_todos,
        {"2015-2025": (list(range(2015, 2026)), "acumulado enero 2015 – diciembre 2025"),
         "2026": ([anio_nr], et_nr),
         "completo": (anios_todos, f"enero 2015 – {et_nr.split('– ')[-1]}")},
        "a igualdad de registros, orden por clave geográfica ascendente", m_rk)
    ex.escribir(STAGING, "ranking_municipios.json", rkm)

    # cartografía (productos persistentes generados por pipeline/src/geo.py)
    geo_src = WORK / "geo_export"
    if geo_src.exists():
        shutil.copytree(geo_src, STAGING / "geo", dirs_exist_ok=True)
    else:
        avisos.append("Cartografía no disponible en esta corrida; el explorador mostrará solo tablas.")
    avisos.append("Municipios de creación reciente sin cartografía 2023 ni proyección CONAPO (tasa n. d.; solo tablas): "
                  "24059 Villa de Pozos (SLP), 25019 Eldorado y 25020 Juan José Ríos (Sinaloa).")

    # hallazgos
    log("hallazgos")
    tarjetas = [
        hz.hallazgo_tendencia(sn_nm, pob_nac),
        hz.hallazgo_composicion(sn_nm),
        hz.hallazgo_concentracion(muni_prod, tot_nm),
        hz.hallazgo_volumen_vs_tasa(est_tot, nombres_ent, pob_est, 2025, idx_a[2025]),
        hz.hallazgo_estacionalidad(sn_nm),
    ]
    ex.escribir(STAGING, "hallazgos.json", {
        "meta": ex.meta("Hallazgos calculados con reglas documentadas (R1-R5)",
                        FUENTES["estatal_2015_2025"]["url"], CORTE_NR, ex.UNIDAD, version, ahora),
        "tarjetas": tarjetas,
    })

    return {"total_2015_2025": tot_nm, "total_2026": tot_nr,
            "municipios": len(municipios), "series_homologadas": len(sn_h["series"])}


def manifiesto(controles: list[dict], avisos: list[str], detalle_conc: dict, version: int,
               resumen: dict) -> None:
    fuentes = []
    for clave, meta_f in FUENTES.items():
        zp = UPLOADS / meta_f["zip"]
        origen = zp if zp.exists() else RAW / meta_f["archivo"]
        fuentes.append({
            "clave": clave, "descripcion": meta_f["descripcion"], "url": meta_f["url"],
            "sha256": _sha(origen), "bytes": origen.stat().st_size,
            "ultima_descarga_valida": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        })
    man = {
        "version": version,
        "generado_utc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "ultima_consulta_fuente": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "ultima_actualizacion_validada": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "cortes": {"tramo_2015_2025": CORTE_NM, "tramo_2026": CORTES.get("NR", "")},
        "fuentes": fuentes,
        "poblacion": {
            "fuente": "CONAPO (población a mitad de año): proyecciones estatales y reconstrucción/proyección municipal 1990-2040",
            "version": "espejo lapanquecita/poblacion-estimada, verificado 2026-09-19",
            "notas": "Los denominadores municipales provienen de un producto de vigencia distinta al estatal; la brecha se cuantifica en los controles.",
        },
        "cartografia": {"fuente": "División política estatal y municipal 1:250 000 (CONABIO/INEGI), 2023",
                        "version": "espejo PhantomInsights/mexico-geojson (2023), simplificada para web"},
        "controles": controles,
        "conciliacion": detalle_conc,
        "cambios": [{"ts": datetime.now(timezone.utc).isoformat(timespec="seconds"),
                     "evento": "publicacion_inicial",
                     "detalle": f"Corte ago. 2026. Totales: 2015-2025 = {resumen['total_2015_2025']:,}; 2026 (ene-ago) = {resumen['total_2026']:,}. {resumen['series_homologadas']} series homologadas.".replace(",", " ")}],
        "avisos": avisos,
    }
    ex.escribir(STAGING, "manifiesto.json", man)


def publicar() -> None:
    PUBLICADO.parent.mkdir(parents=True, exist_ok=True)
    respaldo = WORK / "datos_prev"   # fuera de web/public para no publicarse
    if respaldo.exists():
        shutil.rmtree(respaldo)
    if PUBLICADO.exists():
        PUBLICADO.rename(respaldo)
    shutil.copytree(STAGING, PUBLICADO)


def main() -> int:
    version = 1
    controles: list[dict] = []
    avisos: list[str] = []
    transformar_todo(controles, avisos)
    con = duckdb.connect()
    con.execute("SET threads TO 2; SET memory_limit='3GB';")
    detalle = controles_duckdb(con, controles, avisos)
    resumen = construir_productos(con, controles, avisos, version)
    manifiesto(controles, avisos, detalle, version, resumen)
    publicar()
    log(json.dumps({"resumen": resumen}, ensure_ascii=False))
    for c in controles:
        log(f"control {c['control']}: {c['resultado']} ({c['detalle']})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
