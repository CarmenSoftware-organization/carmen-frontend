import type { JournalVoucherStatus } from "@/types/journal-voucher";
import type { PaginatedResponse, ParamsDto } from "@/types/params";
import { addDecimal, compareDecimal } from "../accounts-payable/shared/ap-decimal";
import type {
  JournalVoucher,
  JournalVoucherAction,
  JournalVoucherInput,
  JournalVoucherLine,
} from "@/types/journal-voucher";
import type {
  JournalVoucherCommand,
  JournalVoucherRepository,
} from "./journal-voucher-repository";
import {
  isSourceGenerated,
  journalVoucherCapabilities,
  sourceLinksForJournal,
} from "./journal-voucher-source";

const stateByBu = new Map<string, JournalVoucher[]>();
const clone = <T>(value: T): T => structuredClone(value);

const line = (
  id: string,
  code: string,
  name: string,
  debit: string,
  credit: string,
): JournalVoucherLine => ({
  id,
  sequence_no: Number(id),
  account_id: id,
  account_code: code,
  account_name: name,
  department_id: null,
  department_code: null,
  department_name: null,
  comment: null,
  currency_id: "THB",
  currency_code: "THB",
  exchange_rate: "1",
  rate_date: null,
  rate_type: null,
  rate_source: "mock",
  debit,
  credit,
  base_debit: debit,
  base_credit: credit,
  dimension: [],
});

const seed = (): JournalVoucher[] => [
  {
    id: "mock-jv-001",
    doc_version: 1,
    display_no: "JV-2026-0001",
    jv_no: "JV-2026-0001",
    draft_reference: "DRAFT-0001",
    jv_status: "posted",
    jv_date: "2026-08-31",
    journal_date: "2026-08-31",
    journal_type: "AP",
    jv_type: "AP",
    prefix: "JV",
    description: "AP invoice posting",
    note: null,
    functional_currency_id: "THB",
    base_currency_id: "THB",
    source_system: "accounts_payable",
    source_type: "ap_invoice",
    source_id: "ap-1",
    source_no: "AP-2026-0001",
    source_version: 1,
    event_type: "post",
    posting_rule_code: "AP_INVOICE_STANDARD",
    is_source_generated: true,
    posting_event_id: "posting-ap-1-v1",
    generated_revision: 1,
    schedule_post: false,
    scheduled_post_at: null,
    auto_reverse: false,
    reverse_date: null,
    total_debit: "12500.00",
    total_credit: "12500.00",
    lines: [
      line("1", "6100", "Expense", "11682.24", "0"),
      line("2", "1150", "Input VAT", "817.76", "0"),
      line("3", "2110", "Trade accounts payable", "0", "12500.00"),
    ],
  },
  {
    id: "mock-jv-002",
    doc_version: 1,
    display_no: "DRAFT-0002",
    jv_no: null,
    draft_reference: "DRAFT-0002",
    jv_status: "draft",
    jv_date: "2026-09-01",
    journal_date: "2026-09-01",
    journal_type: "GJ",
    jv_type: "GJ",
    prefix: "JV",
    description: "Office supplies purchase",
    note: "Mock manual draft",
    functional_currency_id: "THB",
    base_currency_id: "THB",
    source_system: "general_ledger",
    source_type: "manual",
    source_id: null,
    source_no: null,
    source_version: null,
    event_type: "manual",
    posting_rule_code: null,
    is_source_generated: false,
    schedule_post: true,
    scheduled_post_at: "2026-09-02T09:00:00Z",
    auto_reverse: false,
    reverse_date: null,
    total_debit: "3200.00",
    total_credit: "3200.00",
    lines: [
      line("1", "6200", "Office supplies", "3200.00", "0"),
      line("2", "1100", "Cash", "0", "3200.00"),
    ],
  },
];

function withDerivedFields(journal: JournalVoucher): JournalVoucher {
  const normalized = {
    ...journal,
    is_source_generated: isSourceGenerated(journal),
    source_links: sourceLinksForJournal(journal),
  };
  return {
    ...normalized,
    capabilities: journalVoucherCapabilities(normalized),
  };
}

function state(buCode: string): JournalVoucher[] {
  if (!stateByBu.has(buCode)) stateByBu.set(buCode, seed());
  return stateByBu.get(buCode)!;
}

function replace(buCode: string, journal: JournalVoucher): void {
  stateByBu.set(
    buCode,
    state(buCode).map((item) => (item.id === journal.id ? journal : item)),
  );
}

function assertVersion(actual: number, expected: number): void {
  if (actual !== expected)
    throw new Error("Document was changed by another user");
}

function assertCommandAllowed(
  journal: JournalVoucher,
  command: JournalVoucherCommand,
): void {
  const capability = journalVoucherCapabilities(journal);
  const allowed =
    command === "submit"
      ? capability.can_submit
      : command === "approve"
        ? capability.can_approve
        : command === "reject"
          ? capability.can_reject
          : command === "void"
            ? capability.can_void
            : command === "reverse"
              ? capability.can_reverse
              : journal.jv_status === "scheduled";
  if (!allowed) throw new Error(`Cannot ${command} this Journal Voucher`);
}

