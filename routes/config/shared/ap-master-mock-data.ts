import type { ParamsDto, PaginatedResponse } from "@/types/params";
import type {
  ApMasterDependencies,
  ApMasterDimension,
  ApMasterMapping,
  PaymentTypeMaster,
  WhtFormMaster,
  WhtServiceTypeMaster,
} from "@/types/accounting-master";

export type MockMasterKind =
  "payment-types" | "wht-forms" | "wht-service-types";
export type MockMasterRow =
  PaymentTypeMaster | WhtFormMaster | WhtServiceTypeMaster;
const id = (value: number) =>
  `00000000-0000-4000-8000-${String(value).padStart(12, "0")}`;

// Sample data/defaults from the three HTML references; never used for AP posting.
export const MOCK_COST_CENTERS = [
  { id: id(11), code: "100", name: "Front Office" },
  { id: id(12), code: "900", name: "Finance & Accounting" },
  { id: id(13), code: "FNB", name: "Food & Beverage" },
];
export const MOCK_CHEQUE_FORMS = [
  "BBL Standard Form A",
  "KBANK Voucher Form B",
  "SCB Corporate Form C",
  "BAY Standard Form D",
].map((name, index) => ({ id: id(21 + index), name }));
export const MOCK_BANKS = [
  "BBL-HQ-MAIN",
  "KBANK-OPER-01",
  "SCB-CORP-MAIN",
  "BAY-PAYROLL-01",
].map((code, index) => ({
  id: id(31 + index),
  code,
  name: code,
  cheque_form_id: MOCK_CHEQUE_FORMS[index].id,
}));
export const MOCK_DIMENSIONS = [
  {
    code: "D1",
    name: "Market Segment",
    values: ["FIT", "OTA", "WALK-IN", "CORP"],
  },
  {
    code: "D3",
    name: "Project / Event Code",
    values: ["PRJ-HQ", "PRJ-EXPO", "PRJ-CATERING"],
  },
  {
    code: "D4",
    name: "Department Scope",
    values: [
      "DEPT-FIN",
      "DEPT-FO",
      "DEPT-FB",
      "FO-CASH",
      "HQ-FIN",
      "GEN",
      "POS-FB",
    ],
  },
  {
    code: "D6",
    name: "Tax Branch Code",
    values: ["TAX-DOMESTIC", "TAX-EXEMPT"],
  },
].map((item, index) => ({
  ...item,
  id: id(41 + index),
  values: item.values.map((code, valueIndex) => ({
    id: id(100 + index * 20 + valueIndex),
    code,
    name: code,
  })),
}));

function dimensions(values: Record<string, string>): ApMasterDimension[] {
  return Object.entries(values).map(([code, valueCode]) => {
    const category = MOCK_DIMENSIONS.find((item) => item.code === code)!;
    const value = category.values.find((item) => item.code === valueCode)!;
    return {
      gl_dimension_id: category.id,
      gl_dimension_value_id: value.id,
      dimension_code: code,
      dimension_name: category.name,
      value_code: value.code,
      value_name: value.name,
    };
  });
}
function account(
  index: number,
  code: string,
  name: string,
  costCenter: number,
  defaults: Record<string, string>,
  bank?: number,
) {
  return {
    id: id(201 + index),
    code,
    name,
    cost_center_id: id(costCenter),
    dimensions: dimensions(defaults),
    bank_account_id: bank ? id(bank) : null,
  };
}
export const MOCK_ACCOUNTS = [
  account(0, "1101-001", "Cash on Hand (Front Desk)", 11, { D4: "FO-CASH" }),
  account(
    1,
    "1102-010",
    "Cheque Clearing BBL (Bangkok Bank)",
    12,
    { D4: "HQ-FIN" },
    31,
  ),
  account(
    2,
    "1102-020",
    "Cheque Clearing KBANK (Kasikorn Bank)",
    12,
    { D4: "HQ-FIN" },
    32,
  ),
  account(3, "1103-005", "Bank Operating Account", 12, { D4: "GEN" }, 33),
  account(4, "1104-001", "Credit Card EDC Clearing Account", 13, {
    D4: "POS-FB",
  }),
  account(5, "2191-001", "WHT Payable ภ.ง.ด. 1", 12, {
    D4: "DEPT-FIN",
    D6: "TAX-DOMESTIC",
  }),
  account(6, "2191-002", "WHT Payable ภ.ง.ด. 2", 12, { D4: "DEPT-FIN" }),
  account(7, "2191-003", "WHT Payable ภ.ง.ด. 3", 12, {
    D1: "FIT",
    D4: "DEPT-FIN",
    D6: "TAX-DOMESTIC",
  }),
  account(8, "2191-053", "WHT Payable ภ.ง.ด. 53", 12, {
    D1: "CORP",
    D3: "PRJ-HQ",
    D6: "TAX-DOMESTIC",
  }),
];

