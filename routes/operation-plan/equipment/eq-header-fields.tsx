import type { ReactNode } from "react";
import {
  Controller,
  useFormState,
  useWatch,
  type UseFormReturn,
} from "react-hook-form";
import { useLocale, useTranslations } from "use-intl";
import { Field, FieldLabel, FieldInput } from "@/components/ui/field";
import { LookupEquipmentCategory } from "@/components/lookup/lookup-equipment-category";
import { FieldGrid } from "@/components/share/compact-section";
import { formatLocalizedDate } from "@/lib/date-utils";
import type { EquipmentFormValues } from "./eq-form-schema";
import { EqThumbnail } from "./eq-thumbnail";
import { EqMaintenanceBadge } from "./eq-maintenance-badge";
import { EqAvailability } from "./eq-availability";

interface EqHeaderFieldsProps {
  readonly form: UseFormReturn<EquipmentFormValues>;
  readonly isDisabled: boolean;
  readonly isView: boolean;
  readonly imageUrl?: string | null;
  /**
   * หมวดที่บันทึกไว้ — เป็น `defaultLabel` ของ lookup หมวด ซึ่งโหลดทีละ 30
   * หมวดที่อยู่หลังหน้าแรกจะขึ้น placeholder ทั้งที่มีค่า
   */
  readonly savedCategory?: { id: string | null; name: string | null };
}

/**
 * ribbon ของการ์ดหัว (ทรงหัวเอกสาร PR)
 *
 * - โหมดดู: แถบสรุปเดิม — รูปย่อ · หมวด · รอบซ่อม · พร้อมใช้ · สถานี (สิ่งที่คนเปิดหน้านี้มาหา
 *   ก่อนเลื่อนลงไปอ่านฟอร์ม) อ่านจากฟอร์มด้วย useWatch ให้ตรงกับที่เพิ่งบันทึกทันที
 * - โหมดแก้: ช่องตัวตน Code · Name · Category (ย้ายมาจากหมวด General)
 *
 * อ่าน error ผ่าน useFormState ในคอมโพเนนต์นี้เอง — element ที่ส่งเป็น ribbon มี props คงที่
 * React Compiler จึง memo ไว้ อ่าน form.formState.errors จาก prop แล้วช่องว่างจะไม่ขึ้นแดง
 */
export function EqHeaderFields({
  form,
  isDisabled,
  isView,
  imageUrl,
  savedCategory,
}: EqHeaderFieldsProps) {
  const t = useTranslations("operationPlan.equipment");
  const tfl = useTranslations("field");
  const locale = useLocale();
  const { errors } = useFormState({ control: form.control });
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

  if (isView) {
    return (
      <div className="flex min-w-0 items-start gap-4">
        <EqThumbnail src={imageUrl} alt={name} className="size-16" />
        <div className="min-w-0 flex-1">
          <FieldGrid dense>
            <HeaderItem label={tfl("category")}>
              {savedCategory?.name || <Dash />}
            </HeaderItem>
            <HeaderItem label={t("maintenance")}>
              <EqMaintenanceBadge nextDate={nextDate} />
              {(lastDate || schedule) && (
                <p className="text-muted-foreground mt-1 text-xs">
                  {lastDate &&
                    t("maintLast", {
                      date: formatLocalizedDate(lastDate, locale),
                    })}
                  {lastDate && schedule && " · "}
                  {schedule}
                </p>
              )}
            </HeaderItem>
            <HeaderItem label={t("availabilityCol")}>
              <EqAvailability
                available={Number(available)}
                total={Number(total)}
              />
            </HeaderItem>
            <HeaderItem label={tfl("station")}>
              {station || <Dash />}
            </HeaderItem>
          </FieldGrid>
        </div>
      </div>
    );
  }

  return (
    <FieldGrid>
      <Field>
        <FieldLabel htmlFor="equipment-code" required>
          {tfl("code")}
        </FieldLabel>
        <FieldInput
          id="equipment-code"
          placeholder={t("codePlaceholder")}
          className="h-8"
          disabled={isDisabled}
          maxLength={10}
          error={errors.code?.message}
          {...form.register("code")}
        />
      </Field>

      <Field>
        <FieldLabel htmlFor="equipment-name" required>
          {tfl("name")}
        </FieldLabel>
        <FieldInput
          id="equipment-name"
          placeholder={t("namePlaceholder")}
          className="h-8"
          disabled={isDisabled}
          maxLength={100}
          error={errors.name?.message}
          {...form.register("name")}
        />
      </Field>

      <Field>
        <FieldLabel required>{tfl("category")}</FieldLabel>
        <Controller
          control={form.control}
          name="category_id"
          render={({ field }) => (
            <LookupEquipmentCategory
              value={field.value ?? ""}
              onValueChange={field.onChange}
              defaultLabel={
                field.value && field.value === savedCategory?.id
                  ? (savedCategory.name ?? undefined)
                  : undefined
              }
              disabled={isDisabled}
              error={errors.category_id?.message}
            />
          )}
        />
      </Field>
    </FieldGrid>
  );
}

function Dash() {
  return <span className="text-muted-foreground/60">—</span>;
}

/** ทรงเดียวกับ SettingField (ป้ายจาง + ค่าเด่น) แต่ค่าเป็น node */
function HeaderItem({
  label,
  children,
}: {
  readonly label: string;
  readonly children: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <div className="text-muted-foreground text-xs">{label}</div>
      <div className="mt-0.5 min-w-0 text-xs break-words">{children}</div>
    </div>
  );
}
