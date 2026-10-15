import { Controller } from "react-hook-form";
import { z } from "zod";
import { Ruler } from "lucide-react";
import { useTranslations } from "use-intl";
import { StatusSwitch } from "@/components/ui/status-switch";
import { Field, FieldInput, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { ConfigEntityDialog } from "@/components/templates/config-entity-dialog";
import { QTY_MAX_DECIMALS } from "@/components/ui/input/qty-decimals";
import { useCreateUnit, useUpdateUnit } from "@/hooks/use-unit";
import type { Unit } from "@/types/unit";
import type { TranslationFn } from "@/lib/i18n-schema";

const createUnitSchema = (tv: TranslationFn, tf: TranslationFn) => {
  return z.object({
    name: z.string().min(1, tv("required", { field: tf("name") })),
    description: z.string(),
    // ช่องว่างในช่องตัวเลขให้เป็น 0 ไม่ใช่ NaN (valueAsNumber ของ RHF คืน NaN)
    decimal_place: z.coerce
      .number()
      .int()
      .min(0)
      .max(QTY_MAX_DECIMALS)
      .catch(0),
    is_active: z.boolean(),
  });
};

type UnitFormValues = z.infer<ReturnType<typeof createUnitSchema>>;
type UnitPayload = {
  name: string;
  description: string;
  decimal_place: number;
  is_active: boolean;
};

interface UnitDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly unit?: Unit | null;
  readonly onSuccess?: (id: string) => void;
  readonly readOnly?: boolean;
}

/**
 * Dialog สร้าง/แก้ไข Unit (หน่วยนับ)
 *
 * ใช้ `ConfigEntityDialog` เหมือน config dialog อื่น เพิ่ม `onCreated` เพื่อส่ง
 * id ของ unit ที่เพิ่งสร้างกลับ (flow สร้าง inline แล้วเลือกทันที) และ
 * `stopPropagationOnSubmit` กัน submit ทะลุ form แม่ที่เปิด dialog นี้
 */
export function UnitDialog({
  open,
  onOpenChange,
  unit,
  onSuccess,
  readOnly,
}: UnitDialogProps) {
  const t = useTranslations("config.unit");
  const tfl = useTranslations("field");

  return (
    <ConfigEntityDialog<Unit, UnitFormValues, UnitPayload>
      open={open}
      onOpenChange={onOpenChange}
      entity={unit}
      readOnly={readOnly}
      icon={Ruler}
      translationNamespace="config.unit"
      useCreate={useCreateUnit}
      useUpdate={useUpdateUnit}
      serverFieldErrors={{ UNIT_ALREADY_EXISTS: "name" }}
      buildSchema={createUnitSchema}
      stopPropagationOnSubmit
      onCreated={(res) => {
        const created = res as { id?: string } | undefined;
        if (created?.id) onSuccess?.(created.id);
      }}
      toFormValues={(e) =>
        e
          ? {
              name: e.name,
              description: e.description,
              decimal_place: e.decimal_place ?? 0,
              is_active: e.is_active,
            }
          : { name: "", description: "", decimal_place: 0, is_active: true }
      }
      toPayload={(v) => ({
        name: v.name,
        description: v.description ?? "",
        decimal_place: v.decimal_place,
        is_active: v.is_active,
      })}
    >
      {({ form, disabled }) => (
        <>
          <div className="grid grid-cols-2 gap-x-2">
            <Field>
              <FieldLabel htmlFor="unit-name" required>
                {tfl("name")}
              </FieldLabel>
              <FieldInput
                id="unit-name"
                placeholder={t("namePlaceholder")}
                disabled={disabled}
                error={form.formState.errors.name?.message}
                maxLength={100}
                {...form.register("name")}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="unit-decimal-place" required>
                {tfl("decimalPlaces")}
              </FieldLabel>
              <FieldInput
                id="unit-decimal-place"
                type="number"
                inputMode="numeric"
                min={0}
                max={QTY_MAX_DECIMALS}
                step={1}
                className="text-right tabular-nums"
                disabled={disabled}
                error={form.formState.errors.decimal_place?.message}
                {...form.register("decimal_place", { valueAsNumber: true })}
              />
            </Field>
          </div>

          <Field>
            <FieldLabel htmlFor="unit-description">
              {tfl("description")}
            </FieldLabel>
            <Textarea
              id="unit-description"
              placeholder={tfl("optional")}
              disabled={disabled}
              maxLength={256}
              {...form.register("description")}
            />
          </Field>

          <Controller
            control={form.control}
            name="is_active"
            render={({ field }) => (
              <StatusSwitch
                id="unit-is-active"
                checked={field.value}
                onCheckedChange={field.onChange}
                disabled={disabled}
              />
            )}
          />
        </>
      )}
    </ConfigEntityDialog>
  );
}
