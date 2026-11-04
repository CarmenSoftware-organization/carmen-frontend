import type {
  JournalVoucher,
  JournalVoucherCapabilities,
  JournalVoucherSourceLink,
} from "@/types/journal-voucher";
import { getStageActionFlags } from "@/lib/workflow-stage-actions";
import { STAGE_ROLE } from "@/types/stage-role";
import {
  CHART_OF_ACCOUNT_TYPE,
  type ChartOfAccount,
} from "@/types/chart-of-accounts";

const editableStatuses = new Set(["draft"]);
const voidableStatuses = new Set(["draft", "in_review", "scheduled"]);

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

export function isSourceGenerated(
  journal: Pick<JournalVoucher, "is_source_generated" | "source_type">,
): boolean {
  if (typeof journal.is_source_generated === "boolean")
    return journal.is_source_generated;
  return Boolean(journal.source_type && journal.source_type !== "manual");
}

export function sourceDocumentHref(
  journal: Pick<JournalVoucher, "source_type" | "source_id">,
): string | null {
  if (!journal.source_id) return null;
  if (journal.source_type === "ap_invoice")
    return `/accounting/accounts-payable/invoice/${journal.source_id}`;
  if (journal.source_type === "ap_payment")
    return `/accounting/accounts-payable/payment/${journal.source_id}`;
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
  // อนุมัติ/ตีกลับได้ต่อเมื่อ backend บอกว่าผู้ใช้ลงมือที่ขั้นนี้ได้ (role) และขั้นนั้นเปิดปุ่ม
  const canAct =
    !generated &&
    journal.jv_status === "in_review" &&
    journal.role === STAGE_ROLE.APPROVE;
  const flags = getStageActionFlags(journal.stage_actions);
  return {
    can_edit_accounting_fields:
      !generated && editableStatuses.has(journal.jv_status),
    can_submit: !generated && journal.jv_status === "draft",
    can_approve: canAct && flags.approve,
    can_reject: canAct && flags.reject,
    can_void: !generated && voidableStatuses.has(journal.jv_status),
    can_reverse: !generated && journal.jv_status === "posted",
    can_open_source: sourceLinksForJournal(journal).some((link) => link.href),
  };
}
