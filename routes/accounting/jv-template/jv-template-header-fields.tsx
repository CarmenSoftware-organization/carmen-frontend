import type { ReactNode } from "react";
import { Controller, useWatch, type UseFormReturn } from "react-hook-form";
import { useTranslations } from "use-intl";
import {
  Field,
  FieldDatePicker,
  FieldInput,
  FieldLabel,
  FieldPlainText,
  FieldSelect,
} from "@/components/ui/field";
import { SelectContent, SelectItem } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { InputAmount } from "@/components/ui/input/input-amount";
import { Switch } from "@/components/ui/switch";
import { StatusBadge } from "@/components/ui/status-badge";
import { LookupCurrency } from "@/components/lookup/lookup-currency";
import { formatCurrency } from "@/lib/currency-utils";
import { formatDate } from "@/lib/date-utils";
import { useProfile } from "@/hooks/use-profile";
import { useGlJvPrefixOptions } from "@/hooks/use-gl-jv-prefix-options";
import type { JvTemplateType } from "./jv-template-types";
import {
  ymdFromPicker,
  ymdToPicker,
  type JvTemplateFormValues,
} from "./jv-template-form-schema";
import { jvTemplateTypeLabel, periodLabel } from "./jv-template-labels";

type Form = UseFormReturn<JvTemplateFormValues>;

function Required() {
  return <span className="text-destructive"> *</span>;
}

/** ช่องหนึ่งช่อง — โหมดดูแสดงข้อความ โหมดแก้แสดง input */
function Item({
  label,
  htmlFor,
  isView,
  required,
  view,
  className,
  children,
}: {
  readonly label: string;
  readonly htmlFor?: string;
  readonly isView: boolean;
  readonly required?: boolean;
  readonly view: ReactNode;
  readonly className?: string;
  readonly children: ReactNode;
}) {
  return (
    <Field className={className}>
      <FieldLabel htmlFor={isView ? undefined : htmlFor}>
        {label}
        {required && !isView && <Required />}
      </FieldLabel>
      {isView ? <FieldPlainText>{view}</FieldPlainText> : children}
    </Field>
  );
}

/**
 * เรียงข้อมูลแม่แบบ → งวด/เงื่อนไขและการลงบัญชี → คำอธิบาย/หมายเหตุ
 */
