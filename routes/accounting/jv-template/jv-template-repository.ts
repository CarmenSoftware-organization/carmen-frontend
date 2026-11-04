import type { PaginatedResponse, ParamsDto } from "@/types/params";
import { httpClient } from "@/lib/http-client";
import { buildUrl } from "@/lib/build-query-string";
import { API_ENDPOINTS } from "@/constant/api-endpoints";
import { ApiError } from "@/lib/api-error";
import type {
  JvGenerateAllResult,
  JvGenerateResult,
  JvTemplate,
  JvTemplateInput,
  JvTemplateLine,
} from "./jv-template-types";

type Raw = Record<string, unknown>;

const num = (v: unknown): number => Number(v ?? 0) || 0;
const numOrNull = (v: unknown): number | null =>
  v === null || v === undefined || v === "" ? null : Number(v);
const strOrNull = (v: unknown): string | null =>
  v === null || v === undefined || v === "" ? null : String(v);

function mapLine(raw: Raw, idx: number): JvTemplateLine {
  return {
    id: raw.id ? String(raw.id) : undefined,
    sequence_no: Number(raw.sequence_no ?? idx + 1),
    chart_of_accounts_id: String(raw.chart_of_accounts_id ?? ""),
    cost_center_id: strOrNull(raw.cost_center_id),
    description: strOrNull(raw.description),
    debit: num(raw.debit),
    credit: num(raw.credit),
    side: (raw.side as JvTemplateLine["side"]) ?? null,
    allocation_ratio: numOrNull(raw.allocation_ratio),
  };
}

function mapTemplate(raw: Raw): JvTemplate {
  // findOne ส่งบรรทัดใต้ `tb_gl_jv_template_detail` — list ไม่ส่ง
  const rawLines = Array.isArray(raw.tb_gl_jv_template_detail)
    ? (raw.tb_gl_jv_template_detail as Raw[])
    : [];
  return {
    id: String(raw.id),
    doc_version: Number(raw.doc_version ?? 0),
    template_type: raw.template_type as JvTemplate["template_type"],
    code: String(raw.code ?? ""),
    name: String(raw.name ?? ""),
    description: strOrNull(raw.description),
    is_active: Boolean(raw.is_active),
    prefix_id: String(raw.prefix_id ?? ""),
    from_fiscal_year: num(raw.from_fiscal_year),
    from_period_no: num(raw.from_period_no),
    to_fiscal_year: num(raw.to_fiscal_year),
    to_period_no: num(raw.to_period_no),
    frequency_months: numOrNull(raw.frequency_months),
    currency_id: strOrNull(raw.currency_id),
    exchange_rate: numOrNull(raw.exchange_rate),
    allocate_amount: numOrNull(raw.allocate_amount),
    amortize_type: (raw.amortize_type as JvTemplate["amortize_type"]) ?? null,
    start_date: strOrNull(raw.start_date),
    end_date: strOrNull(raw.end_date),
    total_amount: numOrNull(raw.total_amount),
    note: strOrNull(raw.note),
    lines: rawLines.map(mapLine),
  };
}

/** backend ต้องการ ISO 8601 Z — ฟอร์มอาจส่งมาเป็น `YYYY-MM-DD` */
function toIsoDate(v: string | null): string | null {
  if (!v) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? `${v}T00:00:00.000Z` : v;
}

function toLinePayload(
  type: JvTemplateInput["template_type"],
  { id: _id, ...line }: JvTemplateLine,
): Omit<JvTemplateLine, "id"> {
  if (type === "recurring") {
    return { ...line, side: null, allocation_ratio: null };
  }
  return { ...line, debit: 0, credit: 0 };
}

function toPayload(input: JvTemplateInput): Record<string, unknown> {
  const { lines, ...header } = input;
  return {
    ...header,
    start_date: toIsoDate(header.start_date),
    end_date: toIsoDate(header.end_date),
    details: { add: lines.map((l) => toLinePayload(header.template_type, l)) },
  };
}

