import { isDraftDocNo } from "@/lib/draft-doc-no";
export type ArUiAction =
  | "submit"
  | "delete"
  | "void"
  | "approve"
  | "sendback"
  | "reject";

/**
 * action ที่เสนอบนหน้า AR Invoice / AR Receipt (ยังไม่รวมสิทธิ์เขียน — call site ต้อง AND canWrite เอง)
 * draft → submit + ลบได้เฉพาะเลข DRAFT- (ได้เลขจริงแล้วเหลือ void) · in_review → ตาม `allowed_actions` ของ backend
 * (ไม่มี void/ลบ) · posted → void · void → ไม่มี
 */
export function arDocActions(doc: {
  doc_status: string;
  doc_no: string;
  allowed_actions?: readonly ArUiAction[];
}): ArUiAction[] {
  if (doc.doc_status === "draft")
    return isDraftDocNo(doc.doc_no) ? ["submit", "delete"] : ["submit", "void"];
  if (doc.doc_status === "in_review") return [...(doc.allowed_actions ?? [])];
  if (doc.doc_status === "posted") return ["void"];
  return [];
}
