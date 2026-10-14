import { useTranslations } from "use-intl";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";

interface StatusSwitchProps {
  readonly checked: boolean;
  readonly onCheckedChange: (checked: boolean) => void;
  readonly disabled?: boolean;
  readonly label?: string;
  readonly description?: string;
  readonly activeText?: string;
  readonly inactiveText?: string;
  readonly id?: string;
  readonly hideBadge?: boolean;
  /**
   * สีป้ายตอนปิด — `destructive` (ค่าเดิม) เหมาะกับสถานะที่ปิดแล้วมีผล เช่น
   * record ถูกปิดใช้งาน ส่วน flag ที่ "ไม่" เป็นเรื่องปกติ (ไม่ขายตรง) ใช้ `neutral`
   * ไม่งั้นป้ายแดงอ่านเหมือนมีอะไรผิด
   */
  readonly inactiveTone?: "destructive" | "neutral";
}

function StatusSwitch({
  checked,
  onCheckedChange,
  disabled,
  label,
  description,
  activeText,
  inactiveText,
  id,
  hideBadge = false,
  inactiveTone = "destructive",
}: StatusSwitchProps) {
  const tfl = useTranslations("field");

  const resolvedLabel = label ?? tfl("active");
  const resolvedActiveText = activeText ?? tfl("active");
  const resolvedInactiveText = inactiveText ?? tfl("inactive");
  const resolvedDescription = description ?? tfl("activeDescription");

  return (
    <div className="space-y-0.5 rounded-md border p-2">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">{resolvedLabel}</p>
          {resolvedDescription && (
            <p className="text-muted-foreground text-xs">
              {resolvedDescription}
            </p>
          )}
        </div>
        <Switch
          id={id}
          checked={checked}
          onCheckedChange={onCheckedChange}
          disabled={disabled}
          aria-label={resolvedLabel}
        />
      </div>
      {!hideBadge && (
        <Badge
          variant={
            checked
              ? "success"
              : inactiveTone === "neutral"
                ? "secondary"
                : "destructive"
          }
          className="px-2 py-0.5 text-xs"
        >
          {checked ? resolvedActiveText : resolvedInactiveText}
        </Badge>
      )}
    </div>
  );
}

export { StatusSwitch, type StatusSwitchProps };
