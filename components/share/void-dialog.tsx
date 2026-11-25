import type React from "react";
import { useState } from "react";
import { useTranslations } from "use-intl";
import { Ban, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const REASON_MAX = 256;
const COUNTER_FROM = 200;

interface VoidDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly title: string;
  readonly description?: React.ReactNode;
  readonly isPending?: boolean;
  readonly onConfirm: (voidReason: string) => void;
}

/**
 * Dialog ยืนยันการยกเลิกเอกสาร — ถามเหตุผลก่อนยกเลิก
 *
 * โครงเดียวกับ `DeleteDialog`: ไอคอนข้างหัวข้อ · เนื้อหา · footer มีเส้นคั่น
 * สีแดงปรากฏสองที่เท่านั้นคือไอคอนหัวกับปุ่มยืนยัน (DESIGN.md ห้ามยิงสีเดียวกัน
 * ซ้ำหลายจุดในองค์ประกอบเดียว) ปุ่มยืนยันกดไม่ได้จนกว่าจะกรอกเหตุผล
 */
export function VoidDialog({
  open,
  onOpenChange,
  title,
  description,
  isPending,
  onConfirm,
}: VoidDialogProps) {
  const tc = useTranslations("common");
  const tfl = useTranslations("field");
  const [reason, setReason] = useState("");
  const isStringDescription = typeof description === "string";

  const handleOpenChange = (value: boolean) => {
    if (!value && !isPending) {
      onOpenChange(false);
      setReason("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="gap-0 p-0 sm:max-w-md">
        <DialogHeader className="gap-0 px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="bg-muted text-destructive flex size-9 shrink-0 items-center justify-center rounded-lg">
              <Ban className="size-4.5" />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-sm">{title}</DialogTitle>
              {description && isStringDescription && (
                <DialogDescription className="mt-1">
                  {description}
                </DialogDescription>
              )}
              {description && !isStringDescription && (
                <div className="text-muted-foreground mt-1 text-xs">
                  {description}
                </div>
              )}
            </div>
          </div>
        </DialogHeader>

        <Field className="border-t px-5 py-4">
          <FieldLabel htmlFor="void-reason" required>
            {tfl("voidReason")}
          </FieldLabel>
          <Textarea
            id="void-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={tfl("voidReasonPlaceholder")}
            className="resize-none text-xs"
            rows={3}
            maxLength={REASON_MAX}
            disabled={isPending}
          />
          {reason.length >= COUNTER_FROM && (
            <p className="text-muted-foreground text-micro-legal text-right tabular-nums">
              {reason.length}/{REASON_MAX}
            </p>
          )}
        </Field>

        <DialogFooter className="border-t px-5 py-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleOpenChange(false)}
            disabled={isPending}
          >
            <X />
            {tc("cancel")}
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={isPending || !reason.trim()}
            onClick={() => onConfirm(reason.trim())}
          >
            <Ban />
            {isPending ? tc("processing") : tc("void")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
