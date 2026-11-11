import { useQuery } from "@tanstack/react-query";
import { API_ENDPOINTS } from "@/constant/api-endpoints";
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

export const AR_STATUS = ["draft", "in_review", "posted", "void"] as const;
export const AR_TYPES = [
  "invoice",
  "credit_note",
  "debit_note",
  "deposit",
] as const;
export const AR_REGISTER_PATH = "/accounting/accounts-receivable/invoice";
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
}

export interface ArRegisterDocument extends ArRegisterRow {
  doc_version?: number | null;
  customer_id: string;
  is_pms_folio?: boolean;
  description?: string | null;
  source_doc_ref?: string | null;
  workflow_current_stage?: string | null;
  net_amount: ArAmount;
  vat_amount: ArAmount;
  gl_jv_id?: string | null;
  gl_jv_no?: string | null;
  tax_invoice?: {
    tax_invoice_no: string;
    tax_invoice_date: string;
    status: string;
  } | null;
  tb_ar_invoice_detail?: ArInvoiceLineRecord[];
  tb_ar_invoice_reference?: {
    ref_ar_invoice_id: string;
    ref_ar_invoice_no?: string | null;
    applied_amount: ArAmount;
  }[];
}

async function readAr(url: string) {
  const response = await httpClient.get(url);
  if (!response.ok)
    throw await ApiError.from(response, "Unable to load AR invoices");
  return response.json();
}

export function useArRegister(params: ParamsDto) {
  const bu = useBuCode();
  return useQuery({
    queryKey: [QUERY_KEY, bu, "list", params],
    enabled: !!bu,
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
