import { CopyPlus, X } from "lucide-react";
import { useTranslations } from "use-intl";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { DuplicateProductDialogProps } from "@/hooks/use-duplicate-product-confirm";

/**
 * Dialog ยืนยันเมื่อเลือก product ที่ซ้ำกับ row อื่นในลิสต์ (reusable ทั่ว project)
 *
 * driven ด้วย [[use-duplicate-product-confirm]] — spread `dialogProps` ตรงๆ
 * Confirm = เพิ่มซ้ำต่อ, Cancel = คืนค่าเดิม (ผู้เรียกยังไม่ apply ค่าใหม่)
 * แสดงชื่อ product ผ่าน `productName` (fallback เป็นข้อความทั่วไปถ้าไม่ส่งมา)
 *
 * @example
 * const dup = useDuplicateProductConfirm();
 * <DuplicateProductDialog {...dup.dialogProps} />
 */
export function DuplicateProductDialog({
  open,
  onOpenChange,
  onConfirm,
  onCancel,
  productName,
}: DuplicateProductDialogProps) {
  const t = useTranslations("duplicateProduct");
  const tc = useTranslations("common");

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="gap-0 p-0 sm:max-w-md">
        <div className="p-5">
          <div className="flex items-start gap-3">
            <div className="bg-muted text-warning-ink flex size-9 shrink-0 items-center justify-center rounded-lg">
              <CopyPlus className="size-4.5" />
            </div>
            <div className="min-w-0 flex-1">
              <AlertDialogTitle className="text-sm">
                {t("title")}
              </AlertDialogTitle>
              <AlertDialogDescription className="mt-1 text-xs leading-relaxed">
                {productName
                  ? t("descriptionNamed", { name: productName })
                  : t("description")}
              </AlertDialogDescription>
            </div>
          </div>
        </div>
        <AlertDialogFooter className="border-t px-5 py-3">
          <AlertDialogCancel onClick={onCancel}>
            <X />
            {tc("cancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            variant="warning"
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
          >
            <CopyPlus />
            {t("confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
