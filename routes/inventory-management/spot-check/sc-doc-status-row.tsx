import { Receipt } from "lucide-react";
import { useTranslations } from "use-intl";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getSpotCheckMethodLabel } from "@/constant/spot-check-method";
import { METHOD_VISUAL, STATUS_VISUAL } from "./sc-status-visual";
import type { SpotCheckMethod, SpotCheckStatus } from "@/types/spot-check";

interface ScDocStatusRowProps {
  readonly docNo: string;
  readonly docStatus: SpotCheckStatus;
  readonly method: SpotCheckMethod;
  readonly size?: "sm" | "md";
  /** เลขเอกสารบรรทัดบน ป้ายบรรทัดล่าง — สำหรับคอลัมน์แคบในแถวรายการ */
  readonly stacked?: boolean;
}

export function ScDocStatusRow({
  docNo,
  docStatus,
  method,
  size = "md",
  stacked = false,
}: ScDocStatusRowProps) {
  const t = useTranslations("inventoryManagement.spotCheck");
  const ts = useTranslations("status");

  const status = STATUS_VISUAL[docStatus] ?? STATUS_VISUAL.pending;
  const methodVis = METHOD_VISUAL[method] ?? METHOD_VISUAL.random;
  const MethodIcon = methodVis.icon;
  const methodLabel = getSpotCheckMethodLabel(t, method);

  const isSm = size === "sm";

  return (
    <div
      className={cn(
        "flex",
        stacked
          ? "flex-col items-start gap-1"
          : "flex-wrap items-center justify-between gap-2",
      )}
    >
      <div className="flex max-w-full min-w-0 items-center gap-1.5">
        <Receipt
          className={cn(
            "text-primary/80 shrink-0",
            isSm ? "size-3" : "size-3.5",
          )}
          aria-hidden="true"
        />
        <span
          className={cn(
            "text-foreground truncate font-semibold tracking-wider",
            isSm ? "text-xs" : "text-sm",
          )}
        >
          {docNo}
        </span>
      </div>
      <div
        className={cn(
          "flex items-center gap-1",
          stacked ? "flex-wrap" : "shrink-0",
        )}
      >
        <Badge
          variant={status.variant}
          size="xs"
          className={cn(
            "text-micro-eyebrow gap-1 px-2 font-semibold tracking-wider uppercase",
            status.className,
          )}
        >
          <span
            className={cn(
              "size-1.5 rounded-full",
              status.dotClass,
              status.pulse && "animate-pulse",
            )}
            aria-hidden="true"
          />
          {ts(docStatus)}
        </Badge>
        <Badge
          variant={methodVis.variant}
          size="xs"
          className="text-micro-eyebrow gap-1 px-2 font-semibold tracking-wider uppercase"
        >
          <MethodIcon className="size-2.5" aria-hidden="true" />
          {methodLabel}
        </Badge>
      </div>
    </div>
  );
}
