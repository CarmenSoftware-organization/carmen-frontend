import { AlertTriangle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface PoWorkflowRequiredDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly title: string;
  readonly description: string;
  readonly confirmLabel: string;
  readonly onConfirm: () => void;
}

/**
 * เตือนว่ายังไม่ได้เลือกเวิร์กโฟลว์ ตอนกดเพิ่มรายการในฟอร์ม PO
 *
 * ปุ่มเดียว — ไม่มี Cancel เพราะไม่มีอะไรให้ยกเลิก ยังไม่มีการกระทำเกิดขึ้น
 * ทางออกเดียวคือไปเลือกเวิร์กโฟลว์ ปุ่มเลยพาไปตรงนั้นเลย
 * โทนสีตาม TONE.warning ของ `po-action-dialog.tsx`
 */
export function PoWorkflowRequiredDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
}: PoWorkflowRequiredDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="gap-0 p-0 sm:max-w-md">
        <div className="p-5">
          <div className="flex items-start gap-3">
            <div className="bg-warning/10 text-warning-ink flex size-9 shrink-0 items-center justify-center rounded-lg">
              <AlertTriangle className="size-4.5" />
            </div>
            <div className="min-w-0 flex-1">
              <AlertDialogTitle className="text-warning-ink text-sm">
                {title}
              </AlertDialogTitle>
              <AlertDialogDescription className="mt-1">
                {description}
              </AlertDialogDescription>
            </div>
          </div>
        </div>
        <AlertDialogFooter className="bg-muted/20 border-t px-5 py-3">
          <AlertDialogAction
            size="default"
            variant="warning"
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
