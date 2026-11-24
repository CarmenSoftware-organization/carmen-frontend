import { useQuery } from "@tanstack/react-query";
import { API_ENDPOINTS } from "@/constant/api-endpoints";
import { QUERY_KEYS } from "@/constant/query-keys";
import { useBuCode } from "@/hooks/use-bu-code";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { useXlsxExport, type XlsxColumn } from "@/hooks/use-xlsx-export";
import { fetchAllPages } from "@/lib/fetch-all-pages";
import { ApiError } from "@/lib/api-error";
import { buildUrl } from "@/lib/build-query-string";
import { httpClient } from "@/lib/http-client";
import type { PaginatedResponse, ParamsDto } from "@/types/params";
import type { ArAmount } from "./ar-invoice-draft-model";

export const AR_RECEIPT_STATUS = [
  "draft",
  "in_review",
  "posted",
  "void",
] as const;
export type ArReceiptStatus = (typeof AR_RECEIPT_STATUS)[number];
export type ArReceiptSource = "manual" | "copy" | "interface";
export const AR_RECEIPT_METHODS = [
  "bank_transfer",
  "cheque",
  "cash",
  "credit_card",
  "promptpay",
] as const;
export type ArReceiptMethod = (typeof AR_RECEIPT_METHODS)[number];
export type ArInvoiceDocType =
  "invoice" | "credit_note" | "debit_note" | "deposit";
export type ArReceiptWorkflowAction = "approve" | "reject" | "sendback";

const QUERY_KEY = "ar-receipt";
const INVOICE_QUERY_KEY = "ar-invoice";

export interface ArReceiptRow {
  id: string;
  doc_no: string;
  doc_status: ArReceiptStatus;
  receipt_date: string;
  customer_id?: string;
  customer_code?: string;
  customer_name: string;
  currency_code?: string;
  bank_account_code?: string;
  bank_account_name?: string;
  receipt_method?: ArReceiptMethod;
  net_received_amount: ArAmount;
  total_applied_amount?: ArAmount;
  total_unapplied_amount?: ArAmount;
  doc_source?: ArReceiptSource;
}

export interface ArReceiptDetailRecord {
  id: string;
  ar_invoice_id: string;
  ar_invoice_detail_id: string;
  doc_type: ArInvoiceDocType;
  /** negative for credit-note lines */
  applied_amount: ArAmount;
  invoice_exchange_rate: ArAmount;
  base_applied_at_invoice_rate: ArAmount;
  base_applied_at_receipt_rate: ArAmount;
  realized_fx_amount: ArAmount;
  /** invoice header snapshot joined by findOne (absent on older backends) */
  ar_invoice_doc_no?: string;
  ar_invoice_doc_type?: ArInvoiceDocType;
  ar_invoice_doc_date?: string;
  ar_invoice_net_amount?: ArAmount;
  ar_invoice_vat_amount?: ArAmount;
  ar_invoice_total_amount?: ArAmount;
}

export interface ArReceiptWhtRecord {
  id: string;
  wht_tax_profile_id: string | null;
  wht_tax_profile_name?: string | null;
  pnd_form?: string | null;
  income_type?: string | null;
  base_amount: ArAmount;
  wht_rate: ArAmount;
  wht_amount: ArAmount;
  is_override: boolean;
  wht_certificate_no?: string | null;
  wht_certificate_date?: string | null;
}

export interface ArReceiptTaxInvoice {
  id: string;
  tax_invoice_no: string;
  tax_status: string;
}

export interface ArReceiptDocument extends ArReceiptRow {
  doc_version?: number | null;
  customer_id: string;
  received_date?: string | null;
  currency_id: string;
  base_currency_id?: string;
  base_currency_code?: string;
  exchange_rate: ArAmount;
  bank_account_id: string;
  receipt_method: ArReceiptMethod;
  cheque_no?: string | null;
  cheque_date?: string | null;
  reference_no?: string | null;
  payer_name?: string | null;
  description?: string | null;
  is_tax_invoice?: boolean;
  total_charge_amount?: ArAmount;
  total_wht_amount?: ArAmount;
  base_total_applied_amount?: ArAmount;
  base_total_wht_amount?: ArAmount;
  base_total_charge_amount?: ArAmount;
  base_net_received_amount?: ArAmount;
  base_total_unapplied_amount?: ArAmount;
  realized_fx_amount?: ArAmount;
  doc_source: ArReceiptSource;
  source_doc_ref?: string | null;
  info?: Record<string, unknown> | null;
  gl_jv_id?: string | null;
  gl_jv_no?: string | null;
  void_reason?: string | null;
  void_gl_jv_id?: string | null;
  posted_at?: string | null;
  void_at?: string | null;
  workflow_id?: string | null;
  workflow_name?: string | null;
  workflow_current_stage?: string | null;
  workflow_previous_stage?: string | null;
  workflow_next_stage?: string | null;
  created_by_id?: string | null;
  /** backend-computed approve / reject / sendback for the current user while in_review */
  allowed_actions: ArReceiptWorkflowAction[];
  total_unapplied_amount: ArAmount;
  tb_ar_receipt_detail?: ArReceiptDetailRecord[];
  tb_ar_receipt_wht?: ArReceiptWhtRecord[];
  tb_ar_tax_invoice?: ArReceiptTaxInvoice | null;
}

