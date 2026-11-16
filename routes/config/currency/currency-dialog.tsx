import { useEffect } from "react";
import { useWatch, Controller, type UseFormReturn } from "react-hook-form";
import { Banknote } from "lucide-react";
import { useTranslations } from "use-intl";
import { StatusSwitch } from "@/components/ui/status-switch";
import { LookupCurrencyIso } from "@/components/lookup/lookup-currency-iso";
import { Field, FieldInput, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { ConfigEntityDialog } from "@/components/templates/config-entity-dialog";
import { useCreateCurrency, useUpdateCurrency } from "@/hooks/use-currency";
import { useExternalExchangeRates } from "../shared/use-exchange-rate";
import { useProfile } from "@/hooks/use-profile";
import { currenciesIso } from "@/constant/currencies-iso";
import {
  createCurrencySchema,
  EMPTY_FORM,
  type CurrencyFormValues,
} from "./currency-form-schema";
import type { Currency } from "@/types/currency";

interface CurrencyDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly currency?: Currency | null;
  readonly readOnly?: boolean;
}

type CurrencyPayload = {
  code: string;
  name: string;
  symbol: string;
  exchange_rate: number;
  description: string;
  decimal_places: number;
  is_active: boolean;
};

/**
 * Fields ของ currency — แยกเป็น component เพราะมี field-interaction logic
 * (auto-fill name/symbol/rate จาก ISO list เมื่อเลือก code ในโหมดสร้างใหม่)
 * ที่ต้องใช้ hook/effect ของตัวเอง
 */
function CurrencyFields({
  form,
  disabled,
  isEdit,
}: {
  readonly form: UseFormReturn<CurrencyFormValues>;
  readonly disabled: boolean;
  readonly isEdit: boolean;
}) {
  const t = useTranslations("config.currency");
  const tfl = useTranslations("field");
  const { defaultCurrencyCode } = useProfile();
  const baseCurrency = defaultCurrencyCode ?? "THB";
  const { data: exchangeRates } = useExternalExchangeRates(baseCurrency);
  const watchedCode = useWatch({ control: form.control, name: "code" });

  useEffect(() => {
    if (isEdit || !watchedCode) return;
    const selected = currenciesIso.find((c) => c.code === watchedCode);
    if (!selected) return;

    form.setValue("name", selected.name);
    form.setValue("symbol", selected.symbol);
    // เติมอัตราให้เฉพาะตอนได้ค่าจริงจากแหล่งอัตราเท่านั้น — ดึงไม่ได้ก็ปล่อยว่าง
    // ให้กรอกเอง ห้ามยัดค่าหลอกที่หน้าตาเหมือนอัตราจริงแล้วหลุดลง DB เงียบ ๆ
    // (ตอนนี้ดึงไม่ได้ทุกกรณี — /api/exchange-rate ยังไม่มีใครทำ ดู CLAUDE.md)
    const rate = exchangeRates?.[watchedCode];
    if (rate && rate > 0) form.setValue("exchange_rate", 1 / rate);
    form.setValue("description", `${selected.name} (${selected.country})`);
  }, [watchedCode, isEdit, exchangeRates, form]);

  return (
    <>
      <Field>
        <FieldLabel required>{tfl("code")}</FieldLabel>
        <Controller
          control={form.control}
          name="code"
          render={({ field }) => (
            <LookupCurrencyIso
              value={field.value}
              onValueChange={field.onChange}
              disabled={isEdit || disabled}
              className="w-full"
              error={form.formState.errors.code?.message}
            />
          )}
        />
      </Field>

      <Field>
        <FieldLabel htmlFor="currency-name" required>
          {tfl("name")}
        </FieldLabel>
        <FieldInput
          id="currency-name"
          placeholder={t("namePlaceholder")}
          className="h-8"
          disabled={disabled}
          error={form.formState.errors.name?.message}
          maxLength={100}
          {...form.register("name")}
        />
      </Field>

      <div className="grid gap-3 @sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="currency-symbol" required>
            {tfl("symbol")}
          </FieldLabel>
          <FieldInput
            id="currency-symbol"
            placeholder={t("symbolPlaceholder")}
            className="h-8"
            disabled
            error={form.formState.errors.symbol?.message}
            {...form.register("symbol")}
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="currency-exchange-rate" required>
            {tfl("exchangeRate")}
          </FieldLabel>
          <FieldInput
            errorIconAlign="left"
            id="currency-exchange-rate"
            type="number"
            inputMode="decimal"
            step="any"
            placeholder={t("ratePlaceholder")}
            className="h-8 text-right tabular-nums"
            disabled={disabled}
            error={form.formState.errors.exchange_rate?.message}
            {...form.register("exchange_rate", { valueAsNumber: true })}
          />
        </Field>
      </div>

      <Field>
        <FieldLabel htmlFor="currency-description">
          {tfl("description")}
        </FieldLabel>
        <Textarea
          id="currency-description"
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
            id="currency-is-active"
            checked={field.value}
            onCheckedChange={field.onChange}
            disabled={disabled}
          />
        )}
      />
    </>
  );
}

export function CurrencyDialog({
  open,
  onOpenChange,
  currency,
  readOnly,
}: CurrencyDialogProps) {
  return (
    <ConfigEntityDialog<Currency, CurrencyFormValues, CurrencyPayload>
      contentClassName="@container max-h-[90dvh] overflow-y-auto"
      open={open}
      onOpenChange={onOpenChange}
      entity={currency}
      readOnly={readOnly}
      icon={Banknote}
      translationNamespace="config.currency"
      useCreate={useCreateCurrency}
      useUpdate={useUpdateCurrency}
      buildSchema={createCurrencySchema}
      toFormValues={(e) =>
        e
          ? {
              code: e.code,
              name: e.name,
              symbol: e.symbol,
              exchange_rate: e.exchange_rate,
              description: e.description ?? "",
              decimal_places: e.decimal_places ?? 2,
              is_active: e.is_active,
            }
          : EMPTY_FORM
      }
      toPayload={(v) => ({
        code: v.code,
        name: v.name,
        symbol: v.symbol,
        exchange_rate: v.exchange_rate,
        description: v.description ?? "",
        decimal_places: v.decimal_places,
        is_active: v.is_active,
      })}
    >
      {({ form, disabled }) => (
        <CurrencyFields form={form} disabled={disabled} isEdit={!!currency} />
      )}
    </ConfigEntityDialog>
  );
}
