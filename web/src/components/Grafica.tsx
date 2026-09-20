/** Envoltura de Apache ECharts consciente del tema y del tamaño.
 * Especificaciones de marcas (skill dataviz): líneas 2px, barras ≤24px con
 * extremo redondeado 4px, rejilla hairline sólida, tooltip con crosshair.
 */
import { useEffect, useRef } from "react";
import * as echarts from "echarts/core";
import { LineChart, BarChart, PieChart, HeatmapChart } from "echarts/charts";
import {
  GridComponent, TooltipComponent, LegendComponent, DataZoomComponent,
  MarkLineComponent, ToolboxComponent, VisualMapComponent, TitleComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import type { EChartsCoreOption } from "echarts/core";

echarts.use([LineChart, BarChart, PieChart, HeatmapChart, GridComponent,
  TooltipComponent, LegendComponent, DataZoomComponent, MarkLineComponent,
  ToolboxComponent, VisualMapComponent, TitleComponent, CanvasRenderer]);

export { echarts };

export function tokens() {
  const css = getComputedStyle(document.documentElement);
  const v = (n: string) => css.getPropertyValue(n).trim();
  return {
    ink: v("--ink"), ink2: v("--ink-2"), ink3: v("--ink-3"),
    grid: v("--grid"), axis: v("--axis"), surface: v("--surface"),
    series: [v("--s1"), v("--s2"), v("--s3"), v("--s4"), v("--s5")],
    deemphasis: v("--deemphasis"),
    sans: v("--sans") || "IBM Plex Sans, system-ui, sans-serif",
  };
}

/** Base común: rejilla recesiva, ejes hairline, tooltip accesible. */
export function baseOpcion(): EChartsCoreOption {
  const t = tokens();
  return {
    color: t.series,
    textStyle: { fontFamily: t.sans, color: t.ink2 },
    grid: { left: 8, right: 16, top: 28, bottom: 8, containLabel: true },
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "line", lineStyle: { color: t.axis, width: 1 } },
      backgroundColor: t.surface,
      borderColor: t.grid,
      borderWidth: 1,
      textStyle: { color: t.ink, fontSize: 12.5, fontFamily: t.sans },
      extraCssText: "box-shadow: var(--sombra-2); border-radius: 10px; padding: 10px 12px;",
      confine: true,
    },
    xAxis: {
      axisLine: { lineStyle: { color: t.axis, width: 1 } },
      axisTick: { show: false },
      axisLabel: { color: t.ink3, fontSize: 11.5 },
      splitLine: { show: false },
    },
    yAxis: {
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: t.ink3, fontSize: 11.5 },
      splitLine: { lineStyle: { color: t.grid, width: 1, type: "solid" } },
    },
    animationDuration: matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 320,
    animationDurationUpdate: matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 220,
  };
}

interface Props {
  opcion: EChartsCoreOption;
  alto?: number;
  ariaLabel: string;
  onListo?: (inst: echarts.ECharts) => void;
  className?: string;
}

export default function Grafica({ opcion, alto = 300, ariaLabel, onListo, className }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const instRef = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    const inst = echarts.init(ref.current, undefined, { renderer: "canvas" });
    instRef.current = inst;
    const ro = new ResizeObserver(() => inst.resize());
    ro.observe(ref.current);
    const obsTema = new MutationObserver(() => {
      // re-render con tokens del tema activo
      inst.setOption({ ...baseOpcion(), ...opcionRef.current } as EChartsCoreOption, true);
    });
    obsTema.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    onListo?.(inst);
    return () => { ro.disconnect(); obsTema.disconnect(); inst.dispose(); instRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const opcionRef = useRef(opcion);
  opcionRef.current = opcion;

  useEffect(() => {
    instRef.current?.setOption({ ...baseOpcion(), ...opcion } as EChartsCoreOption, true);
  }, [opcion]);

  return (
    <div
      ref={ref}
      className={className}
      style={{ width: "100%", height: alto }}
      role="img"
      aria-label={ariaLabel}
    />
  );
}
