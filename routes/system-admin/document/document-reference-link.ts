import { DOC_TYPE_ROUTES } from "@/lib/notification-helpers";
import type { NotificationDocType } from "@/types/notification";

/**
 * path ของเอกสารต้นทางที่ไฟล์แนบอยู่ — ใช้แผนที่ route เดียวกับการแจ้งเตือน
 * (`DOC_TYPE_ROUTES`) จึงเปิดได้เฉพาะเอกสารที่มีหน้ารายละเอียด (PR/PO/GRN/CN/SR)
 *
 * `reference_type` ที่ลงท้าย `_detail` (ไฟล์แนบของแถวรายการ) ตัด suffix ออกแล้วลิงก์ไป
 * หัวเอกสารด้วย `parentId`; ถ้าเป็นหัวเอกสารเองใช้ `referenceId`
 *
 * @returns path ภายในแอป หรือ undefined เมื่อไม่มีหน้าให้เปิด
 */
export function documentReferenceHref(
  type: string | null,
  parentId: string | null,
  referenceId?: string | null,
): string | undefined {
  if (!type) return undefined;
  const isDetail = type.endsWith("_detail");
  const key = isDetail ? type.slice(0, -"_detail".length) : type;
  if (!Object.hasOwn(DOC_TYPE_ROUTES, key)) return undefined;
  const base = DOC_TYPE_ROUTES[key as NotificationDocType];
  // แถวรายการต้องมีหัวเอกสาร — ถ้าไม่มี parent ห้ามเอา id ของแถวรายการไปต่อ path
  const id = isDetail ? parentId : (parentId ?? referenceId);
  return base && id ? `${base}/${encodeURIComponent(id)}` : undefined;
}
