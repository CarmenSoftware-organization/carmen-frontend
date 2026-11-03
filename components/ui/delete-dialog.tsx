import type { ReactNode } from "react";
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

interface DeleteDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly title: string;
  readonly description?: ReactNode;
  readonly onConfirm: () => void;
  readonly isPending?: boolean;
}

export function DeleteDialog({
  open,
  onOpenChange,
  title,
  description,
  onConfirm,
  isPending,
}: DeleteDialogProps) {
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
                {title || td("title")}
              </AlertDialogTitle>
              <AlertDialogDescription className="mt-1 max-h-48 overflow-y-auto text-sm leading-relaxed wrap-anywhere">
                {description || td("confirm")}
              </AlertDialogDescription>
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
            disabled={isPending}
          >
            <Trash2 />
            {isPending ? td("deleting") : tc("delete")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
