import { useState } from "react";
import { useTranslations } from "use-intl";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";

interface JvReverseDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly isPending?: boolean;
  /** `jvDate` เป็น ISO 8601 (UTC) ตามที่ `POST /gl-posting/:id/reverse` รับ */
  readonly onConfirm: (jvDate: string) => void;
}

/** วันนี้ตามเวลาเครื่อง ในรูป YYYY-MM-DD ที่ DatePicker ใช้ */
const todayYmd = (): string => {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${mm}-${dd}`;
};

/**
 * Dialog กลับรายการ JV — backend บังคับ `jv_date` (วันที่ของใบกลับ ต้องอยู่ในงวดที่เปิด)
 * ไม่ส่งไป = `new Date(undefined)` ฝั่ง micro เป็น Invalid Date จึงให้เลือกวันที่ก่อนยืนยัน (ค่าเริ่มต้นวันนี้)
 */
export function JvReverseDialog({
  open,
  onOpenChange,
  isPending,
  onConfirm,
}: JvReverseDialogProps) {
  const t = useTranslations("accounting.documents");
  const tc = useTranslations("common");
  const [jvDate, setJvDate] = useState(todayYmd);

  const handleOpenChange = (value: boolean) => {
    if (isPending) return;
    onOpenChange(value);
    if (!value) setJvDate(todayYmd());
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("reverseTitle")}</DialogTitle>
          <DialogDescription>{t("reverseDescription")}</DialogDescription>
        </DialogHeader>
        <Field>
          <FieldLabel required>
            {t("reverseDateLabel")}
          </FieldLabel>
          <DatePicker
            value={jvDate}
            onValueChange={setJvDate}
            hideClear
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
            disabled={isPending || !jvDate}
            // วันที่ล้วน (YYYY-MM-DD) → เที่ยงคืน UTC แบบเดียวกับ `journal_date` ตอนสร้างใบ
            onClick={() => onConfirm(new Date(jvDate).toISOString())}
          >
            {t("reverse")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
