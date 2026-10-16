import { Controller } from "react-hook-form";
import { Replace } from "lucide-react";
import { useTranslations } from "use-intl";
import { StatusSwitch } from "@/components/ui/status-switch";
import {
  Field,
  FieldInput,
  FieldLabel,
  FieldSelect,
} from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { SelectContent, SelectItem } from "@/components/ui/select";
import { LookupChartOfAccountById } from "@/components/lookup/lookup-chart-of-account-by-id";
import { ConfigEntityDialog } from "@/components/templates/config-entity-dialog";
import {
  useCreateAdjustmentType,
  useUpdateAdjustmentType,
} from "@/hooks/use-adjustment-type";
import {
  ADJUSTMENT_TYPE,
  ADJUSTMENT_TYPE_OPTIONS,
  adjustmentTypeSchema,
  type AdjustmentType,
  type AdjustmentTypeFormValues,
} from "@/types/adjustment-type";

interface AdjustmentTypeDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly adjustmentType?: AdjustmentType | null;
  readonly readOnly?: boolean;
}

type AdjustmentTypePayload = {
  code: string;
  name: string;
  type: AdjustmentType["type"];
  description: string;
  note: string;
  is_active: boolean;
  chart_of_accounts_id?: string | null;
};

export function AdjustmentTypeDialog({
  open,
  onOpenChange,
  adjustmentType,
  readOnly,
}: AdjustmentTypeDialogProps) {
  const t = useTranslations("config.adjustmentType");
  const tfl = useTranslations("field");

  return (
    <ConfigEntityDialog<
      AdjustmentType,
      AdjustmentTypeFormValues,
      AdjustmentTypePayload
    >
      open={open}
      onOpenChange={onOpenChange}
      entity={adjustmentType}
      readOnly={readOnly}
      icon={Replace}
      translationNamespace="config.adjustmentType"
      useCreate={useCreateAdjustmentType}
      useUpdate={useUpdateAdjustmentType}
      serverFieldErrors={{
        ADJUSTMENT_TYPE_ALREADY_EXISTS: "code",
        GL_ACCOUNT_NOT_POSTABLE: "chart_of_accounts_id",
      }}
      buildSchema={() => adjustmentTypeSchema}
      toFormValues={(e) =>
        e
          ? {
              code: e.code,
              name: e.name,
              type: e.type,
              description: e.description,
              note: e.note,
              is_active: e.is_active,
              chart_of_accounts_id: e.chart_of_accounts_id ?? null,
            }
          : {
              code: "",
              name: "",
              type: ADJUSTMENT_TYPE.STOCK_IN,
              description: "",
              note: "",
              is_active: true,
              chart_of_accounts_id: null,
            }
      }
      toPayload={(v, original) => ({
        code: v.code,
        name: v.name,
        type: v.type,
        description: v.description ?? "",
        note: v.note ?? "",
        is_active: v.is_active,
        // ส่งเฉพาะตอนเปลี่ยน (หรือสร้างใหม่ที่เลือกแล้ว) — ไม่งั้นแก้ฟิลด์อื่นแล้วโดน
        // GL_ACCOUNT_NOT_POSTABLE เมื่อบัญชีเดิมถูกปิด/กลายเป็น header
        ...((original
          ? (v.chart_of_accounts_id ?? null) !==
            (original.chart_of_accounts_id ?? null)
          : v.chart_of_accounts_id != null) && {
          chart_of_accounts_id: v.chart_of_accounts_id ?? null,
        }),
      })}
    >
      {({ form, disabled }) => (
        <>
          <Field>
            <FieldLabel htmlFor="adjustment-type-code" required>
              {tfl("code")}
            </FieldLabel>
            <FieldInput
              id="adjustment-type-code"
              placeholder={t("codePlaceholder")}
              className="h-8"
              disabled={disabled}
              error={form.formState.errors.code?.message}
              maxLength={10}
              {...form.register("code")}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="adjustment-type-name" required>
              {tfl("name")}
            </FieldLabel>
            <FieldInput
              id="adjustment-type-name"
              placeholder={t("namePlaceholder")}
              className="h-8"
              disabled={disabled}
              error={form.formState.errors.name?.message}
              maxLength={100}
              {...form.register("name")}
            />
          </Field>

          <Field>
            <FieldLabel required>{tfl("type")}</FieldLabel>
            <Controller
              control={form.control}
              name="type"
              render={({ field }) => (
                <FieldSelect
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={disabled}
                  error={form.formState.errors.type?.message}
                  placeholder={tfl("selectType")}
                  className="h-8 text-sm"
                >
                  <SelectContent>
                    {ADJUSTMENT_TYPE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </FieldSelect>
              )}
            />
          </Field>

          <Field>
            <FieldLabel>{t("account")}</FieldLabel>
            <Controller
              control={form.control}
              name="chart_of_accounts_id"
              render={({ field }) => (
                <LookupChartOfAccountById
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={disabled}
                  size="sm"
                />
              )}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="adjustment-type-description">
              {tfl("description")}
            </FieldLabel>
            <Textarea
              id="adjustment-type-description"
              placeholder={tfl("optional")}
              rows={2}
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
                id="adjustment-type-is-active"
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
