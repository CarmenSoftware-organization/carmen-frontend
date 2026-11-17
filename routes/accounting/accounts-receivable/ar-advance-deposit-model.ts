import { z } from "zod";
import { round2 } from "@/lib/currency-utils";

const depositSchema = z
  .object({
    id: z.string().min(1),
    number: z.string().min(1),
    date: z.iso.date(),
    party: z.string().trim().min(1).max(150),
    reference: z.string().trim().min(1).max(100),
    amount: z.number().positive().finite().max(999999999),
    applied: z.number().nonnegative().finite(),
    status: z.enum([
      "draft",
      "available",
      "partially_applied",
      "fully_applied",
      "refunded",
    ]),
  })
  .refine((row) => row.applied <= row.amount);
export type AdvanceDeposit = z.infer<typeof depositSchema>;

const samples: AdvanceDeposit[] = [
  {
    id: "sample-ad-1",
    number: "AD-SAMPLE-001",
    date: "2026-11-04",
    party: "Example Travel",
    reference: "Booking SAMPLE-1001",
    amount: 53500,
    applied: 0,
    status: "available",
  },
  {
    id: "sample-ad-2",
    number: "AD-SAMPLE-002",
    date: "2026-11-08",
    party: "Example Events",
    reference: "Banquet SAMPLE-2002",
    amount: 107000,
    applied: 42800,
    status: "partially_applied",
  },
  {
    id: "sample-ad-3",
    number: "AD-SAMPLE-003",
    date: "2026-11-12",
    party: "Example Corporate",
    reference: "Contract SAMPLE-3003",
    amount: 32100,
    applied: 32100,
    status: "fully_applied",
  },
  {
    id: "sample-ad-4",
    number: "AD-SAMPLE-004",
    date: "2026-11-15",
    party: "Example Travel",
    reference: "Booking SAMPLE-1004",
    amount: 21400,
    applied: 0,
    status: "draft",
  },
];
const storageKey = (bu: string) => `carmen.ar.advance-deposit-samples.v1.${bu}`;

// shortcut: BU-scoped session samples; replace with the Advance Deposit API when available.
export function readAdvanceDeposits(bu: string): AdvanceDeposit[] {
  const stored = sessionStorage.getItem(storageKey(bu));
  return stored
    ? z.array(depositSchema).parse(JSON.parse(stored))
    : structuredClone(samples);
}

export function saveAdvanceDeposit(bu: string, record: AdvanceDeposit) {
  const valid = depositSchema.parse(record);
  const rows = readAdvanceDeposits(bu);
  if (rows.some((row) => row.id === valid.id))
    throw new Error("Duplicate sample deposit");
  const next = [valid, ...rows];
  sessionStorage.setItem(storageKey(bu), JSON.stringify(next));
  return next;
}

export function advanceDepositSummary(rows: AdvanceDeposit[]) {
  const active = rows.filter((row) =>
    ["available", "partially_applied", "fully_applied"].includes(row.status),
  );
  return {
    count: rows.length,
    received: round2(active.reduce((sum, row) => sum + row.amount, 0)),
    applied: round2(active.reduce((sum, row) => sum + row.applied, 0)),
    available: round2(
      active.reduce((sum, row) => sum + row.amount - row.applied, 0),
    ),
  };
}
