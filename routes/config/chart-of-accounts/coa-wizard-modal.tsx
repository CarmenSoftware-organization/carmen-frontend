import { useState } from "react";
import { Sparkles, Check } from "lucide-react";
import { useTranslations } from "use-intl";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface CoaWizardModalProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}

interface WizardModuleOption {
  id: string;
  titleKey: string;
  descKey: string;
}

const WIZARD_MODULES: WizardModuleOption[] = [
  {
    id: "hotelRooms",
    titleKey: "hotelRoomsTitle",
    descKey: "hotelRoomsDesc",
  },
  {
    id: "restaurantFB",
    titleKey: "restaurantFBTitle",
    descKey: "restaurantFBDesc",
  },
  {
    id: "banquetEvents",
    titleKey: "banquetEventsTitle",
    descKey: "banquetEventsDesc",
  },
  {
    id: "spaWellness",
    titleKey: "spaWellnessTitle",
    descKey: "spaWellnessDesc",
  },
  {
    id: "statisticsTracking",
    titleKey: "statisticsTrackingTitle",
    descKey: "statisticsTrackingDesc",
  },
];

export function CoaWizardModal({ open, onOpenChange }: CoaWizardModalProps) {
  const t = useTranslations("config.chartOfAccounts.wizard");
  const tc = useTranslations("common");

  const [selectedModules, setSelectedModules] = useState<Record<string, boolean>>({
    hotelRooms: true,
    restaurantFB: true,
    banquetEvents: false,
    spaWellness: false,
    statisticsTracking: true,
  });

  const toggleModule = (id: string) => {
    setSelectedModules((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleApply = () => {
    toast.success(t("success"));
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader className="border-b pb-4">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Sparkles className="size-4.5" />
            </div>
            <div>
              <DialogTitle className="text-sm font-semibold">
                {t("title")}
              </DialogTitle>
              <DialogDescription className="mt-0.5 text-xs text-muted-foreground">
                {t("desc")}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="max-h-[60vh] space-y-3 overflow-y-auto py-2">
          {WIZARD_MODULES.map((item) => {
            const isChecked = Boolean(selectedModules[item.id]);
            return (
              <label
                key={item.id}
                htmlFor={`wizard-option-${item.id}`}
                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                  isChecked
                    ? "border-primary/40 bg-primary/5 dark:bg-primary/10"
                    : "border-border bg-card hover:bg-secondary/40"
                }`}
              >
                <input
                  type="checkbox"
                  id={`wizard-option-${item.id}`}
                  checked={isChecked}
                  onChange={() => toggleModule(item.id)}
                  className="mt-0.5 size-4 rounded border-border text-primary focus:ring-primary"
                />
                <div className="flex-1 space-y-0.5 text-left">
                  <div className="text-xs font-semibold text-foreground">
                    {t(item.titleKey)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {t(item.descKey)}
                  </div>
                </div>
              </label>
            );
          })}
        </div>

        <DialogFooter className="flex-col items-center justify-between gap-2 border-t pt-3 sm:flex-row">
          <span className="text-micro text-muted-foreground">
            {t("note")}
          </span>
          <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              {tc("cancel")}
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleApply}
              className="gap-1.5"
            >
              <Check className="size-4" />
              {t("apply")}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
