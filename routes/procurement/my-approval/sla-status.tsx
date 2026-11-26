import { useTranslations } from "use-intl";
import { cn } from "@/lib/utils";

/** เหลือไม่เกินสัดส่วนนี้ของ SLA = ใกล้ครบ (สีส้ม) */
const NEAR_DUE_RATIO = 0.25;

const MINUTES_PER_DAY = 60 * 24;

/**
 * ระยะเวลาแบบสั้นหน่วยใหญ่สุดหน่วยเดียว (ปัดลง) เช่น "2 วัน" / "20 ชม." / "45 นาที"
 * หน่วยเดียวเพราะอยู่ในคอลัมน์ "รอมาแล้ว" ที่กว้าง 110px — เวลาครบกำหนดเต็มดูได้จาก title
 * @param minutes - จำนวนนาที (ค่าบวก)
 * @param t - ตัวแปลของ procurement.approval
 */
function formatDuration(
  minutes: number,
  t: ReturnType<typeof useTranslations<"procurement.approval">>,
): string {
  const total = Math.max(1, Math.floor(minutes));
  if (total >= MINUTES_PER_DAY) {
    return t("slaDays", { n: Math.floor(total / MINUTES_PER_DAY) });
  }
  if (total >= 60) return t("slaHours", { n: Math.floor(total / 60) });
  return t("slaMinutes", { n: total });
}

/**
 * SLA ของ stage ที่ใบรออยู่ — แสดงเป็นข้อมูลอย่างเดียว (ผู้ใช้สั่ง 2026-11-26 นับตามเวลาจริง)
 *
 * เหลือเวลา = สีปกติ · เหลือไม่ถึง 25% ของ SLA = สีส้ม · เกินแล้ว = สีแดง
 * stage ที่ไม่ได้ตั้ง SLA หรือไม่รู้เวลาเริ่มนับ = ไม่แสดงอะไร (ไม่ใส่ "—" ให้รก)
 * ชี้ค้างดูเวลาครบกำหนดเต็มได้จาก `title`
 * @param dueAt - เวลาครบกำหนดจาก backend (การดำเนินการล่าสุด + SLA)
 * @param minutes - SLA ของ stage เป็นนาที
 * @param now - เวลาปัจจุบันของการ render
 */
export function SlaStatus({
  dueAt,
  minutes,
  now,
}: {
  readonly dueAt: string | null;
  readonly minutes: number | null;
  readonly now: Date;
}) {
  const t = useTranslations("procurement.approval");
  if (!dueAt || !minutes) return null;
  const due = new Date(dueAt);
  if (Number.isNaN(due.getTime())) return null;
  const leftMinutes = (due.getTime() - now.getTime()) / 60_000;
  const isOverdue = leftMinutes < 0;
  const isNearDue = !isOverdue && leftMinutes <= minutes * NEAR_DUE_RATIO;
  const time = formatDuration(Math.abs(leftMinutes), t);
  return (
    <span
      title={t("slaDue", { at: due.toLocaleString() })}
      className={cn(
        "text-right text-xs font-medium tabular-nums",
        isOverdue
          ? "text-destructive"
          : isNearDue
            ? "text-warning-ink"
            : "text-muted-foreground",
      )}
    >
      {isOverdue ? t("slaOverdue", { time }) : t("slaLeft", { time })}
    </span>
  );
}
