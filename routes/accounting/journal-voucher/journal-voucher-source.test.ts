import { describe, expect, it } from "vitest";
import type { JournalVoucher } from "@/types/journal-voucher";
import {
  canUseAccountForManualJournal,
  isSourceGenerated,
  journalVoucherCapabilities,
  sourceDocumentHref,
} from "./journal-voucher-source";
import {
  ACCOUNT_NATURE,
  CHART_OF_ACCOUNT_TYPE,
  type ChartOfAccount,
} from "@/types/chart-of-accounts";

const journal = (patch: Partial<JournalVoucher> = {}): JournalVoucher =>
  ({
    id: "jv-1",
    doc_version: 1,
    display_no: "JV-1",
    jv_no: "JV-1",
    draft_reference: "DRAFT-1",
    jv_status: "draft",
    jv_date: "2026-09-11",
    journal_date: "2026-09-11",
    journal_type: "general",
    jv_type: "general",
    prefix: "JV",
    description: "Test",
    note: null,
    functional_currency_id: "THB",
    base_currency_id: "THB",
    source_type: "manual",
    source_id: null,
    source_no: null,
    schedule_post: false,
    scheduled_post_at: null,
    auto_reverse: false,
    reverse_date: null,
    total_debit: "0.00",
    total_credit: "0.00",
    workflow_enabled_snapshot: false,
    lines: [],
    ...patch,
  }) as JournalVoucher;

describe("Journal Voucher source policy", () => {
  it("excludes subledger control accounts from manual journal selection", () => {
    const account: ChartOfAccount = {
      id: "coa-ap",
      doc_version: 1,
      code: "2100",
      description_1: "Accounts payable control",
      nature: ACCOUNT_NATURE.CREDIT,
      type: CHART_OF_ACCOUNT_TYPE.BALANCE_SHEET,
      category: "liability",
      is_active: true,
      control_account_type: "accounts_payable",
      manual_posting_allowed: false,
    };
    expect(canUseAccountForManualJournal(account)).toBe(false);
    expect(
      canUseAccountForManualJournal({
        ...account,
        id: "coa-expense",
        control_account_type: null,
        manual_posting_allowed: true,
      }),
    ).toBe(true);
  });

  it("allows accounting edits and reversal for a manual journal", () => {
    expect(
      journalVoucherCapabilities(journal()).can_edit_accounting_fields,
    ).toBe(true);
    expect(
      journalVoucherCapabilities(journal({ jv_status: "posted" })).can_reverse,
    ).toBe(true);
  });

  it("keeps a subledger-generated journal immutable in GL", () => {
    const generated = journal({
      source_type: "ap_invoice",
      source_id: "ap-1",
      is_source_generated: true,
      jv_status: "posted",
    });
    expect(isSourceGenerated(generated)).toBe(true);
    expect(journalVoucherCapabilities(generated).can_reverse).toBe(false);
    const draftCapabilities = journalVoucherCapabilities({
      ...generated,
      jv_status: "draft",
    });
    expect(draftCapabilities.can_edit_accounting_fields).toBe(false);
    expect(draftCapabilities.can_submit).toBe(false);
    expect(
      journalVoucherCapabilities({ ...generated, jv_status: "in_review" })
        .can_approve,
    ).toBe(false);
  });

  it("links AP sources back to their owning document", () => {
    expect(
      sourceDocumentHref(
        journal({ source_type: "ap_invoice", source_id: "ap-42" }),
      ),
    ).toBe("/accounting/accounts-payable/invoice/ap-42");
    expect(
      sourceDocumentHref(
        journal({ source_type: "ap_payment", source_id: "pv-7" }),
      ),
    ).toBe("/accounting/accounts-payable/payment/pv-7");
  });
});
