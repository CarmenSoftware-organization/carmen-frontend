import { Controller, useWatch, type UseFormReturn } from "react-hook-form";
import { useTranslations } from "use-intl";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldDescription,
  FieldInput,
  FieldLabel,
} from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { ScheduleFormValues } from "./schedule-form-schema";

/**
 * ต่ำกว่านี้ถือว่า "แจ้งแทบจะพร้อมกับที่รอบรันเริ่ม" แล้วขึ้นคำเตือน
 *
 * เป็นแค่คำเตือน ไม่ใช่กฎ — หลังบ้านยอมรับ gap เท่าไรก็ได้ และตั้งใจไม่แปลง
 * gap สั้น ๆ เป็น "พรุ่งนี้" ให้อัตโนมัติ เพราะ "แจ้งหลังรัน 5 นาที" เป็นเจตนา
 * ที่พบได้ปกติ การดันไปอีก 24 ชม. ให้เองคือเดาผิดแบบที่ผู้ใช้ไม่รู้ตัว
 */
const NOTIFY_GAP_WARNING_MINUTES = 10;

function toMinutes(value: string): number | null {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

interface ScheduleNotificationsFieldProps {
  readonly form: UseFormReturn<ScheduleFormValues>;
  readonly disabled: boolean;
}

/**
 * เวลาแจ้งเตือน + ช่องทาง notification (web app + email)
 *
 * `notify_at` คือเวลาที่ "บอกผู้รับว่ารายงานพร้อม" ไม่ใช่เวลาที่รายงานรัน
 * ว่างไว้ = แจ้งทันทีที่รันเสร็จ ถ้าใส่เวลาที่เร็วกว่าเวลารัน แปลว่าวันถัดไป
 * และจะขึ้น badge "+1 วัน" แบบเดียวกับเวลาถึงของตั๋วเครื่องบินที่บินข้ามวัน —
 * backend คำนวณ offset เองจากคู่ (time, notify_at) จึงไม่ต้องส่งขึ้นไป
 *
 * Pair `htmlFor` + `id` ตามที่ CLAUDE.md กำหนด — shadcn Checkbox อย่างเดียว
 * ไม่ปนกับ `<input type="checkbox">` native
 *
 * @param props.form - RHF instance
 * @param props.disabled - ปิด input ทั้งกลุ่ม
 * @returns JSX
 */
export function ScheduleNotificationsField({
  form,
  disabled,
}: ScheduleNotificationsFieldProps) {
  const t = useTranslations("reportSchedule");
  const runTime = useWatch({ control: form.control, name: "time" });
  const notifyAt = useWatch({ control: form.control, name: "notify_at" });
  // "HH:mm" zero-padded เทียบกันเป็น string ได้ตรง ๆ — ตรรกะเดียวกับที่ gateway
  // ใช้ตัดสิน notify_day_offset ตอนสร้าง schedule
  const isNextDay = !!notifyAt && !!runTime && notifyAt < runTime;

  // รอบรันแบบ viewer_url แค่ mint ลิงก์แล้วยิง noti ต่อในฟังก์ชันเดียว ใช้เวลา
  // ไม่กี่วินาที ตั้งใกล้แค่ไหนก็ไม่มี race — แต่คนตั้งมักคิดว่าเลขนี้คือ
  // "เผื่อเวลารายงานประมวลผล" ซึ่งไม่ใช่ จึงบอกไปตรง ๆ ว่าจะได้แจ้งเกือบทันที
  const gapMinutes = (() => {
    if (!notifyAt || isNextDay) return null;
    const run = toMinutes(runTime ?? "");
    const notify = toMinutes(notifyAt);
    if (run === null || notify === null) return null;
    return notify - run;
  })();
  const isTooClose =
    gapMinutes !== null && gapMinutes < NOTIFY_GAP_WARNING_MINUTES;

  return (
    <Field>
      <FieldLabel>{t("notifications")}</FieldLabel>
      <div className="flex flex-col gap-3 rounded-md border p-3">
        <Field>
          <FieldLabel htmlFor="notify-at">{t("notifyAt")}</FieldLabel>
          <div className="flex items-center gap-2">
            <FieldInput
              id="notify-at"
              type="time"
              className="h-8 w-32"
              disabled={disabled}
              {...form.register("notify_at")}
            />
            {isNextDay && (
              <Badge variant="secondary" size="sm">
                {t("notifyAtNextDayBadge")}
              </Badge>
            )}
          </div>
          <FieldDescription className={cn(isTooClose && "text-warning-ink")}>
            {!notifyAt
              ? t("notifyImmediately")
              : isNextDay
                ? t("notifyAtHintNextDay")
                : isTooClose
                  ? t("notifyAtHintTooClose", {
                      minutes: NOTIFY_GAP_WARNING_MINUTES,
                    })
                  : t("notifyAtHintSameDay")}
          </FieldDescription>
        </Field>

        <Controller
          control={form.control}
          name="notify_web"
          render={({ field }) => (
            <div className="flex items-center gap-2">
              <Checkbox
                id="notify-web"
                checked={field.value}
                onCheckedChange={(v) => field.onChange(v === true)}
                disabled={disabled}
              />
              <Label htmlFor="notify-web" className="cursor-pointer text-xs">
                {t("notifyWebApplication")}
              </Label>
            </div>
          )}
        />
        <Controller
          control={form.control}
          name="notify_email"
          render={({ field }) => (
            <div className="flex items-center gap-2">
              <Checkbox
                id="notify-email"
                checked={field.value}
                onCheckedChange={(v) => field.onChange(v === true)}
                disabled={disabled}
              />
              <Label htmlFor="notify-email" className="cursor-pointer text-xs">
                {t("notifyEmail")}
              </Label>
            </div>
          )}
        />
      </div>
    </Field>
  );
}
