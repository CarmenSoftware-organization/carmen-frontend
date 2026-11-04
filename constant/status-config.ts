import type { BadgeProps } from "@/components/ui/badge";

// ── Types ──────────────────────────────────────────────────────────────

export type BadgeVariant = NonNullable<BadgeProps["variant"]>;

export interface StatusConfigEntry {
  className: string;
  label: string;
}

export type StatusConfig<S extends string = string> = Record<
  string,
  StatusConfigEntry
> & { [K in S]: StatusConfigEntry };

// ── Static class map ───────────────────────────────────────────────────
// Tailwind scans source for complete class names at build time.
// Dynamic construction (template literals) won't be detected.
// Every status className MUST be written out in full here.
//
// FLAT design (DESIGN.md "avoid neon"): badges are a NEUTRAL chip
// (`bg-muted` box, `text-foreground` label) with the status color carried
// as ONE signal — a small dot rendered via the `::before` pseudo-element.
// The dot color is the only place the status hue appears, so the chip never
// reads as a glowing/clustered block. `DOT` holds the shared neutral chip +
// dot geometry; each entry only appends `before:bg-[var(--status-X)]`.

export const STATUS_DOT_CHIP =
  "bg-muted text-foreground border-transparent px-2 gap-1.5 before:size-1.5 before:shrink-0 before:rounded-full before:content-['']";
const DOT = STATUS_DOT_CHIP;

const STATUS_CLASSNAMES: Record<string, string> = {
  /* Neutral / Initial */
  draft: `${DOT} before:bg-[var(--status-draft)]`,
  pending: `${DOT} before:bg-[var(--status-pending)]`,
  /* Info / Submitted */
  submitted: `${DOT} before:bg-[var(--status-submitted)]`,
  sent: `${DOT} before:bg-[var(--status-sent)]`,
  /* PO "sent" ถูก rename เป็น "sent_or_print" (§2026-09-14) — คงสี teal เดิม
     ไม่มี CSS var ใหม่ให้ เพราะยังเป็นแนวคิดเดียวกัน (ส่งถึง vendor แล้ว) */
  sent_or_print: `${DOT} before:bg-[var(--status-sent)]`,
  open: `${DOT} before:bg-[var(--status-open)]`,
  /* Progress / Active */
  active: `${DOT} before:bg-[var(--status-approved)]`,
  inactive: `${DOT} before:bg-[var(--status-closed)]`,
  in_progress: `${DOT} before:bg-[var(--status-in-progress)]`,
  review: `${DOT} before:bg-[var(--status-review)]`,
  partial: `${DOT} before:bg-[var(--status-partial)]`,
  save: `${DOT} before:bg-[var(--status-save)]`,
  saved: `${DOT} before:bg-[var(--status-save)]`,
  /* Positive / Complete */
  approved: `${DOT} before:bg-[var(--status-approved)]`,
  completed: `${DOT} before:bg-[var(--status-completed)]`,
  committed: `${DOT} before:bg-[var(--status-committed)]`,
  /* Negative / Terminal */
  rejected: `${DOT} before:bg-[var(--status-rejected)]`,
  cancelled: `${DOT} before:bg-[var(--status-cancelled)]`,
  closed: `${DOT} before:bg-[var(--status-closed)]`,
  locked: `${DOT} before:bg-[var(--status-locked)]`,
  voided: `${DOT} before:bg-[var(--status-voided)]`,
  /* ใบสำคัญ GL (JV) — สีเดียวกับไอคอนใน status-icon-label.tsx */
  in_review: `${DOT} before:bg-[var(--status-in-progress)]`,
  scheduled: `${DOT} before:bg-[var(--status-pending)]`,
  posted: `${DOT} before:bg-[var(--status-committed)]`,
  void: `${DOT} before:bg-[var(--status-voided)]`,
  /* Workflow action badges */
  reviewed: `${DOT} before:bg-[var(--status-review)]`,
  sent_back: `${DOT} before:bg-[var(--status-review)]`,
  /* Type badges (Inventory Adjustment) */
  "stock-in": `${DOT} before:bg-[var(--status-stock-in)]`,
  "stock-out": `${DOT} before:bg-[var(--status-stock-out)]`,
  /* Workflow type badges — ชนิดเอกสารไม่ใช่สถานะ ไม่มีความหมายดี/ร้ายให้สื่อด้วยสี
     จุดจึงเป็น primary เหมือนกันหมด ตัวแยกคือ label (เดิมใช้ --sub-* คนละ hue) */
  purchase_request_workflow: `${DOT} before:bg-primary`,
  purchase_order_workflow: `${DOT} before:bg-primary`,
  store_requisition_workflow: `${DOT} before:bg-primary`,
  /* CN type badges */
  quantity_return: `${DOT} before:bg-[var(--status-quantity-return)]`,
  amount_discount: `${DOT} before:bg-[var(--status-amount-discount)]`,
  /* GRN type badges */
  grn_purchase_order: `${DOT} before:bg-[var(--status-grn-po)]`,
  grn_manual: `${DOT} before:bg-[var(--status-grn-manual)]`,
  /* PO type badges — เหตุผลเดียวกับ workflow type ข้างบน */
  purchase_request: `${DOT} before:bg-primary`,
  manual: `${DOT} before:bg-primary`,
  pricelist: `${DOT} before:bg-primary`,
  /* Cuisine region badges */
  ASIA: `${DOT} before:bg-[var(--status-cuisine-asia)]`,
  EUROPE: `${DOT} before:bg-[var(--status-cuisine-europe)]`,
  AMERICAS: `${DOT} before:bg-[var(--status-cuisine-americas)]`,
  AFRICA: `${DOT} before:bg-[var(--status-cuisine-africa)]`,
  MIDDLE_EAST: `${DOT} before:bg-[var(--status-cuisine-middle-east)]`,
  OCEANIA: `${DOT} before:bg-[var(--status-cuisine-oceania)]`,
};

