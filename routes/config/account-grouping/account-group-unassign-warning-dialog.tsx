import { useTranslations } from "use-intl";
import { AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { AccountGroupNode } from "./account-grouping-types";

interface AccountGroupUnassignWarningDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly targetGroup: AccountGroupNode | null;
}

export function AccountGroupUnassignWarningDialog({
  open,
  onOpenChange,
  targetGroup,
}: AccountGroupUnassignWarningDialogProps) {
  const t = useTranslations("config.accountGrouping");

  if (!targetGroup) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="@container max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
            <AlertTriangle className="size-5 shrink-0" />
            <span>{t("unassignWarning.title")}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2 text-xs">
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-foreground leading-relaxed">
            {t("unassignWarning.desc")}
          </div>

          <div className="space-y-1.5 pt-1">
            <div className="font-semibold text-muted-foreground">
              Required Step-by-Step Actions:
            </div>
            <ol className="list-decimal list-inside space-y-1 font-mono text-xs text-foreground/90 pl-1">
              <li>{t("unassignWarning.step1")}</li>
              <li>
                {t("unassignWarning.step2")} (Group: <strong>[{targetGroup.code}]</strong>)
              </li>
              <li>{t("unassignWarning.step3")}</li>
            </ol>
          </div>
        </div>

        <DialogFooter className="pt-2">
          <Button
            type="button"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto"
          >
            {t("unassignWarning.understood")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