async function unwrap(res: Response): Promise<unknown> {
  const json = await res.json();
  return json?.data ?? json;
}

export const jvTemplateRepository = {
  async list(
    buCode: string,
    params?: ParamsDto,
  ): Promise<PaginatedResponse<JvTemplate>> {
    const res = await httpClient.get(
      buildUrl(API_ENDPOINTS.GL_JV_TEMPLATES(buCode), params),
    );
    if (!res.ok) throw await ApiError.from(res, "Failed to fetch JV templates");
    const json = await res.json();
    const items: Raw[] = Array.isArray(json)
      ? json
      : Array.isArray(json?.data)
        ? json.data
        : [];
    const total = Number(json?.paginate?.total ?? items.length);
    const page = Number(params?.page) || 1;
    const perpage = Number(params?.perpage) || 20;
    return {
      data: items.map(mapTemplate),
      paginate: {
        total,
        page,
        perpage,
        pages: Math.ceil(total / perpage) || 1,
      },
    };
  },

  async get(buCode: string, id: string): Promise<JvTemplate> {
    const res = await httpClient.get(
      `${API_ENDPOINTS.GL_JV_TEMPLATES(buCode)}/${encodeURIComponent(id)}`,
    );
    if (!res.ok) {
      throw await ApiError.from(res, `Failed to fetch JV template ${id}`);
    }
    return mapTemplate((await unwrap(res)) as Raw);
  },

  async create(buCode: string, input: JvTemplateInput): Promise<{ id: string }> {
    const res = await httpClient.post(
      API_ENDPOINTS.GL_JV_TEMPLATES(buCode),
      toPayload(input),
    );
    if (!res.ok) throw await ApiError.from(res, "Failed to create JV template");
    const data = (await unwrap(res)) as Raw | null;
    if (!data?.id) throw new Error("Backend did not return an ID for the JV template");
    return { id: String(data.id) };
  },

  async update(
    buCode: string,
    id: string,
    docVersion: number,
    input: JvTemplateInput,
  ): Promise<void> {
    const res = await httpClient.patch(
      `${API_ENDPOINTS.GL_JV_TEMPLATES(buCode)}/${encodeURIComponent(id)}`,
      { ...toPayload(input), doc_version: docVersion },
    );
    if (!res.ok) {
      throw await ApiError.from(res, `Failed to update JV template ${id}`);
    }
  },

  async remove(buCode: string, id: string): Promise<void> {
    const res = await httpClient.delete(
      `${API_ENDPOINTS.GL_JV_TEMPLATES(buCode)}/${encodeURIComponent(id)}`,
    );
    if (!res.ok) throw await ApiError.from(res, "Failed to delete JV template");
  },

  async generate(
    buCode: string,
    id: string,
    glPeriodId: string,
  ): Promise<JvGenerateResult> {
    const res = await httpClient.post(
      `${API_ENDPOINTS.GL_JV_TEMPLATES(buCode)}/${encodeURIComponent(id)}/generate`,
      { gl_period_id: glPeriodId },
    );
    if (!res.ok) throw await ApiError.from(res, "Failed to generate JV");
    const data = (await unwrap(res)) as Raw;
    return {
      jv_id: String(data.jv_id),
      jv_no: String(data.jv_no),
      gl_period_id: String(data.gl_period_id),
      amount_total: num(data.amount_total),
    };
  },

  async generateAllDue(
    buCode: string,
    glPeriodId: string,
  ): Promise<JvGenerateAllResult> {
    const res = await httpClient.post(
      `${API_ENDPOINTS.GL_JV_TEMPLATES(buCode)}/generate-all-due`,
      { gl_period_id: glPeriodId },
    );
    if (!res.ok) throw await ApiError.from(res, "Failed to generate JVs");
    const data = (await unwrap(res)) as Partial<JvGenerateAllResult>;
    return {
      generated: data.generated ?? [],
      skipped: data.skipped ?? [],
      failed: data.failed ?? [],
    };
  },
};
