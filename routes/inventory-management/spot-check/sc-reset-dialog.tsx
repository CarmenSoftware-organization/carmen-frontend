import { RotateCcw, X } from "lucide-react";
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

interface ScResetDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly isPending: boolean;
  readonly onConfirm: () => void;
}

export function ScResetDialog({
  open,
  onOpenChange,
  isPending,
  onConfirm,
}: ScResetDialogProps) {
  const t = useTranslations("inventoryManagement.spotCheck");
  const tc = useTranslations("common");

  return (
    <AlertDialog
      open={open}
      onOpenChange={(o) => !isPending && onOpenChange(o)}
    >
      <AlertDialogContent className="gap-0 p-0 sm:max-w-md">
        {" "}
        <div className="p-5">
          <div className="flex items-start gap-3">
            <div className="bg-muted text-warning-ink flex size-9 shrink-0 items-center justify-center rounded-lg">
              <RotateCcw className="size-4.5" />
            </div>
            <div className="min-w-0 flex-1">
              <AlertDialogTitle className="text-sm">
                {t("resetTitle")}
              </AlertDialogTitle>
              <AlertDialogDescription className="mt-1 text-xs leading-relaxed">
                {t("resetConfirm")}
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
            variant="warning"
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            disabled={isPending}
          >
            <RotateCcw />
            {isPending ? t("resetting") : t("reset")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
