import { useTranslations } from "use-intl";
import {
  Field,
  FieldInput,
  FieldLabel,
  FieldSelect,
} from "@/components/ui/field";
import { SelectContent, SelectItem } from "@/components/ui/select";
import type { DatasetParam, WidgetParams } from "@/types/dashboard-widget";
import { WidgetLookupField } from "./widget-lookup-field";
import { PARAM_EMPTY, shouldShowAllOption } from "./widget-shape";

interface WidgetParamFieldsProps {
  readonly params: readonly DatasetParam[];
  readonly values: WidgetParams;
  readonly onChange: (name: string, value: string | number) => void;
  readonly disabled?: boolean;
}

/**
 * ฟอร์ม param ที่สร้างจาก descriptor ล้วน — ไม่รู้จักชื่อ param ตัวไหนเลย
 * dataset ที่ backend เพิ่ม param ให้ทีหลังจะขึ้นฟอร์มเองโดยไม่ต้องแก้ไฟล์นี้
 */
export function WidgetParamFields({
  params,
  values,
  onChange,
  disabled,
}: WidgetParamFieldsProps) {
  const t = useTranslations("dashboard.savedWidget");
  const tStatus = useTranslations("status");
  const tRange = useTranslations("dashboard.savedWidget.timeRange");
  const tOption = useTranslations("dashboard.savedWidget.option");

  /**
   * ป้ายที่อ่านง่ายของแต่ละ option โดยดูจาก "ค่า" ไม่ใช่ชื่อ param (ฟอร์มยังคง
   * generic): token ขึ้นต้น "@" = time_range (@today→"Today"); ค่าที่มีคำแปลใน
   * `option` (เช่น metric ของ movement: consumption→"Consumption"); ที่เหลือถือเป็น
   * enum สถานะ (in_progress→"In Progress") fallback เป็นค่าดิบถ้าไม่มีคำแปล
   */
  const optionLabel = (value: string): string => {
    if (value.startsWith("@")) {
      const key = value.slice(1);
      return tRange.has(key) ? tRange(key) : value;
    }
    if (tOption.has(value)) return tOption(value);
    return tStatus.has(value) ? tStatus(value) : value;
  };

  return (
    <>
      {params.map((p) => {
        const id = `widget-param-${p.name}`;
        const value = values[p.name] ?? "";

        // เลือกจากรายการของ BU (category / location / vendor / แผนก / งวด)
        if (p.lookup) {
          return (
            <Field key={p.name}>
              <FieldLabel htmlFor={id} required={p.required}>
                {p.label}
              </FieldLabel>
              <WidgetLookupField
                id={id}
                param={p}
                value={String(value)}
                onChange={(v) => onChange(p.name, v)}
                disabled={disabled}
              />
            </Field>
          );
        }

        if (p.options?.length) {
          return (
            <Field key={p.name}>
              <FieldLabel htmlFor={id} required={p.required}>
                {p.label}
              </FieldLabel>
              <FieldSelect
                value={value === "" ? PARAM_EMPTY : String(value)}
                onValueChange={(v) =>
                  onChange(p.name, v === PARAM_EMPTY ? "" : v)
                }
                disabled={disabled}
                className="h-8 text-sm"
              >
                <SelectContent>
                  {/* param ไม่บังคับ + ไม่มี default = เลือก "ทั้งหมด" ได้ (ส่ง "") */}
                  {shouldShowAllOption(p) && (
                    <SelectItem value={PARAM_EMPTY}>
                      {t("paramsAll")}
                    </SelectItem>
                  )}
                  {p.options.map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {optionLabel(opt)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </FieldSelect>
            </Field>
          );
        }

        return (
          <Field key={p.name}>
            <FieldLabel htmlFor={id} required={p.required}>
              {p.label}
            </FieldLabel>
            <FieldInput
              id={id}
              type={p.type === "int" ? "number" : "text"}
              inputMode={p.type === "int" ? "numeric" : undefined}
              className="h-8"
              disabled={disabled}
              value={value}
              onChange={(e) =>
                onChange(
                  p.name,
                  p.type === "int" ? Number(e.target.value) : e.target.value,
                )
              }
            />
          </Field>
        );
      })}
    </>
  );
}
