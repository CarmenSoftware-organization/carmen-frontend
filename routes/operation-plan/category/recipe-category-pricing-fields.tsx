import { useWatch, type FieldPath, type UseFormReturn } from "react-hook-form";
import { useTranslations } from "use-intl";
import { Field, FieldLabel, FieldInput } from "@/components/ui/field";
import { CompactSection, FieldGrid } from "@/components/share/compact-section";
import { cn } from "@/lib/utils";
import type { RecipeCategoryFormValues } from "./recipe-category-form-schema";
import {
  RecipeCategoryPriceBreakdown,
  MARKER_CLASS,
  SEGMENT_COLOR,
} from "./recipe-category-price-breakdown";

interface RecipeCategoryPricingFieldsProps {
  readonly form: UseFormReturn<RecipeCategoryFormValues>;
  readonly isDisabled: boolean;
  /** โหมดอ่าน — ช่องที่ยังไม่ตั้ง (0) แสดง "—" แทน "0 %" */
  readonly isView: boolean;
}

/** ต้นทุน 3 ตัว + กำไร 2 ตัว เป็น % ของราคาขายเหมือนกัน จึงอยู่ section เดียวกับแถบสรุป */
export function RecipeCategoryPricingFields({
  form,
  isDisabled,
  isView,
}: RecipeCategoryPricingFieldsProps) {
  const t = useTranslations("operationPlan.recipeCategory");
  const [food, labor, overhead, marginMin, marginTarget] = useWatch({
    control: form.control,
    name: [
      "cost_target_food_cost_percentage",
      "cost_labor_percentage",
      "cost_overhead_percentage",
      "margin_minimum",
      "margin_target",
    ],
  }).map((v) => Number(v) || 0);

  const field = (
    name: FieldPath<RecipeCategoryFormValues>,
    id: string,
    label: string,
    value: number,
    swatch: string,
  ) => (
    <PercentField
      form={form}
      name={name}
      id={id}
      label={label}
      swatch={swatch}
      isDisabled={isDisabled}
      readValue={isView ? value : undefined}
    />
  );

  return (
    <CompactSection first title={t("pricingTargets")}>
      {/* คำอธิบายยาวสองประโยค — อยู่ในการ์ด ไม่ใช่บนบรรทัดหัวข้อ เพราะหมวดนี้วางคู่กับ
          General บนจอกว้าง ข้อความห่อบรรทัดแล้วหัวข้อสองฝั่งไม่เสมอกัน */}
      <p className="text-muted-foreground mb-3 text-xs">
        {t("pricingTargetsDesc")}
      </p>
      <RecipeCategoryPriceBreakdown
        food={food}
        labor={labor}
        overhead={overhead}
        marginMin={marginMin}
        marginTarget={marginTarget}
      />

      <div className="border-border/70 mt-4 border-t pt-4">
        <FieldGrid>
          {field(
            "cost_target_food_cost_percentage",
            "rc-cost-food",
            t("foodCostShort"),
            food,
            dot(SEGMENT_COLOR.food),
          )}
          {field(
            "cost_labor_percentage",
            "rc-cost-labor",
            t("laborShort"),
            labor,
            dot(SEGMENT_COLOR.labor),
          )}
          {field(
            "cost_overhead_percentage",
            "rc-cost-overhead",
            t("overheadShort"),
            overhead,
            dot(SEGMENT_COLOR.overhead),
          )}
          {field(
            "margin_minimum",
            "rc-margin-min",
            t("minMarginShort"),
            marginMin,
            MARKER_CLASS.min,
          )}
          {field(
            "margin_target",
            "rc-margin-target",
            t("targetMarginShort"),
            marginTarget,
            MARKER_CLASS.target,
          )}
        </FieldGrid>
      </div>
    </CompactSection>
  );
}

const dot = (color: string) => cn("size-2 rounded-full", color);

function PercentField({
  form,
  name,
  id,
  label,
  swatch,
  isDisabled,
  readValue,
}: {
  readonly form: UseFormReturn<RecipeCategoryFormValues>;
  readonly name: FieldPath<RecipeCategoryFormValues>;
  readonly id: string;
  readonly label: string;
  readonly swatch: string;
  readonly isDisabled: boolean;
  /** มีค่า = โหมดอ่าน: แสดงค่าแบบคงที่ ไม่ผูก register */
  readonly readValue?: number;
}) {
  const error = form.formState.errors[name as keyof RecipeCategoryFormValues]
    ?.message as string | undefined;
  const isRead = readValue !== undefined;
  const unset = isRead && readValue <= 0;

  // โหมดอ่าน: ข้อความ (ป้ายจาง + ค่าเด่น ทรงเดียวกับ SettingField) ไม่ใช่ input ที่ disable
  // จุดสีหน้าป้ายคงไว้ — มันคือคำอธิบายสีของแถบสรุปด้านบน
  if (isRead) {
    return (
      <div className="min-w-0">
        <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
          <span aria-hidden className={swatch} />
          {label}
        </div>
        {unset ? (
          <div className="text-muted-foreground/60 mt-0.5 text-sm">—</div>
        ) : (
          <div className="mt-0.5 text-sm tabular-nums">{readValue} %</div>
        )}
      </div>
    );
  }

  return (
    <Field>
      <FieldLabel htmlFor={id} className="items-center">
        <span aria-hidden className={swatch} />
        {label}
      </FieldLabel>
      <div className="relative">
        <FieldInput
          id={id}
          type="number"
          inputMode="decimal"
          step="0.01"
          min={0}
          placeholder="0"
          className="h-8 pr-10 text-right"
          disabled={isDisabled}
          error={error}
          errorIconAlign="left"
          {...form.register(name)}
        />
        <span className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm">
          %
        </span>
      </div>
    </Field>
  );
}
