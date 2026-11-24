import type {
  ApDocSource,
  ApDocStatus,
  ApInvoice,
  ApPayment,
  ApSettlement,
  ApUiAction,
} from "@/types/accounts-payable";
import { isDraftDocNo } from "@/lib/draft-doc-no";
import { compareDecimal } from "./ap-decimal";

type ApDoc = Pick<ApInvoice | ApPayment, "doc_status" | "user_action"> & {
  doc_source?: ApDocSource;
};

/** ใบที่ระบบสร้างและ post เองตอน commit GRN — ล็อก แก้ได้ผ่าน GRN เท่านั้น */
export function apIsAutoFromGrn(doc: { doc_source?: ApDocSource }): boolean {
  return doc.doc_source === "grn_auto";
}

/** unpaid / partially_paid / paid — คำนวณจาก outstanding เทียบ total (เฉพาะใบ posted) */
export function apSettlement(
  inv: Pick<ApInvoice, "doc_status" | "total_amount" | "outstanding_amount">,
): ApSettlement {
  if (inv.doc_status !== "posted") return "unpaid";
  const outstanding = Math.abs(Number(inv.outstanding_amount));
  if (outstanding === 0) return "paid";
  if (compareDecimal(inv.outstanding_amount, inv.total_amount) === 0)
    return "unpaid";
  return "partially_paid";
}

/** แก้ไขได้เฉพาะ draft ที่ไม่ใช่ใบ grn_auto */
export function apCanEdit(doc: ApDoc): boolean {
  return doc.doc_status === "draft" && !apIsAutoFromGrn(doc);
}

function userCanExecute(doc: ApDoc, currentUserId?: string | null): boolean {
  const execute = doc.user_action?.execute;
  // ไม่รู้ผู้ใช้ หรือ backend ไม่ส่งรายชื่อ → ไม่ซ่อนปุ่ม (backend ตรวจสิทธิ์ซ้ำอยู่แล้ว)
  if (!currentUserId || !Array.isArray(execute) || execute.length === 0)
    return true;
  return execute.some((u) => u.user_id === currentUserId);
}

/**
 * action ที่เสนอบน UI ของใบจ่ายเงิน — draft → submit/delete · in_review → approve/sendback/reject
 * (เฉพาะผู้ที่ user_action.execute มีชื่อ) · posted → void
 */
export function apActions(
  doc: ApDoc,
  currentUserId?: string | null,
): ApUiAction[] {
  if (apIsAutoFromGrn(doc)) return [];
  const status: ApDocStatus = doc.doc_status;
  if (status === "draft") return ["submit", "delete"];
  if (status === "in_review")
    return userCanExecute(doc, currentUserId)
      ? ["approve", "sendback", "reject"]
      : [];
  if (status === "posted") return ["void"];
  return [];
}

/**
 * action ที่เสนอบน UI ของใบแจ้งหนี้ — ใบ grn_auto ไม่มีเลย
 * draft → submit + ลบได้เฉพาะเลข DRAFT- (ได้เลขจริงแล้วเหลือ void) · in_review → ตาม `allowed_actions` ของ backend
 * (backend เก่าที่ไม่ส่งฟิลด์ → ดูจาก user_action.execute) · posted → void
 */
export function apInvoiceActions(
  doc: ApDoc & Pick<ApInvoice, "doc_no" | "allowed_actions">,
  currentUserId?: string | null,
): ApUiAction[] {
  if (apIsAutoFromGrn(doc)) return [];
  if (doc.doc_status === "draft")
    return isDraftDocNo(doc.doc_no) ? ["submit", "delete"] : ["submit", "void"];
  if (doc.doc_status === "in_review" && doc.allowed_actions)
    return doc.allowed_actions;
  return apActions(doc, currentUserId);
}
