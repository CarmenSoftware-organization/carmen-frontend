import { Printer } from "lucide-react";
import { useTranslations } from "use-intl";
import { Button } from "@/components/ui/button";
import { FormToolbar, ToolbarLabel } from "@/components/share/form-toolbar";
import type { FormMode } from "@/types/form";

interface RoleHeroProps {
  readonly name: string;
  readonly mode: FormMode;
  readonly canDelete: boolean;
  readonly isDeleting: boolean;
  readonly isSaving: boolean;
  readonly onBack: () => void;
  readonly onDelete: () => void;
  readonly onEdit: () => void;
  readonly onCancel: () => void;
  readonly onPrint: () => void;
}

export function RoleHero({
  name,
  mode,
  canDelete,
  isDeleting,
  isSaving,
  onBack,
  onDelete,
  onEdit,
  onCancel,
  onPrint,
}: RoleHeroProps) {
  const t = useTranslations("systemAdmin.role");
  const tc = useTranslations("common");

  return (
    <FormToolbar
      mode={mode}
      formId="role-form"
      isPending={isSaving}
      title={name?.trim() || t("untitled")}
      onBack={onBack}
      onCancel={onCancel}
      onEdit={onEdit}
      onDelete={canDelete ? onDelete : undefined}
      deleteIsPending={isDeleting}
    >
      {/* Print เป็นปุ่มเฉพาะหน้า — อยู่ท้ายชุดมาตรฐาน (Edit · Delete · Activity · Print) */}
      {mode === "view" && (
        <Button
          title={tc("print")}
          key="print"
          type="button"
          variant="secondary"
          size="sm"
          onClick={onPrint}
        >
          <Printer className="size-3.5" aria-hidden="true" />
          <ToolbarLabel>{tc("print")}</ToolbarLabel>
        </Button>
      )}
    </FormToolbar>
  );
}
