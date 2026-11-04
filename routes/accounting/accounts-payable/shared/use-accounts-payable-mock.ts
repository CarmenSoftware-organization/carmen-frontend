import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useBuCode } from "@/hooks/use-bu-code";
import type {
  ApInvoiceFilters,
  ApInvoiceInput,
  ApPaymentFilters,
  ApPaymentInput,
} from "@/types/accounts-payable-mock";
import { createApMockRepository } from "./ap-mock-repository";

export const AP_QUERY_KEYS = {
  root: (bu: string) => ["accounts-payable", bu] as const,
  dashboard: (bu: string, asOf: string, paidFrom: string, paidTo: string) =>
    [...AP_QUERY_KEYS.root(bu), "dashboard", asOf, paidFrom, paidTo] as const,
  invoices: (bu: string, filters?: ApInvoiceFilters) =>
    [...AP_QUERY_KEYS.root(bu), "invoices", filters] as const,
  invoice: (bu: string, id?: string) =>
    [...AP_QUERY_KEYS.root(bu), "invoice", id] as const,
  payments: (bu: string, filters?: ApPaymentFilters) =>
    [...AP_QUERY_KEYS.root(bu), "payments", filters] as const,
  payment: (bu: string, id?: string) =>
    [...AP_QUERY_KEYS.root(bu), "payment", id] as const,
  approvals: (bu: string, filters?: ApPaymentFilters) =>
    [...AP_QUERY_KEYS.root(bu), "approvals", filters] as const,
};

function useRepository() {
  const bu = useBuCode() ?? "BU-MOCK";
  return { bu, repository: createApMockRepository(bu) };
}

export function useApDashboard(asOf: string, paidFrom: string, paidTo: string) {
  const { bu, repository } = useRepository();
  return useQuery({
    queryKey: AP_QUERY_KEYS.dashboard(bu, asOf, paidFrom, paidTo),
    queryFn: () => repository.dashboard(asOf, paidFrom, paidTo),
  });
}

export function useApInvoices(filters?: ApInvoiceFilters) {
  const { bu, repository } = useRepository();
  return useQuery({
    queryKey: AP_QUERY_KEYS.invoices(bu, filters),
    queryFn: () => repository.listInvoices(filters),
  });
}

export function useApInvoice(id?: string) {
  const { bu, repository } = useRepository();
  return useQuery({
    queryKey: AP_QUERY_KEYS.invoice(bu, id),
    queryFn: () => repository.getInvoice(id!),
    enabled: !!id && id !== "new",
  });
}

export function useSaveApInvoice() {
  const { bu, repository } = useRepository();
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      input,
      id,
      docVersion,
    }: {
      input: ApInvoiceInput;
      id?: string;
      docVersion?: number;
    }) => repository.saveInvoice(input, id, docVersion),
    onSuccess: (invoice) => {
      client.setQueryData(AP_QUERY_KEYS.invoice(bu, invoice.id), invoice);
      client.invalidateQueries({ queryKey: AP_QUERY_KEYS.root(bu) });
    },
  });
}

export function useApInvoiceAction() {
  const { bu, repository } = useRepository();
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      action,
      docVersion,
    }: {
      id: string;
      action: "submit" | "approve" | "return" | "reject" | "void";
      docVersion: number;
    }) => repository.invoiceAction(id, action, docVersion),
    onSuccess: (invoice) => {
      client.setQueryData(AP_QUERY_KEYS.invoice(bu, invoice.id), invoice);
      client.invalidateQueries({ queryKey: AP_QUERY_KEYS.root(bu) });
    },
  });
}

export function useApPayments(filters?: ApPaymentFilters) {
  const { bu, repository } = useRepository();
  return useQuery({
    queryKey: AP_QUERY_KEYS.payments(bu, filters),
    queryFn: () => repository.listPayments(filters),
  });
}

export function useApPaymentApprovals(filters?: ApPaymentFilters) {
  const { bu, repository } = useRepository();
  return useQuery({
    queryKey: AP_QUERY_KEYS.approvals(bu, filters),
    queryFn: () => repository.listApprovals(filters),
  });
}

export function useApPayment(id?: string) {
  const { bu, repository } = useRepository();
  return useQuery({
    queryKey: AP_QUERY_KEYS.payment(bu, id),
    queryFn: () => repository.getPayment(id!),
    enabled: !!id && id !== "new",
  });
}

export function useSaveApPayment() {
  const { bu, repository } = useRepository();
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      input,
      id,
      docVersion,
    }: {
      input: ApPaymentInput;
      id?: string;
      docVersion?: number;
    }) => repository.savePayment(input, id, docVersion),
    onSuccess: (payment) => {
      client.setQueryData(AP_QUERY_KEYS.payment(bu, payment.id), payment);
      client.invalidateQueries({ queryKey: AP_QUERY_KEYS.root(bu) });
    },
  });
}

export function useApPaymentAction() {
  const { bu, repository } = useRepository();
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      action,
      docVersion,
      idempotencyKey,
      reason,
    }: {
      id: string;
      action:
        | "submit"
        | "approve"
        | "return"
        | "reject"
        | "void"
        | "clarify";
      docVersion: number;
      idempotencyKey?: string;
      reason?: string;
    }) => repository.paymentAction(id, action, docVersion, idempotencyKey, reason),
    onSuccess: (payment) => {
      client.setQueryData(AP_QUERY_KEYS.payment(bu, payment.id), payment);
      client.invalidateQueries({ queryKey: AP_QUERY_KEYS.root(bu) });
    },
  });
}
