import { format } from "date-fns";
import type {
  ArCustomer,
  ArCustomerInput,
  CustomerAddress,
} from "./use-ar-customer";

export const PROFILE_TYPES = ["TA", "CORP", "FIT", "GOV"] as const;
export interface ProfileExtension {
  type: string;
  title: string;
  firstName: string;
  lastName: string;
  position: string;
  telephone: string;
  fax: string;
  email: string;
  registerDate: string;
  paymentType: string;
  whtService: string;
  entityType: "corporate" | "individual";
  billingSame: boolean;
  mailingSame: boolean;
  billingContact: string;
  billingEmail: string;
  mailingContact: string;
  mailingEmail: string;
}
export interface ProfileDraft extends ProfileExtension {
  code: string;
  name: string;
  note: string;
  registeredName: string;
  taxId: string;
  branch: string;
  taxProfileId: string;
  creditTermId: string;
  creditLimit: string;
  accountId: string;
  currencyId: string;
  active: boolean;
  addressLine1: string;
  subDistrict: string;
  district: string;
  province: string;
  postalCode: string;
  billingAddress: string;
  mailingAddress: string;
}
const key = (bu: string, id: string) =>
  `carmen.ar.profile-extension.v1.${bu}.${id}`;
export function readProfileExtension(
  bu: string,
  id: string,
): Partial<ProfileExtension> {
  try {
    const value: unknown = JSON.parse(
      sessionStorage.getItem(key(bu, id)) ?? "{}",
    );
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Partial<ProfileExtension>)
      : {};
  } catch {
    return {};
  }
}
export function saveProfileExtension(
  bu: string,
  id: string,
  draft: ProfileDraft,
) {
  const {
    type,
    title,
    firstName,
    lastName,
    position,
    telephone,
    fax,
    email,
    registerDate,
    paymentType,
    whtService,
    entityType,
    billingSame,
    mailingSame,
    billingContact,
    billingEmail,
    mailingContact,
    mailingEmail,
  } = draft;
  // shortcut: Customer API has no contact/default-payment fields; replace session storage when its DTO supports them.
  sessionStorage.setItem(
    key(bu, id),
    JSON.stringify({
      type,
      title,
      firstName,
      lastName,
      position,
      telephone,
      fax,
      email,
      registerDate,
      paymentType,
      whtService,
      entityType,
      billingSame,
      mailingSame,
      billingContact,
      billingEmail,
      mailingContact,
      mailingEmail,
    }),
  );
}
export function profileDraft(
  customer?: ArCustomer,
  local: Partial<ProfileExtension> = {},
): ProfileDraft {
  const address = (type: string) =>
    customer?.customer_address?.find(
      (a) => a.address_type === type && a.is_active !== false,
    );
  const tax = address("register_address");
  return {
    title: "",
    firstName: "",
    lastName: "",
    position: "",
    telephone: "",
    fax: "",
    email: "",
    registerDate: format(new Date(), "yyyy-MM-dd"),
    paymentType: "BANK",
    whtService: "NONE",
    entityType: "corporate",
    billingSame: false,
    mailingSame: false,
    billingContact: "",
    billingEmail: "",
    mailingContact: "",
    mailingEmail: "",
    ...local,
    type:
      customer?.customer_group?.find((g) =>
        PROFILE_TYPES.includes(g.id as (typeof PROFILE_TYPES)[number]),
      )?.id ?? "CORP",
    code: customer?.code ?? "",
    name: customer?.name ?? "",
    note: customer?.note ?? "",
    registeredName: customer?.registered_name ?? "",
    taxId: customer?.tax_no ?? "",
    branch: customer?.branch_no ?? "00000",
    taxProfileId: customer?.tax_profile_id ?? "",
    creditTermId: customer?.credit_term_id ?? "",
    creditLimit: String(customer?.credit_limit ?? "0"),
    accountId: customer?.ar_chart_of_accounts_id ?? "",
    currencyId: customer?.default_currency_id ?? "",
    active: customer?.is_active !== false,
    addressLine1: tax?.address_line1 ?? "",
    subDistrict: tax?.sub_district ?? "",
    district: tax?.district ?? "",
    province: tax?.province ?? "",
    postalCode: tax?.postal_code ?? "",
    billingAddress: address("billing_address")?.address_line1 ?? "",
    mailingAddress: address("mailing_address")?.address_line1 ?? "",
  };
}
export function taxAddress(d: ProfileDraft) {
  return [d.addressLine1, d.subDistrict, d.district, d.province, d.postalCode]
    .filter(Boolean)
    .join(" ");
}
export function profileValidation(d: ProfileDraft): string | undefined {
  if (!/^[A-Z0-9_-]{1,15}$/.test(d.code)) return "codeInvalid";
  if (
    !(d.entityType === "individual"
      ? d.title && d.firstName.trim() && d.lastName.trim()
      : d.name.trim() && d.registeredName.trim())
  )
    return "identityRequired";
  if (!/^\d{13}$/.test(d.taxId) || !/^\d{5}$/.test(d.branch))
    return "taxInvalid";
  if (
    ![d.addressLine1, d.subDistrict, d.district, d.province].every((s) =>
      s.trim(),
    ) ||
    !/^\d{5}$/.test(d.postalCode)
  )
    return "addressRequired";
  if (
    !d.taxProfileId ||
    !d.creditTermId ||
    !d.registerDate ||
    !d.paymentType ||
    !d.whtService
  )
    return "financialRequired";
  if (
    !/^\d+(\.\d+)?$/.test(d.creditLimit) ||
    !Number.isFinite(Number(d.creditLimit))
  )
    return "invalidLimit";
  if (
    (!d.billingSame && !d.billingAddress.trim()) ||
    (!d.mailingSame && !d.mailingAddress.trim())
  )
    return "addressRequired";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.billingEmail))
    return "billingEmailRequired";
  return undefined;
}
export function profileInput(
  d: ProfileDraft,
  customer?: ArCustomer,
): ArCustomerInput {
  const addresses: Omit<CustomerAddress, "id">[] = [
    {
      address_type: "register_address",
      address_line1: d.addressLine1,
      sub_district: d.subDistrict,
      district: d.district,
      province: d.province,
      postal_code: d.postalCode,
    },
    {
      address_type: "billing_address",
      address_line1: d.billingSame ? taxAddress(d) : d.billingAddress,
    },
    {
      address_type: "mailing_address",
      address_line1: d.mailingSame ? taxAddress(d) : d.mailingAddress,
    },
  ];
  const changes: NonNullable<ArCustomerInput["customer_address"]> = {
    add: [],
    update: [],
  };
  for (const address of addresses) {
    const old = customer?.customer_address?.find(
      (a) => a.address_type === address.address_type && a.is_active !== false,
    );
    if (old) changes.update!.push({ customer_address_id: old.id, ...address });
    else changes.add!.push(address);
  }
  return {
    code: d.code,
    name:
      d.entityType === "individual"
        ? [d.firstName, d.lastName].join(" ").trim()
        : d.name.trim(),
    is_active: d.active,
    registered_name:
      d.entityType === "individual"
        ? [d.title, d.firstName, d.lastName].filter(Boolean).join(" ")
        : d.registeredName.trim(),
    tax_no: d.taxId,
    branch_no: d.branch,
    note: d.note,
    customer_group: [
      ...(customer?.customer_group ?? []).filter(
        (g) => !PROFILE_TYPES.includes(g.id as (typeof PROFILE_TYPES)[number]),
      ),
      { id: d.type, name: d.type },
    ],
    tax_profile_id: d.taxProfileId || null,
    credit_term_id: d.creditTermId || null,
    credit_limit: d.creditLimit,
    ar_chart_of_accounts_id: d.accountId || null,
    default_currency_id: d.currencyId || undefined,
    customer_address: changes,
  };
}
