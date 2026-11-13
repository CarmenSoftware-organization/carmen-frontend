import type { WidgetDisplay } from "@/types/dashboard-widget";

/**
 * กริดของ dashboard — 12 คอลัมน์เมื่อกล่องกว้าง 64rem ขึ้นไป · 6 ตั้งแต่ 38rem · ต่ำกว่านั้นเต็มแถว
 * 1 แถว = 4rem (คู่กับ `auto-rows-[4rem]` ของ container)
 *
 * ตัดสินจาก **ความกว้างของกล่อง** (container query) ไม่ใช่ของจอ: จอ 1024 ที่กาง sidebar เหลือกล่อง
 * ~710px ถ้าแบ่ง 12 คอลัมน์ การ์ด KPI กว้าง 169px บรรทัดเทียบงวดก่อนโดนตัดขอบล่าง
 * ตัวที่ห่อกริดจึงต้องเป็น `@container` (ไม่มี = คอลัมน์ไม่แตกเลย และไม่มี error)
 *
 * ต้องเป็น string เต็มตัวในตาราง ไม่ใช่ประกอบด้วย template literal — Tailwind
 * สแกน class จาก source แบบ static ถ้าประกอบชื่อตอน runtime จะไม่มี class นั้นใน bundle
 */
const COL_SPAN_WIDE: Record<number, string> = {
  1: "@5xl:col-span-1",
  2: "@5xl:col-span-2",
  3: "@5xl:col-span-3",
  4: "@5xl:col-span-4",
  5: "@5xl:col-span-5",
  6: "@5xl:col-span-6",
  7: "@5xl:col-span-7",
  8: "@5xl:col-span-8",
  9: "@5xl:col-span-9",
  10: "@5xl:col-span-10",
  11: "@5xl:col-span-11",
  12: "@5xl:col-span-12",
};

/** กล่องกลาง 6 คอลัมน์ = ครึ่งหนึ่งของความกว้างที่ตั้งไว้ (ปัดขึ้น, อย่างน้อย 1) */
const COL_SPAN_MID: Record<number, string> = {
  1: "@min-[38rem]:col-span-1",
  2: "@min-[38rem]:col-span-2",
  3: "@min-[38rem]:col-span-3",
  4: "@min-[38rem]:col-span-4",
  5: "@min-[38rem]:col-span-5",
  6: "@min-[38rem]:col-span-6",
};

const ROW_SPAN: Record<number, string> = {
  1: "row-span-1",
  2: "row-span-2",
  3: "row-span-3",
  4: "row-span-4",
  5: "row-span-5",
  6: "row-span-6",
};

/** ขนาดหนึ่งตัวเลือก — [กว้างเป็นคอลัมน์ (จาก 12), สูงเป็นแถว] */
export type GridSize = readonly [width: number, height: number];

/**
 * ขนาดที่เลือกได้ต่อชนิดกราฟ เรียงจากเล็กไปใหญ่ — **ตัวแรกคือขนาดต่ำสุด**
 *
 * ไม่ปล่อยให้ตั้งได้อิสระทุกค่า เพราะ KPI ที่ถูกย่อจนเลขล้นกล่อง หรือกราฟแท่งกว้าง
 * 3 คอลัมน์สูง 2 แถว มันอ่านไม่ออกจริง ๆ — ขอบล่างต่อชนิดคือสิ่งที่กันไม่ให้
 * dashboard เละจากการปรับของผู้ใช้เอง
 */
const SIZE_OPTIONS: Record<string, readonly GridSize[]> = {
  kpi: [
    [3, 2],
    [3, 3],
    [4, 2],
    [4, 3],
    [6, 2],
    [6, 3],
  ],
  gauge: [
    [3, 3],
    [4, 3],
    [4, 4],
    [6, 3],
    [6, 4],
  ],
  pie: [
    [4, 3],
    [6, 3],
    [6, 4],
    [8, 4],
    [12, 4],
  ],
  bar: [
    [4, 3],
    [6, 3],
    [6, 4],
    [8, 4],
    [12, 4],
    [12, 6],
  ],
  line: [
    [4, 3],
    [6, 3],
    [6, 4],
    [8, 4],
    [12, 4],
  ],
  area: [
    [4, 3],
    [6, 3],
    [6, 4],
    [8, 4],
    [12, 4],
  ],
  table: [
    [6, 4],
    [8, 4],
    [12, 4],
    [12, 6],
  ],
};

