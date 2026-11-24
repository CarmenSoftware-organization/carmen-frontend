import { WORKFLOW_TYPE } from "@/types/workflows";

export const workflowTypeField = [
  { label: "Purchase Request", value: WORKFLOW_TYPE.PR },
  { label: "Store Requisition", value: WORKFLOW_TYPE.SR },
  { label: "Purchase Order", value: WORKFLOW_TYPE.PO },
  { label: "Journal Voucher", value: WORKFLOW_TYPE.JV },
  { label: "AP Invoice", value: WORKFLOW_TYPE.AP_INVOICE },
  { label: "AP Payment", value: WORKFLOW_TYPE.AP_PAYMENT },
  { label: "AR Invoice", value: WORKFLOW_TYPE.AR_INVOICE },
];

export const WF_ROW_TYPE = {
  PR: "purchase_request",
  PO: "purchase_order",
  SR: "store_requisition",
  JV: "gl_jv",
  AP_INVOICE: "ap_invoice",
  AP_PAYMENT: "ap_payment",
  AR_INVOICE: "ar_invoice",
} as const;

/** ที่มาของ JV ที่ใช้กำหนดขอบเขต workflow (`data.jv_scope.sources`) */
export const JV_WORKFLOW_SOURCES = [
  "manual",
  "recurring",
  "allocation",
  "amortize",
  "reversal",
  "closing",
] as const;

export type JvWorkflowSource = (typeof JV_WORKFLOW_SOURCES)[number];

/**
 * ความสามารถที่ต่างกันตามชนิด workflow — ใช้แทนการเช็ก `=== WORKFLOW_TYPE.JV` กระจายหลายไฟล์
 * - hasProducts: ผูกสินค้าเป็นขอบเขต (tab Products)
 * - hasJvScope: ขอบเขตเป็น prefix/ที่มาของ JV (tab Scope)
 * - totalOnlyRouting: routing ตัดสินจากยอดรวมอย่างเดียว ไม่มี department/category
 * - canHidePrice: ซ่อนราคาตาม stage ได้
 */
export const WORKFLOW_CAPS: Record<
  WORKFLOW_TYPE,
  {
    hasProducts: boolean;
    hasJvScope: boolean;
    totalOnlyRouting: boolean;
    canHidePrice: boolean;
  }
> = {
  [WORKFLOW_TYPE.PR]: {
    hasProducts: true,
    hasJvScope: false,
    totalOnlyRouting: false,
    canHidePrice: true,
  },
  [WORKFLOW_TYPE.PO]: {
    hasProducts: true,
    hasJvScope: false,
    totalOnlyRouting: false,
    canHidePrice: true,
  },
  [WORKFLOW_TYPE.SR]: {
    hasProducts: true,
    hasJvScope: false,
    totalOnlyRouting: false,
    canHidePrice: false,
  },
  [WORKFLOW_TYPE.JV]: {
    hasProducts: false,
    hasJvScope: true,
    totalOnlyRouting: true,
    canHidePrice: false,
  },
  [WORKFLOW_TYPE.AP_INVOICE]: {
    hasProducts: false,
    hasJvScope: false,
    totalOnlyRouting: true,
    canHidePrice: false,
  },
  [WORKFLOW_TYPE.AP_PAYMENT]: {
    hasProducts: false,
    hasJvScope: false,
    totalOnlyRouting: true,
    canHidePrice: false,
  },
  [WORKFLOW_TYPE.AR_INVOICE]: {
    hasProducts: false,
    hasJvScope: false,
    totalOnlyRouting: true,
    canHidePrice: false,
  },
};

/** caps ของชนิดที่ไม่รู้จัก = เหมือน PR (พฤติกรรมเดิมก่อนมี caps — ไม่ซ่อน/ไม่ตัดอะไรของเก่าที่อ่านไม่ออก) */
export const getWorkflowCaps = (workflowType?: string) =>
  WORKFLOW_CAPS[workflowType as WORKFLOW_TYPE] ??
  WORKFLOW_CAPS[WORKFLOW_TYPE.PR];

type WfI18nFn = (key: string) => string;

export const WORKFLOW_TYPES = [
  { value: WORKFLOW_TYPE.PR, i18nKey: "typePurchaseRequest" },
  { value: WORKFLOW_TYPE.SR, i18nKey: "typeStoreRequisition" },
  { value: WORKFLOW_TYPE.PO, i18nKey: "typePurchaseOrder" },
  { value: WORKFLOW_TYPE.JV, i18nKey: "typeJournalVoucher" },
  { value: WORKFLOW_TYPE.AP_INVOICE, i18nKey: "typeApInvoice" },
  { value: WORKFLOW_TYPE.AP_PAYMENT, i18nKey: "typeApPayment" },
  { value: WORKFLOW_TYPE.AR_INVOICE, i18nKey: "typeArInvoice" },
] as const;

export function getWorkflowTypeOptions(t: WfI18nFn) {
  return WORKFLOW_TYPES.map((tp) => ({
    label: t(tp.i18nKey),
    value: tp.value,
  }));
}

const WF_TYPE_I18N_KEY: Record<string, string> = {
  [WF_ROW_TYPE.PR]: "typePurchaseRequest",
  [WF_ROW_TYPE.PO]: "typePurchaseOrder",
  [WF_ROW_TYPE.SR]: "typeStoreRequisition",
  [WF_ROW_TYPE.JV]: "typeJournalVoucher",
  [WF_ROW_TYPE.AP_INVOICE]: "typeApInvoice",
  [WF_ROW_TYPE.AP_PAYMENT]: "typeApPayment",
  [WF_ROW_TYPE.AR_INVOICE]: "typeArInvoice",
};

export function getWorkflowTypeLabels(t: WfI18nFn): Record<string, string> {
  return Object.fromEntries(
    Object.entries(WF_TYPE_I18N_KEY).map(([value, key]) => [value, t(key)]),
  );
}
