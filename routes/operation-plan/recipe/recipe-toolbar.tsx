import { useWatch, type UseFormReturn } from "react-hook-form";
import { useTranslations } from "use-intl";
import { FormToolbar } from "@/components/share/form-toolbar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RECIPE_STATUS_OPTIONS } from "@/constant/recipe";
import { cn } from "@/lib/utils";
import type { FormMode } from "@/types/form";
import type { RecipeFormValues } from "./recipe-form-schema";
import { RecipeStatusBadge } from "./recipe-list-cells";

interface RecipeToolbarProps {
  readonly form: UseFormReturn<RecipeFormValues>;
  readonly mode: FormMode;
  readonly isPending: boolean;
  readonly isDeleting: boolean;
  readonly onBack: () => void;
  readonly onEdit: () => void;
  readonly onCancel: () => void;
  readonly onDelete?: () => void;
  /** ปุ่มประวัติการแก้ไข — ส่งเฉพาะสูตรที่บันทึกแล้ว */
  readonly activity?: { id: string; label?: string };
  /** เปิด sheet comment + ไฟล์แนบ — ส่งเฉพาะสูตรที่บันทึกแล้ว */
  readonly onComment?: () => void;
}

export function RecipeToolbar({
  form,
  mode,
  isPending,
  isDeleting,
  onBack,
  onEdit,
  onCancel,
  onDelete,
  activity,
  onComment,
}: RecipeToolbarProps) {
  const ts = useTranslations("status");
  const tr = useTranslations("operationPlan.recipe");
  const code = useWatch({ control: form.control, name: "code" });
  const name = useWatch({ control: form.control, name: "name" });
  const status = useWatch({ control: form.control, name: "status" });
  const isView = mode === "view";
  const isAdd = mode === "add";

  const badges = (
    <>
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
        {code || "—"}
      </span>
      {isView ? (
        <RecipeStatusBadge
          status={status}
          className="tracking-wider uppercase"
        />
      ) : (
        <Select
          value={status}
          onValueChange={(v) =>
            form.setValue("status", v, { shouldDirty: true })
          }
          disabled={isPending}
        >
          <SelectTrigger
            size="xs"
            className="h-6 w-32 text-xs"
            aria-label="status"
          >
            <SelectValue placeholder="—" />
          </SelectTrigger>
          <SelectContent>
            {RECIPE_STATUS_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {ts(
                  opt.value.toLowerCase() as "draft" | "published" | "archived",
                )}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </>
  );

  return (
    <FormToolbar
      mode={mode}
      formId="recipe-form"
      isPending={isPending}
      title={isAdd ? tr("add") : name || tr("untitledRecipe")}
      badges={badges}
      onBack={onBack}
      onCancel={onCancel}
      onEdit={onEdit}
      onDelete={onDelete}
      deleteIsPending={isDeleting}
      activity={activity}
      onComment={onComment}
    />
  );
}
