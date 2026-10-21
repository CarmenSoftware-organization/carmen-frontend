import { useCallback, useState } from "react";
import type { AccountCategory } from "@/types/chart-of-accounts";

export interface TitleMaster {
  id: string;
  code: string;
  description: string;
  is_active: boolean;
  is_system: boolean;
  reference_count: number;
}

export interface AccountGroupMaster {
  id: string;
  code: string;
  name: string;
  name_local?: string | null;
  level: 1 | 2 | 3 | 4;
  parent_id: string | null;
  category: AccountCategory;
  sort_order: number;
  is_active: boolean;
  account_count: number;
  note?: string | null;
  doc_version: number;
}

export interface JvPrefixMaster {
  id: string;
  code: string;
  description: string;
  description_local?: string | null;
  is_default: boolean;
  is_system: boolean;
  is_active: boolean;
  doc_version: number;
}

export interface DimensionValueMaster {
  id: string;
  dimension_id: string;
  code: string;
  name: string;
  name_local?: string | null;
  effective_from?: string | null;
  effective_to?: string | null;
  is_active: boolean;
  doc_version: number;
}

export interface DimensionMaster {
  id: string;
  code: string;
  name: string;
  name_local?: string | null;
  sequence: number;
  is_active: boolean;
  values?: DimensionValueMaster[];
  doc_version: number;
}

export interface BankAccountMaster {
  id: string;
  bank_name: string;
  account_number: string;
  account_name: string;
  branch_name?: string | null;
  gl_account_id?: string | null;
  currency_code: string;
  is_active: boolean;
  doc_version: number;
}

export interface GlPeriodMaster {
  id: string;
  fiscal_year: number;
  period_number: number;
  start_date: string;
  end_date: string;
  status: "open" | "closed" | "locked";
  doc_version: number;
}

export interface PaymentTypeMaster {
  id: string;
  code: string;
  description: string;
  description_local?: string | null;
  payment_method: string;
  is_active: boolean;
  doc_version: number;
}

export interface WhtServiceTypeMaster {
  id: string;
  code: string;
  description: string;
  default_rate: string;
  is_active: boolean;
  doc_version: number;
}

export interface WhtFormMaster {
  id: string;
  code: string;
  description: string;
  form_type: string;
  gl_account_id?: string | null;
  is_active: boolean;
  doc_version: number;
}

export interface AssetCategoryMaster {
  id: string;
  code: string;
  description: string;
  useful_life_years: number;
  asset_account_id?: string | null;
  accum_dep_account_id?: string | null;
  dep_expense_account_id?: string | null;
  is_active: boolean;
  doc_version: number;
}

interface AccountingMasterState {
  titles: TitleMaster[];
  accountGroups: AccountGroupMaster[];
  jvPrefixes: JvPrefixMaster[];
  dimensions: DimensionMaster[];
  bankAccounts: BankAccountMaster[];
  glPeriods: GlPeriodMaster[];
  paymentTypes: PaymentTypeMaster[];
  whtServiceTypes: WhtServiceTypeMaster[];
  whtForms: WhtFormMaster[];
  assetCategories: AssetCategoryMaster[];
}

const STORAGE_KEY = "carmen-accounting-master-mock-v2";

