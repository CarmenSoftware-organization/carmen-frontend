import { useQuery } from "@tanstack/react-query";
import { API_ENDPOINTS } from "@/constant/api-endpoints";
import { QUERY_KEYS } from "@/constant/query-keys";
import { useBuCode } from "@/hooks/use-bu-code";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { useXlsxExport, type XlsxColumn } from "@/hooks/use-xlsx-export";
import { ApiError } from "@/lib/api-error";
import { buildUrl } from "@/lib/build-query-string";
import { httpClient } from "@/lib/http-client";
import { fetchAllPages } from "@/lib/fetch-all-pages";
import type { PaginatedResponse, ParamsDto } from "@/types/params";
import type {
  ArAmount,
  ArInvoiceCreateInput,
  ArInvoiceLineRecord,
  ArInvoiceUpdateInput,
} from "./ar-invoice-draft-model";
import type { PreviousStage } from "../shared/send-back-fields";

export const AR_STATUS = ["draft", "in_review", "posted", "void"] as const;
export const AR_TYPES = [
  "invoice",
  "credit_note",
  "debit_note",
  "deposit",
] as const;
export const AR_REGISTER_PATH = "/accounts-receivable/invoice";
const QUERY_KEY = "ar-invoice";

export interface ArRegisterRow {
  id: string;
  doc_no: string;
  doc_type: (typeof AR_TYPES)[number];
  doc_status: (typeof AR_STATUS)[number];
  doc_date: string;
  due_date: string;
  customer_code: string;
  customer_name: string;
  currency_code: string;
  total_amount: ArAmount;
  outstanding_amount: ArAmount;
  exchange_rate?: ArAmount;
  reference_applied_amount?: ArAmount;
}

export type ArWorkflowAction = "approve" | "reject" | "sendback";

export interface ArRegisterDocument extends ArRegisterRow {
  doc_version?: number | null;
  customer_id: string;
  is_pms_folio?: boolean;
  description?: string | null;
  source_doc_ref?: string | null;
  doc_source?: string;
  credit_term_days?: number;
  currency_id?: string;
  exchange_rate?: ArAmount;
  base_currency_code?: string;
  sub_total_amount?: ArAmount;
  base_total_amount?: ArAmount;
  discount_amount?: ArAmount;
  tax2_amount?: ArAmount;
  is_tax_invoice?: boolean;
  is_wht_recorded?: boolean;
  wht_amount?: ArAmount;
  workflow_current_stage?: string | null;
  workflow_name?: string | null;
  allowed_actions?: ArWorkflowAction[];
  user_action?: { execute?: boolean } | null;
  net_amount: ArAmount;
  vat_amount: ArAmount;
  gl_jv_id?: string | null;
  gl_jv_no?: string | null;
  tax_invoice?: {
    tax_invoice_no: string;
    tax_invoice_date: string;
    status: string;
    customer_registered_name?: string;
    customer_tax_no?: string | null;
    customer_branch_no?: string | null;
    address_line1?: string | null;
    address_line2?: string | null;
    province?: string | null;
    postal_code?: string | null;
    base_amount?: ArAmount;
    vat_rate?: ArAmount;
    vat_amount?: ArAmount;
    total_amount?: ArAmount;
  } | null;
  tb_ar_invoice_detail?: ArInvoiceLineRecord[];
  tb_ar_invoice_reference?: {
    ref_ar_invoice_id: string;
    ref_ar_invoice_no?: string | null;
    applied_amount: ArAmount;
    applied_net_amount?: ArAmount;
    applied_vat_amount?: ArAmount;
    realized_fx_amount?: ArAmount;
    remarks?: string | null;
  }[];
}

async function readAr(url: string) {
  const response = await httpClient.get(url);
  if (!response.ok)
    throw await ApiError.from(response, "Unable to load AR invoices");
  return response.json();
}

export function useArRegister(
  params: ParamsDto,
  options?: { enabled?: boolean },
) {
  const bu = useBuCode();
  return useQuery({
    queryKey: [QUERY_KEY, bu, "list", params],
    enabled: !!bu && options?.enabled !== false,
    queryFn: () => fetchArRegister(bu!, params),
  });
}

