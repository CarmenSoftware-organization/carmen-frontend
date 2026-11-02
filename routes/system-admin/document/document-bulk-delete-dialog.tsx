import { Trash2, X } from "lucide-react";
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
import { formatFileSize } from "@/lib/format-file-size";

interface DocumentBulkDeleteDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly count: number;
  readonly size: number;
  readonly isPending: boolean;
  /** ปิดปุ่มยืนยันระหว่าง refetch (กันส่ง expected_count เก่าหลัง 409) */
  readonly confirmDisabled?: boolean;
  /** ข้อความ error จาก server (เช่น 409 จำนวนเปลี่ยน) — แสดงในกล่องโดยไม่ปิด */
  readonly error?: string;
  readonly onConfirm: () => void;
}

/** ยืนยันลบหลายไฟล์ — จำนวน + ขนาดรวม + "ลบถาวร กู้คืนไม่ได้" · ปุ่มยืนยันเป็น destructive */
export function DocumentBulkDeleteDialog({
  open,
  onOpenChange,
  count,
  size,
  isPending,
  confirmDisabled,
  error,
  onConfirm,
}: DocumentBulkDeleteDialogProps) {
  const t = useTranslations("systemAdmin.document");
  const td = useTranslations("delete");
  const tc = useTranslations("common");

  return (
    <AlertDialog
      open={open}
      onOpenChange={(o) => !isPending && onOpenChange(o)}
    >
      <AlertDialogContent className="gap-0 p-0 sm:max-w-md">
        <div className="p-5">
          <div className="flex items-start gap-3">
            <div className="bg-muted text-destructive flex size-9 shrink-0 items-center justify-center rounded-lg">
              <Trash2 className="size-4.5" />
            </div>
            <div className="min-w-0 flex-1">
              <AlertDialogTitle className="text-base">
                {t("bulkDeleteTitle", { count })}
              </AlertDialogTitle>
              <AlertDialogDescription className="mt-1 text-sm leading-relaxed">
                <span className="text-foreground block font-medium">
                  {t("bulkDeleteSummary", {
                    count,
                    size: formatFileSize(size),
                  })}
                </span>
                {t("bulkDeletePermanent")}
              </AlertDialogDescription>
              {error && (
                <p
                  role="alert"
                  className="text-destructive mt-3 text-sm font-medium"
                >
                  {error}
                </p>
              )}
            </div>
          </div>
        </div>
        <AlertDialogFooter className="border-t px-5 py-3">
          <AlertDialogCancel disabled={isPending}>
            <X />
            {tc("cancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            size="default"
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            disabled={isPending || confirmDisabled || count <= 0}
          >
            <Trash2 />
            {isPending ? td("deleting") : tc("delete")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
