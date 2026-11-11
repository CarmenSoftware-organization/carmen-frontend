export type PreviewProfile = {
  id: string;
  code: string;
  name: string;
  taxId: string;
  creditDays: number;
  billingAddress: string;
  active: boolean;
};

export type PreviewContract = {
  id: string;
  code: string;
  name: string;
  profileId: string;
  startDate: string;
  endDate: string;
  amount: number;
};

export type PreviewCustomers = {
  profiles: PreviewProfile[];
  contracts: PreviewContract[];
};

export type CustomerDirectory = keyof PreviewCustomers;

export const AR_PREVIEW_PATH = "/accounting/accounts-receivable/preview";

const STORAGE_KEY = "carmen.ar-preview.customer-master.v1";
const fixtures: PreviewCustomers = {
  profiles: [{
    id: "mock-customer-1",
    code: "MOCK-C001",
    name: "Example Travel",
    taxId: "",
    creditDays: 30,
    billingAddress: "Example billing address",
    active: true,
  }],
  contracts: [{
    id: "mock-contract-1",
    code: "MOCK-CONTRACT-001",
    name: "Monthly corporate accommodation",
    profileId: "mock-customer-1",
    startDate: "2026-01-01",
    endDate: "2026-12-31",
    amount: 12000,
  }],
};

export function readPreviewCustomers(): PreviewCustomers {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored) as PreviewCustomers;
  } catch {
    return fixtures;
  }
  return fixtures;
}

export function writePreviewCustomers(data: PreviewCustomers) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function removePreviewCustomer(
  data: PreviewCustomers,
  directory: CustomerDirectory,
  id: string,
): PreviewCustomers | null {
  if (directory === "contracts") {
    return { ...data, contracts: data.contracts.filter((contract) => contract.id !== id) };
  }
  if (data.contracts.some((contract) => contract.profileId === id)) return null;
  return { ...data, profiles: data.profiles.filter((profile) => profile.id !== id) };
}