const FALLBACK_OPTIONS: readonly GridSize[] = [
  [4, 3],
  [6, 3],
  [12, 4],
];

/** ขนาดเริ่มต้นเมื่อยังไม่เคยตั้งเอง — ไม่ใช่ตัวเล็กสุดเสมอไป */
const DEFAULT_SIZE: Record<string, GridSize> = {
  kpi: [3, 2],
  gauge: [3, 3],
  pie: [6, 3],
  bar: [6, 3],
  line: [6, 3],
  area: [6, 3],
  table: [12, 4],
};

/**
 * ขนาดทั้งหมดที่ชนิดกราฟนี้เลือกได้ เรียงจากเล็กไปใหญ่
 *
 * @param widgetType - ชนิดกราฟ
 * @returns รายการ `[กว้าง, สูง]`
 */
export function sizeOptionsFor(widgetType: string): readonly GridSize[] {
  return SIZE_OPTIONS[widgetType] ?? FALLBACK_OPTIONS;
}

/**
 * ขนาดต่ำสุดที่ชนิดกราฟนี้ยอมให้ย่อลงไปได้
 *
 * @param widgetType - ชนิดกราฟ
 * @returns `[กว้าง, สูง]` ตัวเล็กสุด
 */
export function minSizeFor(widgetType: string): GridSize {
  return sizeOptionsFor(widgetType)[0];
}

const clamp = (n: number, lo: number, hi: number) =>
  Math.min(Math.max(Math.round(n), lo), hi);

/**
 * ขนาดของ widget เป็นหน่วยกริด — ค่าที่ผู้ใช้ตั้งมาก่อน ไม่งั้นใช้ค่าตามชนิดกราฟ
 *
 * บังคับขอบล่างต่อชนิดเสมอ ไม่ใช่แค่ตอนเลือกในฟอร์ม เพราะขนาดที่เคย valid อาจเล็ก
 * เกินไปหลังผู้ใช้สลับชนิดกราฟ (KPI 3×2 → เปลี่ยนเป็นกราฟแท่งที่ต่ำสุด 4×3)
 *
 * @param widgetType - ชนิดกราฟ
 * @param display - ค่าตั้งการแสดงผล (อาจไม่มี)
 * @returns `{ width, height }` เป็นหน่วยคอลัมน์/แถว
 */
export function gridSize(
  widgetType: string,
  display?: WidgetDisplay | null,
): { width: number; height: number } {
  const [defW, defH] = DEFAULT_SIZE[widgetType] ?? [6, 3];
  const [minW, minH] = minSizeFor(widgetType);
  return {
    width: clamp(display?.width ?? defW, minW, 12),
    height: clamp(display?.height ?? defH, minH, 6),
  };
}

/**
 * ปรับค่าการแสดงผลตอนสลับชนิดกราฟในฟอร์ม — ขนาดที่ไม่อยู่ในตัวเลือกของชนิดใหม่ถูกล้างทิ้ง
 * ให้กลับไปใช้ขนาดตั้งต้นของชนิดนั้น (`gridSize` บังคับขอบล่างตอนวาดอยู่แล้ว แต่ค่าที่บันทึก
 * จะค้างเป็นขนาดที่ชนิดใหม่เลือกไม่ได้) · ค่าอื่น (ทศนิยม · min/max ของ gauge) เก็บไว้
 *
 * @param display - ค่าการแสดงผลปัจจุบัน
 * @param widgetType - ชนิดกราฟใหม่
 * @returns ค่าการแสดงผลที่ใช้กับชนิดใหม่ได้
 */
