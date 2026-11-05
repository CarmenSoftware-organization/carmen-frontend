import {
  availableRenders,
  defaultRenderFor,
} from "@/components/dashboard-widget/render-support";
import type {
  DatasetParam,
  DatasetShape,
  WidgetParams,
  WidgetType,
} from "@/types/dashboard-widget";
import type { DashboardDataset } from "@/types/dashboard-dataset";

export const SUPPORTED_SHAPES = [
  "scalar",
  "scalar_delta",
  "time_series",
  "categorical",
  "ranked",
  "matrix",
  "table",
] as const satisfies readonly DatasetShape[];

/**
 * ชนิดกราฟเริ่มต้นตอนเพิ่ม widget — ตัวแรกที่ทั้ง backend อนุญาต (`supported_renders`)
 * และ frontend มีการ์ดให้วาด: scalar/scalar_delta→kpi, time_series→line,
 * categorical→pie, ranked→bar (ผู้ใช้สลับทีหลังได้จากปุ่มบนการ์ด)
 *
 * @param dataset - dataset ที่เลือกจาก picker
 * @returns ชนิดกราฟเริ่มต้น
 */
export function defaultWidgetTypeFor(dataset: DashboardDataset): WidgetType {
  // dataset บอกเองว่าควรเริ่มเป็นอะไร — ใช้เมื่อการ์ดของชนิดนั้นมีจริงเท่านั้น
  const preferred = dataset.default_render as WidgetType | undefined;
  if (
    preferred &&
    availableRenders(
      dataset.shape,
      dataset.supported_renders,
      dataset.dimension,
    ).includes(preferred)
  ) {
    return preferred;
  }
  return defaultRenderFor(
    dataset.shape,
    dataset.supported_renders,
    dataset.dimension,
  );
}

export function defaultParamsFor(
  params: readonly DatasetParam[] = [],
): WidgetParams {
  const out: WidgetParams = {};
  for (const p of params) {
    if (p.default !== undefined) out[p.name] = p.default;
  }
  return out;
}

/**
 * ค่าของ param แบบเลือกจากรายการ (`lookup`) → id ที่เลือก · "" = ไม่ได้เลือก
 * (backend ตัดช่องว่าง/ค่าซ้ำเองอยู่แล้ว ฝั่งนี้ตัดให้ UI นับถูก)
 */
export function splitPicked(value: string | number | undefined): string[] {
  if (value === undefined || value === "") return [];
  return [
    ...new Set(
      String(value)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  ];
}

/** id ที่เลือก → ค่าที่เก็บใน `params` (คั่น `,`) */
export function joinPicked(ids: readonly string[]): string {
  return ids.join(",");
}

/**
 * รหัสงวดที่ค่าหนึ่งชี้ถึง — token (`@current_period` / `@previous_period`) คืนรหัสที่ token
 * ชี้อยู่ตอนนี้ (จาก `tokenCode`) รหัสงวดคืนตัวเอง · token ที่ยังไม่รู้รหัส (รายการงวดยังโหลด
 * ไม่เสร็จ) คืนตัว token เอง จึงเท่ากับแค่ตัวมันเอง
 */
export function periodCodeOf(
  value: string,
  tokenCode: Readonly<Record<string, string | undefined>>,
): string {
  return (value.startsWith("@") ? tokenCode[value] : value) ?? value;
}

/**
 * งวดที่ยังติ๊กเพิ่มได้ในช่องเลือกหลายงวด — ตัดทั้งค่าที่เลือกแล้ว และค่าที่ชี้งวดเดียวกับที่เลือก
 * แล้ว: เลือก "งวดปัจจุบัน · 2610" แล้วไม่มี "2610" ให้ติ๊กซ้ำ และกลับกัน (backend รวมงวดซ้ำเป็น
 * แถวเดียวอยู่แล้ว แต่ซ้ำแล้วเปลืองโควตา `max` กับงวดเดิม)
 *
 * @param options - token + รหัสงวดทั้งหมด ตามลำดับที่จะแสดง
 * @param picked - ค่าที่เลือกอยู่
 * @param tokenCode - token → รหัสงวดที่ชี้อยู่ตอนนี้
 * @returns ค่าที่ยังเลือกเพิ่มได้ ลำดับเดิม
 */
export function selectablePeriods(
  options: readonly string[],
  picked: readonly string[],
  tokenCode: Readonly<Record<string, string | undefined>>,
): string[] {
  const taken = new Set(picked.map((v) => periodCodeOf(v, tokenCode)));
  return options.filter((v) => !taken.has(periodCodeOf(v, tokenCode)));
}

/**
 * ป้ายของ token ขอบเขตเจ้าของเอกสาร (param `owner_visibility` ของ micro-data:
 * `@everyone` = ทั้ง BU, `@current_user` = เอกสารที่ฉันสร้าง) → key ใน
 * `dashboard.savedWidget` คำเดียวกับ badge ทั้งหมด / ของฉัน ของ status group
 */
export const OWNER_SCOPE_LABEL: ReadonlyMap<string, "visAll" | "visMine"> =
  new Map([
    ["@everyone", "visAll"],
    ["@current_user", "visMine"],
  ]);

/**
 * Radix SelectItem ห้าม value="" — param ที่ไม่บังคับและใช้ "" แปลว่า "ทั้งหมด"
 * (เช่น status) จึงต้องมี sentinel แล้ว map กลับเป็น "" ตอนส่งขึ้น API
 */
export const PARAM_EMPTY = "__all__";

/**
 * ควรโชว์ตัวเลือก "ทั้งหมด" (ค่าว่าง) ในดรอปดาวน์ของ param นี้ไหม
 * โชว์เมื่อ param ไม่บังคับ และไม่มี default ที่มีความหมาย ("" นับเป็นไม่มี) —
 * เช่น `status` (default "" = ทั้งหมด) โชว์ได้; ส่วน `time_range` ที่มี default
 * `@1month` เป็น token ที่ต้องมีค่าเสมอ (backend ตีความ "" กลับเป็น default อยู่ดี)
 * จึงไม่ควรมี "ทั้งหมด" ให้เลือก
 */
export function shouldShowAllOption(p: DatasetParam): boolean {
  return !p.required && (p.default === undefined || p.default === "");
}

export function inferModuleName(datasetId: string): string {
  const prefix = datasetId.split(".")[0];
  if (prefix === "inventory") return "inventoryManagement";
  return "procurement";
}

export function inferSubTile(datasetId: string): string {
  if (datasetId.includes("physical-count")) return "physicalCount";
  if (datasetId.includes("spot-check")) return "spotCheck";
  if (datasetId.includes("store-requisition") || datasetId.includes("sr-"))
    return "storeRequisition";
  if (datasetId.includes("low-stock")) return "stockReplenishment";
  if (datasetId.includes("stock-in") || datasetId.includes("stock-out"))
    return "transaction";
  if (datasetId.includes("pr-by-department")) return "department";
  if (datasetId.includes("by-vendor")) return "vendor";
  if (datasetId.includes("pr-")) return "purchaseRequest";
  if (datasetId.includes("po-")) return "purchaseOrder";
  if (datasetId.includes("grn")) return "goodsReceiveNote";
  if (datasetId.includes("cn-")) return "creditNote";
  return "document";
}
