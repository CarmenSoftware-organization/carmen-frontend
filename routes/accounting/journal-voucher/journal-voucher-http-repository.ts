import type { PaginatedResponse, ParamsDto } from "@/types/params";
import type {
  JournalVoucher,
  JournalVoucherAction,
  JournalVoucherInput,
  JournalVoucherLine,
  JournalVoucherLineInput,
  JournalVoucherSourceType,
  JournalVoucherStatus,
} from "@/types/journal-voucher";
import { httpClient } from "@/lib/http-client";
import { buildUrl } from "@/lib/build-query-string";
import { API_ENDPOINTS } from "@/constant/api-endpoints";
import { ApiError } from "@/lib/api-error";
import type {
  JournalVoucherCommand,
  JournalVoucherRepository,
} from "./journal-voucher-repository";
import { journalVoucherMockRepository } from "./journal-voucher-mock-repository";
import { journalVoucherCapabilities } from "./journal-voucher-source";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function resolvePrefixId(
  buCode: string,
  prefixCode?: string,
): Promise<string> {
  try {
    const res = await httpClient.get(API_ENDPOINTS.GL_JV_PREFIXES(buCode));
    if (res.ok) {
      const json = await res.json();
      const prefixes: Array<{ id: string; code?: string }> = Array.isArray(json)
        ? json
        : (json?.data ?? []);
      if (prefixes.length > 0) {
        if (prefixCode) {
          const match = prefixes.find(
            (p) =>
              p.code?.toLowerCase() === prefixCode.toLowerCase() ||
              p.id === prefixCode,
          );
          if (match?.id) return match.id;
        }
        return prefixes[0].id;
      }
    }
  } catch {
    // ignore
  }
  if (prefixCode && UUID_REGEX.test(prefixCode)) {
    return prefixCode;
  }
  throw new Error(
    "No JV Prefix configured for this Business Unit. Please create a JV Prefix in Configuration first.",
  );
}

async function resolveChartOfAccountId(
  buCode: string,
  accountCodeOrId: string,
): Promise<string> {
  if (UUID_REGEX.test(accountCodeOrId)) {
    return accountCodeOrId;
  }
  try {
    const res = await httpClient.get(
      `${API_ENDPOINTS.CHART_OF_ACCOUNTS(buCode)}?perpage=100`,
    );
    if (res.ok) {
      const json = await res.json();
      const coas: Array<{ id: string; code?: string; is_active?: boolean }> =
        Array.isArray(json) ? json : (json?.data ?? []);
      if (coas.length > 0) {
        const match = coas.find(
          (c) =>
            c.code === accountCodeOrId ||
            c.id === accountCodeOrId ||
            c.code?.toLowerCase() === accountCodeOrId?.toLowerCase(),
        );
        if (match?.id) return match.id;
        const active = coas.find((c) => c.is_active);
        if (active?.id) return active.id;
        if (coas[0]?.id) return coas[0].id;
      }
    }
  } catch {
    // ignore
  }
  throw new Error(
    `Account "${accountCodeOrId}" is not a valid Chart of Accounts entry. Please select an active account from the system.`,
  );
}

interface CostCenterLookupItem {
  id: string;
  code?: string;
  name?: string;
  is_active?: boolean;
}

let costCenterCache: {
  buCode: string;
  items: CostCenterLookupItem[];
  timestamp: number;
} | null = null;

async function getCostCenterLookup(
  buCode: string,
): Promise<CostCenterLookupItem[]> {
  const now = Date.now();
  if (
    costCenterCache &&
    costCenterCache.buCode === buCode &&
    now - costCenterCache.timestamp < 60000
  ) {
    return costCenterCache.items;
  }
  let items: CostCenterLookupItem[] = [];
  try {
    const res = await httpClient.get(
      `${API_ENDPOINTS.GL_COST_CENTERS(buCode)}?perpage=100`,
    );
    if (res.ok) {
      const json = await res.json();
      const list = Array.isArray(json) ? json : (json?.data ?? []);
      if (list.length > 0) items = list;
    }
  } catch {
    // ignore
  }
  costCenterCache = { buCode, items, timestamp: now };
  return items;
}

