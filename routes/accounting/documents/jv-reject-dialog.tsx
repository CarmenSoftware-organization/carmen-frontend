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

const REASON_MAX = 256;

interface JvRejectDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly isPending?: boolean;
  readonly onConfirm: (reason: string) => void;
}

/** Dialog ปฏิเสธ JV — ปฏิเสธแล้วใบถูก void ไม่กลับมาแก้ได้ จึงบังคับกรอกเหตุผล */
export function JvRejectDialog({
  open,
  onOpenChange,
  isPending,
  onConfirm,
}: JvRejectDialogProps) {
  const t = useTranslations("accounting.documents");
  const tc = useTranslations("common");
  const [reason, setReason] = useState("");

  const handleOpenChange = (value: boolean) => {
    if (isPending) return;
    onOpenChange(value);
    if (!value) setReason("");
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("rejectTitle")}</DialogTitle>
          <DialogDescription>{t("rejectDescription")}</DialogDescription>
        </DialogHeader>
        <Field>
          <FieldLabel htmlFor="jv-reject-reason" required>
            {t("rejectReasonLabel")}
          </FieldLabel>
          <Textarea
            id="jv-reject-reason"
            value={reason}
            maxLength={REASON_MAX}
            rows={3}
            className="resize-none text-xs"
            placeholder={t("rejectReasonPlaceholder")}
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
            variant="destructive"
            disabled={isPending || reason.trim() === ""}
            onClick={() => onConfirm(reason.trim())}
          >
            {tc("reject")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
