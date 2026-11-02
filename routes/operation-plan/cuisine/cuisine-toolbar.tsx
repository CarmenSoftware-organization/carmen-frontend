import { useWatch, type UseFormReturn } from "react-hook-form";
import { useTranslations } from "use-intl";
import { FormToolbar } from "@/components/share/form-toolbar";

import { StatusDotBadge } from "@/components/ui/status-dot-badge";
import type { FormMode } from "@/types/form";
import type { CuisineFormValues } from "./cuisine-form-schema";

interface CuisineToolbarProps {
  readonly form: UseFormReturn<CuisineFormValues>;
  readonly mode: FormMode;
  readonly isPending: boolean;
  readonly isDeleting: boolean;
  readonly onBack: () => void;
  readonly onEdit: () => void;
  readonly onCancel: () => void;
  readonly onDelete?: () => void;
  /**
   * id ของรายการที่บันทึกไว้แล้ว — เปิดปุ่ม Activity
   *
   * toolbar เห็นแต่ค่าในฟอร์ม ไม่เห็นตัว record จึงต้องรับ id มาจากฟอร์มแม่
   * (ไม่ส่ง = โหมด add ที่ยังไม่มีประวัติให้ดู)
   */
  readonly activityId?: string;
  /** เปิด sheet comment + ไฟล์แนบ (ไม่ส่ง = โหมด add ที่ยังไม่มี record ให้ comment) */
  readonly onComment?: () => void;
}

export function CuisineToolbar({
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
}: CuisineToolbarProps) {
  const tr = useTranslations("operationPlan.cuisine");
  const ts = useTranslations("status");

  const name = useWatch({ control: form.control, name: "name" });
  const isActive = useWatch({ control: form.control, name: "is_active" });
  const isAdd = mode === "add";

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
      formId="cuisine-form"
      isPending={isPending}
      title={isAdd ? tr("add") : name || tr("untitledCuisine")}
      badges={statusDot}
      onBack={onBack}
      onCancel={onCancel}
      onEdit={onEdit}
      onDelete={onDelete}
      deleteIsPending={isDeleting}
      onComment={onComment}
      activity={activityId ? { id: activityId, label: name } : undefined}
    />
  );
}
