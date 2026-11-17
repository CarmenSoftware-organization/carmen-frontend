import { beforeEach, expect, it } from "vitest";
import {
  profileDraft,
  profileInput,
  profileValidation,
  readProfileExtension,
  saveProfileExtension,
} from "./ar-profile-model";
import type { ArCustomer } from "./use-ar-customer";

beforeEach(() => sessionStorage.clear());
const valid = () => ({
  ...profileDraft(),
  code: "TEST_AR-1",
  name: "Test Company",
  registeredName: "Test Company Ltd.",
  taxId: "1234567890123",
  taxProfileId: "vat",
  creditTermId: "net30",
  addressLine1: "1 Test Road",
  subDistrict: "A",
  district: "B",
  province: "Bangkok",
  postalCode: "10110",
  billingEmail: "qa@example.com",
  billingSame: true,
  mailingSame: true,
});
it("validates corporate and individual identity and RD address before saving", () => {
  expect(profileValidation(valid())).toBeUndefined();
  expect(profileValidation({ ...valid(), code: "ไทย" })).toBe("codeInvalid");
  expect(profileValidation({ ...valid(), taxId: "123" })).toBe("taxInvalid");
  expect(profileValidation({ ...valid(), postalCode: "abcde" })).toBe(
    "addressRequired",
  );
  expect(profileValidation({ ...valid(), billingEmail: "invalid" })).toBe(
    "billingEmailRequired",
  );
  expect(
    profileValidation({
      ...valid(),
      entityType: "individual",
      name: "",
      registeredName: "",
    }),
  ).toBe("identityRequired");
  expect(
    profileValidation({
      ...valid(),
      entityType: "individual",
      title: "Ms.",
      name: "",
      registeredName: "",
      firstName: "Jane",
      lastName: "Doe",
    }),
  ).toBeUndefined();
});
it("updates existing address IDs without replacing unrelated address fields or customer groups", () => {
  const customer: ArCustomer = {
    id: "customer",
    code: "OLD",
    name: "Old",
    customer_group: [
      { id: "loyalty", name: "Gold" },
      { id: "TA", name: "TA" },
    ],
    customer_address: [
      {
        id: "tax-address",
        address_type: "register_address",
        address_line2: "Preserve me",
        country: "Thailand",
      },
      { id: "billing-address", address_type: "billing_address" },
      {
        id: "contact-address",
        address_type: "contact_address",
        address_line1: "Do not touch",
      },
    ],
  };
  const input = profileInput(valid(), customer);
  expect(input.customer_address?.update).toHaveLength(2);
  expect(input.customer_address?.update?.[0]).toEqual(
    expect.objectContaining({
      customer_address_id: "tax-address",
      postal_code: "10110",
    }),
  );
  expect(input.customer_address?.update?.[0]).not.toHaveProperty(
    "address_line2",
  );
  expect(input.customer_address?.update?.[0]).not.toHaveProperty("country");
  expect(input.customer_address?.add).toEqual([
    {
      address_type: "mailing_address",
      address_line1: "1 Test Road A B Bangkok 10110",
    },
  ]);
  expect(input.customer_group).toEqual([
    { id: "loyalty", name: "Gold" },
    { id: "CORP", name: "CORP" },
  ]);
  expect(input).not.toHaveProperty("billingEmail");
  expect(input).not.toHaveProperty("info");
});
it("keeps unsupported contacts in BU/customer scoped mock storage and restores them", () => {
  saveProfileExtension("A", "customer", {
    ...valid(),
    telephone: "0812345678",
    billingContact: "Accounts",
  });
  expect(
    profileDraft(undefined, readProfileExtension("A", "customer")),
  ).toEqual(
    expect.objectContaining({
      telephone: "0812345678",
      billingContact: "Accounts",
    }),
  );
  expect(readProfileExtension("B", "customer")).toEqual({});
  expect(readProfileExtension("A", "other")).toEqual({});
});
it("uses the individual full name for the real customer name without storing mock fields in the API", () => {
  const input = profileInput({
    ...valid(),
    entityType: "individual",
    title: "Ms.",
    firstName: "Jane",
    lastName: "Doe",
    name: "",
  });
  expect(input.name).toBe("Jane Doe");
  expect(input.registered_name).toBe("Ms. Jane Doe");
  expect(input).not.toHaveProperty("entityType");
});
