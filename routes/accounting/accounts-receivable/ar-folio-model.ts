export type FolioStatus = "pending" | "billed" | "void";
export type FolioType = "city_ledger" | "credit_card";

export interface ArFolio {
  id: string;
  folioNo: string;
  date: string;
  guestNo: string;
  customerId: string;
  customerCode: string;
  customerName: string;
  contact: string;
  description: string;
  syncRemark: string;
  amount: number;
  taxAmount: number;
  total: number;
  unbilled: number;
  source: string;
  type: FolioType;
  status: FolioStatus;
  invoices: { number: string; date: string; amount: number; status: string }[];
}

export const FOLIO_SAMPLES: ArFolio[] = [
  {
    id: "sample-folio-1",
    folioNo: "SAMPLE-PMS-0105",
    date: "2026-08-25",
    guestNo: "G:1024",
    customerId: "sample-travel",
    customerCode: "SAMPLE-C001",
    customerName: "Example Travel",
    contact: "Corporate reservations",
    description: "Room charges",
    syncRemark: "Night audit import",
    amount: 2000,
    taxAmount: 140,
    total: 2140,
    unbilled: 2140,
    source: "PMS",
    type: "city_ledger",
    status: "pending",
    invoices: [],
  },
  {
    id: "sample-folio-2",
    folioNo: "SAMPLE-PMS-0106",
    date: "2026-08-26",
    guestNo: "G:1031",
    customerId: "sample-corporate",
    customerCode: "SAMPLE-C002",
    customerName: "Example Corporate",
    contact: "Events department",
    description: "Banquet package",
    syncRemark: "Night audit import",
    amount: 10000,
    taxAmount: 700,
    total: 10700,
    unbilled: 5350,
    source: "PMS",
    type: "city_ledger",
    status: "pending",
    invoices: [
      {
        number: "SAMPLE-ARIV-001",
        date: "2026-08-27",
        amount: 5350,
        status: "posted",
      },
    ],
  },
  {
    id: "sample-folio-3",
    folioNo: "SAMPLE-POS-0107",
    date: "2026-08-27",
    guestNo: "G:1040",
    customerId: "sample-card",
    customerCode: "SAMPLE-CC01",
    customerName: "Example Card Settlement",
    contact: "Card settlement",
    description: "Restaurant charges",
    syncRemark: "POS import",
    amount: 5000,
    taxAmount: 350,
    total: 5350,
    unbilled: 0,
    source: "POS",
    type: "credit_card",
    status: "billed",
    invoices: [
      {
        number: "SAMPLE-ARIV-002",
        date: "2026-08-28",
        amount: 5350,
        status: "posted",
      },
    ],
  },
  {
    id: "sample-folio-4",
    folioNo: "SAMPLE-PMS-0108",
    date: "2026-08-28",
    guestNo: "G:1041",
    customerId: "sample-travel",
    customerCode: "SAMPLE-C001",
    customerName: "Example Travel",
    contact: "Corporate reservations",
    description: "Duplicate PMS import",
    syncRemark: "PMS posting error",
    amount: 1000,
    taxAmount: 70,
    total: 1070,
    unbilled: 0,
    source: "PMS",
    type: "city_ledger",
    status: "void",
    invoices: [],
  },
];

export function canChangeFolio(folio: ArFolio) {
  return (
    folio.status === "pending" &&
    folio.unbilled === folio.total &&
    folio.invoices.length === 0
  );
}

export function folioSummary(folios: ArFolio[]) {
  return {
    count: folios.length,
    total: folios.reduce((sum, folio) => sum + folio.total, 0),
    unbilled: folios.reduce((sum, folio) => sum + folio.unbilled, 0),
    billed: folios.reduce(
      (sum, folio) =>
        sum +
        folio.invoices.reduce((amount, invoice) => amount + invoice.amount, 0),
      0,
    ),
  };
}

export function filterFolios(
  folios: ArFolio[],
  search: string,
  values: Record<string, string>,
) {
  const query = search.trim().toLowerCase();
  const status = values.status || "pending";
  const type = values.type || "all";
  const [from, to] = (values.date?.split(":").at(-1) ?? "").split(",");
  return folios.filter(
    (folio) =>
      (status === "all" || folio.status === status) &&
      (type === "all" || folio.type === type) &&
      (!from || folio.date >= from) &&
      (!to || folio.date <= to) &&
      [
        folio.folioNo,
        folio.customerCode,
        folio.customerName,
        folio.guestNo,
        folio.description,
        folio.contact,
        folio.syncRemark,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query),
  );
}

// shortcut: session-only samples until a Folio API supports persistence.
const storageKey = (bu: string) => `carmen.ar.folio-samples.v1.${bu}`;

export function readFolioSamples(bu: string): ArFolio[] {
  const stored = sessionStorage.getItem(storageKey(bu));
  return stored ? JSON.parse(stored) : FOLIO_SAMPLES;
}

export function saveFolioSamples(bu: string, folios: ArFolio[]) {
  sessionStorage.setItem(storageKey(bu), JSON.stringify(folios));
}
