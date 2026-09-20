"""Cálculo de los cinco hallazgos de portada con reglas documentadas.

Cada regla es determinista y se recalcula con cada actualización; si su
evidencia no alcanza los umbrales documentados, la tarjeta se marca como
insuficiente en lugar de inventarse. Redacción: plantillas fijas alimentadas
exclusivamente con resultados ya calculados."""
from __future__ import annotations

from statistics import mean


def _fmt_int(v: float) -> str:
    return f"{v:,.0f}".replace(",", " ").replace(" ", " ")


def _fmt1(v: float) -> str:
    return f"{v:,.1f}".replace(",", "X").replace(".", ",").replace("X", " ")


def _pct(v: float) -> str:
    return ("+" if v > 0 else "−" if v < 0 else "") + _fmt1(abs(v)) + " %"


def anual(sn: dict, serie_id: str | None = None) -> dict[int, int]:
    vals = sn["total"] if serie_id is None else sn["series"][serie_id]
    out: dict[int, int] = {}
    for ym, v in zip(sn["meses"], vals):
        if v is not None:
            out[int(ym[:4])] = out.get(int(ym[:4]), 0) + v
    return out


def hallazgo_tendencia(sn_nm: dict, pob_nac: dict[str, int]) -> dict:
    """R1: nivel y trayectoria del total nacional 2015-2025 (tasa anual)."""
    tot = anual(sn_nm)
    tasas = {a: tot[a] / pob_nac[str(a)] * 100_000 for a in tot if str(a) in pob_nac}
    pico_a = max(tasas, key=tasas.get)
    fin = 2025
    var_pico = (tasas[fin] - tasas[pico_a]) / tasas[pico_a] * 100
    var_ini = (tasas[fin] - tasas[2015]) / tasas[2015] * 100
    serie = [round(tasas[a], 1) for a in sorted(tasas)]
    return {
        "id": "tendencia-nacional",
        "titulo": f"La tasa nacional de delitos registrados tocó máximo en {pico_a} y cerró 2025 {_fmt1(abs(var_pico))} % por debajo",
        "cifra": _fmt1(tasas[fin]),
        "unidad": "delitos por 100 mil hab. (2025)",
        "periodo": "Tasas anuales 2015–2025, total del fuero común",
        "comparacion": f"{_pct(var_pico)} vs máximo de {pico_a} · {_pct(var_ini)} vs 2015",
        "interpretacion": (
            f"El registro pasó de {_fmt1(tasas[2015])} (2015) a {_fmt1(tasas[pico_a])} ({pico_a}) "
            f"y descendió a {_fmt1(tasas[fin])} en 2025. Mide denuncia e integración de carpetas, no toda la delincuencia ocurrida."),
        "validez": "2015-2025",
        "mini": {"tipo": "linea", "etiquetas": [str(a) for a in sorted(tasas)], "valores": serie},
        "calculo": {
            "regla": "R1 documentada: total nacional (fuente estatal) por año ÷ población CONAPO a mitad de año × 100 000; se reportan el máximo de la serie y la variación porcentual del último año completo frente al máximo y frente a 2015.",
            "formula": "tasa_a = Σ_meses delitos_a / poblacion_a × 100000; var% = (tasa_2025 − tasa_ref) / tasa_ref × 100",
            "datos": {"totales_anuales": tot, "tasas": {str(k): round(v, 2) for k, v in tasas.items()}},
            "fuente": "SESNSP, IDFC estatal 2015-2025 (corte ago. 2026); CONAPO, población a mitad de año",
        },
    }