const seed: AccountingMasterState = {
  titles: [
    {
      id: "title-mr",
      code: "MR",
      description: "Mr.",
      is_active: true,
      is_system: true,
      reference_count: 18,
    },
    {
      id: "title-mrs",
      code: "MRS",
      description: "Mrs.",
      is_active: true,
      is_system: true,
      reference_count: 9,
    },
    {
      id: "title-dr",
      code: "DR",
      description: "Dr.",
      is_active: true,
      is_system: false,
      reference_count: 2,
    },
    {
      id: "title-khun",
      code: "KHUN",
      description: "Khun",
      is_active: false,
      is_system: false,
      reference_count: 0,
    },
  ],
  accountGroups: [
    {
      id: "group-assets",
      code: "1000",
      name: "Assets",
      name_local: "สินทรัพย์",
      level: 1,
      parent_id: null,
      category: "asset",
      sort_order: 1,
      is_active: true,
      account_count: 42,
      doc_version: 0,
    },
    {
      id: "group-current-assets",
      code: "1100",
      name: "Current Assets",
      name_local: "สินทรัพย์หมุนเวียน",
      level: 2,
      parent_id: "group-assets",
      category: "asset",
      sort_order: 1,
      is_active: true,
      account_count: 18,
      doc_version: 0,
    },
    {
      id: "group-cash",
      code: "1110",
      name: "Cash and Cash Equivalents",
      name_local: "เงินสดและรายการเทียบเท่าเงินสด",
      level: 3,
      parent_id: "group-current-assets",
      category: "asset",
      sort_order: 1,
      is_active: true,
      account_count: 7,
      doc_version: 0,
    },
    {
      id: "group-expense",
      code: "5000",
      name: "Operating Expenses",
      name_local: "ค่าใช้จ่ายในการดำเนินงาน",
      level: 1,
      parent_id: null,
      category: "expense",
      sort_order: 2,
      is_active: true,
      account_count: 61,
      doc_version: 0,
    },
    {
      id: "group-rooms",
      code: "5100",
      name: "Rooms Department",
      name_local: "แผนกห้องพัก",
      level: 2,
      parent_id: "group-expense",
      category: "expense",
      sort_order: 1,
      is_active: true,
      account_count: 16,
      doc_version: 0,
    },
  ],
  jvPrefixes: [
    {
      id: "jv-pfx-aj",
      code: "AJ",
      description: "Adjustment Voucher",
      description_local: "ใบสำคัญปรับปรุง",
      is_default: true,
      is_system: true,
      is_active: true,
      doc_version: 0,
    },
    {
      id: "jv-pfx-rv",
      code: "RV",
      description: "Receipt Voucher",
      description_local: "ใบสำคัญรับเงิน",
      is_default: false,
      is_system: false,
      is_active: true,
      doc_version: 0,
    },
    {
      id: "jv-pfx-pv",
      code: "PV",
      description: "Payment Voucher",
      description_local: "ใบสำคัญจ่ายเงิน",
      is_default: false,
      is_system: true,
      is_active: true,
      doc_version: 0,
    },
  ],
  dimensions: [
    {
      id: "dim-dept",
      code: "department",
      name: "Department Dimension",
      name_local: "มิติแผนกงาน",
      sequence: 1,
      is_active: true,
      doc_version: 0,
      values: [
        {
          id: "dimv-fb",
          dimension_id: "dim-dept",
          code: "FB",
          name: "Food & Beverage",
          name_local: "อาหารและเครื่องดื่ม",
          is_active: true,
          doc_version: 0,
        },
        {
          id: "dimv-hk",
          dimension_id: "dim-dept",
          code: "HK",
          name: "Housekeeping",
          name_local: "แม่บ้าน",
          is_active: true,
          doc_version: 0,
        },
      ],
    },
    {
      id: "dim-market",
      code: "market",
      name: "Market Segment",
      name_local: "กลุ่มตลาด",
      sequence: 2,
      is_active: true,
      doc_version: 0,
      values: [
        {
          id: "dimv-corp",
          dimension_id: "dim-market",
          code: "CORP",
          name: "Corporate",
          name_local: "องค์กร",
          is_active: true,
          doc_version: 0,
        },
      ],
    },
  ],
  bankAccounts: [
    {
      id: "bank-kbank-01",
      bank_name: "Kasikorn Bank (KBANK)",
      account_number: "712-2-98421-0",
      account_name: "Riverside Hotels (Thailand) Co., Ltd.",
      branch_name: "Silom Complex",
      gl_account_id: "1112-01",
      currency_code: "THB",
      is_active: true,
      doc_version: 0,
    },
    {
      id: "bank-scb-01",
      bank_name: "Siam Commercial Bank (SCB)",
      account_number: "045-3-11982-4",
      account_name: "Riverside Hotels (Thailand) Co., Ltd.",
      branch_name: "Thonglor",
      gl_account_id: "1112-02",
      currency_code: "THB",
      is_active: true,
      doc_version: 0,
    },
  ],
  glPeriods: [
    {
      id: "per-2026-01",
      fiscal_year: 2026,
      period_number: 1,
      start_date: "2026-01-01",
      end_date: "2026-01-31",
      status: "closed",
      doc_version: 0,
    },
    {
      id: "per-2026-02",
      fiscal_year: 2026,
      period_number: 2,
      start_date: "2026-02-01",
      end_date: "2026-02-28",
      status: "closed",
      doc_version: 0,
    },
    {
      id: "per-2026-03",
      fiscal_year: 2026,
      period_number: 3,
      start_date: "2026-03-01",
      end_date: "2026-03-31",
      status: "open",
      doc_version: 0,
    },
    {
      id: "per-2026-04",
      fiscal_year: 2026,
      period_number: 4,
      start_date: "2026-04-01",
      end_date: "2026-04-30",
      status: "open",
      doc_version: 0,
    },
  ],
  paymentTypes: [
    {
      id: "pm-transfer",
      code: "TRANSFER",
      description: "Bank Transfer",
      description_local: "โอนเงินผ่านธนาคาร",
      payment_method: "transfer",
      is_active: true,
      doc_version: 0,
    },
    {
      id: "pm-cheque",
      code: "CHEQUE",
      description: "Bank Cheque",
      description_local: "เช็คธนาคาร",
      payment_method: "cheque",
      is_active: true,
      doc_version: 0,
    },
    {
      id: "pm-cash",
      code: "CASH",
      description: "Petty Cash",
      description_local: "เงินสดย่อย",
      payment_method: "cash",
      is_active: true,
      doc_version: 0,
    },
  ],
  whtServiceTypes: [
    {
      id: "wht-service-3",
      code: "WHT-SVC",
      description: "Service Fee (ค่าจ้างบริการ/ทำของ)",
      default_rate: "3.00",
      is_active: true,
      doc_version: 0,
    },
    {
      id: "wht-rent-5",
      code: "WHT-RENT",
      description: "Rental Fee (ค่าเช่าทรัพย์สิน)",
      default_rate: "5.00",
      is_active: true,
      doc_version: 0,
    },
    {
      id: "wht-transport-1",
      code: "WHT-TRANS",
      description: "Transportation (ค่าขนส่ง)",
      default_rate: "1.00",
      is_active: true,
      doc_version: 0,
    },
  ],
  whtForms: [
    {
      id: "wht-form-pnd3",
      code: "PND3",
      description: "ภ.ง.ด. 3 (บุคคลธรรมดา)",
      form_type: "pnd3",
      gl_account_id: "2141-01",
      is_active: true,
      doc_version: 0,
    },
    {
      id: "wht-form-pnd53",
      code: "PND53",
      description: "ภ.ง.ด. 53 (นิติบุคคล)",
      form_type: "pnd53",
      gl_account_id: "2141-02",
      is_active: true,
      doc_version: 0,
    },
  ],
  assetCategories: [
    {
      id: "ast-comp",
      code: "COMP",
      description: "Computer Hardware & Software",
      useful_life_years: 3,
      asset_account_id: "1410-01",
      accum_dep_account_id: "1419-01",
      dep_expense_account_id: "5310-01",
      is_active: true,
      doc_version: 0,
    },
    {
      id: "ast-furn",
      code: "FURN",
      description: "Furniture & Fixtures",
      useful_life_years: 5,
      asset_account_id: "1420-01",
      accum_dep_account_id: "1429-01",
      dep_expense_account_id: "5320-01",
      is_active: true,
      doc_version: 0,
    },
  ],
};