/** Matches the gateway request DTO (invoice-level allocations; backend splits per line). */
export interface ArReceiptPayload {
  /** required on update (optimistic lock); the backend rejects a stale version */
  doc_version?: number;
  customer_id: string;
  receipt_date: string;
  received_date?: string | null;
  bank_account_id: string;
  receipt_method?: ArReceiptMethod;
  /** `interface` is set by POS/PMS only, never by a client */
  doc_source?: "manual" | "copy";
  currency_id?: string | null;
  exchange_rate?: number | null;
  cheque_no?: string | null;
  cheque_date?: string | null;
  reference_no?: string | null;
  payer_name?: string | null;
  description?: string | null;
  is_tax_invoice?: boolean;
  source_doc_ref?: string | null;
  net_received_amount: number;
  charge_amount: number;
  /** max 3 rows */
  wht: {
    wht_tax_profile_id?: string | null;
    base_amount: number;
    wht_amount?: number | null;
    wht_certificate_no?: string | null;
    wht_certificate_date?: string | null;
    pnd_form?: string | null;
  }[];
  allocations: { ar_invoice_id: string; applied_amount: number }[];
  info?: Record<string, unknown>;
}

export interface OutstandingInvoiceLine {
  ar_invoice_detail_id: string;
  sequence_no?: number;
  unpaid_amount: ArAmount;
  /** held by other draft/in_review receipts */
  reserved_amount: ArAmount;
  /** unpaid minus reservations by other draft/in_review receipts */
  available_amount: ArAmount;
}

export interface OutstandingInvoice {
  ar_invoice_id: string;
  doc_no: string;
  doc_type: ArInvoiceDocType;
  doc_date: string;
  currency_id: string;
  currency_code: string;
  exchange_rate: ArAmount;
  net_amount: ArAmount;
  vat_amount: ArAmount;
  total_amount: ArAmount;
  outstanding_amount: ArAmount;
  available_amount: ArAmount;
  lines: OutstandingInvoiceLine[];
}

async function readReceipt(url: string) {
  const response = await httpClient.get(url);
  if (!response.ok)
    throw await ApiError.from(response, "Unable to load AR receipts");
  return response.json();
}

async function fetchArReceipts(
  bu: string,
  params: ParamsDto,
): Promise<PaginatedResponse<ArReceiptRow>> {
  const body = await readReceipt(
    buildUrl(API_ENDPOINTS.AR_RECEIPT_LIST(bu), params),
  );
  if (!Array.isArray(body.data) || typeof body.paginate?.total !== "number")
    throw new Error("Invalid AR receipt list response");
  return body;
}

export function useArReceipts(
  params: ParamsDto,
  options?: { enabled?: boolean },
) {
  const bu = useBuCode();
  return useQuery({
    queryKey: [QUERY_KEY, bu, "list", params],
    enabled: !!bu && options?.enabled !== false,
    queryFn: () => fetchArReceipts(bu!, params),
  });
}

export function useExportArReceipts() {
  const bu = useBuCode();
  const { exportToXlsx, isExporting } = useXlsxExport();
  return {
    isExporting,
    exportReceipts: (params: ParamsDto, columns: XlsxColumn<ArReceiptRow>[]) =>
      exportToXlsx({
        fetch: () =>
          fetchAllPages((page, perpage) =>
            fetchArReceipts(bu!, { ...params, page, perpage }),
          ),
        columns,
        sheetName: "AR Receipts",
        fileNamePrefix: "ar-receipt",
      }),
  };
}