function toJournalLines(
  input: JournalVoucherInput,
  current: JournalVoucherLine[] = [],
): JournalVoucherLine[] {
  return input.lines.map((item, index) => ({
    ...item,
    id: current[index]?.id ?? `${index + 1}`,
    sequence_no: index + 1,
    account_code: current[index]?.account_code ?? null,
    account_name: current[index]?.account_name ?? null,
    department_code: current[index]?.department_code ?? null,
    department_name: current[index]?.department_name ?? null,
    currency_code: current[index]?.currency_code ?? null,
    base_debit: item.debit,
    base_credit: item.credit,
  }));
}

function journalTotals(lines: JournalVoucherLine[]) {
  return {
    total_debit: addDecimal(lines.map((item) => item.base_debit)),
    total_credit: addDecimal(lines.map((item) => item.base_credit)),
  };
}

export const journalVoucherMockRepository: JournalVoucherRepository = {
  async list(buCode, params?: ParamsDto) {
    const search = String(params?.search ?? "").toLowerCase();
    const filter = String(params?.filter ?? "");
    const status = filter.startsWith("status:") ? filter.slice(7) : "";
    const data = state(buCode)
      .filter(
        (item) =>
          (!status || item.jv_status === status) &&
          (!search ||
            `${item.display_no} ${item.description} ${item.source_type}`
              .toLowerCase()
              .includes(search)),
      )
      .map(withDerivedFields);
    return clone({
      data,
      paginate: {
        page: 1,
        perpage: data.length,
        total: data.length,
        pages: 1,
      },
    } satisfies PaginatedResponse<JournalVoucher>);
  },

  async get(buCode, id) {
    const journal = state(buCode).find((item) => item.id === id);
    return journal ? clone(withDerivedFields(journal)) : null;
  },

  async create(buCode, input) {
    const rows = state(buCode);
    const draftReference = `DRAFT-${String(rows.length + 1).padStart(4, "0")}`;
    const journal: JournalVoucher = {
      ...input,
      id: `mock-jv-${Date.now()}`,
      doc_version: 1,
      display_no: draftReference,
      jv_no: null,
      draft_reference: draftReference,
      jv_status: "draft",
      jv_date: input.journal_date,
      jv_type: input.journal_type,
      base_currency_id: input.functional_currency_id,
      ...journalTotals(toJournalLines(input)),
        is_source_generated: isSourceGenerated({
        source_type: input.source_type,
        is_source_generated: undefined,
      }),
      lines: toJournalLines(input),
    };
    stateByBu.set(buCode, [journal, ...rows]);
    return clone(withDerivedFields(journal));
  },

  async update(buCode, id, docVersion, input) {
    const current = state(buCode).find((item) => item.id === id);
    if (!current) throw new Error("Journal Voucher not found");
    assertVersion(current.doc_version, docVersion);
    if (!journalVoucherCapabilities(current).can_edit_accounting_fields)
      throw new Error("Source-generated Journal Vouchers are read-only in GL");
    const next: JournalVoucher = {
      ...current,
      ...input,
      doc_version: current.doc_version + 1,
      jv_date: input.journal_date,
      base_currency_id: input.functional_currency_id,
      lines: toJournalLines(input, current.lines),
      ...journalTotals(toJournalLines(input, current.lines)),
    };
    replace(buCode, next);
    return clone(withDerivedFields(next));
  },

  async action(buCode, id, command, input: JournalVoucherAction) {
    const current = state(buCode).find((item) => item.id === id);
    if (!current) throw new Error("Journal Voucher not found");
    assertVersion(current.doc_version, input.doc_version);
    assertCommandAllowed(current, command);
    if (
      command === "submit" &&
      (current.lines.length === 0 ||
        compareDecimal(current.total_debit, current.total_credit) !== 0)
    )
      throw new Error("Journal Voucher must be balanced before Submit");
    // mock ไม่มี workflow — submit แล้วลงบัญชีทันที
    const status: JournalVoucherStatus =
      command === "submit" || command === "approve"
        ? "posted"
        : command === "reject"
          ? "draft"
          : command === "void"
            ? "void"
            : current.jv_status;
    const next = {
      ...current,
      jv_status: status,
      doc_version: current.doc_version + 1,
    } as JournalVoucher;
    replace(buCode, next);
    return clone(withDerivedFields(next));
  },

  async copy(buCode, id) {
    const current = state(buCode).find((item) => item.id === id);
    if (!current) throw new Error("Journal Voucher not found");
    if (isSourceGenerated(current))
      throw new Error("Copy the source document instead of its generated JV");
    return this.create(buCode, {
      ...current,
      source_system: "general_ledger",
      source_type: "manual",
      source_id: null,
      source_no: null,
      source_version: null,
      event_type: "manual",
      posting_rule_code: null,
      description: `Copy of ${current.description}`,
      lines: current.lines,
    });
  },

  async remove(buCode, id) {
    const current = state(buCode).find((item) => item.id === id);
    if (!current) throw new Error("Journal Voucher not found");
    if (current.jv_status !== "draft")
      throw new Error("Only a draft Journal Voucher can be deleted");
    stateByBu.set(
      buCode,
      state(buCode).filter((item) => item.id !== id),
    );
  },
};

export function clearJournalVoucherMockState(): void {
  stateByBu.clear();
}