function cloneSeed(): AccountingMasterState {
  return structuredClone(seed);
}

function readState(): AccountingMasterState {
  if (typeof window === "undefined") return cloneSeed();
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (!stored) return cloneSeed();
  try {
    return JSON.parse(stored) as AccountingMasterState;
  } catch {
    return cloneSeed();
  }
}

function writeState(state: AccountingMasterState) {
  if (typeof window !== "undefined")
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// --- Title ---
export function saveTitleState(
  state: AccountingMasterState,
  input: Omit<TitleMaster, "id" | "is_system" | "reference_count">,
  id?: string,
): AccountingMasterState {
  const current = state.titles.find((item) => item.id === id);
  const code = current?.code ?? input.code.trim().toUpperCase();
  if (
    state.titles.some(
      (item) => item.code.toUpperCase() === code && item.id !== id,
    )
  )
    throw new Error(`Title code ${code} already exists.`);
  if (current?.is_active && !input.is_active && current.reference_count > 0)
    throw new Error(
      `${current.code} is referenced by ${current.reference_count} active records.`,
    );
  return {
    ...state,
    titles: id
      ? state.titles.map((item) =>
          item.id === id
            ? {
                ...item,
                description: input.description.trim(),
                is_active: input.is_active,
              }
            : item,
        )
      : [
          ...state.titles,
          {
            id: crypto.randomUUID(),
            code,
            description: input.description.trim(),
            is_active: input.is_active,
            is_system: false,
            reference_count: 0,
          },
        ],
  };
}

export function deleteTitleState(
  state: AccountingMasterState,
  item: TitleMaster,
): AccountingMasterState {
  if (item.is_system) throw new Error(`${item.code} is system reserved.`);
  if (item.reference_count > 0)
    throw new Error(
      `${item.code} is referenced by ${item.reference_count} records.`,
    );
  return {
    ...state,
    titles: state.titles.filter((title) => title.id !== item.id),
  };
}

export function getDescendantGroupIds(
  groups: AccountGroupMaster[],
  rootId: string,
): Set<string> {
  const descendants = new Set<string>();
  const queue = [rootId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const g of groups) {
      if (g.parent_id === current && !descendants.has(g.id)) {
        descendants.add(g.id);
        queue.push(g.id);
      }
    }
  }
  return descendants;
}

