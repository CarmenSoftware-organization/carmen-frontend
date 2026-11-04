import type { ComponentProps } from "react";
import type { Badge } from "@/components/ui/badge";

type BadgeVariant = ComponentProps<typeof Badge>["variant"];

const SHAPE_BADGE: Record<string, { label: string; variant: BadgeVariant }> = {
  scalar: { label: "Scalar", variant: "info-light" },
  scalar_delta: { label: "Scalar Δ", variant: "success-light" },
  time_series: { label: "Time Series", variant: "primary-light" },
  categorical: { label: "Categorical", variant: "warning-light" },
  ranked: { label: "Ranked", variant: "invert-light" },
  matrix: { label: "Matrix", variant: "destructive-light" },
  table: { label: "Table", variant: "outline" },
};

/** ป้าย + สีของรูปทรงข้อมูล dataset — shape ที่ไม่รู้จักใช้ชื่อดิบ ขอบเปล่า */
export const getShapeBadge = (shape: string) =>
  SHAPE_BADGE[shape] ?? {
    label: shape.replaceAll("_", " "),
    variant: "outline" as const,
  };
