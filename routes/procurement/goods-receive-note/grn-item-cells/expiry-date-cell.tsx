import { Controller, useWatch, type UseFormReturn } from "react-hook-form";
import { useTranslations } from "use-intl";
import { DatePicker } from "@/components/ui/date-picker";
import type { GrnFormValues } from "../grn-form-schema";
import { isExpiredOn } from "../grn-expiry";

/**
 * วันหมดอายุของล็อตในบรรทัด — ไม่บังคับ และเลือกวันที่ผ่านมาแล้วได้
 *
 * วันที่ผ่านมาแล้วขึ้นป้าย "หมดอายุแล้ว" ใต้ช่อง ให้เห็นว่าบรรทัดไหนจะทำให้ระบบถามซ้ำ
 * ตอนสร้างใบ/commit · ไม่ล็อกตามบรรทัดที่ถูกอ้างอิง (`lockedLines`) เพราะหลังบ้านเทียบ
 * แค่ผลต่อสต๊อก การแก้วันหมดอายุของบรรทัดนั้นจึงผ่าน
 */
export function ExpiryDateCell({
  form,
  index,
  disabled,
}: {
  form: UseFormReturn<GrnFormValues>;
  index: number;
  disabled: boolean;
}) {
  "use no memo";
  const t = useTranslations("procurement.goodsReceiveNote");
  const value = useWatch({
    control: form.control,
    name: `items.${index}.expired_at`,
  });
  const expired = isExpiredOn(value);

  return (
    <div className="space-y-0.5">
      {disabled ? (
        <DatePicker value={value ?? undefined} readOnly />
      ) : (
        <Controller
          control={form.control}
          name={`items.${index}.expired_at`}
          render={({ field }) => (
            <DatePicker
              value={field.value ?? undefined}
              // ปุ่มล้างของ DatePicker ส่ง "" — เก็บเป็น null ให้ตรงกับที่หลังบ้านรับ
              onValueChange={(v) => field.onChange(v || null)}
              size="xs"
              className="w-full text-xs"
            />
          )}
        />
      )}
      {expired && (
        <p className="text-warning-ink text-xs">{t("lineExpired")}</p>
      )}
    </div>
  );
}