export function JvTemplateHeaderFields({
  form,
  isView,
  isDisabled,
  typeChoices,
  onTypeChange,
}: {
  readonly form: Form;
  readonly isView: boolean;
  readonly isDisabled: boolean;
  /** มีค่า = เปลี่ยนชนิดได้ตอนสร้างบนหน้ารวม · null = ชนิดล็อกแล้ว */
  readonly typeChoices: JvTemplateType[] | null;
  readonly onTypeChange: (type: JvTemplateType) => void;
}) {
  const t = useTranslations("accounting.jvTemplate");
  const tfl = useTranslations("field");
  const { errors } = form.formState;
  const v = useWatch({ control: form.control });
  const type = v.template_type ?? "";

  return (
    <div className="@container/jvt-header space-y-3">
      <section aria-label={tfl("general")}>
        <div className="grid grid-cols-1 gap-3 @md/jvt-header:grid-cols-2 @3xl/jvt-header:grid-cols-4 @min-[96rem]/jvt-header:grid-cols-6">
          {typeChoices && (
            <Field>
              <FieldLabel>
                {t("type")}
                <Required />
              </FieldLabel>
              <Controller
                control={form.control}
                name="template_type"
                render={({ field }) => (
                  <FieldSelect
                    disabled={isDisabled}
                    value={field.value}
                    onValueChange={(next) =>
                      onTypeChange(next as JvTemplateType)
                    }
                    placeholder={t("chooseType")}
                    error={errors.template_type?.message}
                  >
                    <SelectContent>
                      {typeChoices.map((ty) => (
                        <SelectItem key={ty} value={ty}>
                          {jvTemplateTypeLabel(t, ty)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </FieldSelect>
                )}
              />
            </Field>
          )}

          <Item
            label={t("code")}
            htmlFor="jvt-code"
            isView={isView}
            required
            view={v.code}
          >
            <FieldInput
              id="jvt-code"
              maxLength={50}
              autoComplete="off"
              disabled={isDisabled}
              error={errors.code?.message}
              {...form.register("code")}
            />
          </Item>
          <Item
            label={t("name")}
            htmlFor="jvt-name"
            isView={isView}
            required
            className={
              typeChoices
                ? "@min-[96rem]/jvt-header:col-span-3"
                : "@3xl/jvt-header:col-span-2 @min-[96rem]/jvt-header:col-span-4"
            }
            view={v.name}
          >
            <FieldInput
              id="jvt-name"
              autoComplete="off"
              disabled={isDisabled}
              error={errors.name?.message}
              {...form.register("name")}
            />
          </Item>

          <Field>
            <FieldLabel htmlFor={isView ? undefined : "jvt-active"}>
              {t("active")}
            </FieldLabel>
            {isView ? (
              <FieldPlainText>
                <StatusBadge active={!!v.is_active} />
              </FieldPlainText>
            ) : (
              <Controller
                control={form.control}
                name="is_active"
                render={({ field }) => (
                  <div className="flex min-h-8 items-center">
                    <Switch
                      id="jvt-active"
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={isDisabled}
                      aria-label={t("active")}
                    />
                  </div>
                )}
              />
            )}
          </Field>
        </div>
      </section>

      {type && (
        <ScheduleSection
          form={form}
          type={type}
          isView={isView}
          isDisabled={isDisabled}
        />
      )}

      <div className="grid grid-cols-1 gap-3 @md/jvt-header:grid-cols-2">
        <Item
          label={tfl("description")}
          htmlFor="jvt-description"
          isView={isView}
          view={v.description?.trim()}
        >
          <Textarea
            id="jvt-description"
            rows={2}
            placeholder={tfl("optional")}
            disabled={isDisabled}
            {...form.register("description")}
          />
        </Item>
        <Item
          label={t("note")}
          htmlFor="jvt-note"
          isView={isView}
          view={v.note?.trim()}
        >
          <Textarea
            id="jvt-note"
            rows={2}
            placeholder={tfl("optional")}
            disabled={isDisabled}
            {...form.register("note")}
          />
        </Item>
      </div>
    </div>
  );
}

function ScheduleSection({
  form,
  type,
  isView,
  isDisabled,
}: {
  readonly form: Form;
  readonly type: JvTemplateType;
  readonly isView: boolean;
  readonly isDisabled: boolean;
}) {
  const t = useTranslations("accounting.jvTemplate");
  const { dateFormat } = useProfile();
  const { options: prefixOptions, isLoading: prefixLoading } =
    useGlJvPrefixOptions();
  const { errors } = form.formState;
  const v = useWatch({ control: form.control });
  const amount = (n: number | null | undefined) =>
    n == null ? "" : formatCurrency(n);

  /** FY + งวดคู่กัน — ตัวเลขล้วน ไม่ต้องรอ lookup ของปีบัญชี */
  const periodPair = (
    side: "from" | "to",
    fy: "from_fiscal_year" | "to_fiscal_year",
    no: "from_period_no" | "to_period_no",
  ) => (
    <Item
      label={t(side === "from" ? "fromPeriod" : "toPeriod")}
      isView={isView}
      required
      view={v[fy] != null && v[no] != null ? periodLabel(v[fy], v[no]) : ""}
    >
      <div className="grid grid-cols-[1fr_5rem] gap-2">
        <FieldInput
          type="number"
          inputMode="numeric"
          min={1900}
          max={2200}
          aria-label={t("fiscalYear")}
          placeholder={t("fiscalYear")}
          disabled={isDisabled}
          error={errors[fy]?.message}
          {...form.register(fy, { valueAsNumber: true })}
        />
        <FieldInput
          type="number"
          inputMode="numeric"
          min={1}
          max={12}
          aria-label={t("periodNo")}
          placeholder={t("periodNo")}
          disabled={isDisabled}
          error={errors[no]?.message}
          {...form.register(no, { valueAsNumber: true })}
        />
      </div>
    </Item>
  );

  /** ช่องจำนวนเงินที่ว่างได้ (null) — 0 ถือว่ายังไม่กรอก */
  const nullableAmount = (
    name: "allocate_amount" | "total_amount" | "exchange_rate",
    decimals = 2,
  ) => (
    <Controller
      control={form.control}
      name={name}
      render={({ field }) => (
        <InputAmount
          decimals={decimals}
          value={field.value ?? 0}
          onValueChange={(n) => field.onChange(n || null)}
          disabled={isDisabled}
          className="text-right tabular-nums"
          error={errors[name]?.message}
        />
      )}
    />
  );

  return (
    <section
      className="space-y-3 border-t pt-3"
      aria-labelledby="jvt-schedule-heading"
    >
      <h2 id="jvt-schedule-heading" className="text-sm font-semibold">
        {t("sectionSchedule")}
      </h2>
      <div className="grid grid-cols-1 gap-3 @md/jvt-header:grid-cols-2 @3xl/jvt-header:grid-cols-3 @min-[96rem]/jvt-header:grid-cols-6">
        {periodPair("from", "from_fiscal_year", "from_period_no")}
        {periodPair("to", "to_fiscal_year", "to_period_no")}

        {type === "recurring" && (
          <Item
            label={t("frequencyMonths")}
            htmlFor="jvt-frequency"
            isView={isView}
            required
            view={v.frequency_months}
          >
            <FieldInput
              id="jvt-frequency"
              type="number"
              inputMode="numeric"
              min={1}
              disabled={isDisabled}
              error={errors.frequency_months?.message}
              {...form.register("frequency_months", { valueAsNumber: true })}
            />
          </Item>
        )}
        {type === "allocation" && (
          <Item
            label={t("allocateAmount")}
            isView={isView}
            required
            view={amount(v.allocate_amount)}
          >
            {nullableAmount("allocate_amount")}
          </Item>
        )}

        {type === "amortize" && (
          <>
            <Item
              label={t("amortizeType")}
              isView={isView}
              required
              view={v.amortize_type ? t(`amortize_${v.amortize_type}`) : ""}
            >
              <Controller
                control={form.control}
                name="amortize_type"
                render={({ field }) => (
                  <FieldSelect
                    value={field.value ?? ""}
                    onValueChange={field.onChange}
                    disabled={isDisabled}
                    error={errors.amortize_type?.message}
                  >
                    <SelectContent>
                      <SelectItem value="monthly">
                        {t("amortize_monthly")}
                      </SelectItem>
                      <SelectItem value="day_in_month">
                        {t("amortize_day_in_month")}
                      </SelectItem>
                    </SelectContent>
                  </FieldSelect>
                )}
              />
            </Item>
            <Item
              label={t("totalAmount")}
              isView={isView}
              required
              view={amount(v.total_amount)}
            >
              {nullableAmount("total_amount")}
            </Item>
            {(["start_date", "end_date"] as const).map((name) => (
              <Item
                key={name}
                label={t(name === "start_date" ? "startDate" : "endDate")}
                isView={isView}
                required
                view={
                  v[name] ? formatDate(ymdToPicker(v[name]), dateFormat) : ""
                }
              >
                <Controller
                  control={form.control}
                  name={name}
                  render={({ field }) => (
                    <FieldDatePicker
                      value={ymdToPicker(field.value)}
                      onValueChange={(iso) =>
                        field.onChange(ymdFromPicker(iso))
                      }
                      disabled={isDisabled}
                      className="w-full"
                      error={errors[name]?.message}
                    />
                  )}
                />
              </Item>
            ))}
          </>
        )}
        <Item
          label={t("prefix")}
          isView={isView}
          required
          view={prefixOptions.find((o) => o.value === v.prefix_id)?.label}
        >
          <Controller
            control={form.control}
            name="prefix_id"
            render={({ field }) => (
              <FieldSelect
                value={field.value}
                onValueChange={field.onChange}
                disabled={isDisabled || prefixLoading}
                placeholder={t("prefix")}
                error={errors.prefix_id?.message}
              >
                <SelectContent>
                  {prefixOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </FieldSelect>
            )}
          />
        </Item>
        {/* LookupCurrency มีโหมด readOnly ของตัวเอง (แสดงป้ายสกุลเงิน) — Item จึงไม่ต้องสลับให้ */}
        <Item label={t("currency")} isView={false} view={null}>
          <Controller
            control={form.control}
            name="currency_id"
            render={({ field }) => (
              <LookupCurrency
                value={field.value}
                onValueChange={field.onChange}
                onItemChange={(c) => {
                  if (c.exchange_rate && c.exchange_rate > 0) {
                    form.setValue("exchange_rate", c.exchange_rate, {
                      shouldDirty: true,
                    });
                  }
                }}
                readOnly={isView}
                disabled={isDisabled}
                fullWidth
              />
            )}
          />
        </Item>
        <Item
          label={t("exchangeRate")}
          isView={isView}
          view={v.exchange_rate == null ? "" : String(v.exchange_rate)}
        >
          {nullableAmount("exchange_rate", 5)}
        </Item>
      </div>
    </section>
  );
}
