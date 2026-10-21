import { createStatusConfig } from "./status-config";
import type { DotTone } from "@/components/ui/status-dot-badge";

/**
 * map สถานะ price list / template → semantic tone ของ dot badge
 * (draft=ฟ้า submitted=เหลือง active=เขียว inactive=เทา expired=แดง) — ใช้ร่วม card/table/form
 * ให้ status แสดงเหมือนกันทุก view
 */
export const PL_STATUS_TONE: Record<string, DotTone> = {
  draft: "info",
  submitted: "warning",
  active: "success",
  inactive: "neutral",
  voided: "neutral",
  expired: "destructive",
};

export const PRICE_LIST_STATUS_OPTIONS = [
  { label: "Draft", value: "draft" },
  { label: "Submitted", value: "submitted" },
  { label: "Active", value: "active" },
  { label: "Inactive", value: "inactive" },
];

export const PL_STATUS_CONFIG = createStatusConfig([
  "draft",
  "submitted",
  "active",
  "inactive",
  "voided",
] as const);
