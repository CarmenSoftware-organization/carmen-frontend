import { useNavigate } from "react-router";
import { useTranslations } from "use-intl";
import { FileText, LayoutTemplate } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface CreatePRDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}

const PR_BASE_PATH = "/procurement/purchase-request";

export function CreatePRDialog({ open, onOpenChange }: CreatePRDialogProps) {
  const t = useTranslations("procurement.purchaseRequest");
  const navigate = useNavigate();

  const go = (path: string) => {
    onOpenChange(false);
    navigate(path);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden p-0 sm:max-w-2xl">
        <div className="space-y-5 p-6">
          <DialogHeader>
            <DialogTitle className="text-sm">{t("createTitle")}</DialogTitle>
            <DialogDescription className="mt-1">
              {t("createDesc")}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => go(`${PR_BASE_PATH}/new`)}
              className="group hover:border-primary/40 bg-card focus-visible:ring-primary/40 flex cursor-pointer flex-col items-start gap-2 rounded-lg border p-3 text-left transition-colors duration-200 focus:outline-none focus-visible:ring-2"
            >
              <FileText className="text-foreground size-5" />
              <div className="space-y-0.5">
                <h3 className="text-foreground text-sm font-semibold">
                  {t("blankPr")}
                </h3>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  {t("blankPrDesc")}
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => go(`${PR_BASE_PATH}/from-template`)}
              className="group hover:border-primary/40 bg-card focus-visible:ring-primary/40 flex cursor-pointer flex-col items-start gap-2 rounded-lg border p-3 text-left transition-colors duration-200 focus:outline-none focus-visible:ring-2"
            >
              <LayoutTemplate className="text-primary size-5" />
              <div className="space-y-0.5">
                <h3 className="text-foreground text-sm font-semibold">
                  {t("fromTemplate")}
                </h3>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  {t("fromTemplateDesc")}
                </p>
              </div>
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