async function resolveDepartmentId(
  buCode: string,
  departmentCodeOrId?: string | null,
): Promise<string | null> {
  if (!departmentCodeOrId) return null;
  if (UUID_REGEX.test(departmentCodeOrId)) {
    return departmentCodeOrId;
  }
  const items = await getCostCenterLookup(buCode);
  if (items.length > 0) {
    const match = items.find(
      (d) =>
        d.id === departmentCodeOrId ||
        d.code === departmentCodeOrId ||
        d.code?.toLowerCase() === departmentCodeOrId?.toLowerCase(),
    );
    if (match?.id) return match.id;
  }
  return null;
}

async function buildLineRequests(
  buCode: string,
  lines: JournalVoucherLineInput[] = [],
  fallbackDescription?: string,
): Promise<Array<Record<string, unknown>>> {
  return Promise.all(
    lines.map(async (line, idx) => {
      const coaId = await resolveChartOfAccountId(buCode, line.account_id);
      const debitNum = Number(line.debit) || 0;
      const creditNum = Number(line.credit) || 0;

      const lineObj: Record<string, unknown> = {
        sequence_no: idx + 1,
        chart_of_accounts_id: coaId,
        debit: debitNum > 0 ? debitNum : 0,
        credit: creditNum > 0 ? creditNum : 0,
      };

      const deptId = await resolveDepartmentId(buCode, line.department_id);
      if (deptId) {
        lineObj.cost_center_id = deptId;
      }
      if (line.currency_id && UUID_REGEX.test(line.currency_id)) {
        lineObj.currency_id = line.currency_id;
      }
      if (line.exchange_rate) {
        lineObj.exchange_rate = Number(line.exchange_rate) || 1;
      }
      if (line.comment || fallbackDescription) {
        lineObj.description = line.comment || fallbackDescription;
      }
      if (line.dimension.length > 0) {
        lineObj.dimensions = line.dimension.map((item) => ({
          gl_dimension_id: item.dimension_id,
          gl_dimension_value_id: item.dimension_value_id,
        }));
      }

      return lineObj;
    }),
  );
}

