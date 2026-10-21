import { LockKeyhole } from "lucide-react";
import { useTranslations } from "use-intl";

import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface HiddenValueProps {
  className?: string;
}

/**
 * ป้าย "ซ่อน" แทนตัวเลขราคาที่ workflow ของ stage ปัจจุบันซ่อนจากผู้ใช้
 * ใช้เมื่อ `isPriceHidden(hidden_fields, ...)` เป็นจริงเท่านั้น (ห้ามเดาจาก null)
 */
export function HiddenValue({ className }: HiddenValueProps) {
  const t = useTranslations("common");
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge
          variant="invert-light"
          size="sm"
          className={cn("text-muted-foreground", className)}
        >
          <LockKeyhole aria-hidden />
          {t("hiddenValue")}
        </Badge>
      </TooltipTrigger>
      <TooltipContent>{t("hiddenValueHint")}</TooltipContent>
    </Tooltip>
  );
}