export function mockAccountDefaults(
  accountId: string | null | undefined,
): ApMasterMapping {
  const selected = MOCK_ACCOUNTS.find((item) => item.id === accountId);
  return {
    chart_of_accounts_id: selected?.id ?? null,
    cost_center_id: selected?.cost_center_id ?? null,
    dimensions: structuredClone(selected?.dimensions ?? []),
  };
}
export function mockChequeForm(
  bankId: string | null | undefined,
): string | null {
  return MOCK_BANKS.find((item) => item.id === bankId)?.cheque_form_id ?? null;
}
export function enrichMockMaster<T extends MockMasterRow>(row: T): T {
  if (!("chart_of_accounts_id" in row)) return row;
  const selected = MOCK_ACCOUNTS.find(
    (item) => item.id === row.chart_of_accounts_id,
  );
  const cc = MOCK_COST_CENTERS.find((item) => item.id === row.cost_center_id);
  const bank =
    "bank_account_id" in row
      ? MOCK_BANKS.find((item) => item.id === row.bank_account_id)
      : undefined;
  const cheque =
    "cheque_form_id" in row
      ? MOCK_CHEQUE_FORMS.find((item) => item.id === row.cheque_form_id)
      : undefined;
  return {
    ...row,
    account_code: selected?.code,
    account_name: selected?.name,
    cost_center_code: cc?.code,
    cost_center_name: cc?.name,
    bank_account_code: bank?.code,
    bank_account_name: bank?.name,
    cheque_form_name: cheque?.name,
    dimensions: row.dimensions.map((dimension) => {
      const category = MOCK_DIMENSIONS.find(
        (item) => item.id === dimension.gl_dimension_id,
      );
      const value = category?.values.find(
        (item) => item.id === dimension.gl_dimension_value_id,
      );
      return {
        ...dimension,
        dimension_code: category?.code,
        dimension_name: category?.name,
        value_code: value?.code,
        value_name: value?.name,
      };
    }),
  };
}

export function mockMasterKind(endpoint: string): MockMasterKind {
  const kind = endpoint.split("/").at(-1);
  if (
    kind !== "payment-types" &&
    kind !== "wht-forms" &&
    kind !== "wht-service-types"
  )
    throw new Error("Unknown master mockup");
  return kind;
}

export function initialMockMasters(kind: MockMasterKind): MockMasterRow[] {
  const base = (
    value: number,
    code: string,
    description: string,
    active = true,
  ) => ({
    id: id(value),
    code,
    description,
    is_active: active,
    doc_version: 0,
  });
  if (kind === "wht-service-types")
    return [
      ["01", "ค่าบริการ / Service Fee (P.N.D. 3/53)", 3],
      ["02", "ค่าเช่าอาคารและสถานที่ / Building Rental Fee", 5],
      ["03", "ค่าขนส่งและโลจิสติกส์ / Transportation Fee", 1],
      ["04", "ค่าจ้างทำของ / Hired Labor & Manufacturing", 3],
      ["05", "ค่าโฆษณาและประชาสัมพันธ์ / Advertising Fee", 2],
      ["06", "ค่าเบี้ยประกันภัย / Insurance Premium (P.N.D. 53)", 1],
    ].map(([code, description, rate], index) => ({
      ...base(1000 + index, String(code), String(description), index !== 5),
      rate_percent: Number(rate),
    }));
  if (kind === "wht-forms")
    return ["1", "2", "3", "53"].map((code, index) =>
      enrichMockMaster({
        ...base(
          2000 + index,
          code,
          [
            "ภ.ง.ด. 1 (Personal Employment)",
            "ภ.ง.ด. 2 (Personal Service/Asset)",
            "ภ.ง.ด. 3 (Personal Service)",
            "ภ.ง.ด. 53 (Corporate Service)",
          ][index],
        ),
        ...mockAccountDefaults(MOCK_ACCOUNTS[5 + index].id),
      }),
    );
  return [
    ["CASH", "Petty Cash Payment", 0, false],
    ["CHQ-BBL", "Bangkok Bank Cheque", 1, true],
    ["CHQ-KBANK", "Kasikorn Bank Cheque", 2, true],
    ["BANK-TRF", "Bank Direct Wire Transfer", 3, false],
    ["OLD-PAY", "Legacy Payment Method", 0, false],
  ].map(([code, description, accountIndex, cheque], index) => {
    const selected = MOCK_ACCOUNTS[Number(accountIndex)];
    return enrichMockMaster({
      ...base(3000 + index, String(code), String(description), index !== 4),
      ...mockAccountDefaults(selected.id),
      chart_of_accounts_id: selected.id,
      available_ap: true,
      available_ar: index === 0,
      bank_account_id: selected.bank_account_id,
      is_cheque: Boolean(cheque),
      cheque_form_id: cheque ? mockChequeForm(selected.bank_account_id) : null,
    });
  });
}