// ── Factory functions ──────────────────────────────────────────────────

export function createStatusConfig<S extends string>(
  statuses: readonly S[],
  overrides?: Partial<Record<S, Partial<StatusConfigEntry>>>,
): StatusConfig<S> {
  const config = {} as Record<string, StatusConfigEntry>;
  for (const status of statuses) {
    const override = overrides?.[status];
    config[status] = {
      className: override?.className ?? STATUS_CLASSNAMES[status] ?? "",
      label: override?.label ?? status.toUpperCase().replace(/_/g, " "),
    };
  }
  return config as StatusConfig<S>;
}

/**
 * ชิปสำหรับสถานะที่ยังไม่มีในแผนที่ของโมดูล
 *
 * ไม่มีในแผนที่แล้วปล่อย `className: ""` = Badge กลับไปใช้ variant default ซึ่งเป็น
 * พื้นทึบสี primary — ขัด DESIGN.md ("avoid neon") และโผล่เป็นก้อนสีเรืองนั่งข้าง
 * ชิปที่ถูกต้อง (เจอจริงกับ status `save` ในไทม์ไลน์ประวัติรายบรรทัด) ตัวนี้คง
 * ดีไซน์ dot-chip ไว้ด้วยจุดสีกลาง แล้วแปลงค่าดิบจาก API เป็นป้ายที่คนอ่านได้
 *
 * @param status - ค่า status ดิบจาก API (เช่น `send_back`)
 * @returns entry ที่ใช้กับ `Badge` ได้เลย
 * @example
 * ```ts
 * const config = STATUS_MAP[entry.status] ?? unknownStatusEntry(entry.status);
 * ```
 */
export function unknownStatusEntry(status: string): StatusConfigEntry {
  return {
    className: `${STATUS_DOT_CHIP} before:bg-[var(--status-draft)]`,
    label: status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
  };
}

export interface StatusFilterOption {
  label: string;
  value: string;
  statusKey?: string;
  dotColor?: string;
}

/**
 * แกะสี dot จาก className ของ status entry (`before:bg-[var(--status-x)]`)
 * — แหล่งความจริงเดียวกับสีบน badge จึงไม่ต้องประกาศสีซ้ำที่ options
 */
function extractDotColor(className: string): string | undefined {
  const match = /before:bg-\[(var\([^)]+\))\]/.exec(className);
  return match?.[1];
}

export function createStatusFilterOptions<S extends string>(
  fieldName: string,
  config: StatusConfig<S>,
  include?: S[],
): StatusFilterOption[] {
  const keys = include ?? (Object.keys(config) as S[]);
  return keys.map((status) => ({
    label: config[status].label,
    value: `${fieldName}|string:${status}`,
    dotColor: extractDotColor(config[status].className),
    // ตัวกรองเลือกไอคอนจากคีย์นี้ ให้ตรงกับที่แสดงในตาราง (`StatusIconLabel`)
    statusKey: status,
  }));
}

/**
 * สร้าง map ของ semantic badge variant สำหรับ workflow action หรือ status map แบบเบา
 *
 * ใช้เมื่อไม่ต้องการ CSS custom color แต่ใช้ variant ของ Badge component แทน
 *
 * @param entries - object ที่ map จาก status key → BadgeVariant
 * @returns Record ที่ key เป็น string และ value เป็น BadgeVariant
 * @example
 * ```ts
 * const ACTION_VARIANTS = createVariantMap({
 *   approve: "success",
 *   reject: "destructive",
 * });
 * ```
 */
export function createVariantMap<S extends string>(
  entries: Record<S, BadgeVariant>,
): Record<string, BadgeVariant> {
  return entries;
}
