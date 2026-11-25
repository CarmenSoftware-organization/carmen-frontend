import { useTranslations } from "use-intl";
import { SendHorizontal } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ReactNode } from "react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useProfile } from "@/hooks/use-profile";
import { formatDate } from "@/lib/date-utils";
import type { SrDatePattern } from "./use-sr";

interface SrSubmitDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly srNo?: string;
  readonly isPending: boolean;
  readonly onConfirm: () => void;
  /** งวด active ที่วันนี้อยู่นอก — มีค่า = ต้องถามวันที่ก่อนส่ง */
  readonly datePatternPeriod?: { start_at: string; end_at: string };
  readonly datePattern: SrDatePattern | null;
  readonly onDatePatternChange: (value: SrDatePattern) => void;
}

export function SrSubmitDialog({
  open,
  onOpenChange,
  srNo,
  isPending,
  onConfirm,
  datePatternPeriod,
  datePattern,
  onDatePatternChange,
}: SrSubmitDialogProps) {
  const t = useTranslations("storeOperation.storeRequisition");
  const tc = useTranslations("common");
  const { dateFormat } = useProfile();
  // ต้องเลือกวันที่ก่อนถึงส่งได้ — backend ตั้งใจให้ผู้ใช้เลือกเอง ไม่ตั้งค่าเริ่มต้นให้
  const isAwaitingDatePattern = !!datePatternPeriod && !datePattern;

  const renderStrong = (chunks: ReactNode) => (
    <strong className="text-foreground font-semibold">{chunks}</strong>
  );

  return (
    <AlertDialog
      open={open}
      onOpenChange={(o) => !o && !isPending && onOpenChange(false)}
    >
      <AlertDialogContent className="gap-0 p-0 sm:max-w-md">
        <div className="p-5">
          <div className="flex items-start gap-3">
            <div className="bg-info/10 text-info-ink flex size-9 shrink-0 items-center justify-center rounded-lg">
              <SendHorizontal className="size-4.5" />
            </div>
            <div className="min-w-0 flex-1">
              <AlertDialogTitle className="text-sm">
                {t("submitTitle")}
              </AlertDialogTitle>
              <AlertDialogDescription className="mt-1">
                {t.rich("submitConfirm", {
                  srNo: srNo ?? "—",
                  strong: renderStrong,
                })}
              </AlertDialogDescription>
              {/* backend ไม่ใช้ sr_date บนฟอร์มตอนส่ง — มันลงวันนี้ ถ้าวันนี้อยู่นอกงวด active
                  มันจะตีกลับ 422 ให้ถามว่าจะลงวันไหน ถามตรงนี้ไปพร้อมกับการยืนยันเลย
                  จะได้ไม่ต้องเด้งกล่องที่สองหลังกดส่ง */}
              {datePatternPeriod && (
                <div className="border-border bg-muted/40 mt-3 space-y-2 rounded-md border p-3">
                  <p className="text-foreground text-xs font-medium">
                    {t("submitDatePatternDesc", {
                      from: formatDate(datePatternPeriod.start_at, dateFormat),
                      to: formatDate(datePatternPeriod.end_at, dateFormat),
                    })}
                  </p>
                  <RadioGroup
                    value={datePattern ?? ""}
                    onValueChange={(next) =>
                      onDatePatternChange(next as SrDatePattern)
                    }
                    className="gap-2"
                  >
                    <div className="flex items-center gap-2">
                      <RadioGroupItem
                        value="open-period"
                        id="sr-date-open-period"
                      />
                      <Label
                        htmlFor="sr-date-open-period"
                        className="cursor-pointer text-xs font-normal"
                      >
                        {t("submitDateOpenPeriod", {
                          date: formatDate(datePatternPeriod.end_at, dateFormat),
                        })}
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="today" id="sr-date-today" />
                      <Label
                        htmlFor="sr-date-today"
                        className="cursor-pointer text-xs font-normal"
                      >
                        {t("submitDateToday", {
                          date: formatDate(new Date().toISOString(), dateFormat),
                        })}
                      </Label>
                    </div>
                  </RadioGroup>
                </div>
              )}
            </div>
          </div>
        </div>

        <AlertDialogFooter className="px-5 py-3">
          <AlertDialogCancel disabled={isPending}>
            {tc("cancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            size="default"
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            disabled={isPending || isAwaitingDatePattern}
          >
            <SendHorizontal />
            {isPending ? tc("processing") : tc("submit")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
