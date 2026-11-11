export interface ArInvoiceLine {
  id: string;
  description: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  taxRate: number;
  tax2Rate: number;
  tax1Account: string;
  tax1CostCenter: string;
  tax2Account: string;
  tax2CostCenter: string;
  account: string;
  costCenter: string;
  arAccount: string;
  arCostCenter: string;
  dimensions: string;
  reference: string;
  dateFrom: string;
  dateTo: string;
  groupNo: number;
  source: "Manual" | "PMS Folio";
}

export type ArDocumentType = "ARIV" | "ARCN" | "ARDN" | "ARDP" | "ARRC";

export const AR_DOC_TYPE_LABELS: Record<
  ArDocumentType,
  { label: string; prefix: string; description: string }
> = {
  ARIV: { label: "ARIV", prefix: "ARIV", description: "Invoice (ใบแจ้งหนี้)" },
  ARCN: { label: "ARCN", prefix: "ARCN", description: "Credit Note (ใบลดหนี้)" },
  ARDN: { label: "ARDN", prefix: "ARDN", description: "Debit Note (ใบเพิ่มหนี้)" },
  ARDP: { label: "ARDP", prefix: "ARDP", description: "Advance Deposit (เงินรับมัดจำ)" },
  ARRC: { label: "ARRC", prefix: "ARRC", description: "Official Receipt (ใบเสร็จรับเงิน)" },
};

export interface ArInvoice {
  id: string;
  docNo: string;
  docType: ArDocumentType;
  originalInvoiceNo?: string;
  inputDate: string;
  customerCode: string;
  customerName: string;
  currency: string;
  exchangeRate: number;
  status: "Draft" | "Submitted" | "Approved" | "Posted" | "Void";
  source: "Manual" | "PMS Folio" | "Copy";
  sourceDoc: string;
  taxInvoice: boolean;
  taxInvoiceNo: string;
  creditDays: number;
  description: string;
  whtRecorded: boolean;
  whtAmount: number;
  taxName: string;
  taxId: string;
  branchNo: string;
  address1: string;
  address2: string;
  province: string;
  postalCode: string;
  lines: ArInvoiceLine[];
  depositAmount: number;
  depositRate: number;
  receiptAmount: number;
}

export const AR_INVOICE_PATH = "/accounting/accounts-receivable/preview/invoice";

