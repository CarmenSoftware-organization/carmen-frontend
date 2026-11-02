import { useWatch, type UseFormReturn } from "react-hook-form";
import { useTranslations } from "use-intl";
import { FormToolbar } from "@/components/share/form-toolbar";
import { cn } from "@/lib/utils";

import type { FormMode } from "@/types/form";
import type { RecipeCategoryFormValues } from "./recipe-category-form-schema";

interface RecipeCategoryToolbarProps {
  readonly form: UseFormReturn<RecipeCategoryFormValues>;
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

export function RecipeCategoryToolbar({
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
}: RecipeCategoryToolbarProps) {
  const tr = useTranslations("operationPlan.recipeCategory");

  const code = useWatch({ control: form.control, name: "code" });
  const name = useWatch({ control: form.control, name: "name" });

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

  return (
    <FormToolbar
      mode={mode}
      formId="recipe-category-form"
      isPending={isPending}
      title={isAdd ? tr("add") : name || tr("untitledCategory")}
      badges={codePill}
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
