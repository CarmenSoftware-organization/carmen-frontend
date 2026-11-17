import { z } from "zod";
import type { ArRegisterDocument } from "./use-ar-register";
import type { ArCustomer } from "./use-ar-customer";

const entitySchema = z.object({
  registeredName: z.string(),
  taxId: z.string(),
  branchNo: z.string(),
  address1: z.string(),
  address2: z.string(),
  province: z.string(),
  postalCode: z.string(),
});
export const invoiceMockDepositSchema = z
  .object({
    id: z.string(),
    number: z.string().trim().min(1),
    date: z.iso.date(),
    available: z.number().finite().positive(),
    amount: z.number().finite().positive(),
    rate: z.number().finite().positive(),
  })
  .refine((row) => row.amount <= row.available);
const supplementSchema = z.object({
  taxEntity: entitySchema,
  deposits: z.array(invoiceMockDepositSchema),
});
export type InvoiceTaxEntity = z.infer<typeof entitySchema>;
export type InvoiceMockDeposit = z.infer<typeof invoiceMockDepositSchema>;
export type InvoiceSupplement = z.infer<typeof supplementSchema>;
const key = (bu: string, id: string) =>
  `carmen.ar.invoice-supplement-mock.v1.${bu}.${id}`;
export function invoiceTaxEntity(
  doc?: ArRegisterDocument,
  customer?: ArCustomer,
): InvoiceTaxEntity {
  const tax = doc?.tax_invoice;
  const addresses = customer?.customer_address?.filter(
    (row) => row.is_active !== false,
  );
  const address =
    addresses?.find((row) => row.address_type === "register_address") ??
    addresses?.find((row) => row.address_type === "billing_address");
  return {
    registeredName:
      tax?.customer_registered_name ?? customer?.registered_name ?? "",
    taxId: tax?.customer_tax_no ?? customer?.tax_no ?? "",
    branchNo: tax?.customer_branch_no ?? customer?.branch_no ?? "00000",
    address1: tax?.address_line1 ?? address?.address_line1 ?? "",
    address2: tax?.address_line2 ?? address?.address_line2 ?? "",
    province: tax?.province ?? address?.province ?? "",
    postalCode: tax?.postal_code ?? address?.postal_code ?? "",
  };
}
export function readInvoiceSupplement(
  bu: string,
  id: string,
): InvoiceSupplement | undefined {
  const raw = sessionStorage.getItem(key(bu, id));
  if (!raw) return;
  try {
    const parsed = supplementSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : undefined;
  } catch {
    return;
  }
}
// Only fields absent from the invoice API live here. They never change API outstanding or tax snapshots.
export function saveInvoiceSupplement(
  bu: string,
  id: string,
  value: InvoiceSupplement,
) {
  sessionStorage.setItem(
    key(bu, id),
    JSON.stringify(supplementSchema.parse(value)),
  );
}

export function validInvoiceSupplement(
  value: InvoiceSupplement,
  availableAmount: number,
  isTaxInvoice = false,
) {
  return (
    supplementSchema.safeParse(value).success &&
    invoiceTaxEntityValidation(value.taxEntity, isTaxInvoice) === null &&
    value.deposits.reduce((sum, row) => sum + row.amount, 0) <= availableAmount
  );
}

export function invoiceTaxEntityValidation(
  entity: InvoiceTaxEntity,
  isTaxInvoice: boolean,
): "taxEntityRequired" | "invalidTaxEntity" | "invalidPostalCode" | null {
  if (isTaxInvoice) {
    const required = [
      entity.registeredName,
      entity.taxId,
      entity.branchNo,
      entity.address1,
      entity.province,
      entity.postalCode,
    ];
    if (required.some((value) => !value.trim())) return "taxEntityRequired";
    if (!/^\d{13}$/.test(entity.taxId) || !/^\d{5}$/.test(entity.branchNo))
      return "invalidTaxEntity";
  }
  if (entity.postalCode && !/^\d{5}$/.test(entity.postalCode))
    return "invalidPostalCode";
  return null;
}
