import type { DashboardDataset } from "@/types/dashboard-dataset";

/**
 * ลำดับหมวดใน pop up เพิ่ม widget — หมวดตามโมดูลจาก prefix ของ dataset id
 * (`document.pr-count` → document) ไม่ใช้ฟิลด์ `category` ของ backend เพราะมีแค่ 4 ค่า
 * และ workflow กองรวมเอกสารกับงานจัดซื้อไว้ราวครึ่ง catalogue
 *
 * lab (ตัวที่ promote จาก SQL Workbench) ไว้ท้ายสุด · prefix ใหม่ที่ไม่อยู่ในนี้ต่อท้าย
 * เรียงตามตัวอักษร
 */
export const WIDGET_MODULE_ORDER = [
  "document",
  "procurement",
  "inventory",
  "product",
  "recipe",
  "vendor",
  "pricelist",
  "rfp",
  "equipment",
  "config",
  "workflow",
  "lab",
] as const;

/**
 * หมวดของ dataset จาก id — ตัด `x@` นำหน้าออกก่อน (preset ของหน้าเว็บอย่าง
 * `group@document.pr-count` อยู่หมวดเดียวกับ dataset ที่มันห่อ)
 */
export function moduleOfDataset(id: string): string {
  return id.replace(/^[^@.]*@/, "").split(".")[0];
}

export interface WidgetModuleGroup {
  readonly module: string;
  readonly items: readonly DashboardDataset[];
}

interface GroupOptions {
  /** ชื่อที่แสดงของ dataset ตาม locale (ดู `useDatasetLabel`) */
  readonly labelOf: (dataset: DashboardDataset) => string;
  /** ชื่อหมวดตาม locale — ใช้ค้นหาด้วยชื่อหมวดได้ */
  readonly moduleLabelOf: (module: string) => string;
  readonly query?: string;
  readonly locale?: string;
}

const rankOf = (module: string): number => {
  const i = (WIDGET_MODULE_ORDER as readonly string[]).indexOf(module);
  return i < 0 ? WIDGET_MODULE_ORDER.length : i;
};

/**
 * จัด dataset เป็นหมวดตามโมดูล เรียงหมวดตาม `WIDGET_MODULE_ORDER` และเรียงในหมวด
 * ตามชื่อที่แสดง · `query` กรองแบบทุกคำต้องเจอ (ชื่อแปล · ชื่อ en · id · description ·
 * ชื่อหมวด) หมวดที่ไม่เหลือตัวไหนถูกตัดทิ้ง
 */
export function groupDatasetsByModule(
  datasets: readonly DashboardDataset[],
  { labelOf, moduleLabelOf, query = "", locale }: GroupOptions,
): WidgetModuleGroup[] {
  const terms = query.toLocaleLowerCase(locale).split(/\s+/).filter(Boolean);
  const byModule = new Map<string, DashboardDataset[]>();

  for (const d of datasets) {
    const module = moduleOfDataset(d.id);
    if (terms.length > 0) {
      const haystack = [
        labelOf(d),
        d.name,
        d.id,
        d.description,
        moduleLabelOf(module),
      ]
        .join(" ")
        .toLocaleLowerCase(locale);
      if (!terms.every((term) => haystack.includes(term))) continue;
    }
    const list = byModule.get(module);
    if (list) list.push(d);
    else byModule.set(module, [d]);
  }

  return [...byModule.entries()]
    .sort(([a], [b]) => rankOf(a) - rankOf(b) || a.localeCompare(b, "en"))
    .map(([module, items]) => ({
      module,
      items: items.sort((a, b) => labelOf(a).localeCompare(labelOf(b), locale)),
    }));
}
