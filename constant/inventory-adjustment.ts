import { PackageMinus, PackagePlus, type LucideIcon } from "lucide-react";
import { createStatusConfig } from "./status-config";

export const IA_STATUS_CONFIG = createStatusConfig([
  "draft",
  "in_progress",
  "completed",
  "voided",
] as const);

// Type badge: พื้นอ่อน + หมึกตามทิศ (เข้า = success · ออก = negative) — ทิศทางเป็นข้อมูลหลัก
// ของเอกสารนี้ ต้องอ่านออกจากป้ายเอง ไม่ใช่จากไอคอนจุดเดียว · ไม่ใช้ dot เหมือน status badge
const IA_TYPE_CHIP = "border-transparent gap-1.5 px-2";

export const IA_TYPE_CONFIG = createStatusConfig(
  ["stock-in", "stock-out"] as const,
  {
    "stock-in": {
      label: "Stock In",
      className: `${IA_TYPE_CHIP} bg-success/10 text-success-ink`,
    },
    "stock-out": {
      label: "Stock Out",
      className: `${IA_TYPE_CHIP} bg-destructive/10 text-negative-ink`,
    },
  },
);

/** หมึกของตัวเลขตามทิศ — คู่กับ IA_TYPE_SIGN ใช้ทั้งไอคอน ป้าย และยอดรวม */
export const IA_TYPE_ICON_COLOR: Record<"stock-in" | "stock-out", string> = {
  "stock-in": "text-success-ink",
  "stock-out": "text-negative-ink",
};

/** เครื่องหมายหน้ายอดรวม — U+2212 (minus) ไม่ใช่ hyphen ให้กว้างเท่า "+" */
export const IA_TYPE_SIGN: Record<"stock-in" | "stock-out", string> = {
  "stock-in": "+",
  "stock-out": "\u2212",
};

export const IA_TYPE_ICON: Record<"stock-in" | "stock-out", LucideIcon> = {
  "stock-in": PackagePlus,
  "stock-out": PackageMinus,
};
