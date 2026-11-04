import {
  createStatusConfig,
  createStatusFilterOptions,
} from "@/constant/status-config";

/**
 * สถานะ JV ตาม enum จริงของ backend (`enum_jv_status`)
 *
 * ไม่ใช้ `JournalVoucherStatus` ใน `types/journal-voucher.ts` เพราะ union นั้นยังเป็น
 * ชุดเก่า (`submitted` / `voided` / `post_failed` …) ที่ backend ไม่เคยส่งมา — กรอง
 * ด้วยค่าชุดนั้นจะได้รายการว่างเสมอ
 */
export const JV_STATUS_CONFIG = createStatusConfig([
  "draft",
  "in_review",
  "scheduled",
  "posted",
  "void",
] as const);

export const JV_STATUS_OPTIONS = createStatusFilterOptions(
  "jv_status",
  JV_STATUS_CONFIG,
);

/** ที่มาของใบ ตาม `enum_gl_jv_source` — ชนิดของใบ ไม่ใช่สถานะ จึงไม่มีสี */
export const JV_SOURCE_CONFIG = createStatusConfig(
  [
    "manual",
    "recurring",
    "allocation",
    "amortize",
    "reversal",
    "closing",
    "ap",
    "ar",
    "inventory",
    "asset",
    "interface",
  ] as const,
  {
    manual: { label: "Manual" },
    recurring: { label: "Recurring" },
    allocation: { label: "Allocation" },
    amortize: { label: "Amortize" },
    reversal: { label: "Reversal" },
    closing: { label: "Closing" },
    ap: { label: "AP" },
    ar: { label: "AR" },
    inventory: { label: "Inventory" },
    asset: { label: "Asset" },
    interface: { label: "Interface" },
  },
);

export const JV_SOURCE_OPTIONS = createStatusFilterOptions(
  "source",
  JV_SOURCE_CONFIG,
);

/** ป้ายที่มาของใบ — ค่าที่ไม่รู้จักแสดงค่าดิบ */
export function jvSourceLabel(source: string | null | undefined): string {
  const key = source || "manual";
  return JV_SOURCE_CONFIG[key]?.label ?? key;
}

/** ป้ายสถานะ — ค่าที่ไม่รู้จักแสดงค่าดิบแบบอ่านได้ */
export function jvStatusLabel(status: string): string {
  return (
    JV_STATUS_CONFIG[status]?.label ?? status.toUpperCase().replace(/_/g, " ")
  );
}
