import { useTranslations } from "use-intl";
import { Toggle } from "@/components/ui/toggle";
import type { WidgetType } from "@/types/dashboard-widget";
import { RenderIcon } from "./render-icon";

interface WidgetTypeFieldProps {
  /** ชนิดที่ dataset นี้วาดได้ (`availableRenders`) เรียงตามลำดับเดียวกับเมนูบนการ์ด */
  readonly options: readonly WidgetType[];
  readonly value: WidgetType;
  readonly onChange: (widgetType: WidgetType) => void;
  readonly disabled?: boolean;
}

/**
 * ตัวเลือกชนิดกราฟแบบปุ่มเรียงกัน (icon + ชื่อ) — เลือกได้ทีละแบบ กดตัวที่เลือกอยู่ซ้ำไม่ยกเลิก
 * ชุดตัวเลือกและป้ายเดียวกับเมนูเปลี่ยนชนิดกราฟบนการ์ด
 */
export function WidgetTypeField({
  options,
  value,
  onChange,
  disabled,
}: WidgetTypeFieldProps) {
  const t = useTranslations("dashboard.savedWidget.chartType");
  return (
    <div role="group" aria-label={t("label")} className="space-y-1.5">
      {/* หน้าตาเดียวกับ FieldLabel ของฟิลด์ข้าง ๆ — แต่เป็นป้ายของกลุ่มปุ่ม ไม่ใช่ <label> ของ input */}
      <p className="text-xs leading-snug font-semibold">{t("label")}</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((type) => (
          <Toggle
            key={type}
            variant="outline"
            pressed={type === value}
            onPressedChange={(pressed) => pressed && onChange(type)}
            disabled={disabled}
          >
            <RenderIcon type={type} />
            {t(type)}
          </Toggle>
        ))}
      </div>
    </div>
  );
}