// --- Account Group ---
export function saveAccountGroupState(
  state: AccountingMasterState,
  input: Omit<AccountGroupMaster, "id" | "account_count" | "doc_version">,
  id?: string,
): AccountingMasterState {
  const current = state.accountGroups.find((item) => item.id === id);
  const code = current?.code ?? input.code.trim().toUpperCase();
  if (
    state.accountGroups.some(
      (item) => item.code.toUpperCase() === code && item.id !== id,
    )
  )
    throw new Error(`Group code ${code} already exists.`);
  const parent = input.parent_id
    ? state.accountGroups.find((item) => item.id === input.parent_id)
    : null;
  if (input.level === 1 && input.parent_id)
    throw new Error("Level 1 groups cannot have a parent.");
  if (input.level > 1 && parent?.level !== input.level - 1)
    throw new Error(
      `Level ${input.level} requires a level ${input.level - 1} parent.`,
    );
  if (parent && parent.category !== input.category)
    throw new Error(
      `Parent group must be in the same category (${input.category}).`,
    );
  if (id && input.parent_id) {
    const descendants = getDescendantGroupIds(state.accountGroups, id);
    if (descendants.has(input.parent_id)) {
      throw new Error("Cannot set a descendant group as parent.");
    }
  }
  if (current?.is_active && !input.is_active && current.account_count > 0)
    throw new Error(
      `${current.code} contains ${current.account_count} accounts.`,
    );
  return {
    ...state,
    accountGroups: id
      ? state.accountGroups.map((item) =>
          item.id === id
            ? {
                ...item,
                name: input.name.trim(),
                name_local: input.name_local?.trim() || null,
                level: input.level,
                parent_id: input.parent_id,
                category: input.category,
                sort_order: input.sort_order ?? 0,
                is_active: input.is_active,
                note: input.note?.trim() || null,
                doc_version: item.doc_version + 1,
              }
            : item,
        )
      : [
          ...state.accountGroups,
          {
            ...input,
            id: crypto.randomUUID(),
            code,
            name: input.name.trim(),
            name_local: input.name_local?.trim() || null,
            note: input.note?.trim() || null,
            sort_order: input.sort_order ?? 0,
            account_count: 0,
            doc_version: 0,
          },
        ],
  };
}

