import { useState } from "react";
import { useTranslations } from "use-intl";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { SendBackFields } from "@/routes/accounting/shared/send-back-fields";
import { useJvPreviousStages } from "@/routes/accounting/journal-voucher/use-jv-previous-stages";

const REASON_MAX = 256;

interface JvSendBackDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly journalId: string | undefined;
  readonly isPending?: boolean;
  readonly onConfirm: (stage: string, reason: string) => void;
}

/** Dialog ส่ง JV กลับไปขั้นก่อนหน้า — ต้องเลือกขั้นปลายทางและกรอกเหตุผลก่อนยืนยัน */
export function JvSendBackDialog({
  open,
  onOpenChange,
  journalId,
  isPending,
  onConfirm,
}: JvSendBackDialogProps) {
  const t = useTranslations("accounting.documents");
  const tc = useTranslations("common");
  const [stage, setStage] = useState("");
  const [reason, setReason] = useState("");
  const stagesQuery = useJvPreviousStages(journalId, open);

  const handleOpenChange = (value: boolean) => {
    if (isPending) return;
    onOpenChange(value);
    if (!value) {
      setStage("");
      setReason("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("sendBackTitle")}</DialogTitle>
          <DialogDescription>{t("sendBackDescription")}</DialogDescription>
        </DialogHeader>
        <SendBackFields
          labels={{
            stage: t("sendBackStage"),
            stagePlaceholder: t("sendBackStagePlaceholder"),
            stagesError: t("sendBackStagesError"),
            noStages: t("sendBackNoStages"),
          }}
          stage={stage}
          onStageChange={setStage}
          stages={stagesQuery.data ?? []}
          isLoading={stagesQuery.isLoading}
          isError={stagesQuery.isError}
        />
        <Field>
          <FieldLabel htmlFor="jv-send-back-reason" required>
            {t("sendBackReasonLabel")}
          </FieldLabel>
          <Textarea
            id="jv-send-back-reason"
            value={reason}
            maxLength={REASON_MAX}
            rows={3}
            className="resize-none text-sm"
            placeholder={t("sendBackReasonPlaceholder")}
            onChange={(e) => setReason(e.target.value)}
          />
        </Field>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isPending}
            onClick={() => handleOpenChange(false)}
          >
            {tc("cancel")}
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={isPending || !stage || reason.trim() === ""}
            onClick={() => onConfirm(stage, reason.trim())}
          >
            {t("sendBack")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
