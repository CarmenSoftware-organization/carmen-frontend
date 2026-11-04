import type {
  ApActionInput,
  ApCommand,
  ApInvoice,
  ApInvoiceInput,
  ApListParams,
  ApMutationResult,
  ApOutstandingDocument,
  ApPayment,
  ApPaymentInput,
  ApWhtPreviewInput,
  ApWhtPreviewRow,
} from "@/types/accounts-payable";
import type { PaginatedResponse } from "@/types/params";

/** AP repository แบบ buCode-first — เงินเป็น DecimalString ทั้งขาเข้าและขาออก */
export interface ApRepository {
  listInvoices(
    buCode: string,
    params?: ApListParams,
  ): Promise<PaginatedResponse<ApInvoice>>;
  getInvoice(buCode: string, id: string): Promise<ApInvoice | null>;
  createInvoice(buCode: string, input: ApInvoiceInput): Promise<ApMutationResult>;
  updateInvoice(
    buCode: string,
    id: string,
    docVersion: number,
    input: Partial<ApInvoiceInput>,
  ): Promise<ApMutationResult>;
  deleteInvoice(buCode: string, id: string): Promise<void>;
  invoiceAction(
    buCode: string,
    id: string,
    command: ApCommand,
    input: ApActionInput,
  ): Promise<ApMutationResult>;

  listPayments(
    buCode: string,
    params?: ApListParams,
  ): Promise<PaginatedResponse<ApPayment>>;
  getPayment(buCode: string, id: string): Promise<ApPayment | null>;
  createPayment(buCode: string, input: ApPaymentInput): Promise<ApMutationResult>;
  updatePayment(
    buCode: string,
    id: string,
    docVersion: number,
    input: Partial<Omit<ApPaymentInput, "vendor_id">>,
  ): Promise<ApMutationResult>;
  deletePayment(buCode: string, id: string): Promise<void>;
  paymentAction(
    buCode: string,
    id: string,
    command: ApCommand,
    input: ApActionInput,
  ): Promise<ApMutationResult>;
  outstandingDocuments(
    buCode: string,
    vendorId: string,
  ): Promise<ApOutstandingDocument[]>;
  whtPreview(
    buCode: string,
    body: ApWhtPreviewInput,
  ): Promise<ApWhtPreviewRow[]>;
}