export function deleteAccountGroupState(
  state: AccountingMasterState,
  item: AccountGroupMaster,
): AccountingMasterState {
  if (item.account_count > 0)
    throw new Error(`${item.code} contains ${item.account_count} accounts.`);
  if (state.accountGroups.some((group) => group.parent_id === item.id))
    throw new Error(`${item.code} still has child groups.`);
  return {
    ...state,
    accountGroups: state.accountGroups.filter((group) => group.id !== item.id),
  };
}

// --- JV Prefix ---
export function saveJvPrefixState(
  state: AccountingMasterState,
  input: Omit<JvPrefixMaster, "id" | "is_system" | "doc_version">,
  id?: string,
): AccountingMasterState {
  const current = state.jvPrefixes.find((item) => item.id === id);
  const code = current?.code ?? input.code.trim().toUpperCase();
  if (
    state.jvPrefixes.some(
      (item) => item.code.toUpperCase() === code && item.id !== id,
    )
  )
    throw new Error(`JV Prefix ${code} already exists.`);
  return {
    ...state,
    jvPrefixes: id
      ? state.jvPrefixes.map((item) =>
          item.id === id
            ? {
                ...item,
                description: input.description.trim(),
                description_local: input.description_local?.trim() || null,
                is_default: input.is_default,
                is_active: input.is_active,
                doc_version: item.doc_version + 1,
              }
            : input.is_default ? { ...item, is_default: false } : item,
        )
      : [
          ...(input.is_default ? state.jvPrefixes.map((item) => ({ ...item, is_default: false })) : state.jvPrefixes),
          {
            id: crypto.randomUUID(),
            code,
            description: input.description.trim(),
            description_local: input.description_local?.trim() || null,
            is_default: input.is_default,
            is_system: false,
            is_active: input.is_active,
            doc_version: 0,
          },
        ],
  };
}

export function deleteJvPrefixState(
  state: AccountingMasterState,
  item: JvPrefixMaster,
): AccountingMasterState {
  if (item.is_system) throw new Error(`JV Prefix ${item.code} is system reserved.`);
  return {
    ...state,
    jvPrefixes: state.jvPrefixes.filter((p) => p.id !== item.id),
  };
}

// --- Dimension ---
export function saveDimensionState(
  state: AccountingMasterState,
  input: Omit<DimensionMaster, "id" | "doc_version" | "values">,
  id?: string,
): AccountingMasterState {
  const current = state.dimensions.find((item) => item.id === id);
  const code = current?.code ?? input.code.trim().toLowerCase();
  if (state.dimensions.some((item) => item.code.toLowerCase() === code && item.id !== id))
    throw new Error(`Dimension ${code} already exists.`);
  return {
    ...state,
    dimensions: id
      ? state.dimensions.map((item) =>
          item.id === id
            ? {
                ...item,
                name: input.name.trim(),
                name_local: input.name_local?.trim() || null,
                sequence: input.sequence,
                is_active: input.is_active,
                doc_version: item.doc_version + 1,
              }
            : item,
        )
      : [
          ...state.dimensions,
          {
            ...input,
            id: crypto.randomUUID(),
            code,
            name: input.name.trim(),
            name_local: input.name_local?.trim() || null,
            values: [],
            doc_version: 0,
          },
        ],
  };
}