def hallazgo_composicion(sn_nm: dict) -> dict:
    """R2: mayor ganancia y mayor pérdida de participación entre trienios."""
    ini_a, fin_a = (2015, 2016, 2017), (2023, 2024, 2025)
    tot = anual(sn_nm)
    tot_ini = sum(tot[a] for a in ini_a)
    tot_fin = sum(tot[a] for a in fin_a)
    cambios = []
    for sid in sn_nm["series"]:
        if "/" in sid:
            continue
        s = anual(sn_nm, sid)
        p_ini = sum(s.get(a, 0) for a in ini_a) / tot_ini * 100
        p_fin = sum(s.get(a, 0) for a in fin_a) / tot_fin * 100
        cambios.append((sid, p_ini, p_fin, p_fin - p_ini))
    sube = max(cambios, key=lambda x: x[3])
    baja = min(cambios, key=lambda x: x[3])
    nom_s = sn_nm["jerarquia"][sube[0]]["subtipo"]
    nom_b = sn_nm["jerarquia"][baja[0]]["subtipo"]
    return {
        "id": "composicion",
        "titulo": f"{nom_s} es el delito que más peso ganó en el registro; {nom_b.lower()} es el que más perdió",
        "cifra": f"{_fmt1(sube[2])} %",
        "unidad": f"del total nacional lo aporta {nom_s.lower()} (2023–2025)",
        "periodo": "Participaciones promedio 2015–2017 vs 2023–2025",
        "comparacion": f"+{_fmt1(sube[3])} pts de participación · {nom_b}: −{_fmt1(abs(baja[3]))} pts",
        "interpretacion": (
            f"{nom_s} pasó de {_fmt1(sube[1])} % a {_fmt1(sube[2])} % del total registrado; "
            f"{nom_b.lower()} cayó de {_fmt1(baja[1])} % a {_fmt1(baja[2])} %. La composición del registro cambió de manera persistente."),
        "validez": "2015-2025",
        "mini": {"tipo": "barras", "etiquetas": ["2015–17", "2023–25"],
                 "valores": [round(sube[1], 1), round(sube[2], 1)]},
        "calculo": {
            "regla": "R2 documentada: participación de cada subtipo en el total nacional, promediada por trienios (2015–2017 y 2023–2025); se reportan la mayor alza y la mayor caída en puntos porcentuales. Subtipos mutuamente excluyentes del instrumento 2015-2025.",
            "formula": "part = Σ delitos_subtipo / Σ delitos_totales × 100 (por trienio); cambio = part_fin − part_ini",
            "datos": {"alza": {"subtipo": nom_s, "ini": round(sube[1], 2), "fin": round(sube[2], 2)},
                      "caida": {"subtipo": nom_b, "ini": round(baja[1], 2), "fin": round(baja[2], 2)}},
            "fuente": "SESNSP, IDFC estatal 2015-2025 (corte ago. 2026)",
        },
    }


def hallazgo_concentracion(muni_prod: dict, total_periodo: int) -> dict:
    """R3: concentración territorial del acumulado 2015-2025."""
    sumas = []
    for m in muni_prod["municipios"]:
        s = sum(v for v in m["total"][:11] if v is not None)  # 2015-2025
        sumas.append(s)
    sumas.sort(reverse=True)
    acum, n50 = 0, 0
    for s in sumas:
        acum += s
        n50 += 1
        if acum >= total_periodo * 0.5:
            break
    total_munis = len(sumas)
    pct_munis = n50 / total_munis * 100
    top100 = sum(sumas[:100]) / total_periodo * 100
    return {
        "id": "concentracion",
        "titulo": f"{n50} municipios —el {_fmt1(pct_munis)} % del país— concentran la mitad de los delitos registrados",
        "cifra": str(n50),
        "unidad": f"municipios reúnen el 50 % del registro 2015–2025 (de {_fmt_int(total_munis)})",
        "periodo": "Acumulado municipal 2015–2025, todos los delitos",
        "comparacion": f"Los 100 municipios de mayor registro suman {_fmt1(top100)} % del total nacional",
        "interpretacion": (
            "La incidencia registrada está fuertemente concentrada en centros urbanos; refleja también dónde es más probable que se denuncie y se registre."),
        "validez": "2015-2025",
        "mini": {"tipo": "linea",
                 "etiquetas": ["10", "25", "50", "100", "250"],
                 "valores": [round(sum(sumas[:k]) / total_periodo * 100, 1) for k in (10, 25, 50, 100, 250)]},
        "calculo": {
            "regla": "R3 documentada: municipios ordenados por acumulado 2015-2025 (todos los delitos); número mínimo cuya suma alcanza el 50 % del total nacional (fuente estatal). Registros sin municipio identificado quedan en conciliación y no entran al conteo de municipios.",
            "formula": "n50 = min{n : Σ_{i≤n} delitos_(i) ≥ 0.5 × total_nacional}",
            "datos": {"n50": n50, "total_municipios": total_munis, "top100_pct": round(top100, 2)},
            "fuente": "SESNSP, IDFC municipal y estatal 2015-2025 (corte ago. 2026)",
        },
    }


