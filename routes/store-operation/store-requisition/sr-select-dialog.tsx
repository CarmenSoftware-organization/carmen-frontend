import { useTranslations } from "use-intl";
import { CheckSquare, ListChecks } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

interface SrSelectDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly allCount: number;
  readonly pendingCount: number;
  readonly onSelectAll: () => void;
  readonly onSelectPending: () => void;
}

export function SrSelectDialog({
  open,
  onOpenChange,
  allCount,
  pendingCount,
  onSelectAll,
  onSelectPending,
}: SrSelectDialogProps) {
  const t = useTranslations("storeOperation.storeRequisition");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden p-0 sm:max-w-2xl">
        {" "}
        <div className="relative space-y-5 p-6">
          <DialogHeader>
            <div className="flex items-start gap-3">
              <div className="bg-invert/10 text-invert flex size-9 shrink-0 items-center justify-center rounded-lg">
                <ListChecks className="size-4.5" />
              </div>
              <div className="min-w-0 flex-1">
                <DialogTitle className="text-sm">
                  {t("selectItemsTitle")}
                </DialogTitle>
                <DialogDescription className="mt-1">
                  {t("selectItemsDesc")}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={onSelectAll}
              className="group hover:border-primary/40 bg-card focus-visible:ring-primary/40 relative flex cursor-pointer flex-col items-start gap-3 overflow-hidden rounded-xl border p-4 text-left transition-colors duration-200 hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2"
            >
              <div className="bg-primary/10 text-primary flex size-9 items-center justify-center rounded-lg">
                <CheckSquare className="size-4" />
              </div>
              <div className="space-y-1">
                <div className="text-sm font-semibold">{t("selectAll")}</div>
                <div className="text-muted-foreground text-xs">
                  {t("selectAllDesc")}
                </div>
              </div>
              <Badge variant="secondary" size="xs" className="tabular-nums">
                {allCount}
              </Badge>
            </button>

            <button
              type="button"
              onClick={onSelectPending}
              disabled={pendingCount === 0}
              className="group hover:border-warning/40 bg-card focus-visible:ring-warning/40 relative flex cursor-pointer flex-col items-start gap-3 overflow-hidden rounded-xl border p-4 text-left transition-colors duration-200 hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
            >
              <div className="bg-warning/10 text-warning-foreground flex size-9 items-center justify-center rounded-lg">
                <ListChecks className="size-4" />
              </div>
              <div className="space-y-1">
                <div className="text-sm font-semibold">
                  {t("selectPending")}
                </div>
                <div className="text-muted-foreground text-xs">
                  {t("selectPendingDesc")}
                </div>
              </div>
              <Badge variant="warning-light" size="xs" className="tabular-nums">
                {pendingCount}
              </Badge>
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