export const httpJournalVoucherRepository: JournalVoucherRepository = {
  async list(
    buCode: string,
    params?: ParamsDto,
  ): Promise<PaginatedResponse<JournalVoucher>> {
    // ส่ง page/perpage/search/filter/sort ตรงตามชื่อที่ PaginateQuery ของ gateway อ่าน
    // — เดิมส่ง `limit` (backend ไม่รู้จัก) และไม่ส่ง filter/sort เลย ตัวกรองจึงไม่เคยมีผล
    const url = buildUrl(API_ENDPOINTS.GL_JV_LIST(buCode), params);
    const res = await httpClient.get(url);

    if (!res.ok) {
      throw await ApiError.from(res, "Failed to fetch journal vouchers");
    }

    const json = await res.json();
    const items: JournalVoucher[] = Array.isArray(json)
      ? json
      : Array.isArray(json?.data)
        ? json.data
        : [];

    const total =
      typeof json?.total === "number"
        ? json.total
        : typeof json?.paginate?.total === "number"
          ? json.paginate.total
          : typeof json?.meta?.total === "number"
            ? json.meta.total
            : items.length;

    const pageNum = Number(params?.page) || 1;
    const perPageNum = Number(params?.perpage) || 20;

    const mappedItems: JournalVoucher[] = items.map((item) => {
      const raw = item as unknown as Record<string, unknown>;
      const rawJvNo = typeof raw.jv_no === "string" && raw.jv_no.trim() ? raw.jv_no.trim() : null;
      const rawPrefix = typeof raw.prefix_code === "string" && raw.prefix_code.trim() ? raw.prefix_code.trim() : null;
      const rawDraftRef = typeof raw.draft_reference === "string" && raw.draft_reference.trim() ? raw.draft_reference.trim() : null;
      const rawId = String(raw.id ?? "");
      const shortId = rawId ? rawId.slice(0, 8) : "";

      let displayNo = "";
      if (rawPrefix && rawJvNo) {
        displayNo = rawJvNo.startsWith(rawPrefix) ? rawJvNo : `${rawPrefix}-${rawJvNo}`;
      } else if (rawJvNo) {
        displayNo = rawJvNo;
      } else if (rawDraftRef) {
        displayNo = rawDraftRef;
      } else if (typeof raw.display_no === "string" && raw.display_no.trim()) {
        displayNo = raw.display_no.trim();
      } else if (rawPrefix) {
        displayNo = `${rawPrefix}-DRAFT${shortId ? ` (${shortId})` : ""}`;
      } else {
        displayNo = shortId ? `Draft (${shortId})` : "—";
      }

      return {
        ...item,
        id: rawId,
        prefix: rawPrefix ?? (typeof raw.prefix === "string" ? raw.prefix : "JV"),
        display_no: displayNo,
        jv_no: rawJvNo,
        draft_reference: rawDraftRef ?? (rawJvNo ?? (shortId ? `DRAFT-${shortId}` : "DRAFT")),
        jv_status: (raw.jv_status as JournalVoucherStatus) ?? "draft",
        jv_date: typeof raw.jv_date === "string" ? raw.jv_date : new Date().toISOString(),
        total_debit: String(raw.total_debit ?? 0),
        total_credit: String(raw.total_credit ?? 0),
        source_type: (raw.source as JournalVoucherSourceType) ?? (raw.source_type as JournalVoucherSourceType) ?? "manual",
        capabilities: journalVoucherCapabilities(item),
      };
    });

    return {
      data: mappedItems,
      paginate: {
        total,
        page: pageNum,
        perpage: perPageNum,
        pages: Math.ceil(total / perPageNum) || 1,
      },
    };
  },

  async get(buCode: string, id: string): Promise<JournalVoucher | null> {
    if (id.startsWith("mock-")) {
      return journalVoucherMockRepository.get(buCode, id);
    }
    const res = await httpClient.get(API_ENDPOINTS.GL_JV_DETAIL(buCode, id));
    if (!res.ok) {
      if (res.status === 404) return null;
      throw await ApiError.from(res, `Failed to fetch journal voucher ${id}`);
    }
    const json = await res.json();
    const raw = json?.data ?? json;
    if (!raw || !raw.id) return null;

    interface RawLine {
      id?: string;
      sequence_no?: number;
      chart_of_accounts_id?: string;
      account_id?: string;
      account_code?: string | null;
      account_name?: string | null;
      cost_center_id?: string | null;
      cost_center_code?: string | null;
      cost_center_name?: string | null;
      department_id?: string | null;
      department_code?: string | null;
      department_name?: string | null;
      description?: string | null;
      comment?: string | null;
      currency_id?: string;
      currency_code?: string | null;
      exchange_rate?: number | string;
      debit?: number | string;
      credit?: number | string;
      base_debit?: number | string;
      base_credit?: number | string;
      tb_gl_jv_detail_dimension?: Array<{
        gl_dimension_id: string;
        gl_dimension_value_id: string;
      }>;
    }

    const rawLines: RawLine[] = Array.isArray(raw.tb_gl_jv_detail)
      ? raw.tb_gl_jv_detail
      : Array.isArray(raw.lines)
        ? raw.lines
        : [];

    const costCenters = await getCostCenterLookup(buCode);

    const mappedLines: JournalVoucherLine[] = rawLines.map(
      (l, idx) => {
        const ccId = l.cost_center_id ?? l.department_id ?? null;
        const matched = ccId
          ? costCenters.find((c) => c.id === ccId || c.code === ccId)
          : null;
        return {
          id: l.id ?? `line-${idx + 1}`,
          sequence_no: l.sequence_no ?? idx + 1,
          account_id: l.chart_of_accounts_id ?? l.account_id ?? "",
          account_code: l.account_code ?? null,
          account_name: l.account_name ?? null,
          department_id: ccId,
          department_code:
            l.cost_center_code ?? l.department_code ?? matched?.code ?? null,
          department_name:
            l.cost_center_name ?? l.department_name ?? matched?.name ?? null,
          comment: l.description ?? l.comment ?? null,
          currency_id: l.currency_id ?? "THB",
          currency_code: l.currency_code ?? "THB",
          exchange_rate: String(l.exchange_rate ?? 1),
          rate_date: null,
          rate_type: null,
          rate_source: null,
          debit: String(l.debit ?? 0),
          credit: String(l.credit ?? 0),
          base_debit: String(l.base_debit ?? l.debit ?? 0),
          base_credit: String(l.base_credit ?? l.credit ?? 0),
          dimension: (l.tb_gl_jv_detail_dimension ?? []).map((item) => ({
            dimension_id: item.gl_dimension_id,
            dimension_value_id: item.gl_dimension_value_id,
          })),
        };
      },
    );

    const doc: JournalVoucher = {
      id: raw.id,
      doc_version: raw.doc_version ?? 0,
      display_no: raw.jv_no ?? raw.display_no ?? "JV-DRAFT",
      jv_no: raw.jv_no ?? null,
      draft_reference: raw.draft_reference ?? raw.jv_no ?? "DRAFT",
      jv_status: raw.jv_status ?? "draft",
      jv_date: raw.jv_date ?? new Date().toISOString(),
      journal_date: raw.jv_date
        ? String(raw.jv_date).slice(0, 10)
        : new Date().toISOString().slice(0, 10),
      journal_type: raw.source ?? "general",
      jv_type: raw.source ?? "general",
      prefix: raw.prefix_code ?? "JV",
      description: raw.description ?? "",
      note: raw.note ?? null,
      functional_currency_id: raw.currency_id ?? "THB",
      base_currency_id: raw.currency_id ?? "THB",
      total_debit: String(raw.total_debit ?? 0),
      total_credit: String(raw.total_credit ?? 0),
      role: typeof raw.role === "string" ? raw.role : undefined,
      stage_actions: raw.stage_actions ?? null,
      workflow_id: raw.workflow_id ?? null,
      workflow_name: raw.workflow_name ?? null,
      workflow_current_stage: raw.workflow_current_stage ?? null,
      workflow_previous_stage: raw.workflow_previous_stage ?? null,
      workflow_next_stage: raw.workflow_next_stage ?? null,
      workflow_history: raw.workflow_history,
      source_system: "general_ledger",
      source_type: (raw.source as JournalVoucherSourceType) ?? "manual",
      source_id: raw.source_id ?? null,
      source_no: raw.source_no ?? null,
      schedule_post: false,
      scheduled_post_at: null,
      auto_reverse: false,
      reverse_date: null,
      is_adjustment: Boolean(raw.is_adjustment),
      lines: mappedLines,
      capabilities: journalVoucherCapabilities(raw),
    };

    return doc;
  },

  async create(
    buCode: string,
    input: JournalVoucherInput,
  ): Promise<JournalVoucher> {
    const prefixId = await resolvePrefixId(buCode, input.prefix);
    const jvDate = input.journal_date
      ? new Date(input.journal_date).toISOString()
      : new Date().toISOString();

    const addLines = await buildLineRequests(
      buCode,
      input.lines,
      input.description,
    );

    const payload: Record<string, unknown> = {
      prefix_id: prefixId,
      jv_date: jvDate,
      is_adjustment: Boolean(input.is_adjustment),
      details: {
        add: addLines,
      },
    };

    if (input.description) {
      payload.description = input.description;
    }
    if (input.note) {
      payload.note = input.note;
    }
    if (
      input.functional_currency_id &&
      UUID_REGEX.test(input.functional_currency_id)
    ) {
      payload.currency_id = input.functional_currency_id;
    }

    const res = await httpClient.post(API_ENDPOINTS.GL_JV_LIST(buCode), payload);
    if (!res.ok) {
      throw await ApiError.from(res, "Failed to create journal voucher");
    }
    const json = await res.json();
    const createdData = json?.data ?? json;
    const newId = createdData?.id;

    if (!newId) {
      throw new Error(
        "Backend did not return an ID for the created Journal Voucher",
      );
    }

    try {
      const fullDoc = await this.get(buCode, newId);
      if (fullDoc && fullDoc.id) return fullDoc;
    } catch {
      // ignore
    }

    return {
      ...input,
      id: newId,
      display_no: createdData?.jv_no ?? "JV-DRAFT",
      jv_no: createdData?.jv_no ?? null,
      draft_reference: createdData?.draft_reference ?? "DRAFT",
      jv_status: "draft",
      doc_version: createdData?.doc_version ?? 0,
      jv_date: input.journal_date ?? new Date().toISOString().slice(0, 10),
      jv_type: input.journal_type ?? "general",
      base_currency_id: input.functional_currency_id ?? "THB",
      total_debit: (input.lines ?? [])
        .reduce((s, l) => s + (Number(l.debit) || 0), 0)
        .toFixed(2),
      total_credit: (input.lines ?? [])
        .reduce((s, l) => s + (Number(l.credit) || 0), 0)
        .toFixed(2),
      source_system: "general_ledger",
      source_type: "manual",
      source_id: null,
      source_no: null,
      lines: (input.lines ?? []).map((line, idx) => ({
        ...line,
        id: `line-${idx + 1}`,
        sequence_no: idx + 1,
        account_code: line.account_id,
        account_name: null,
        department_code: line.department_id,
        department_name: null,
        currency_code: line.currency_id,
        base_debit: line.debit,
        base_credit: line.credit,
      })),
      capabilities: journalVoucherCapabilities({
        id: newId,
        jv_status: "draft",
        source_type: "manual",
      } as unknown as JournalVoucher),
    };
  },

  async update(
    buCode: string,
    id: string,
    docVersion: number,
    input: JournalVoucherInput,
  ): Promise<JournalVoucher> {
    if (id.startsWith("mock-")) {
      return journalVoucherMockRepository.update(buCode, id, docVersion, input);
    }

    const patchPayload: Record<string, unknown> = {
      doc_version: docVersion,
    };
    if (input.journal_date) {
      patchPayload.jv_date = new Date(input.journal_date).toISOString();
    }
    if (input.description !== undefined) {
      patchPayload.description = input.description;
    }
    if (input.note !== undefined) {
      patchPayload.note = input.note;
    }
    if (input.is_adjustment !== undefined) {
      patchPayload.is_adjustment = Boolean(input.is_adjustment);
    }
    if (
      input.functional_currency_id &&
      UUID_REGEX.test(input.functional_currency_id)
    ) {
      patchPayload.currency_id = input.functional_currency_id;
    }
    const res = await httpClient.patch(
      API_ENDPOINTS.GL_JV_DETAIL(buCode, id),
      patchPayload,
    );
    if (!res.ok) {
      throw await ApiError.from(res, `Failed to update journal voucher ${id}`);
    }
    const json = await res.json();
    const data: JournalVoucher = json?.data ?? json;
    try {
      const fullDoc = await this.get(buCode, id);
      if (fullDoc && fullDoc.id) return fullDoc;
    } catch {
      // ignore
    }
    return {
      ...data,
      capabilities: journalVoucherCapabilities(data),
    };
  },

  async action(
    buCode: string,
    id: string,
    action: JournalVoucherCommand,
    input: JournalVoucherAction,
  ): Promise<JournalVoucher> {
    if (id.startsWith("mock-")) {
      return journalVoucherMockRepository.action(buCode, id, action, input);
    }
    let endpoint: string | null = null;
    if (action === "submit") endpoint = API_ENDPOINTS.GL_JV_SUBMIT(buCode, id);
    else if (action === "approve") endpoint = API_ENDPOINTS.GL_JV_APPROVE(buCode, id);
    else if (action === "reject") endpoint = API_ENDPOINTS.GL_JV_REJECT(buCode, id);
    else if (action === "void") endpoint = API_ENDPOINTS.GL_POSTING_VOID(buCode, id);
    else if (action === "reverse") endpoint = API_ENDPOINTS.GL_POSTING_REVERSE(buCode, id);

    if (endpoint) {
      // approve/reject รับ body เฉพาะของตัวเอง (post_at / reason) — ไม่ส่ง doc_version
      const body =
        action === "approve"
          ? { post_at: input.post_at }
          : action === "reject"
            ? { reason: input.reason }
            : input;
      const res = await httpClient.post(endpoint, body);
      if (!res.ok) {
        throw await ApiError.from(
          res,
          `Failed to perform action ${action} on journal voucher ${id}`,
        );
      }
      const json = await res.json();
      const data: JournalVoucher = json?.data ?? json;
      return {
        ...data,
        capabilities: journalVoucherCapabilities(data),
      };
    }
    throw new Error(`Unsupported action: ${action}`);
  },

  async copy(buCode: string, id: string): Promise<JournalVoucher> {
    if (id.startsWith("mock-")) {
      return journalVoucherMockRepository.copy(buCode, id);
    }
    const current = await this.get(buCode, id);
    if (!current) throw new Error("Journal Voucher not found");
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

  async remove(buCode: string, id: string): Promise<void> {
    if (id.startsWith("mock-")) {
      return journalVoucherMockRepository.remove(buCode, id);
    }
    const res = await httpClient.delete(API_ENDPOINTS.GL_JV_DETAIL(buCode, id));
    if (!res.ok) {
      throw await ApiError.from(res, "Failed to delete journal voucher");
    }
  },
};