export const AR_INVOICES: ArInvoice[] = [
  {
    id: "ar-1",
    docNo: "ARIV26090001",
    docType: "ARIV",
    inputDate: "2026-09-20",
    customerCode: "AR-OTA-001",
    customerName: "Agoda Company",
    currency: "USD",
    exchangeRate: 35,
    status: "Submitted",
    source: "Manual",
    sourceDoc: "",
    taxInvoice: true,
    taxInvoiceNo: "TXIV26090001",
    creditDays: 30,
    description: "September room sales — Agoda",
    whtRecorded: true,
    whtAmount: 2.7,
    taxName: "Agoda Company Pte. Ltd.",
    taxId: "0105556000123",
    branchNo: "00000",
    address1: "123 Sukhumvit Road",
    address2: "Khlong Toei",
    province: "Bangkok",
    postalCode: "10110",
    lines: [
      {
        id: "ar-line-1",
        description: "Room sales — September",
        unit: "ROOM",
        quantity: 1,
        unitPrice: 100,
        discount: 10,
        taxRate: 7,
        tax2Rate: 0,
        tax1Account: "2151000",
        tax1CostCenter: "GEN",
        tax2Account: "2180000",
        tax2CostCenter: "GEN",
        account: "4110000",
        costCenter: "101",
        arAccount: "1130000",
        arCostCenter: "GEN",
        dimensions: "Market: OTA_FIT",
        reference: "FOL2609-0112 · Mr. J*** D**",
        dateFrom: "2026-09-18",
        dateTo: "2026-09-20",
        groupNo: 1,
        source: "Manual",
      },
    ],
    depositAmount: 21.4,
    depositRate: 34,
    receiptAmount: 0,
  },
  {
    id: "ar-2",
    docNo: "ARIV26090002",
    docType: "ARIV",
    inputDate: "2026-09-22",
    customerCode: "AR-OTA-002",
    customerName: "Booking.com B.V.",
    currency: "THB",
    exchangeRate: 1,
    status: "Draft",
    source: "PMS Folio",
    sourceDoc: "FOL2609-0188",
    taxInvoice: false,
    taxInvoiceNo: "",
    creditDays: 15,
    description: "City ledger — September folio",
    whtRecorded: false,
    whtAmount: 0,
    taxName: "Booking.com B.V.",
    taxId: "",
    branchNo: "00000",
    address1: "",
    address2: "",
    province: "",
    postalCode: "",
    lines: [
      {
        id: "ar-line-2",
        description: "Accommodation — PMS folio",
        unit: "NIGHT",
        quantity: 2,
        unitPrice: 4500,
        discount: 0,
        taxRate: 7,
        tax2Rate: 0,
        tax1Account: "2151000",
        tax1CostCenter: "GEN",
        tax2Account: "2180000",
        tax2CostCenter: "GEN",
        account: "4110000",
        costCenter: "101",
        arAccount: "1130000",
        arCostCenter: "GEN",
        dimensions: "Market: OTA_FIT",
        reference: "FOL2609-0188 · Ms. A*** P**",
        dateFrom: "2026-09-20",
        dateTo: "2026-09-22",
        groupNo: 1,
        source: "PMS Folio",
      },
    ],
    depositAmount: 0,
    depositRate: 1,
    receiptAmount: 0,
  },
  {
    id: "ar-cn-1",
    docNo: "ARCN26090001",
    docType: "ARCN",
    originalInvoiceNo: "ARIV26090001",
    inputDate: "2026-09-23",
    customerCode: "AR-OTA-001",
    customerName: "Agoda Company",
    currency: "USD",
    exchangeRate: 35,
    status: "Submitted",
    source: "Manual",
    sourceDoc: "ARIV26090001",
    taxInvoice: true,
    taxInvoiceNo: "TXCN26090001",
    creditDays: 0,
    description: "Credit Note - Room rebate for cancelled pax",
    whtRecorded: false,
    whtAmount: 0,
    taxName: "Agoda Company Pte. Ltd.",
    taxId: "0105556000123",
    branchNo: "00000",
    address1: "123 Sukhumvit Road",
    address2: "Khlong Toei",
    province: "Bangkok",
    postalCode: "10110",
    lines: [
      {
        id: "ar-cn-line-1",
        description: "Rebate on Room rate adjustment",
        unit: "ROOM",
        quantity: 1,
        unitPrice: 20,
        discount: 0,
        taxRate: 7,
        tax2Rate: 0,
        tax1Account: "2151000",
        tax1CostCenter: "GEN",
        tax2Account: "2180000",
        tax2CostCenter: "GEN",
        account: "4110000",
        costCenter: "101",
        arAccount: "1130000",
        arCostCenter: "GEN",
        dimensions: "Market: OTA_FIT",
        reference: "ARIV26090001 Rebate",
        dateFrom: "2026-09-18",
        dateTo: "2026-09-20",
        groupNo: 1,
        source: "Manual",
      },
    ],
    depositAmount: 0,
    depositRate: 35,
    receiptAmount: 0,
  },
  {
    id: "ar-dn-1",
    docNo: "ARDN26090001",
    docType: "ARDN",
    originalInvoiceNo: "ARIV26090001",
    inputDate: "2026-09-24",
    customerCode: "AR-OTA-001",
    customerName: "Agoda Company",
    currency: "USD",
    exchangeRate: 35,
    status: "Draft",
    source: "Manual",
    sourceDoc: "ARIV26090001",
    taxInvoice: true,
    taxInvoiceNo: "TXDN26090001",
    creditDays: 15,
    description: "Debit Note - Extra bed surcharge and airport transfer",
    whtRecorded: false,
    whtAmount: 0,
    taxName: "Agoda Company Pte. Ltd.",
    taxId: "0105556000123",
    branchNo: "00000",
    address1: "123 Sukhumvit Road",
    address2: "Khlong Toei",
    province: "Bangkok",
    postalCode: "10110",
    lines: [
      {
        id: "ar-dn-line-1",
        description: "Airport transfer service",
        unit: "TRIP",
        quantity: 1,
        unitPrice: 35,
        discount: 0,
        taxRate: 7,
        tax2Rate: 0,
        tax1Account: "2151000",
        tax1CostCenter: "GEN",
        tax2Account: "2180000",
        tax2CostCenter: "GEN",
        account: "4120000",
        costCenter: "301",
        arAccount: "1130000",
        arCostCenter: "GEN",
        dimensions: "Market: OTA_FIT",
        reference: "Transfer voucher TR-902",
        dateFrom: "2026-09-20",
        dateTo: "2026-09-20",
        groupNo: 1,
        source: "Manual",
      },
    ],
    depositAmount: 0,
    depositRate: 35,
    receiptAmount: 0,
  },
  {
    id: "ar-dp-1",
    docNo: "ARDP26090001",
    docType: "ARDP",
    inputDate: "2026-09-15",
    customerCode: "AR-CORP-001",
    customerName: "Siam Cement Group (SCG)",
    currency: "THB",
    exchangeRate: 1,
    status: "Posted",
    source: "Manual",
    sourceDoc: "AGR-2026-SCG",
    taxInvoice: true,
    taxInvoiceNo: "TXDP26090001",
    creditDays: 0,
    description: "Advance deposit for Annual Management Seminar 2026",
    whtRecorded: true,
    whtAmount: 300,
    taxName: "The Siam Cement Public Co., Ltd.",
    taxId: "0107537000114",
    branchNo: "00000",
    address1: "1 Siam Cement Road",
    address2: "Bangsue",
    province: "Bangkok",
    postalCode: "10800",
    lines: [
      {
        id: "ar-dp-line-1",
        description: "Advance 50% Event Deposit (Banquet & Ballroom)",
        unit: "EVENT",
        quantity: 1,
        unitPrice: 50000,
        discount: 0,
        taxRate: 7,
        tax2Rate: 0,
        tax1Account: "2151000",
        tax1CostCenter: "GEN",
        tax2Account: "2180000",
        tax2CostCenter: "GEN",
        account: "2140000",
        costCenter: "201",
        arAccount: "1130000",
        arCostCenter: "GEN",
        dimensions: "Project: CORP_EVENT",
        reference: "Contract SCG-2026-Q3",
        dateFrom: "2026-10-15",
        dateTo: "2026-10-16",
        groupNo: 1,
        source: "Manual",
      },
    ],
    depositAmount: 0,
    depositRate: 1,
    receiptAmount: 53500,
  },
  {
    id: "ar-rc-1",
    docNo: "ARRC26090001",
    docType: "ARRC",
    originalInvoiceNo: "ARIV26090001",
    inputDate: "2026-09-25",
    customerCode: "AR-OTA-001",
    customerName: "Agoda Company",
    currency: "USD",
    exchangeRate: 35,
    status: "Posted",
    source: "Manual",
    sourceDoc: "ARIV26090001",
    taxInvoice: true,
    taxInvoiceNo: "TXRC26090001",
    creditDays: 0,
    description: "Official Receipt / Full payment settlement",
    whtRecorded: true,
    whtAmount: 2.7,
    taxName: "Agoda Company Pte. Ltd.",
    taxId: "0105556000123",
    branchNo: "00000",
    address1: "123 Sukhumvit Road",
    address2: "Khlong Toei",
    province: "Bangkok",
    postalCode: "10110",
    lines: [
      {
        id: "ar-rc-line-1",
        description: "Official receipt payment settlement for ARIV26090001",
        unit: "RECEIPT",
        quantity: 1,
        unitPrice: 90,
        discount: 0,
        taxRate: 7,
        tax2Rate: 0,
        tax1Account: "2151000",
        tax1CostCenter: "GEN",
        tax2Account: "2180000",
        tax2CostCenter: "GEN",
        account: "1112001",
        costCenter: "800",
        arAccount: "1130000",
        arCostCenter: "GEN",
        dimensions: "Market: OTA_FIT",
        reference: "Wire Transfer KBANK-0925",
        dateFrom: "2026-09-20",
        dateTo: "2026-09-25",
        groupNo: 1,
        source: "Manual",
      },
    ],
    depositAmount: 21.4,
    depositRate: 35,
    receiptAmount: 74.9,
  },
];


