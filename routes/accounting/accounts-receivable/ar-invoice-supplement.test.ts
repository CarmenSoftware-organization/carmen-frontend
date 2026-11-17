import { beforeEach, expect, it } from "vitest";
import {
  invoiceTaxEntity,
  invoiceTaxEntityValidation,
  validInvoiceSupplement,
  readInvoiceSupplement,
  saveInvoiceSupplement,
} from "./ar-invoice-supplement-model";

beforeEach(() => sessionStorage.clear());
it("keeps unsupported tax/deposit overrides isolated by invoice and business unit", () => {
  const value = {
    taxEntity: invoiceTaxEntity(),
    deposits: [
      {
        id: "deposit",
        number: "ARDP-MOCK-1",
        date: "2026-11-17",
        available: 100,
        amount: 40,
        rate: 35,
      },
    ],
  };
  saveInvoiceSupplement("A", "invoice-1", value);
  expect(readInvoiceSupplement("A", "invoice-1")).toEqual(value);
  expect(readInvoiceSupplement("B", "invoice-1")).toBeUndefined();
  expect(readInvoiceSupplement("A", "invoice-2")).toBeUndefined();
  expect(() =>
    saveInvoiceSupplement("A", "invoice-2", {
      ...value,
      deposits: [{ ...value.deposits[0], amount: 101 }],
    }),
  ).toThrow();
});
it("prefers issued tax snapshot over the current customer", () => {
  const document = {
    tax_invoice: {
      customer_registered_name: "Issued Name",
      customer_tax_no: "1234567890123",
      customer_branch_no: "00001",
      address_line1: "Issued address",
    },
  };
  const customer = { registered_name: "Current Name", tax_no: "9999999999999" };
  expect(invoiceTaxEntity(document as never, customer as never)).toMatchObject({
    registeredName: "Issued Name",
    taxId: "1234567890123",
    branchNo: "00001",
    address1: "Issued address",
  });
});

it("previews the registered address before the billing address like tax posting", () => {
  const customer = {
    customer_address: [
      {
        id: "billing",
        address_type: "billing_address",
        address_line1: "Billing address",
      },
      {
        id: "registered",
        address_type: "register_address",
        address_line1: "Registered address",
      },
    ],
  };
  expect(invoiceTaxEntity(undefined, customer as never).address1).toBe(
    "Registered address",
  );
});

const completeEntity = {
  registeredName: "Customer Limited",
  taxId: "1234567890123",
  branchNo: "00000",
  address1: "123 Main Street",
  address2: "",
  province: "Bangkok",
  postalCode: "10100",
};
it.each([
  "registeredName",
  "taxId",
  "branchNo",
  "address1",
  "province",
  "postalCode",
] as const)("requires %s only when issuing a tax invoice", (field) => {
  const taxEntity = { ...completeEntity, [field]: "" };
  expect(invoiceTaxEntityValidation(taxEntity, true)).toBe("taxEntityRequired");
  expect(validInvoiceSupplement({ taxEntity, deposits: [] }, 100, true)).toBe(
    false,
  );
  expect(validInvoiceSupplement({ taxEntity, deposits: [] }, 100, false)).toBe(
    true,
  );
});
it.each(["ABCDE", "1010", "101000"])(
  "rejects entered postal code %s in both modes",
  (postalCode) => {
    const taxEntity = { ...completeEntity, postalCode };
    expect(invoiceTaxEntityValidation(taxEntity, false)).toBe(
      "invalidPostalCode",
    );
    expect(validInvoiceSupplement({ taxEntity, deposits: [] }, 100, true)).toBe(
      false,
    );
  },
);
it("allows an empty optional tax entity for an ordinary invoice and complete details for a tax invoice", () => {
  expect(
    validInvoiceSupplement(
      { taxEntity: invoiceTaxEntity(), deposits: [] },
      100,
      false,
    ),
  ).toBe(true);
  expect(
    validInvoiceSupplement(
      { taxEntity: completeEntity, deposits: [] },
      100,
      true,
    ),
  ).toBe(true);
  expect(
    invoiceTaxEntityValidation({ ...completeEntity, taxId: "123" }, true),
  ).toBe("invalidTaxEntity");
  expect(
    invoiceTaxEntityValidation({ ...completeEntity, branchNo: "123" }, true),
  ).toBe("invalidTaxEntity");
});