def hallazgo_volumen_vs_tasa(estatal_anual_total: dict[str, list], entidades: dict[str, str],
                             pob_est: dict[str, dict[str, int]], anio: int, idx_anio: int) -> dict:
    """R4: divergencia entre ranking estatal por volumen y por tasa (año completo más reciente)."""
    filas = []
    for cve, arr in estatal_anual_total.items():
        v = arr[idx_anio]
        p = pob_est.get(cve, {}).get(str(anio))
        if v is None or not p:
            continue
        filas.append((cve, entidades[cve], v, v / p * 100_000))
    top_v = [f[0] for f in sorted(filas, key=lambda x: -x[2])[:5]]
    top_t = [f[0] for f in sorted(filas, key=lambda x: -x[3])[:5]]
    inter = len(set(top_v) & set(top_t))
    solo_tasa = [f for f in sorted(filas, key=lambda x: -x[3])[:5] if f[0] not in top_v]
    ejemplo = solo_tasa[0] if solo_tasa else sorted(filas, key=lambda x: -x[3])[0]
    nombres_v = [entidades[c] for c in top_v]
    nombres_t = [entidades[c] for c in top_t]
    return {
        "id": "volumen-vs-tasa",
        "titulo": f"Solo {inter} de las 5 entidades con más delitos registrados están también entre las 5 de mayor tasa",
        "cifra": f"{inter}/5",
        "unidad": f"entidades coinciden en ambos rankings ({anio})",
        "periodo": f"Año completo {anio}, todos los delitos",
        "comparacion": f"{ejemplo[1]}: {_fmt1(ejemplo[3])} por 100 mil, fuera del top de volumen",
        "interpretacion": (
            f"Por volumen encabezan {', '.join(nombres_v[:3])}…; por tasa, {', '.join(nombres_t[:3])}…. "
            "Comparar territorios exige denominadores poblacionales: el volumen sigue al tamaño."),
        "validez": "2015-2025",
        "mini": {"tipo": "barras", "etiquetas": [entidades[c][:10] for c in top_t],
                 "valores": [round(dict((f[0], f[3]) for f in filas)[c], 1) for c in top_t]},
        "calculo": {
            "regla": f"R4 documentada: rankings estatales del año completo más reciente ({anio}) por volumen y por tasa (población CONAPO del mismo año); se reporta el tamaño de la intersección y un ejemplo de divergencia.",
            "formula": "tasa_ent = delitos_ent / poblacion_ent × 100000; intersección = |top5_volumen ∩ top5_tasa|",
            "datos": {"top_volumen": nombres_v, "top_tasa": nombres_t, "interseccion": inter},
            "fuente": "SESNSP, IDFC estatal (corte ago. 2026); CONAPO",
        },
    }


