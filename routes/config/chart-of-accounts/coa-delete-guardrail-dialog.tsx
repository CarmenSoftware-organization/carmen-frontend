import { AlertTriangle } from "lucide-react";
import { useTranslations } from "use-intl";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DeleteDialog } from "@/components/ui/delete-dialog";
import type { ChartOfAccount } from "@/types/chart-of-accounts";

interface CoaDeleteGuardrailDialogProps {
  readonly account: ChartOfAccount | null;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onConfirmDelete: (account: ChartOfAccount) => void;
  readonly isPending?: boolean;
}

/**
 * Delete Guardrail Rule (FRD Section 2.1, 3.2, 6.2 Rule 7, VAL-11, VAL-12):
 * - If account is used in transactions (is_used === true), block deletion and show Warning Modal to suggest Inactive status.
 * - If account is not used (is_used === false), show confirmation dialog before deletion.
 */
export function CoaDeleteGuardrailDialog({
  account,
  open,
  onOpenChange,
  onConfirmDelete,
  isPending,
}: CoaDeleteGuardrailDialogProps) {
  const t = useTranslations("config.chartOfAccounts");

  if (!account) return null;

  const isUsed = Boolean(account.is_used);

  if (isUsed) {
    return (
      <AlertDialog open={open} onOpenChange={onOpenChange}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader className="space-y-3">
            <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="size-6" />
            </div>
            <AlertDialogTitle className="text-center text-sm font-semibold">
              {t("rules.deleteGuardrailTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-center text-xs leading-relaxed text-muted-foreground">
              {t("rules.deleteGuardrailUsedDesc", {
                code: account.code,
                name: account.description_1,
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="sm:justify-center">
            <AlertDialogAction
              onClick={() => onOpenChange(false)}
              className="w-full sm:w-auto"
            >
              {t("rules.understood")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  return (
    <DeleteDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("deleteTitle")}
      description={t("rules.deleteGuardrailUnusedConfirm", {
        code: account.code,
        name: account.description_1,
      })}
      isPending={isPending}
      onConfirm={() => onConfirmDelete(account)}
    />
  );
}
