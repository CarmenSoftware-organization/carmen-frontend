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

interface JvVoidDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly isPending?: boolean;
  readonly onConfirm: (reason: string) => void;
}

/** Dialog ยกเลิก (void) JV — backend บังคับ `reason` จึงต้องกรอกก่อนยืนยัน */
export function JvVoidDialog({
  open,
  onOpenChange,
  isPending,
  onConfirm,
}: JvVoidDialogProps) {
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
          <DialogTitle>{t("voidTitle")}</DialogTitle>
          <DialogDescription>{t("voidDescription")}</DialogDescription>
        </DialogHeader>
        <Field>
          <FieldLabel htmlFor="jv-void-reason" required>
            {t("voidReasonLabel")}
          </FieldLabel>
          <Textarea
            id="jv-void-reason"
            value={reason}
            maxLength={REASON_MAX}
            rows={3}
            className="resize-none text-sm"
            placeholder={t("voidReasonPlaceholder")}
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
            disabled={isPending || reason.trim() === ""}
            onClick={() => onConfirm(reason.trim())}
          >
            {t("void")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
