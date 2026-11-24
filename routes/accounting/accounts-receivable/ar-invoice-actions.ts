import { isDraftDocNo } from "@/lib/draft-doc-no";
import type { ArRegisterDocument } from "./use-ar-register";

export type ArUiAction =
  | "submit"
  | "delete"
  | "void"
  | "approve"
  | "sendback"
  | "reject";

/**
 * action ที่เสนอบนหน้า AR Invoice (ยังไม่รวมสิทธิ์เขียน — call site ต้อง AND canWrite เอง)
 * draft → submit + ลบได้เฉพาะเลข DRAFT- (ได้เลขจริงแล้วเหลือ void) · in_review → ตาม `allowed_actions` ของ backend
 * (ไม่มี void/ลบ) · posted → void · void → ไม่มี
 */
export function arInvoiceActions(
  doc: Pick<ArRegisterDocument, "doc_status" | "doc_no" | "allowed_actions">,
): ArUiAction[] {
  if (doc.doc_status === "draft")
    return isDraftDocNo(doc.doc_no) ? ["submit", "delete"] : ["submit", "void"];
  if (doc.doc_status === "in_review") return doc.allowed_actions ?? [];
  if (doc.doc_status === "posted") return ["void"];
  return [];
}