export const money = (value: number) =>
  value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const round2 = (value: number) =>
  Math.round((value + Number.EPSILON) * 100) / 100;

export function lineTotals(line: ArInvoiceLine) {
  const subtotal = round2(line.quantity * line.unitPrice);
  const net = round2(subtotal - line.discount);
  const tax1 = round2((net * line.taxRate) / 100);
  const tax2 = round2((net * line.tax2Rate) / 100);
  return {
    subtotal,
    net,
    tax1,
    tax2,
    tax: round2(tax1 + tax2),
    total: round2(net + tax1 + tax2),
  };
}

export function invoiceTotals(invoice: ArInvoice) {
  const rows = invoice.lines.map(lineTotals);
  const subtotal = round2(rows.reduce((sum, row) => sum + row.subtotal, 0));
  const discount = round2(
    rows.reduce((sum, row) => sum + (row.subtotal - row.net), 0),
  );
  const net = round2(subtotal - discount);
  const tax = round2(rows.reduce((sum, row) => sum + row.tax, 0));
  const tax1 = round2(rows.reduce((sum, row) => sum + row.tax1, 0));
  const tax2 = round2(rows.reduce((sum, row) => sum + row.tax2, 0));
  const total = round2(net + tax);
  const unpaid = Math.max(
    0,
    round2(total - invoice.depositAmount - invoice.receiptAmount),
  );
  return { subtotal, discount, net, tax1, tax2, tax, total, unpaid };
}