export function fitDisplayToType(
  display: WidgetDisplay,
  widgetType: string,
): WidgetDisplay {
  const { width, height, ...rest } = display;
  if (width === undefined && height === undefined) return display;
  const isOffered = sizeOptionsFor(widgetType).some(
    ([w, h]) => w === width && h === height,
  );
  return isOffered ? display : rest;
}

/**
 * class ของช่องที่ widget กินบนกริด
 *
 * `row-span` คือหัวใจ: การ์ดสูงเท่าที่ประกาศ ไม่ยืดตามการ์ดที่สูงที่สุดในแถว
 * (พฤติกรรมเดิมของ `align-items: stretch` ที่ทำให้ KPI ข้าง ๆ กราฟใหญ่บวมตาม)
 *
 * @param widgetType - ชนิดกราฟ
 * @param display - ค่าตั้งการแสดงผล
 * @returns class string สำหรับ grid item
 */
export function gridClasses(
  widgetType: string,
  display?: WidgetDisplay | null,
): string {
  const { width, height } = gridSize(widgetType, display);
  const md = clamp(Math.ceil(width / 2), 1, 6);
  return `${COL_SPAN_MID[md]} ${COL_SPAN_WIDE[width]} ${ROW_SPAN[height]}`;
}

/**
 * ปัดทศนิยมตามที่ผู้ใช้ตั้ง — ไม่ได้ตั้ง = ปล่อยตามเดิม (ไม่บังคับปัด)
 *
 * @param value - ตัวเลขดิบ
 * @param display - ค่าตั้งการแสดงผล
 * @returns ตัวเลขที่ปัดแล้ว หรือค่าเดิมเมื่อไม่ได้ตั้ง
 */
export function applyDecimals(
  value: number,
  display?: WidgetDisplay | null,
): number {
  const d = display?.decimals;
  if (d === undefined || d === null) return value;
  return Number(value.toFixed(clamp(d, 0, 4)));
}

/**
 * ช่วงสเกลของ gauge
 *
 * `max` ที่ไม่ได้ตั้งคือปัญหาจริง — gauge ที่ไม่รู้ปลายทางอ่านไม่ได้ความหมาย จึงต้อง
 * เดาให้ดูไม่หลอกตา: ปัดขึ้นเป็นเลขกลม ๆ เหนือค่าปัจจุบัน แล้วให้ dialog ชวนตั้งเอง
 *
 * @param value - ค่าปัจจุบัน
 * @param display - ค่าตั้งการแสดงผล
 * @returns `{ min, max, isEstimated }` — `isEstimated` = ยังไม่ได้ตั้ง max เอง
 */
export function gaugeRange(
  value: number,
  display?: WidgetDisplay | null,
): { min: number; max: number; isEstimated: boolean } {
  const min = display?.min ?? 0;
  if (display?.max !== undefined && display.max !== null && display.max > min) {
    return { min, max: display.max, isEstimated: false };
  }
  const span = Math.max(value - min, 1);
  const step = 10 ** Math.floor(Math.log10(span));
  const max = min + Math.max(Math.ceil((span * 1.25) / step) * step, step);
  return { min, max, isEstimated: true };
}

/**
 * สีของค่าปัจจุบันตาม threshold ที่ตั้งไว้ — ขีดที่ค่าผ่านแล้วและสูงที่สุดชนะ
 *
 * @param value - ค่าปัจจุบัน
 * @param display - ค่าตั้งการแสดงผล
 * @param fallback - สีเมื่อไม่มี threshold ไหนถูกข้าม
 * @returns CSS color
 */
export function thresholdColor(
  value: number,
  display: WidgetDisplay | null | undefined,
  fallback: string,
): string {
  const crossed = (display?.thresholds ?? [])
    .filter((t) => value >= t.value)
    .sort((a, b) => a.value - b.value)
    .at(-1);
  return crossed?.color ?? fallback;
}