export function mockDependencies(
  kind: MockMasterKind,
  code: string,
): ApMasterDependencies {
  const vendors =
    kind === "payment-types" && code === "CHQ-BBL"
      ? ["V004 (AMATI INVOCATION CO., LTD)", "V012 (SUPREME OFFICE SUPPLIES)"]
      : kind === "wht-forms" && code === "3"
        ? [
            "VEND-001 (Siam Fresh Supplies)",
            "VEND-004 (Bangkok Laundry Co., Ltd)",
          ]
        : kind === "wht-service-types"
          ? ((
              {
                "01": [
                  "BANGKOK SUPPLIER CO., LTD.",
                  "HOTEL MAINTENANCE THAILAND",
                  "CLEANING SERVICE PLUS",
                ],
                "02": ["CP LAND PUBLIC CO., LTD."],
                "03": ["EXPRESS LOGISTICS THAILAND"],
                "04": ["CRAFT PRINTING HOUSE"],
              } as Record<string, string[]>
            )[code] ?? [])
          : [];
  const history =
    kind === "payment-types"
      ? (({ CASH: 7, "CHQ-BBL": 3, "BANK-TRF": 9 } as Record<string, number>)[
          code
        ] ?? 0)
      : kind === "wht-forms"
        ? (({ "1": 3, "3": 6, "53": 8 } as Record<string, number>)[code] ?? 0)
        : (({ "01": 11, "02": 4, "03": 7, "04": 1 } as Record<string, number>)[
            code
          ] ?? 0);
  const references = [
    ...(vendors.length
      ? [{ type: "vendor", count: vendors.length, names: vendors }]
      : []),
    ...(history ? [{ type: "ap_payment", count: history }] : []),
  ];
  return {
    is_used: references.length > 0,
    can_delete: references.length === 0,
    can_deactivate:
      kind === "wht-service-types"
        ? references.length === 0
        : vendors.length === 0,
    references,
  };
}

export function mockMasterPage<T extends MockMasterRow>(
  rows: T[],
  params: ParamsDto = {},
): PaginatedResponse<T> {
  const search = params.search?.trim().toLowerCase() ?? "";
  const active = params.filter?.match(/is_active\|bool:(true|false)/)?.[1];
  const filtered = rows.filter(
    (row) =>
      [
        row.code,
        row.description,
        "rate_percent" in row ? Number(row.rate_percent).toFixed(2) : "",
        "account_code" in row ? row.account_code : "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(search) &&
      (!active || row.is_active === (active === "true")),
  );
  const [key, direction] = (params.sort ?? "code:asc").split(":");
  filtered.sort((a, b) => {
    const left = a[key as keyof T],
      right = b[key as keyof T];
    const comparison =
      key === "rate_percent"
        ? Number(left) - Number(right)
        : String(left ?? "").localeCompare(String(right ?? ""), undefined, {
            numeric: true,
          });
    return comparison * (direction === "desc" ? -1 : 1);
  });
  const page = Math.max(1, Number(params.page) || 1),
    perpage = Math.max(1, Number(params.perpage) || 10);
  return {
    data: filtered.slice((page - 1) * perpage, page * perpage),
    paginate: {
      page,
      perpage,
      total: filtered.length,
      pages: Math.max(1, Math.ceil(filtered.length / perpage)),
    },
  };
}