export function lineUnpaid(invoice: ArInvoice, index: number) {
  const applied = invoice.depositAmount + invoice.receiptAmount;
  const prior = invoice.lines
    .slice(0, index)
    .reduce((sum, line) => sum + lineTotals(line).total, 0);
  return round2(
    Math.max(
      0,
      lineTotals(invoice.lines[index]).total - Math.max(0, applied - prior),
    ),
  );
}

export function journalPreviewTotals(invoice: ArInvoice) {
  const totals = invoiceTotals(invoice);
  const debit = round2(totals.total * invoice.exchangeRate);
  const credit = round2(
    invoice.lines.reduce((sum, line) => {
      const row = lineTotals(line);
      return (
        sum +
        round2(row.net * invoice.exchangeRate) +
        round2(row.tax1 * invoice.exchangeRate) +
        round2(row.tax2 * invoice.exchangeRate)
      );
    }, 0),
  );
  return { debit, credit, variance: round2(debit - credit) };
}

export function dueDate(inputDate: string, creditDays: number) {
  const date = new Date(`${inputDate}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + creditDays);
  return date.toISOString().slice(0, 10);
}

export function newArInvoice(docType: ArDocumentType = "ARIV"): ArInvoice {
  return {
    ...AR_INVOICES[0],
    id: "new",
    docNo: "Auto-generated",
    docType,
    inputDate: new Date().toISOString().slice(0, 10),
    customerCode: "",
    customerName: "",
    currency: "THB",
    exchangeRate: 1,
    status: "Draft",
    source: "Manual",
    sourceDoc: "",
    taxInvoice: false,
    taxInvoiceNo: "",
    creditDays: 0,
    description: "",
    whtRecorded: false,
    whtAmount: 0,
    taxName: "",
    taxId: "",
    branchNo: "00000",
    address1: "",
    address2: "",
    province: "",
    postalCode: "",
    lines: [],
    depositAmount: 0,
    depositRate: 1,
    receiptAmount: 0,
  };
}
