import type { ResolvedWidget } from "@/components/dashboard-widget/dashboard-widget-grid";
import type { DatasetShape } from "@/types/dashboard-widget";

export type { DatasetShape };
export type ResolvedWidgetLike = ResolvedWidget;

/** shape ที่มีการ์ดรองรับอย่างน้อยหนึ่งชนิด */
export const SHAPES = [
  "scalar",
  "scalar_delta",
  "categorical",
  "time_series",
  "ranked",
  "matrix",
  "table",
] as const;

const DATA: Record<string, unknown> = {
  scalar: { value: 42 },
  scalar_delta: { value: 42, prev: 30 },
  categorical: [{ label: "draft", value: 3 }],
  ranked: [{ rank: 1, label: "PR-1", value: 9 }],
  time_series: [{ date: "2026-01-01", value: 3 }],
  matrix: { rows: ["2602", "2601"], cols: ["Main Store"], values: [[5], [3]] },
  table: {
    columns: [{ key: "a", label: "A", type: "text" }],
    rows: [{ a: "x" }],
  },
};

/**
 * widget ที่ resolve แล้วแบบย่อ สำหรับป้อนให้ `WidgetRouter` ทดสอบการวาด
 * @param shape - data kind ของ dataset
 * @param widgetType - ชนิดกราฟที่จะวาด
 * @returns widget ที่พร้อมส่งให้การ์ด
 */
export function makeWidget(shape: DatasetShape, widgetType: string) {
  return {
    id: `w-${shape}-${widgetType}`,
    dataset_id: `test.${shape}`,
    widget_type: widgetType,
    title: `${shape} as ${widgetType}`,
    order_index: 0,
    params: {},
    meta: {
      id: `test.${shape}`,
      name: shape,
      shape,
      category: "workflow",
      unit: "items",
    },
    data: DATA[shape],
  };
}