export function deleteDimensionState(
  state: AccountingMasterState,
  item: DimensionMaster,
): AccountingMasterState {
  return {
    ...state,
    dimensions: state.dimensions.filter((d) => d.id !== item.id),
  };
}

// --- Bank Account ---
export function saveBankAccountState(
  state: AccountingMasterState,
  input: Omit<BankAccountMaster, "id" | "doc_version">,
  id?: string,
): AccountingMasterState {
  return {
    ...state,
    bankAccounts: id
      ? state.bankAccounts.map((item) =>
          item.id === id
            ? {
                ...item,
                ...input,
                bank_name: input.bank_name.trim(),
                account_number: input.account_number.trim(),
                account_name: input.account_name.trim(),
                doc_version: item.doc_version + 1,
              }
            : item,
        )
      : [
          ...state.bankAccounts,
          {
            ...input,
            id: crypto.randomUUID(),
            bank_name: input.bank_name.trim(),
            account_number: input.account_number.trim(),
            account_name: input.account_name.trim(),
            doc_version: 0,
          },
        ],
  };
}

export function deleteBankAccountState(
  state: AccountingMasterState,
  item: BankAccountMaster,
): AccountingMasterState {
  return {
    ...state,
    bankAccounts: state.bankAccounts.filter((b) => b.id !== item.id),
  };
}

// --- GL Period ---
export function generateFiscalYearPeriods(
  state: AccountingMasterState,
  year: number,
): AccountingMasterState {
  if (state.glPeriods.some((p) => p.fiscal_year === year)) {
    throw new Error(`Fiscal year ${year} already generated.`);
  }
  const newPeriods: GlPeriodMaster[] = [];
  for (let m = 1; m <= 12; m++) {
    const padM = String(m).padStart(2, "0");
    const lastDay = new Date(year, m, 0).getDate();
    newPeriods.push({
      id: crypto.randomUUID(),
      fiscal_year: year,
      period_number: m,
      start_date: `${year}-${padM}-01`,
      end_date: `${year}-${padM}-${String(lastDay).padStart(2, "0")}`,
      status: "open",
      doc_version: 0,
    });
  }
  // Period 13: Year-end adjustment
  newPeriods.push({
    id: crypto.randomUUID(),
    fiscal_year: year,
    period_number: 13,
    start_date: `${year}-12-31`,
    end_date: `${year}-12-31`,
    status: "open",
    doc_version: 0,
  });
  return {
    ...state,
    glPeriods: [...state.glPeriods, ...newPeriods],
  };
}

export function toggleGlPeriodStatus(
  state: AccountingMasterState,
  id: string,
  newStatus: "open" | "closed" | "locked",
): AccountingMasterState {
  return {
    ...state,
    glPeriods: state.glPeriods.map((p) =>
      p.id === id ? { ...p, status: newStatus, doc_version: p.doc_version + 1 } : p,
    ),
  };
}

// --- Generic Helpers for Simple Masters (PaymentType, WhtServiceType, WhtForm, AssetCategory) ---
export function savePaymentTypeState(
  state: AccountingMasterState,
  input: Omit<PaymentTypeMaster, "id" | "doc_version">,
  id?: string,
): AccountingMasterState {
  const current = state.paymentTypes.find((item) => item.id === id);
  const code = current?.code ?? input.code.trim().toUpperCase();
  return {
    ...state,
    paymentTypes: id
      ? state.paymentTypes.map((item) =>
          item.id === id
            ? { ...item, ...input, code, doc_version: item.doc_version + 1 }
            : item,
        )
      : [
          ...state.paymentTypes,
          { ...input, id: crypto.randomUUID(), code, doc_version: 0 },
        ],
  };
}

