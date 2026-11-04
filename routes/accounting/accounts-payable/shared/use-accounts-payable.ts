import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useBuCode } from "@/hooks/use-bu-code";
import type {
  ApActionInput,
  ApCommand,
  ApInvoiceInput,
  ApListParams,
  ApPaymentInput,
  ApUiAction,
  ApWhtPreviewInput,
} from "@/types/accounts-payable";
import { httpApRepository } from "./ap-http-repository";

const repository = httpApRepository;

export const AP_QUERY_KEYS = {
  root: (bu: string) => ["accounts-payable", bu] as const,
  invoices: (bu: string, params?: ApListParams) =>
    [...AP_QUERY_KEYS.root(bu), "invoices", params] as const,
  invoice: (bu: string, id?: string) =>
    [...AP_QUERY_KEYS.root(bu), "invoice", id] as const,
  payments: (bu: string, params?: ApListParams) =>
    [...AP_QUERY_KEYS.root(bu), "payments", params] as const,
  payment: (bu: string, id?: string) =>
    [...AP_QUERY_KEYS.root(bu), "payment", id] as const,
  outstanding: (bu: string, vendorId?: string) =>
    [...AP_QUERY_KEYS.root(bu), "outstanding", vendorId] as const,
};

/** UI "return" = คำสั่ง `review` ของ backend */
export function toApCommand(action: Exclude<ApUiAction, "delete">): ApCommand {
  return action === "return" ? "review" : action;
}

function useBu() {
  return useBuCode() ?? "";
}

function useInvalidateAll() {
  const bu = useBu();
  const client = useQueryClient();
  return () =>
    client.invalidateQueries({ queryKey: AP_QUERY_KEYS.root(bu) });
}

const isId = (id?: string): id is string =>
  !!id && id !== "new" && id !== "undefined";

export function useApInvoices(
  params?: ApListParams,
  options?: { enabled?: boolean },
) {
  const bu = useBu();
  return useQuery({
    queryKey: AP_QUERY_KEYS.invoices(bu, params),
    queryFn: () => repository.listInvoices(bu, params),
    enabled: !!bu && (options?.enabled ?? true),
  });
}

export function useApInvoice(id?: string) {
  const bu = useBu();
  return useQuery({
    queryKey: AP_QUERY_KEYS.invoice(bu, id),
    queryFn: () => repository.getInvoice(bu, id!),
    enabled: !!bu && isId(id),
  });
}

/** create เมื่อไม่มี `id`, update (ต้องมี `docVersion`) เมื่อมี */
export function useSaveApInvoice() {
  const bu = useBu();
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({
      id,
      docVersion,
      input,
    }:
      | { id?: undefined; docVersion?: undefined; input: ApInvoiceInput }
      | { id: string; docVersion: number; input: Partial<ApInvoiceInput> }) =>
      id
        ? repository.updateInvoice(bu, id, docVersion, input)
        : repository.createInvoice(bu, input as ApInvoiceInput),
    onSuccess: invalidate,
  });
}

export function useDeleteApInvoice() {
  const bu = useBu();
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (id: string) => repository.deleteInvoice(bu, id),
    onSuccess: invalidate,
  });
}

export function useApInvoiceAction() {
  const bu = useBu();
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({
      id,
      action,
      ...input
    }: ApActionInput & {
      id: string;
      action: Exclude<ApUiAction, "delete">;
    }) => repository.invoiceAction(bu, id, toApCommand(action), input),
    onSuccess: invalidate,
  });
}

export function useApPayments(
  params?: ApListParams,
  options?: { enabled?: boolean },
) {
  const bu = useBu();
  return useQuery({
    queryKey: AP_QUERY_KEYS.payments(bu, params),
    queryFn: () => repository.listPayments(bu, params),
    enabled: !!bu && (options?.enabled ?? true),
  });
}

export function useApPayment(id?: string) {
  const bu = useBu();
  return useQuery({
    queryKey: AP_QUERY_KEYS.payment(bu, id),
    queryFn: () => repository.getPayment(bu, id!),
    enabled: !!bu && isId(id),
  });
}

/** create เมื่อไม่มี `id`, update (ต้องมี `docVersion`) เมื่อมี */
export function useSaveApPayment() {
  const bu = useBu();
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({
      id,
      docVersion,
      input,
    }:
      | { id?: undefined; docVersion?: undefined; input: ApPaymentInput }
      | {
          id: string;
          docVersion: number;
          input: Partial<Omit<ApPaymentInput, "vendor_id">>;
        }) =>
      id
        ? repository.updatePayment(bu, id, docVersion, input)
        : repository.createPayment(bu, input as ApPaymentInput),
    onSuccess: invalidate,
  });
}

export function useDeleteApPayment() {
  const bu = useBu();
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (id: string) => repository.deletePayment(bu, id),
    onSuccess: invalidate,
  });
}

export function useApPaymentAction() {
  const bu = useBu();
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({
      id,
      action,
      ...input
    }: ApActionInput & {
      id: string;
      action: Exclude<ApUiAction, "delete">;
    }) => repository.paymentAction(bu, id, toApCommand(action), input),
    onSuccess: invalidate,
  });
}

export function useApOutstandingDocuments(vendorId?: string) {
  const bu = useBu();
  return useQuery({
    queryKey: AP_QUERY_KEYS.outstanding(bu, vendorId),
    queryFn: () => repository.outstandingDocuments(bu, vendorId!),
    enabled: !!bu && !!vendorId,
  });
}

export function useApWhtPreview() {
  const bu = useBu();
  return useMutation({
    mutationFn: (body: ApWhtPreviewInput) => repository.whtPreview(bu, body),
    // error แสดงinline ที่หน้า payment เอง (WHT ค้างต้องเห็นเหตุผลถาวร ไม่ใช่ toast ที่หายไป)
    meta: { skipGlobalErrorToast: true },
  });
}
