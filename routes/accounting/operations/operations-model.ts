import { round2 } from "@/lib/currency-utils";
import type { PreviewRecord } from "./preview-register";

export interface ChequeRecord extends PreviewRecord {
  status: "on_hand" | "in_transit" | "cleared" | "bounced";
  bank: string;
  statementNumber: string;
  statementAmount: number;
  statementDate: string;
}

export const chequeSamples: ChequeRecord[] = [
  {
    id: "sample-cq-1",
    number: "CQ-SAMPLE-001",
    date: "2026-11-05",
    party: "Example Corporate",
    reference: "RC-SAMPLE-001",
    amount: 53500,
    status: "in_transit",
    bank: "Sample Bank · 001",
    statementNumber: "CQ-SAMPLE-001",
    statementAmount: 53500,
    statementDate: "2026-11-09",
  },
  {
    id: "sample-cq-2",
    number: "CQ-SAMPLE-002",
    date: "2026-11-10",
    party: "Example Travel",
    reference: "RC-SAMPLE-002",
    amount: 107000,
    status: "on_hand",
    bank: "Sample Bank · 001",
    statementNumber: "CQ-SAMPLE-002",
    statementAmount: 106000,
    statementDate: "2026-11-12",
  },
  {
    id: "sample-cq-3",
    number: "CQ-SAMPLE-003",
    date: "2026-11-12",
    party: "Example Conference",
    reference: "RC-SAMPLE-003",
    amount: 21400,
    status: "cleared",
    bank: "Sample Bank · 002",
    statementNumber: "CQ-SAMPLE-003",
    statementAmount: 21400,
    statementDate: "2026-11-13",
  },
  {
    id: "sample-cq-4",
    number: "CQ-SAMPLE-004",
    date: "2026-11-15",
    party: "Example Events",
    reference: "RC-SAMPLE-004",
    amount: 32100,
    status: "bounced",
    bank: "Sample Bank · 001",
    statementNumber: "",
    statementAmount: 0,
    statementDate: "",
  },
];

export function canReconcileCheque(row: ChequeRecord) {
  return (
    row.status === "in_transit" &&
    row.number === row.statementNumber &&
    row.amount === row.statementAmount &&
    !!row.statementDate &&
    row.statementDate >= row.date
  );
}

export interface OutputTaxRecord extends PreviewRecord {
  taxPoint: "due" | "undue";
  period: string;
  taxId: string;
  base: number;
  source: "invoice" | "credit_note";
}

export const outputTaxSamples: OutputTaxRecord[] = [
  {
    id: "sample-vat-1",
    taxPoint: "due",
    number: "TX-SAMPLE-001",
    date: "2026-11-04",
    party: "Example Travel",
    reference: "AR-SAMPLE-001",
    amount: 7000,
    base: 100000,
    period: "2026-11",
    taxId: "0000000000000",
    source: "invoice",
    status: "ready",
  },
  {
    id: "sample-vat-2",
    taxPoint: "undue",
    number: "TX-SAMPLE-002",
    date: "2026-11-08",
    party: "Example Events",
    reference: "AR-SAMPLE-002",
    amount: 3500,
    base: 50000,
    period: "2026-11",
    taxId: "0000000000000",
    source: "invoice",
    status: "pending",
  },
  {
    id: "sample-vat-3",
    taxPoint: "due",
    number: "TX-SAMPLE-003",
    date: "2026-11-12",
    party: "Example Corporate",
    reference: "AR-SAMPLE-003",
    amount: 1400,
    base: 20000,
    period: "2026-11",
    taxId: "",
    source: "invoice",
    status: "exception",
  },
  {
    id: "sample-vat-4",
    taxPoint: "due",
    number: "TX-SAMPLE-004",
    date: "2026-11-14",
    party: "Example Travel",
    reference: "CN-SAMPLE-004",
    amount: -700,
    base: -10000,
    period: "2026-11",
    taxId: "0000000000000",
    source: "credit_note",
    status: "ready",
  },
  {
    id: "sample-vat-5",
    taxPoint: "due",
    number: "TX-SAMPLE-005",
    date: "2026-10-20",
    party: "Example Travel",
    reference: "AR-SAMPLE-005",
    amount: 2100,
    base: 30000,
    period: "2026-10",
    taxId: "0000000000000",
    source: "invoice",
    status: "ready",
  },
];

export function outputTaxSummary(rows: OutputTaxRecord[]) {
  return {
    base: round2(rows.reduce((sum, row) => sum + row.base, 0)),
    vat: round2(rows.reduce((sum, row) => sum + row.amount, 0)),
    exceptions: rows.filter((row) => row.status === "exception" || !row.taxId)
      .length,
    canPrepare:
      rows.length > 0 &&
      rows.every(
        (row) =>
          row.taxPoint === "due" && row.status === "ready" && !!row.taxId,
      ),
  };
}
