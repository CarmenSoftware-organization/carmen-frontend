import type {
  JournalVoucher,
  JournalVoucherCapabilities,
  JournalVoucherSourceLink,
} from "@/types/journal-voucher";
import { isDraftDocNo } from "@/lib/draft-doc-no";
import {
  CHART_OF_ACCOUNT_TYPE,
  type ChartOfAccount,
} from "@/types/chart-of-accounts";

const editableStatuses = new Set(["draft"]);

/** Keep manual journals away from inactive, header, and subledger-owned accounts. */
export function canUseAccountForManualJournal(
  account: ChartOfAccount,
): boolean {
  return (
    account.is_active &&
    account.type !== CHART_OF_ACCOUNT_TYPE.HEADER &&
    account.manual_posting_allowed !== false
  );
}

/**
 * ที่มาที่ GL สร้างเอง (ตรงกับ 6 ค่าที่เข้า workflow ได้ฝั่ง backend) — ใบพวกนี้ submit / อนุมัติ /
 * void / กลับรายการจากหน้า GL ได้ตามปกติ ที่มาอื่นทั้งหมด (ap, ar, inventory, asset, interface
 * และชนิดเก่าอย่าง ap_invoice) คือใบที่ subledger สร้าง
 */
const GL_NATIVE_SOURCES = new Set([
  "manual",
  "recurring",
  "allocation",
  "amortize",
  "reversal",
  "closing",
]);

/**
 * ใบที่ subledger สร้าง — ล้อ `isSubledgerVoucher` ของ backend (`gl-posting.service.ts`):
 * มี `source_ref_type` (อ้างเอกสารต้นทาง เช่นใบกลับรายการของ AP ก็มี) หรือที่มาไม่ใช่ของ GL เอง
 *
 * ฝั่ง backend ตัดสินด้วย `source_ref_type != null || source === ap` เท่านั้น ส่วนเราถือว่าที่มาที่
 * ไม่ใช่ของ GL ทุกตัวเป็นของ subledger ด้วย (เข้มกว่าเล็กน้อย) เพราะใบ ar/inventory/asset/interface
 * ถูกสร้างโดยระบบ ไม่ควรให้แก้หรือ submit จากหน้า GL
 */
export function isSubledgerJournal(journal: {
  source_type?: string | null;
  source_ref_type?: string | null;
}): boolean {
  if (journal.source_ref_type) return true;
  if (!journal.source_type) return false;
  return !GL_NATIVE_SOURCES.has(journal.source_type);
}

export function isSourceGenerated(
  journal: Pick<
    JournalVoucher,
    "is_source_generated" | "source_type" | "source_ref_type"
  >,
): boolean {
  if (typeof journal.is_source_generated === "boolean")
    return journal.is_source_generated;
  return isSubledgerJournal(journal);
}

export function sourceDocumentHref(
  journal: Pick<JournalVoucher, "source_type" | "source_id">,
): string | null {
  if (!journal.source_id) return null;
  if (journal.source_type === "ap_invoice")
    return `/accounts-payable/invoice/${journal.source_id}`;
  if (journal.source_type === "ap_payment")
    return `/accounts-payable/payment/${journal.source_id}`;
  return null;
}

export function sourceLinksForJournal(
  journal: Pick<
    JournalVoucher,
    "source_links" | "source_type" | "source_id" | "source_no"
  >,
): JournalVoucherSourceLink[] {
  if (journal.source_links?.length) return journal.source_links;
  const href = sourceDocumentHref(journal);
  if (!journal.source_type || journal.source_type === "manual") return [];
  return [
    {
      kind: journal.source_type,
      label: journal.source_no ?? journal.source_id ?? journal.source_type,
      href,
    },
  ];
}

export function journalVoucherCapabilities(
  journal: JournalVoucher,
): JournalVoucherCapabilities {
  if (journal.capabilities) return journal.capabilities;
  const generated = isSourceGenerated(journal);
  // ปุ่มของผู้อนุมัติมาจาก backend ล้วน ๆ (`allowed_actions` ว่างเมื่อไม่ใช่ in_review)
  const allowed = generated ? [] : (journal.allowed_actions ?? []);
  const isDraft = journal.jv_status === "draft";
  // ไม่มี jv_no (ใบที่เพิ่งสร้าง) ถือเป็นเลขร่าง — ลบได้ ยังไม่ต้อง void
  const hasRealNo = !!journal.jv_no && !isDraftDocNo(journal.jv_no);
  return {
    can_edit_accounting_fields:
      !generated && editableStatuses.has(journal.jv_status),
    can_submit: !generated && journal.jv_status === "draft",
    can_approve: allowed.includes("approve"),
    can_reject: allowed.includes("reject"),
    can_send_back: allowed.includes("sendback"),
    can_delete: !generated && isDraft && !hasRealNo,
    can_void_draft: !generated && isDraft && hasRealNo,
    // backend voidJv รับเฉพาะใบ posted ที่ยังไม่ถูกกลับรายการ
    can_void:
      !generated &&
      journal.jv_status === "posted" &&
      !journal.reversed_by_jv_id,
    can_reverse: !generated && journal.jv_status === "posted",
    can_open_source: sourceLinksForJournal(journal).some((link) => link.href),
  };
}

/**
 * เลขที่ JV สำหรับแสดงผล — เลขร่าง `DRAFT-########` แสดงตามที่เก็บ (ไม่มี prefix)
 * ส่วนเลขจริงต่อ prefix ของใบ (ถ้า jv_no ขึ้นต้นด้วย prefix อยู่แล้วไม่ต่อซ้ำ)
 */
export function formatJvNo(prefix: string | null, jvNo: string): string {
  if (isDraftDocNo(jvNo)) return jvNo;
  if (!prefix) return jvNo;
  return jvNo.startsWith(prefix) ? jvNo : `${prefix}-${jvNo}`;
}
