import * as React from "react";
import { Progress as ProgressPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

type ProgressTone =
  | "primary"
  | "success"
  | "warning"
  | "info"
  | "destructive"
  | "muted";

type ProgressVariant = ProgressTone | "auto";

const TONE_CLASSES: Record<ProgressTone, { track: string; indicator: string }> =
  {
    primary: { track: "bg-primary/20", indicator: "bg-primary" },
    success: { track: "bg-success/20", indicator: "bg-success" },
    warning: { track: "bg-warning/20", indicator: "bg-warning" },
    info: { track: "bg-info/20", indicator: "bg-info" },
    destructive: { track: "bg-destructive/20", indicator: "bg-destructive" },
    muted: { track: "bg-muted", indicator: "bg-muted-foreground/40" },
  };

const pickAutoTone = (value: number): ProgressTone => {
  if (value <= 0) return "muted";
  if (value >= 100) return "success";
  if (value < 50) return "destructive";
  return "warning";
};

interface ProgressProps extends React.ComponentProps<
  typeof ProgressPrimitive.Root
> {
  readonly variant?: ProgressVariant;
  readonly indicatorClassName?: string;
}

function Progress({
  className,
  value,
  variant = "primary",
  indicatorClassName,
  ...props
}: Readonly<ProgressProps>) {
  const resolved: ProgressTone =
    variant === "auto" ? pickAutoTone(value ?? 0) : variant;
  const tone = TONE_CLASSES[resolved];
  // ส่งค่าให้ Root ด้วย — ไม่ส่ง = Radix ไม่ใส่ aria-valuenow (screen reader อ่านเป็นแถบไม่ทราบค่า)
  // บีบ 0–100 ก่อนส่ง: ค่าที่เกิน max Radix ถือว่าไม่ถูกต้อง (console error + ทิ้งค่า) — แถบเองยังวาดจากค่าดิบเหมือนเดิม
  const ariaValue =
    value === null || value === undefined || Number.isNaN(value)
      ? null
      : Math.min(100, Math.max(0, value));
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      value={ariaValue}
      className={cn(
        "relative h-2 w-full overflow-hidden rounded-full",
        tone.track,
        className,
      )}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className={cn(
          "h-full w-full flex-1 transition-all",
          tone.indicator,
          indicatorClassName,
        )}
        style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
      />
    </ProgressPrimitive.Root>
  );
}

export { Progress };
