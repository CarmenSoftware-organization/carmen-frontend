import { useState } from "react";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import type { MappingType } from "@/types/chart-of-account-mapping";
import { useGenerateAccountMapping } from "./use-account-mapping";

interface CoamGenerateDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (v: boolean) => void;
  readonly defaultType: MappingType;
}

export function CoamGenerateDialog({
  open,
  onOpenChange,
  defaultType,
}: CoamGenerateDialogProps) {
  const t = useTranslations("config.chartOfAccountMapping");
  const tc = useTranslations("common");
  const [mode, setMode] = useState<"used" | "all">("used");
  const [type, setType] = useState<MappingType | "both">(defaultType);
  const generate = useGenerateAccountMapping();

  const submit = () =>
    generate.mutate(
      { mode, ...(type === "both" ? {} : { mapping_type: type }) },
      {
        onSuccess: (res) => {
          toast.success(
            t("generateDone", { created: res.created.AP + res.created.GL }),
          );
          onOpenChange(false);
        },
      },
    );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("generateTitle")}</DialogTitle>
          <DialogDescription>{t("generateDesc")}</DialogDescription>
        </DialogHeader>
        <RadioGroup
          value={mode}
          onValueChange={(v) => setMode(v as "used" | "all")}
        >
          <Label className="flex items-center gap-2">
            <RadioGroupItem value="used" />
            {t("modeUsed")}
          </Label>
          <Label className="flex items-center gap-2">
            <RadioGroupItem value="all" />
            {t("modeAll")}
          </Label>
        </RadioGroup>
        <p className="font-medium">{t("generateType")}</p>
        <RadioGroup
          value={type}
          onValueChange={(v) => setType(v as MappingType | "both")}
        >
          <Label className="flex items-center gap-2">
            <RadioGroupItem value="AP" />
            {t("tabAp")}
          </Label>
          <Label className="flex items-center gap-2">
            <RadioGroupItem value="GL" />
            {t("tabGl")}
          </Label>
          <Label className="flex items-center gap-2">
            <RadioGroupItem value="both" />
            {t("generateBoth")}
          </Label>
        </RadioGroup>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {tc("cancel")}
          </Button>
          <Button onClick={submit} disabled={generate.isPending}>
            {t("generate")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
