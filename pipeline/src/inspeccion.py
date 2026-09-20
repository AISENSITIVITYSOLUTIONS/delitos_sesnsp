"""Diagnóstico estructural de las cuatro bases oficiales (tarea 2)."""
from __future__ import annotations

import json
import sys
from pathlib import Path

import polars as pl

sys.path.insert(0, str(Path(__file__).parent))
from transformacion import leer_ancho  # noqa: E402
from esquema import MESES  # noqa: E402

RAW = Path("/home/claude/sesnsp/raw")

ARCHIVOS = {
    "estatal_2015_2025": RAW / "Estatal-Delitos-2015-2025_ago2026.csv",
    "municipal_2015_2025": RAW / "Municipal-Delitos-2015-2025_ago2026.csv",
    "estatal_2026": RAW / "RNID-Delitos_Estatal-2026-ago2026.csv",
    "municipal_2026": RAW / "RNID-Delitos_Municipal-2026-ago2026.csv",
}


def diag(clave: str, ruta: Path) -> dict:
    df, meta = leer_ancho(ruta)
    d: dict = {"clave": clave, **meta}
    d["anios"] = sorted(df.get_column("Año").unique().to_list())
    d["entidades"] = df.get_column("Clave_Ent").n_unique()
    d["bienes"] = sorted(df.get_column("Bien jurídico afectado").unique().to_list())
    d["n_tipos"] = df.get_column("Tipo de delito").n_unique()
    d["n_subtipos"] = df.get_column("Subtipo de delito").n_unique()
    d["n_modalidades_texto"] = df.get_column("Modalidad").n_unique()
    d["n_combos_modalidad"] = df.select(["Bien jurídico afectado", "Tipo de delito",
                                         "Subtipo de delito", "Modalidad"]).unique().height
    dims = [c for c in ["Año", "Clave_Ent", "Cve. Municipio", "Bien jurídico afectado",
                        "Tipo de delito", "Subtipo de delito", "Modalidad"] if c in df.columns]
    d["duplicados_clave"] = df.group_by(dims).len().filter(pl.col("len") > 1).height
    tot = df.select([pl.col(m).cast(pl.Int64, strict=False).sum().alias(m) for m in MESES])
    d["total_por_mes_ultimo_anio"] = (
        df.filter(pl.col("Año") == max(d["anios"]))
        .select([pl.col(m).cast(pl.Int64, strict=False).sum().alias(m) for m in MESES])
        .row(0)
    )
    d["total_general"] = int(sum(x or 0 for x in tot.row(0)))
    d["nulos_celdas"] = int(df.select([pl.col(m).is_null().sum().alias(m) for m in MESES])
                            .sum_horizontal().item())
    d["negativos"] = int(df.select([(pl.col(m).cast(pl.Int64, strict=False) < 0).sum().alias(m)
                                    for m in MESES]).sum_horizontal().item())
    d["totales_por_anio"] = {
        str(r["Año"]): int(r["total"])
        for r in df.group_by("Año").agg(
            pl.sum_horizontal([pl.col(m).cast(pl.Int64, strict=False) for m in MESES]).sum().alias("total"))
        .sort("Año").iter_rows(named=True)
    }
    if "Cve. Municipio" in df.columns:
        d["n_municipios"] = df.get_column("Cve. Municipio").n_unique()
        noesp = df.filter(pl.col("Municipio").str.contains(r"(?i)no especificado|otros municipios"))
        d["municipios_no_especificados"] = noesp.get_column("Municipio").n_unique()
        d["registros_no_especificado_total"] = int(
            noesp.select(pl.sum_horizontal([pl.col(m).cast(pl.Int64, strict=False) for m in MESES]).sum()).item() or 0)
    return d


def main():
    salida = {}
    for clave, ruta in ARCHIVOS.items():
        print(f"→ {clave}", file=sys.stderr)
        salida[clave] = diag(clave, ruta)
    out = Path("/home/claude/sesnsp/work/diagnostico.json")
    out.parent.mkdir(exist_ok=True, parents=True)
    out.write_text(json.dumps(salida, ensure_ascii=False, indent=1, default=str))
    print(json.dumps(salida, ensure_ascii=False, indent=1, default=str))


if __name__ == "__main__":
    main()