export function deletePaymentTypeState(
  state: AccountingMasterState,
  item: PaymentTypeMaster,
): AccountingMasterState {
  return {
    ...state,
    paymentTypes: state.paymentTypes.filter((p) => p.id !== item.id),
  };
}

export function saveWhtServiceTypeState(
  state: AccountingMasterState,
  input: Omit<WhtServiceTypeMaster, "id" | "doc_version">,
  id?: string,
): AccountingMasterState {
  const current = state.whtServiceTypes.find((item) => item.id === id);
  const code = current?.code ?? input.code.trim().toUpperCase();
  return {
    ...state,
    whtServiceTypes: id
      ? state.whtServiceTypes.map((item) =>
          item.id === id
            ? { ...item, ...input, code, doc_version: item.doc_version + 1 }
            : item,
        )
      : [
          ...state.whtServiceTypes,
          { ...input, id: crypto.randomUUID(), code, doc_version: 0 },
        ],
  };
}

export function deleteWhtServiceTypeState(
  state: AccountingMasterState,
  item: WhtServiceTypeMaster,
): AccountingMasterState {
  return {
    ...state,
    whtServiceTypes: state.whtServiceTypes.filter((p) => p.id !== item.id),
  };
}

export function saveWhtFormState(
  state: AccountingMasterState,
  input: Omit<WhtFormMaster, "id" | "doc_version">,
  id?: string,
): AccountingMasterState {
  const current = state.whtForms.find((item) => item.id === id);
  const code = current?.code ?? input.code.trim().toUpperCase();
  return {
    ...state,
    whtForms: id
      ? state.whtForms.map((item) =>
          item.id === id
            ? { ...item, ...input, code, doc_version: item.doc_version + 1 }
            : item,
        )
      : [
          ...state.whtForms,
          { ...input, id: crypto.randomUUID(), code, doc_version: 0 },
        ],
  };
}

export function deleteWhtFormState(
  state: AccountingMasterState,
  item: WhtFormMaster,
): AccountingMasterState {
  return {
    ...state,
    whtForms: state.whtForms.filter((p) => p.id !== item.id),
  };
}

export function saveAssetCategoryState(
  state: AccountingMasterState,
  input: Omit<AssetCategoryMaster, "id" | "doc_version">,
  id?: string,
): AccountingMasterState {
  const current = state.assetCategories.find((item) => item.id === id);
  const code = current?.code ?? input.code.trim().toUpperCase();
  return {
    ...state,
    assetCategories: id
      ? state.assetCategories.map((item) =>
          item.id === id
            ? { ...item, ...input, code, doc_version: item.doc_version + 1 }
            : item,
        )
      : [
          ...state.assetCategories,
          { ...input, id: crypto.randomUUID(), code, doc_version: 0 },
        ],
  };
}

export function deleteAssetCategoryState(
  state: AccountingMasterState,
  item: AssetCategoryMaster,
): AccountingMasterState {
  return {
    ...state,
    assetCategories: state.assetCategories.filter((p) => p.id !== item.id),
  };
}

