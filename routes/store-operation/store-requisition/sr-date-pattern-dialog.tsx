import { useTranslations } from "use-intl";
import { CalendarClock } from "lucide-react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type { SrDatePattern } from "./use-sr";

/**
 * วันนี้อยู่นอกงวดบัญชีที่เปิดอยู่ — ถามก่อนว่าจะลงวันที่ไหน แล้วยิงซ้ำ
 *
 * backend ตีกลับ 422 พร้อมรหัส `SR_DATE_PATTERN_REQUIRED` (ตอนส่งใบ) หรือ
 * `SR_ISSUE_DATE_PATTERN_REQUIRED` (ตอนจ่ายของ) โดยตั้งใจให้ถามผู้ใช้ ไม่ใช่
 * ความผิดพลาดที่จบด้วย toast — ไม่มี dialog นี้คือทางตัน กดกี่ครั้งก็ได้ 422 เดิม
 */
export function SrDatePatternDialog({
  open,
  field,
  isPending,
  onOpenChange,
  onPick,
}: {
  readonly open: boolean;
  readonly field: "sr_date_pattern" | "issue_date_pattern";
  readonly isPending: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onPick: (pattern: SrDatePattern) => void;
}) {
  const t = useTranslations("storeOperation.storeRequisition");
  const tc = useTranslations("common");
  const isIssue = field === "issue_date_pattern";

  return (
    <AlertDialog
      open={open}
      onOpenChange={(o) => !o && !isPending && onOpenChange(false)}
    >
      <AlertDialogContent className="gap-0 p-0 sm:max-w-md">
        <div className="p-5">
          <div className="flex items-start gap-3">
            <div className="bg-warning/10 text-warning-ink flex size-9 shrink-0 items-center justify-center rounded-lg">
              <CalendarClock className="size-4.5" />
            </div>
            <div className="min-w-0 flex-1">
              <AlertDialogTitle className="text-sm">
                {t("datePatternTitle")}
              </AlertDialogTitle>
              <AlertDialogDescription className="mt-1">
                {isIssue
                  ? t("issueDatePatternDesc")
                  : t("srDatePatternDesc")}
              </AlertDialogDescription>
            </div>
          </div>

          {/* สองปุ่มเต็มความกว้าง ไม่ใช่ปุ่มคู่ท้าย dialog — นี่คือคำถามที่ต้องเลือก
              ไม่ใช่ยืนยัน/ยกเลิก การวางแบบ action bar จะอ่านเหมือนอันหนึ่งเป็นค่าหลัก */}
          <div className="mt-4 flex flex-col gap-2">
            <Button
              variant="outline"
              className="h-auto justify-start py-2.5 text-left"
              disabled={isPending}
              onClick={() => onPick("open-period")}
            >
              {t("datePatternOpenPeriod")}
            </Button>
            <Button
              variant="outline"
              className="h-auto justify-start py-2.5 text-left"
              disabled={isPending}
              onClick={() => onPick("today")}
            >
              {t("datePatternToday")}
            </Button>
          </div>
        </div>

        <AlertDialogFooter className="px-5 py-3">
          <AlertDialogCancel disabled={isPending}>
            {tc("cancel")}
          </AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