def hallazgo_estacionalidad(sn_nm: dict) -> dict:
    """R5: estacionalidad del total nacional (índice mensual medio, años completos)."""
    por_anio_mes: dict[int, dict[int, int]] = {}
    for ym, v in zip(sn_nm["meses"], sn_nm["total"]):
        if v is None:
            continue
        a, mm = int(ym[:4]), int(ym[5:7])
        por_anio_mes.setdefault(a, {})[mm] = v
    anios = [a for a, d in por_anio_mes.items() if len(d) == 12]
    indices: dict[int, list[float]] = {m: [] for m in range(1, 13)}
    for a in anios:
        media = mean(por_anio_mes[a].values())
        for m in range(1, 13):
            indices[m].append(por_anio_mes[a][m] / media * 100)
    med = {m: mean(v) for m, v in indices.items()}
    pico = max(med, key=med.get)
    valle = min(med, key=med.get)
    # consistencia: ¿en cuántos años el mes pico está en el tercio superior?
    consistentes = sum(1 for a in anios
                       if sorted(por_anio_mes[a], key=por_anio_mes[a].get, reverse=True).index(pico) < 4)
    nombres = ["", "enero", "febrero", "marzo", "abril", "mayo", "junio", "julio",
               "agosto", "septiembre", "octubre", "noviembre", "diciembre"]
    amplitud = med[pico] - med[valle]
    suficiente = amplitud >= 5 and consistentes >= int(len(anios) * 0.6)
    if not suficiente:
        return {"id": "estacionalidad", "insuficiente": True,
                "titulo": "Estacionalidad del registro nacional",
                "cifra": "", "unidad": "", "periodo": "", "comparacion": "",
                "interpretacion": (
                    f"Con las reglas documentadas (amplitud mínima de 5 puntos e consistencia en 60 % de los años), "
                    f"la evidencia de estacionalidad no es concluyente: amplitud {_fmt1(amplitud)} pts, "
                    f"mes máximo consistente en {consistentes} de {len(anios)} años."),
                "validez": "2015-2025",
                "mini": {"tipo": "linea", "etiquetas": [nombres[m][:3] for m in range(1, 13)],
                         "valores": [round(med[m], 1) for m in range(1, 13)]},
                "calculo": {"regla": "R5 documentada", "formula": "índice_m = delitos_m / media_anual × 100",
                            "datos": {"indices_medios": {nombres[m]: round(med[m], 1) for m in med}},
                            "fuente": "SESNSP, IDFC estatal 2015-2025"}}
    return {
        "id": "estacionalidad",
        "titulo": f"El registro delictivo tiene estacionalidad: {nombres[pico]} concentra sistemáticamente más carpetas y {nombres[valle]} menos",
        "cifra": _fmt1(med[pico] - 100),
        "unidad": f"% por encima del mes promedio alcanza {nombres[pico]}",
        "periodo": f"Índices mensuales medios, {len(anios)} años completos (2015–2025)",
        "comparacion": f"{nombres[valle]}: {_fmt1(med[valle] - 100)} % vs mes promedio · amplitud {_fmt1(amplitud)} pts",
        "interpretacion": (
            f"El patrón se repite en {consistentes} de {len(anios)} años (mes máximo dentro del tercio superior), "
            "consistente con efectos de calendario en denuncia y registro; los meses de menos días y las vacaciones registran menos."),
        "validez": "2015-2025",
        "mini": {"tipo": "linea", "etiquetas": [nombres[m][:3] for m in range(1, 13)],
                 "valores": [round(med[m], 1) for m in range(1, 13)]},
        "calculo": {
            "regla": "R5 documentada: índice mensual = delitos del mes ÷ media mensual del año × 100, promediado sobre años completos; el hallazgo se publica solo si la amplitud pico-valle ≥ 5 puntos y el mes pico queda en el tercio superior en ≥ 60 % de los años.",
            "formula": "índice_m,a = delitos_m,a / media_mensual_a × 100; índice_m = media_a(índice_m,a)",
            "datos": {"indices_medios": {nombres[m]: round(med[m], 1) for m in med},
                      "consistencia": f"{consistentes}/{len(anios)}"},
            "fuente": "SESNSP, IDFC estatal 2015-2025 (corte ago. 2026)",
        },
    }
