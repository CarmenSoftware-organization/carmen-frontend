import { round2 } from "@/lib/currency-utils";
import type { DimensionRef } from "@/types/gl-dimension";
import { arLineAmounts, type ArDraftLine } from "./ar-invoice-draft-model";

export interface ArContractDocument {
  name: string;
  mime: string;
  data: string;
  size?: number;
}

export interface ArContract {
  id: string;
  contractNo: string;
  customerId: string;
  customerCode: string;
  customerName: string;
  description: string;
  startDate: string;
  endDate: string;
  active: boolean;
  chargeEvery: number;
  currency: string;
  rate: number;
  amount: number;
  lines?: ArDraftLine[];
  document?: ArContractDocument;
  documents?: ArContractDocument[];
}

/** Existing header-only samples keep their amount until their first line edit. */
export function contractAmount(record: Pick<ArContract, "amount" | "lines">) {
  return record.lines
    ? round2(
        record.lines.reduce((sum, line) => sum + arLineAmounts(line).total, 0),
      )
    : record.amount;
}

export function contractLineError(lines: ArDraftLine[]) {
  if (!lines.length) return "lineRequired";
  for (const line of lines) {
    if (
      !line.cr_chart_of_accounts_id ||
      !line.cr_cost_center_id ||
      !line.dr_chart_of_accounts_id ||
      !line.dr_cost_center_id
    )
      return "lineAccountsRequired";
    const amounts = arLineAmounts(line);
    if (
      !Number.isFinite(amounts.total) ||
      !Number.isFinite(Number(line.quantity)) ||
      !Number.isFinite(Number(line.unit_price)) ||
      !String(line.unit_price).trim() ||
      Number(line.quantity) <= 0 ||
      Number(line.unit_price) < 0 ||
      amounts.discount < 0 ||
      amounts.discount > amounts.subtotal ||
      amounts.vat < 0 ||
      amounts.tax2 < 0
    )
      return "lineAmountsInvalid";
    if (line.date_from && line.date_to && line.date_from > line.date_to)
      return "dateOrder";
    if (
      (amounts.vat > 0 &&
        (!line.vat_chart_of_accounts_id || !line.vat_cost_center_id)) ||
      (amounts.tax2 > 0 &&
        (!line.tax2_chart_of_accounts_id || !line.tax2_cost_center_id))
    )
      return "lineTaxAccountsRequired";
  }
  return undefined;
}

interface ContractSamples {
  records: ArContract[];
  counters: Record<string, number>;
}

const fixtures: ArContract[] = [
  {
    id: "sample-contract-1",
    contractNo: "202600001",
    customerId: "sample-travel",
    customerCode: "SAMPLE-C001",
    customerName: "Example Travel",
    description: "Monthly corporate accommodation",
    startDate: "2026-01-01",
    endDate: "2026-12-31",
    active: true,
    chargeEvery: 1,
    currency: "THB",
    rate: 1,
    amount: 12000,
  },
];

// shortcut: session-only samples until a Contract API supports persistence.
const storageKey = (bu: string) => `carmen.ar.contract-samples.v1.${bu}`;
const legacyKey = "carmen.ar-preview.customer-master.v1";

export function readContractSamples(bu: string): ContractSamples {
  const stored = sessionStorage.getItem(storageKey(bu));
  if (stored) {
    const data = JSON.parse(stored) as ContractSamples;
    // Normalize old session keys on read; the next save persists the renamed fields.
    for (const record of data.records) {
      for (const line of record.lines ?? []) {
        line.dimensions = line.dimensions?.map((raw) => {
          const { gl_dimension_id, gl_dimension_value_id, ...ref } =
            raw as DimensionRef & {
              gl_dimension_id?: string;
              gl_dimension_value_id?: string | null;
            };
          return {
            ...ref,
            dimension_id: ref.dimension_id ?? gl_dimension_id!,
            ...(ref.dimension_value_id === undefined &&
            gl_dimension_value_id !== undefined
              ? { dimension_value_id: gl_dimension_value_id }
              : {}),
          };
        });
      }
    }
    return data;
  }
  const legacy = sessionStorage.getItem(legacyKey);
  const migrated = sessionStorage.getItem(`${legacyKey}.migrated-bu`);
  if (legacy && !migrated) {
    const parsed = JSON.parse(legacy) as {
      profiles: { id: string; code: string; name: string }[];
      contracts: {
        id: string;
        code: string;
        name: string;
        profileId: string;
        startDate: string;
        endDate: string;
        amount: number;
      }[];
    };
    const records: ArContract[] = parsed.contracts.map((contract) => {
      const profile = parsed.profiles.find(
        (item) => item.id === contract.profileId,
      );
      return {
        id: contract.id,
        contractNo:
          contract.id === "mock-contract-1" &&
          contract.code === "MOCK-CONTRACT-001"
            ? "202600001"
            : contract.code,
        customerId: contract.profileId,
        customerCode: profile?.code ?? "",
        customerName: profile?.name ?? "",
        description: contract.name,
        startDate: contract.startDate,
        endDate: contract.endDate,
        amount: contract.amount,
        active: true,
        chargeEvery: 1,
        currency: "THB",
        rate: 1,
      };
    });
    const result = { records, counters: {} };
    sessionStorage.setItem(storageKey(bu), JSON.stringify(result));
    sessionStorage.setItem(`${legacyKey}.migrated-bu`, bu);
    return result;
  }
  return { records: fixtures, counters: {} };
}

export function nextContractNo(data: ContractSamples, startDate: string) {
  const year = startDate.slice(0, 4);
  const largest = data.records.reduce(
    (max, record) =>
      /^\d{9}$/.test(record.contractNo) && record.contractNo.startsWith(year)
        ? Math.max(max, Number(record.contractNo.slice(4)))
        : max,
    data.counters[year] ?? 0,
  );
  return `${year}${String(largest + 1).padStart(5, "0")}`;
}

export function saveContractSample(bu: string, record: ArContract) {
  const current = readContractSamples(bu);
  const exists = current.records.some((item) => item.id === record.id);
  const normalized = {
    ...record,
    amount: contractAmount(record),
    lines: record.lines?.map((line, index) => ({
      ...line,
      sequence_no: index + 1,
    })),
  };
  const saved = exists
    ? normalized
    : { ...normalized, contractNo: nextContractNo(current, record.startDate) };
  const year = saved.contractNo.slice(0, 4);
  const next: ContractSamples = {
    records: exists
      ? current.records.map((item) => (item.id === record.id ? saved : item))
      : [...current.records, saved],
    counters: {
      ...current.counters,
      [year]: Math.max(
        current.counters[year] ?? 0,
        Number(saved.contractNo.slice(4)) || 0,
      ),
    },
  };
  sessionStorage.setItem(storageKey(bu), JSON.stringify(next));
  return next;
}

export function deleteContractSample(bu: string, id: string) {
  const current = readContractSamples(bu);
  const record = current.records.find((item) => item.id === id);
  const counters = { ...current.counters };
  if (record && /^\d{9}$/.test(record.contractNo)) {
    const year = record.contractNo.slice(0, 4);
    counters[year] = Math.max(
      counters[year] ?? 0,
      Number(record.contractNo.slice(4)),
    );
  }
  const next = {
    counters,
    records: current.records.filter((record) => record.id !== id),
  };
  sessionStorage.setItem(storageKey(bu), JSON.stringify(next));
  return next;
}