export function useArReceiptDocument(id?: string) {
  const bu = useBuCode();
  return useQuery({
    queryKey: [QUERY_KEY, bu, "document", id],
    enabled: !!bu && !!id,
    queryFn: async (): Promise<ArReceiptDocument> => {
      const body = await readReceipt(
        `${API_ENDPOINTS.AR_RECEIPT_LIST(bu!)}/${encodeURIComponent(id!)}`,
      );
      if (body.data?.id !== id) throw new Error("Invalid AR receipt response");
      return body.data;
    },
  });
}

export function useCreateArReceipt() {
  return useApiMutation<ArReceiptPayload, { data: { id: string } }>({
    mutationFn: (body, bu) =>
      httpClient.post(API_ENDPOINTS.AR_RECEIPT_LIST(bu), body),
    invalidateKeys: [QUERY_KEY],
    errorMessage: "Unable to create AR receipt",
    meta: { preferServerMessage: true },
  });
}

export function useUpdateArReceipt() {
  return useApiMutation<ArReceiptPayload & { id: string }>({
    mutationFn: ({ id, ...body }, bu) =>
      httpClient.put(
        `${API_ENDPOINTS.AR_RECEIPT_LIST(bu)}/${encodeURIComponent(id)}`,
        body,
      ),
    invalidateKeys: [QUERY_KEY],
    errorMessage: "Unable to update AR receipt",
    meta: { preferServerMessage: true },
  });
}

export function useDeleteArReceipt() {
  return useApiMutation<string>({
    mutationFn: (id, bu) =>
      httpClient.delete(
        `${API_ENDPOINTS.AR_RECEIPT_LIST(bu)}/${encodeURIComponent(id)}`,
      ),
    invalidateKeys: [QUERY_KEY],
    errorMessage: "Unable to delete AR receipt",
    meta: { preferServerMessage: true },
  });
}

export type ArReceiptAction =
  "submit" | "void" | "approve" | "review" | "reject";

export function useArReceiptAction() {
  return useApiMutation<{
    id: string;
    action: ArReceiptAction;
    doc_version?: number;
    reason?: string;
    /** review (send back) only: target workflow stage name */
    stage?: string;
  }>({
    mutationFn: ({ id, action, ...body }, bu) =>
      httpClient.post(
        `${API_ENDPOINTS.AR_RECEIPT_LIST(bu)}/${encodeURIComponent(id)}/${action}`,
        body,
      ),
    // submit/void change invoice outstanding, so refresh invoice queries too
    invalidateKeys: [QUERY_KEY, INVOICE_QUERY_KEY],
    errorMessage: "Unable to update AR receipt status",
    meta: { preferServerMessage: true },
  });
}

export function useArOutstandingInvoices(
  customerId?: string,
  currencyId?: string,
  /** the receipt being edited, so its own reservations are not counted */
  excludeReceiptId?: string,
  enabled = true,
) {
  const bu = useBuCode();
  return useQuery({
    queryKey: [
      QUERY_KEY,
      bu,
      "outstanding-invoices",
      customerId,
      currencyId,
      excludeReceiptId,
    ],
    enabled: enabled && !!bu && !!customerId,
    queryFn: async (): Promise<OutstandingInvoice[]> => {
      const body = await readReceipt(
        buildUrl(API_ENDPOINTS.AR_RECEIPT_OUTSTANDING_INVOICES(bu!), {
          customer_id: customerId,
          ...(currencyId ? { currency_id: currencyId } : {}),
          ...(excludeReceiptId ? { exclude_receipt_id: excludeReceiptId } : {}),
        } as ParamsDto),
      );
      if (!Array.isArray(body.data))
        throw new Error("Invalid outstanding invoices response");
      return body.data;
    },
  });
}

export interface ArReceiptPreviousStage {
  key: string;
  name: string;
}

/** Stages a receipt can be sent back to — loaded only while the send-back dialog is open. */
export function useArReceiptPreviousStages(
  id: string | undefined,
  enabled: boolean,
) {
  const bu = useBuCode();
  return useQuery<ArReceiptPreviousStage[]>({
    queryKey: [QUERY_KEYS.AR_RECEIPT_PREVIOUS_STAGES, bu, id],
    queryFn: async () => {
      const body = await readReceipt(
        API_ENDPOINTS.AR_RECEIPT_PREVIOUS_STAGES(bu!, id!),
      );
      return Object.entries(body.data ?? {}).map(([key, name]) => ({
        key,
        name: name as string,
      }));
    },
    enabled: !!bu && !!id && enabled,
  });
}