async function fetchArRegister(
  bu: string,
  params: ParamsDto,
): Promise<PaginatedResponse<ArRegisterRow>> {
  const body = await readAr(
    buildUrl(API_ENDPOINTS.AR_INVOICE_LIST(bu), params),
  );
  if (!Array.isArray(body.data) || typeof body.paginate?.total !== "number")
    throw new Error("Invalid AR invoice list response");
  return body;
}

export function useExportArRegister() {
  const bu = useBuCode();
  const { exportToXlsx, isExporting } = useXlsxExport();
  return {
    isExporting,
    exportInvoices: (params: ParamsDto, columns: XlsxColumn<ArRegisterRow>[]) =>
      exportToXlsx({
        fetch: () =>
          fetchAllPages((page, perpage) =>
            fetchArRegister(bu!, { ...params, page, perpage }),
          ),
        columns,
        sheetName: "AR Invoices",
        fileNamePrefix: "ar-invoice",
      }),
  };
}

export function useArRegisterDocument(id?: string) {
  const bu = useBuCode();
  return useQuery({
    queryKey: [QUERY_KEY, bu, "document", id],
    enabled: !!bu && !!id,
    queryFn: async (): Promise<ArRegisterDocument> => {
      const body = await readAr(
        `${API_ENDPOINTS.AR_INVOICE_LIST(bu!)}/${encodeURIComponent(id!)}`,
      );
      if (body.data?.id !== id) throw new Error("Invalid AR invoice response");
      return body.data;
    },
  });
}

export function useCreateArInvoice() {
  return useApiMutation<ArInvoiceCreateInput, { data: { id: string } }>({
    mutationFn: (body, bu) =>
      httpClient.post(API_ENDPOINTS.AR_INVOICE_LIST(bu), body),
    invalidateKeys: [QUERY_KEY],
    errorMessage: "Unable to create AR invoice",
    meta: { preferServerMessage: true },
  });
}

export function useUpdateArInvoice() {
  return useApiMutation<ArInvoiceUpdateInput & { id: string }>({
    mutationFn: ({ id, ...body }, bu) =>
      httpClient.put(
        `${API_ENDPOINTS.AR_INVOICE_LIST(bu)}/${encodeURIComponent(id)}`,
        body,
      ),
    invalidateKeys: [QUERY_KEY],
    errorMessage: "Unable to update AR invoice",
    meta: { preferServerMessage: true },
  });
}

export function useDeleteArInvoice() {
  return useApiMutation<string>({
    mutationFn: (id, bu) =>
      httpClient.delete(
        `${API_ENDPOINTS.AR_INVOICE_LIST(bu)}/${encodeURIComponent(id)}`,
      ),
    invalidateKeys: [QUERY_KEY],
    errorMessage: "Unable to delete AR invoice",
    meta: { preferServerMessage: true },
  });
}

export type ArInvoiceAction =
  "submit" | "approve" | "review" | "reject" | "void";

export function useArInvoiceAction() {
  return useApiMutation<{
    id: string;
    action: ArInvoiceAction;
    doc_version?: number;
    reason?: string;
    stage?: string;
  }>({
    mutationFn: ({ id, action, ...body }, bu) =>
      httpClient.post(
        `${API_ENDPOINTS.AR_INVOICE_LIST(bu)}/${encodeURIComponent(id)}/${action}`,
        body,
      ),
    invalidateKeys: [QUERY_KEY, "ar-receipt"],
    errorMessage: "Unable to update AR invoice status",
    meta: { preferServerMessage: true },
  });
}

/** ขั้นก่อนหน้าที่ส่งกลับได้ — โหลดเมื่อเปิด dialog ส่งกลับเท่านั้น */
export function useArInvoicePreviousStages(
  id: string | undefined,
  enabled: boolean,
) {
  const bu = useBuCode();
  return useQuery<PreviousStage[]>({
    queryKey: [QUERY_KEYS.AR_INVOICE_PREVIOUS_STAGES, bu, id],
    queryFn: async () => {
      const res = await httpClient.get(
        API_ENDPOINTS.AR_INVOICE_PREVIOUS_STAGES(bu!, id!),
      );
      if (!res.ok) throw new Error("Failed to fetch previous stages");
      const json = await res.json();
      return Object.entries(json.data ?? {}).map(([key, name]) => ({
        key,
        name: name as string,
      }));
    },
    enabled: !!bu && !!id && enabled,
  });
}
