import type { ReactNode } from "react";
import { useWatch, type UseFormReturn } from "react-hook-form";
import { useLocale, useTranslations } from "use-intl";
import { formatLocalizedDate } from "@/lib/date-utils";
import type { EquipmentFormValues } from "./eq-form-schema";
import { EqThumbnail } from "./eq-thumbnail";
import { EqMaintenanceBadge } from "./eq-maintenance-badge";
import { EqAvailability } from "./eq-availability";

interface EqSummaryProps {
  readonly form: UseFormReturn<EquipmentFormValues>;
  readonly imageUrl: string | null | undefined;
}

/**
 * แถบสรุปบนหัวหน้ารายละเอียด (โหมดอ่าน) — ตอบสามคำถามที่คนเปิดหน้านี้มาหา
 * ก่อนต้องเลื่อนลงไปอ่านฟอร์ม: หน้าตาเครื่อง · ถึงรอบซ่อมหรือยัง · พร้อมใช้กี่เครื่อง
 *
 * อ่านค่าจากฟอร์ม (ไม่ใช่ entity) เพื่อให้ตรงกับที่เพิ่งบันทึกทันทีหลัง
 * `form.reset(values)` โดยไม่ต้องรอ refetch
 */
export function EqSummary({ form, imageUrl }: EqSummaryProps) {
  const t = useTranslations("operationPlan.equipment");
  const tfl = useTranslations("field");
  const locale = useLocale();
  const [name, nextDate, lastDate, schedule, available, total, station] =
    useWatch({
      control: form.control,
      name: [
        "name",
        "next_maintenance_date",
        "last_maintenance_date",
        "maintenance_schedule",
        "available_qty",
        "total_qty",
        "station",
      ],
    });

  return (
    <div className="bg-card mb-6 flex flex-col gap-4 rounded-lg border p-4 sm:flex-row sm:items-start">
      <EqThumbnail src={imageUrl} alt={name} className="size-20 sm:size-24" />

      <dl className="grid flex-1 grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <SummaryItem
          label={t("maintenance")}
          className="col-span-2 sm:col-span-1"
        >
          <EqMaintenanceBadge nextDate={nextDate} />
          {(lastDate || schedule) && (
            <p className="text-muted-foreground mt-1.5 text-xs">
              {lastDate &&
                t("maintLast", {
                  date: formatLocalizedDate(lastDate, locale),
                })}
              {lastDate && schedule && " · "}
              {schedule}
            </p>
          )}
        </SummaryItem>

        <SummaryItem label={t("availabilityCol")}>
          <EqAvailability
            available={Number(available)}
            total={Number(total)}
            className="text-lg"
          />
        </SummaryItem>

        <SummaryItem label={tfl("station")}>
          <span className="text-sm font-medium">{station || "—"}</span>
        </SummaryItem>
      </dl>
    </div>
  );
}

function SummaryItem({
  label,
  className,
  children,
}: {
  readonly label: string;
  readonly className?: string;
  readonly children: ReactNode;
}) {
  return (
    <div className={className}>
      <dt className="text-micro-legal text-muted-foreground mb-1.5 font-bold tracking-[0.14em] uppercase">
        {label}
      </dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}
