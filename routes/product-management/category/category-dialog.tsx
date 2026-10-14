import { useTranslations } from "use-intl";
import { FolderTree, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  NODE_TYPE,
  type CategoryNode,
  type CategoryType,
} from "@/types/category";
import type { FormMode } from "@/types/form";
import { CategoryForm } from "./category-form";
import type { CategoryFormValues } from "./category-form-schema";

interface CategoryDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly mode: FormMode;
  readonly selectedNode?: CategoryNode;
  readonly parentNode?: CategoryNode;
  /** บรรพบุรุษเรียงจากใกล้สุด (พ่อ → ปู่) ที่เติม account_codes แล้ว */
  readonly ancestors?: CategoryNode[];
  /** โหมด edit: ยังโหลด account_codes ของ node นี้ไม่เสร็จ → รอก่อน mount ฟอร์ม */
  readonly accountCodesLoading?: boolean;
  /** โหมด edit: โหลด account_codes ไม่สำเร็จ → ปิดช่องบัญชี */
  readonly accountCodesUnavailable?: boolean;
  readonly onSubmit: (data: CategoryFormValues) => void;
  readonly isPending?: boolean;
}

const getCategoryType = (
  mode: FormMode,
  selectedNode?: CategoryNode,
  parentNode?: CategoryNode,
): CategoryType => {
  if (mode === "edit" && selectedNode) {
    if (selectedNode.type === NODE_TYPE.CATEGORY) return "category";
    if (selectedNode.type === NODE_TYPE.SUBCATEGORY) return "subcategory";
    return "itemgroup";
  }
  if (!parentNode) return "category";
  if (parentNode.type === NODE_TYPE.CATEGORY) return "subcategory";
  return "itemgroup";
};

export function CategoryDialog({
  open,
  onOpenChange,
  mode,
  selectedNode,
  parentNode,
  ancestors,
  accountCodesLoading,
  accountCodesUnavailable,
  onSubmit,
  isPending,
}: CategoryDialogProps) {
  const t = useTranslations("productManagement.category");
  const tf = useTranslations("form");
  const tc = useTranslations("common");

  const TYPE_LABELS: Record<CategoryType, string> = {
    category: t("nodeCategory"),
    subcategory: t("nodeSubcategory"),
    itemgroup: t("nodeItemGroup"),
  };

  const categoryType = getCategoryType(mode, selectedNode, parentNode);
  const typeLabel = TYPE_LABELS[categoryType];
  const title =
    mode === "edit"
      ? tf("editTitle", { entity: typeLabel })
      : tf("addTitle", { entity: typeLabel });

  return (
    <Dialog open={open} onOpenChange={isPending ? undefined : onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 p-0 sm:max-w-2xl">
        <DialogHeader className="relative gap-0 px-5 pt-6 pb-4">
          <div className="flex items-start gap-3">
            <div className="bg-muted text-primary flex size-9 shrink-0 items-center justify-center rounded-lg">
              <FolderTree className="size-4.5" />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-base">{title}</DialogTitle>
              <DialogDescription className="sr-only">{title}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {open && accountCodesLoading && (
          <div className="text-muted-foreground flex min-h-0 flex-1 items-center justify-center gap-2 border-t px-5 py-8 text-xs">
            <Loader2 className="size-4 animate-spin" />
            {tc("loading")}
          </div>
        )}
        {open && !accountCodesLoading && (
          <div className="min-h-0 flex-1 overflow-y-auto border-t px-5 py-4">
            <CategoryForm
              type={categoryType}
              mode={mode}
              selectedNode={selectedNode}
              parentNode={parentNode}
              ancestors={ancestors}
              accountCodesUnavailable={accountCodesUnavailable}
              onSubmit={onSubmit}
              onCancel={() => onOpenChange(false)}
              isPending={isPending}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
