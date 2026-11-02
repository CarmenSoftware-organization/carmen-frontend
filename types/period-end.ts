import type { AuditInfo } from "@/types/workflows";
import type {
  PhysicalCountLocation,
  PhysicalCountPeriodStatus,
} from "@/types/physical-count";

export interface PeriodEnd {
  id: string;
  period: string;
  fiscal_year: number;
  fiscal_month: number;
  start_at: string;
  end_at: string;
  status: PeriodEndStatus;
  note: string | null;
  info: Record<string, unknown>;
  dimension: unknown[];
  audit: AuditInfo;
}

type PeriodEndStatus = "open" | "closed" | "locked";

export type ReviewTransactionKey =
  "pr" | "po" | "grn" | "cn" | "sr" | "si" | "so";

export type StartCountingBlockerKey = "grn" | "stock_in" | "stock_out" | "sr";

export interface StartCountingBlockers {
  counts: Record<StartCountingBlockerKey, number>;
  total: number;
  documents: Record<StartCountingBlockerKey, StartCountingDocument[]>;
}

export interface StartCountingResult {
  period: PeriodEnd;
  physical_count_period: { id: string; status: PhysicalCountPeriodStatus };
  created: boolean;
  already_counting: boolean;
}

export type ReviewDocumentGroup =
  "draft" | "in_progress" | "complete" | "cancelled";

export type ReviewGroupFilter = "incomplete" | "complete" | "cancelled" | "all";

export type ReviewGroupCounts = Record<ReviewDocumentGroup, number>;

export interface StartCountingDocument {
  id: string;
  no: string;
  status: string;
  date: string;
}

export interface ReviewDocument extends StartCountingDocument {
  group: ReviewDocumentGroup;
}

export interface ReviewTransactionStat {
  count: number;
  complete_count: number;
  incomplete_count: number;
  is_complete: boolean;
  group_counts: ReviewGroupCounts;
}

type ReviewPhysicalCountItem = PhysicalCountLocation;

export interface PeriodEndReview {
  id: string;
  start_date: string;
  end_date: string;
  status: PeriodEndStatus;
  physical_count_period: {
    id: string;
    status: PhysicalCountPeriodStatus;
  } | null;
  can_start_counting: boolean;
  start_blocking: {
    counts: Record<StartCountingBlockerKey, number>;
    total: number;
  };
  /**
   * มาจาก backend ไม่ใช่คำนวณเองที่ฝั่ง UI
   *
   * เดิมหน้า review คิดเองจาก `is_complete` ของทุกโมดูล ซึ่ง backend คืน false เมื่อโมดูลนั้น
   * ไม่มีเอกสารเลย (`count > 0 && ...`) งวดที่ไม่มีใบลดหนี้จึงปิดไม่ได้ตลอดกาล
   */
  can_close: boolean;
  close_blocking: {
    sr: number;
    grn: number;
    cn: number;
    stock_in: number;
    stock_out: number;
    physical_count: number;
  };
  details: {
    transaction: Record<ReviewTransactionKey, ReviewTransactionStat>;
    physical_count: ReviewPhysicalCountItem[];
  };
}
