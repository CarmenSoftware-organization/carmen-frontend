import { useWatch, type UseFormReturn } from "react-hook-form";
import { useTranslations } from "use-intl";
import { FormToolbar } from "@/components/share/form-toolbar";
import { cn } from "@/lib/utils";
import { StatusDotBadge } from "@/components/ui/status-dot-badge";
import type { FormMode } from "@/types/form";
import type { EquipmentFormValues } from "./eq-form-schema";

interface EqToolbarProps {
  readonly form: UseFormReturn<EquipmentFormValues>;
  readonly mode: FormMode;
  readonly isPending: boolean;
  readonly isDeleting: boolean;
  readonly onBack: () => void;
  readonly onEdit: () => void;
  readonly onCancel: () => void;
  readonly onDelete?: () => void;
  /**
   * id ของรายการที่บันทึกไว้แล้ว — เปิดปุ่ม Activity
   * (ไม่ส่ง = โหมด add ที่ยังไม่มีประวัติให้ดู)
   */
  readonly activityId?: string;
  /** เปิด sheet comment + ไฟล์แนบ (ไม่ส่ง = โหมด add ที่ยังไม่มี record ให้ comment) */
  readonly onComment?: () => void;
}

export function EqToolbar({
  form,
  mode,
  isPending,
  isDeleting,
  onBack,
  onEdit,
  onCancel,
  onDelete,
  activityId,
  onComment,
}: EqToolbarProps) {
  const tr = useTranslations("operationPlan.equipment");
  const ts = useTranslations("status");
  const code = useWatch({ control: form.control, name: "code" });
  const name = useWatch({ control: form.control, name: "name" });
  const isActive = useWatch({ control: form.control, name: "is_active" });
  const isAdd = mode === "add";

  const codePill = (
    <span
      className={cn(
        "text-micro-legal inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold tracking-wider uppercase",
        code
          ? "bg-foreground text-background"
          : "text-muted-foreground border border-dashed",
      )}
    >
      {code && (
        <span
          className="bg-background/70 size-1 rounded-full"
          aria-hidden="true"
        />
      )}
      {code || tr("noCode")}
    </span>
  );
  const statusDot = !isAdd && (
    <StatusDotBadge
      tone={isActive ? "success" : "neutral"}
      size="xs"
      className="tracking-wider uppercase"
    >
      {isActive ? ts("active") : ts("inactive")}
    </StatusDotBadge>
  );

  return (
    <FormToolbar
      mode={mode}
      formId="equipment-form"
      isPending={isPending}
      title={isAdd ? tr("add") : name || tr("untitledEquipment")}
      badges={
        <>
          {codePill}
          {statusDot}
        </>
      }
      onBack={onBack}
      onCancel={onCancel}
      onEdit={onEdit}
      onDelete={onDelete}
      deleteIsPending={isDeleting}
      onComment={onComment}
      activity={
        activityId ? { id: activityId, label: code || name } : undefined
      }
    />
  );
}