// --- Hook ---
export function useAccountingMasterMock() {
  const [state, setState] = useState(readState);
  const update = useCallback(
    (change: (current: AccountingMasterState) => AccountingMasterState) => {
      setState((current) => {
        const next = change(current);
        writeState(next);
        return next;
      });
    },
    [],
  );

  const saveTitle = useCallback(
    (input: Omit<TitleMaster, "id" | "is_system" | "reference_count">, id?: string) => {
      update((value) => saveTitleState(value, input, id));
    },
    [update],
  );

  const deleteTitle = useCallback(
    (item: TitleMaster) => {
      update((value) => deleteTitleState(value, item));
    },
    [update],
  );

  const saveAccountGroup = useCallback(
    (input: Omit<AccountGroupMaster, "id" | "account_count" | "doc_version">, id?: string) => {
      update((value) => saveAccountGroupState(value, input, id));
    },
    [update],
  );

  const deleteAccountGroup = useCallback(
    (item: AccountGroupMaster) => {
      update((value) => deleteAccountGroupState(value, item));
    },
    [update],
  );

  const saveJvPrefix = useCallback(
    (input: Omit<JvPrefixMaster, "id" | "is_system" | "doc_version">, id?: string) => {
      update((value) => saveJvPrefixState(value, input, id));
    },
    [update],
  );

  const deleteJvPrefix = useCallback(
    (item: JvPrefixMaster) => {
      update((value) => deleteJvPrefixState(value, item));
    },
    [update],
  );

  const saveDimension = useCallback(
    (input: Omit<DimensionMaster, "id" | "doc_version" | "values">, id?: string) => {
      update((value) => saveDimensionState(value, input, id));
    },
    [update],
  );

  const deleteDimension = useCallback(
    (item: DimensionMaster) => {
      update((value) => deleteDimensionState(value, item));
    },
    [update],
  );

  const saveBankAccount = useCallback(
    (input: Omit<BankAccountMaster, "id" | "doc_version">, id?: string) => {
      update((value) => saveBankAccountState(value, input, id));
    },
    [update],
  );

  const deleteBankAccount = useCallback(
    (item: BankAccountMaster) => {
      update((value) => deleteBankAccountState(value, item));
    },
    [update],
  );

  const generatePeriods = useCallback(
    (year: number) => {
      update((value) => generateFiscalYearPeriods(value, year));
    },
    [update],
  );

  const setPeriodStatus = useCallback(
    (id: string, newStatus: "open" | "closed" | "locked") => {
      update((value) => toggleGlPeriodStatus(value, id, newStatus));
    },
    [update],
  );

  const savePaymentType = useCallback(
    (input: Omit<PaymentTypeMaster, "id" | "doc_version">, id?: string) => {
      update((value) => savePaymentTypeState(value, input, id));
    },
    [update],
  );

  const deletePaymentType = useCallback(
    (item: PaymentTypeMaster) => {
      update((value) => deletePaymentTypeState(value, item));
    },
    [update],
  );

  const saveWhtServiceType = useCallback(
    (input: Omit<WhtServiceTypeMaster, "id" | "doc_version">, id?: string) => {
      update((value) => saveWhtServiceTypeState(value, input, id));
    },
    [update],
  );

  const deleteWhtServiceType = useCallback(
    (item: WhtServiceTypeMaster) => {
      update((value) => deleteWhtServiceTypeState(value, item));
    },
    [update],
  );

  const saveWhtForm = useCallback(
    (input: Omit<WhtFormMaster, "id" | "doc_version">, id?: string) => {
      update((value) => saveWhtFormState(value, input, id));
    },
    [update],
  );

  const deleteWhtForm = useCallback(
    (item: WhtFormMaster) => {
      update((value) => deleteWhtFormState(value, item));
    },
    [update],
  );

  const saveAssetCategory = useCallback(
    (input: Omit<AssetCategoryMaster, "id" | "doc_version">, id?: string) => {
      update((value) => saveAssetCategoryState(value, input, id));
    },
    [update],
  );

  const deleteAssetCategory = useCallback(
    (item: AssetCategoryMaster) => {
      update((value) => deleteAssetCategoryState(value, item));
    },
    [update],
  );

  return {
    ...state,
    saveTitle,
    deleteTitle,
    saveAccountGroup,
    deleteAccountGroup,
    saveJvPrefix,
    deleteJvPrefix,
    saveDimension,
    deleteDimension,
    saveBankAccount,
    deleteBankAccount,
    generatePeriods,
    setPeriodStatus,
    savePaymentType,
    deletePaymentType,
    saveWhtServiceType,
    deleteWhtServiceType,
    saveWhtForm,
    deleteWhtForm,
    saveAssetCategory,
    deleteAssetCategory,
  };
}
