import type { TableColumnLink, TableData } from "@/types/dashboard-widget";

/**
 * dataset ที่แถวชี้ไปหาเอกสารได้ → path ของหน้ารายละเอียด
 *
 * map อยู่ฝั่ง frontend ไม่ใช่ backend โดยตั้งใจ — micro-data ไม่ควรรู้จัก route
 * ของหน้าเว็บ ไม่งั้นเปลี่ยน path ทีต้อง deploy backend ตาม มันส่งมาแค่ `id`
 */
const DOC_ROUTES: Record<string, string> = {
  "document.pr-table": "/procurement/purchase-request",
  "document.pr-sent-back": "/procurement/purchase-request",
  "document.pr-rejected": "/procurement/purchase-request",
  "document.po-sent-back": "/procurement/purchase-order",
  "document.po-rejected": "/procurement/purchase-order",
  "document.sr-sent-back": "/store-operation/store-requisition",
  "document.sr-rejected": "/store-operation/store-requisition",
  // ranked ของเอกสาร — คลิกได้เมื่อสลับเป็นตาราง (id มาใน extras แล้ว `asTableData`
  // ยกขึ้นเป็นคอลัมน์ id ให้)
  "procurement.slowest-pr-approvals": "/procurement/purchase-request",
  "procurement.slowest-po-approvals": "/procurement/purchase-order",
  "workflow.my-pending-pr": "/procurement/purchase-request",
};

/** คีย์ของคอลัมน์ที่ถือ id (type `id`) — ไม่มี = แถวนี้ลิงก์ไม่ได้ */
export function idColumnKey(data: TableData | null): string | null {
  return data?.columns.find((c) => c.type === "id")?.key ?? null;
}

/**
 * path ของเอกสารในแถวนั้น
 *
 * @param datasetId - dataset ของ widget
 * @param row - แถวที่ถูกคลิก
 * @param key - คีย์ของคอลัมน์ id
 * @returns path หรือ null เมื่อ dataset นี้ไม่มีหน้าปลายทาง หรือแถวไม่มี id
 */
export function docHref(
  datasetId: string,
  row: Record<string, unknown>,
  key: string | null,
): string | null {
  const base = DOC_ROUTES[datasetId];
  if (!base || !key) return null;
  const id = row[key];
  return typeof id === "string" && id.length > 0
    ? `${base}/${encodeURIComponent(id)}`
    : null;
}

/**
 * ประเภทเอกสารของ inventory transaction (`inventory_doc_type`) → path หน้ารายละเอียด
 *
 * SI / SO (รวมใบปรับปิดงวด EOP-IN / EOP-OUT) อยู่หน้าเดียวกัน แยกด้วย `?type=`
 * ไม่ส่ง type หน้า inventory adjustment จะขึ้น error
 */
const INVENTORY_DOC_ROUTES: Record<string, (id: string) => string> = {
  good_received_note: (id) => `/procurement/goods-receive-note/${id}`,
  credit_note: (id) => `/procurement/credit-note/${id}`,
  store_requisition: (id) => `/store-operation/store-requisition/${id}`,
  stock_in: (id) => `/inventory-management/inventory-adjustment/${id}?type=stock-in`,
  stock_out: (id) => `/inventory-management/inventory-adjustment/${id}?type=stock-out`,
};

/**
 * path ของเอกสารที่ช่องนั้นลิงก์ไป (คอลัมน์ที่มี `link`)
 *
 * @param row - แถวของตาราง
 * @param link - คีย์ของคอลัมน์ที่ถือประเภทและ id ของเอกสาร
 * @returns path หรือ null เมื่อแถวไม่มีเอกสาร หรือเป็นประเภทที่ยังไม่มีหน้าปลายทาง
 */
export function cellDocHref(
  row: Record<string, unknown>,
  link: TableColumnLink,
): string | null {
  const type = row[link.doc_type];
  const id = row[link.doc_id];
  const route = typeof type === "string" ? INVENTORY_DOC_ROUTES[type] : undefined;
  return route && typeof id === "string" && id.length > 0
    ? route(encodeURIComponent(id))
    : null;
}
