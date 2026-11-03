import type { DatasetShape, WidgetType } from "@/types/dashboard-widget";

/**
 * การ์ดที่ frontend มีจริง กับชนิดข้อมูล (shape) ที่การ์ดนั้นอ่านได้ เรียงตาม
 * ลำดับที่อยากให้เป็นค่าเริ่มต้น
 *
 * นี่คือ **ความสามารถของ renderer ฝั่ง frontend** ไม่ใช่สำเนาของ `supported_renders`
 * ที่ backend ส่งมา (ซึ่งเป็นสัญญาว่า shape หนึ่ง *ควร* วาดเป็นอะไรได้บ้าง) สองชุดนี้
 * ตัดกันแล้วได้สิ่งที่ "สมเหตุสมผล และวาดออกมาได้จริง" — เดิม frontend เก็บ map
 * ของ backend ไว้เองแล้ว drift (time_series ขาด bar, categorical ขาด table)
 *
 * ที่ยังไม่มีการ์ด: `sparkline` `heatmap` · `matrix` วาดเป็นแท่งจัดกลุ่ม / หลายเส้น
 * (1 series ต่อแถว) หรือตาราง
 */
const RENDERERS: readonly {
  readonly type: WidgetType;
  readonly reads: readonly DatasetShape[];
}[] = [
  { type: "kpi", reads: ["scalar", "scalar_delta"] },
  { type: "gauge", reads: ["scalar", "scalar_delta"] },
  { type: "pie", reads: ["categorical", "ranked"] },
  { type: "bar", reads: ["categorical", "ranked", "time_series", "matrix"] },
  { type: "line", reads: ["time_series", "matrix"] },
  { type: "area", reads: ["time_series"] },
  { type: "table", reads: ["table", "categorical", "ranked", "matrix"] },
];

export function availableRenders(
  shape: string | undefined,
  supportedRenders?: readonly string[],
): WidgetType[] {
  if (!shape) return [];
  const allowed = supportedRenders?.length ? new Set(supportedRenders) : null;
  return RENDERERS.filter(
    (r) =>
      r.reads.includes(shape as DatasetShape) &&
      (!allowed || allowed.has(r.type)),
  ).map((r) => r.type);
}

/**
 * ชนิดกราฟที่อยากให้เป็นค่าเริ่มต้นของ shape นั้น เมื่อมีให้เลือกหลายแบบ
 *
 * เป็นแค่ "ตัวไหนขึ้นก่อน" ไม่ใช่ "ตัวไหนเลือกได้" (ชุดที่เลือกได้มีเจ้าของเดียวคือ
 * `supported_renders` ตัดกับการ์ดที่มีจริง) — ตารางนี้มีไว้คงพฤติกรรมเดิมของ picker
 * ที่ categorical เริ่มที่ pie ส่วน ranked เริ่มที่ bar ทั้งที่การ์ดสองใบอ่านได้ทั้งคู่
 */
const PREFERRED_DEFAULT: Record<string, WidgetType> = {
  categorical: "pie",
  ranked: "bar",
  // ตั้งแต่ bar อ่าน time_series ได้ ตัวมันมาก่อน line ในลำดับของ RENDERERS
  // ซึ่งจะเปลี่ยน default ของกราฟเส้นทั้งหมดโดยไม่มีใครสั่ง
  time_series: "line",
  // เทียบงวด / เทียบ location — แท่งจัดกลุ่มอ่านง่ายกว่าเส้นเมื่อแกน x เป็นกลุ่ม
  matrix: "bar",
};

export function defaultRenderFor(
  shape: string | undefined,
  supportedRenders?: readonly string[],
): WidgetType {
  const options = availableRenders(shape, supportedRenders);
  const preferred = shape ? PREFERRED_DEFAULT[shape] : undefined;
  if (preferred && options.includes(preferred)) return preferred;
  return options[0] ?? "kpi";
}
