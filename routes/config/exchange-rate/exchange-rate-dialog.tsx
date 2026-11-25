import { useEffect, useState } from "react";
import { useForm, Controller, useWatch, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowDown,
  ArrowLeftRight,
  Calendar,
  History,
  Minus,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/date-utils";
import { formatExchangeRate } from "@/lib/currency-utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDatePicker,
  FieldGroup,
  FieldInput,
  FieldLabel,
} from "@/components/ui/field";
import { toast } from "sonner";
import { useTranslations } from "use-intl";
import {
  useExchangeRateUpdate,
  useExchangeRateCreate,
} from "../shared/use-exchange-rate";
import { LookupCurrency } from "@/components/lookup/lookup-currency";
import {
  createExchangeRateSchema,
  createManualExchangeRateSchema,
  EMPTY_FORM,
  EMPTY_MANUAL_FORM,
  type ExchangeRateFormValues,
  type ManualExchangeRateFormValues,
} from "./exchange-rate-form-schema";
import { useProfile } from "@/hooks/use-profile";
import type { ExchangeRateItem } from "@/types/exchange-rate";

interface ExchangeRateDialogEditProps {
  readonly mode: "edit";
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly item: ExchangeRateItem | null;
}

interface ExchangeRateDialogCreateProps {
  readonly mode: "create";
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly item?: null;
}

type ExchangeRateDialogProps =
  ExchangeRateDialogEditProps | ExchangeRateDialogCreateProps;

function EditForm({
  item,
  onOpenChange,
  onPendingChange,
}: {
  readonly item: ExchangeRateItem | null;
  readonly onOpenChange: (open: boolean) => void;
  readonly onPendingChange: (pending: boolean) => void;
}) {
  const updateRate = useExchangeRateUpdate();
  const isPending = updateRate.isPending;
  const { dateFormat } = useProfile();

  useEffect(() => {
    onPendingChange(isPending);
  }, [isPending, onPendingChange]);
  const t = useTranslations("config.exchangeRate");
  const tc = useTranslations("common");
  const tf = useTranslations("form");
  const tfl = useTranslations("field");
  const tt = useTranslations("toast");
  const tv = useTranslations("validation");

  const schema = createExchangeRateSchema(tv, tfl);
  const form = useForm<ExchangeRateFormValues>({
    resolver: zodResolver(schema) as Resolver<ExchangeRateFormValues>,
    defaultValues: EMPTY_FORM,
  });

  useEffect(() => {
    if (item) {
      form.reset({ exchange_rate: item.exchange_rate });
    }
  }, [item, form]);

  const newRate = useWatch({ control: form.control, name: "exchange_rate" });
  const currentRate = item?.exchange_rate ?? 0;
  const delta = Number(newRate ?? 0) - currentRate;
  const deltaPct = currentRate > 0 ? Math.abs((delta / currentRate) * 100) : 0;
  const hasChange = Math.abs(delta) > 1e-6;
  const isIncrease = delta > 0;

  const onSubmit = (values: ExchangeRateFormValues) => {
    if (!item) return;
    updateRate.mutate(
      // doc_version round-trips the loaded record's version — backend requires it for optimistic-concurrency on update
      {
        id: item.id,
        doc_version: item.doc_version,
        exchange_rate: values.exchange_rate,
      },
      {
        onSuccess: () => {
          toast.success(tt("updateSuccess", { entity: t("entity") }));
          onOpenChange(false);
        },
      },
    );
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      {/* Metadata strip */}
      <div className="text-muted-foreground bg-muted/40 text-micro flex flex-wrap items-center gap-x-3 gap-y-1 border-t px-5 py-2">
        <Badge variant="primary-light" size="xs">
          {item?.currency?.code ?? "—"}
        </Badge>
        {item?.at_date && (
          <>
            <span className="bg-border h-3 w-px" />
            <span className="inline-flex items-center gap-1">
              <Calendar className="size-3" />
              {formatDate(item.at_date, dateFormat)}
            </span>
          </>
        )}
        {item?.audit?.updated?.at && (
          <>
            <span className="bg-border h-3 w-px" />
            <span className="inline-flex items-center gap-1">
              <History className="size-3" />
              {formatDate(item.audit.updated.at, dateFormat)}
            </span>
          </>
        )}
      </div>

      <div className="space-y-3 border-t px-5 py-4">
        {/* Current rate display */}
        <div className="bg-muted/40 rounded-lg border p-3 text-center">
          <p className="text-muted-foreground text-micro-legal font-semibold tracking-wider uppercase">
            {t("currencyCode")} · {t("current")}
          </p>
          <p className="mt-1 text-xl leading-tight font-bold tabular-nums">
            {formatExchangeRate(currentRate)}
          </p>
        </div>

        {/* Divider */}
        <div className="flex justify-center">
          <div className="bg-muted text-muted-foreground flex size-7 items-center justify-center rounded-full">
            <ArrowDown className="size-3.5" />
          </div>
        </div>

        {/* New rate input */}
        <FieldGroup className="gap-2">
          <Field>
            <FieldLabel>
              {tfl("exchangeRate")}
              <span className="text-muted-foreground ml-1 font-normal">
                · {t("new")}
              </span>
            </FieldLabel>
            <FieldInput
              errorIconAlign="left"
              type="number"
              inputMode="decimal"
              min={0}
              step={0.0001}
              className="h-9 text-right text-base tabular-nums"
              disabled={isPending}
              error={form.formState.errors.exchange_rate?.message}
              {...form.register("exchange_rate", { valueAsNumber: true })}
            />
          </Field>
        </FieldGroup>

        {/* Delta indicator — single semantic signal on the icon only (neutral box/border/value) */}
        <div className="bg-muted/40 flex items-center justify-between rounded-lg border p-2">
          <div className="flex items-center gap-2">
            <div
              className={`bg-muted flex size-7 items-center justify-center rounded-lg ${
                !hasChange
                  ? "text-muted-foreground"
                  : isIncrease
                    ? "text-success-ink"
                    : "text-destructive"
              }`}
            >
              {!hasChange && <Minus className="size-3.5" />}
              {hasChange && isIncrease && <TrendingUp className="size-3.5" />}
              {hasChange && !isIncrease && (
                <TrendingDown className="size-3.5" />
              )}
            </div>
            <div>
              <p className="text-micro-legal font-semibold tracking-wider uppercase">
                {!hasChange && t("noChange")}
                {hasChange && isIncrease && t("increase")}
                {hasChange && !isIncrease && t("decrease")}
              </p>
              <p className="text-muted-foreground text-micro-legal">
                {t("vsCurrentRate")}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold tabular-nums">
              {hasChange && isIncrease && "+"}
              {formatExchangeRate(delta)}
            </p>
            {hasChange && (
              <p className="text-muted-foreground text-micro-legal tabular-nums">
                {isIncrease ? "+" : "−"}
                {deltaPct.toFixed(2)}%
              </p>
            )}
          </div>
        </div>
      </div>

      <DialogFooter className="bg-muted/20 border-t px-5 py-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onOpenChange(false)}
          disabled={isPending}
        >
          {tc("cancel")}
        </Button>
        <Button type="submit" size="default" disabled={isPending || !hasChange}>
          {isPending ? tf("saving") : tc("save")}
        </Button>
      </DialogFooter>
    </form>
  );
}

function CreateForm({
  onOpenChange,
  onPendingChange,
}: {
  readonly onOpenChange: (open: boolean) => void;
  readonly onPendingChange: (pending: boolean) => void;
}) {
  const { defaultCurrencyId } = useProfile();
  const excludeCurrencyIds = defaultCurrencyId
    ? new Set([defaultCurrencyId])
    : undefined;
  const createRate = useExchangeRateCreate();
  const isPending = createRate.isPending;

  useEffect(() => {
    onPendingChange(isPending);
  }, [isPending, onPendingChange]);
  const t = useTranslations("config.exchangeRate");
  const tc = useTranslations("common");
  const tf = useTranslations("form");
  const tfl = useTranslations("field");
  const tt = useTranslations("toast");
  const tv = useTranslations("validation");

  const schema = createManualExchangeRateSchema(tv, tfl);
  const form = useForm<ManualExchangeRateFormValues>({
    resolver: zodResolver(schema) as Resolver<ManualExchangeRateFormValues>,
    defaultValues: { ...EMPTY_MANUAL_FORM, at_date: new Date().toISOString() },
  });

  const onSubmit = (values: ManualExchangeRateFormValues) => {
    createRate.mutate(
      {
        currency_id: values.currency_id,
        at_date: values.at_date,
        exchange_rate: values.exchange_rate,
      },
      {
        onSuccess: () => {
          toast.success(tt("createSuccess", { entity: t("entity") }));
          form.reset({
            ...EMPTY_MANUAL_FORM,
            at_date: new Date().toISOString(),
          });
          onOpenChange(false);
        },
      },
    );
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <div className="space-y-3 border-t px-5 py-4">
        <FieldGroup className="gap-3">
          <Field>
            <FieldLabel required>{tfl("currency")}</FieldLabel>
            <Controller
              control={form.control}
              name="currency_id"
              render={({ field }) => (
                <LookupCurrency
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={isPending}
                  excludeIds={excludeCurrencyIds}
                  error={form.formState.errors.currency_id?.message}
                />
              )}
            />
          </Field>

          <Field>
            <FieldLabel required>{tfl("date")}</FieldLabel>
            <Controller
              control={form.control}
              name="at_date"
              render={({ field }) => (
                <FieldDatePicker
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={isPending}
                  placeholder={tfl("pickDate")}
                  className="h-8 w-full text-xs"
                  includeTime
                  error={form.formState.errors.at_date?.message}
                />
              )}
            />
          </Field>

          <Field>
            <FieldLabel required>{tfl("exchangeRate")}</FieldLabel>
            <FieldInput
              errorIconAlign="left"
              type="number"
              inputMode="decimal"
              min={0}
              step={0.0001}
              placeholder="1.0000"
              className="h-8 text-right tabular-nums"
              disabled={isPending}
              error={form.formState.errors.exchange_rate?.message}
              {...form.register("exchange_rate", { valueAsNumber: true })}
            />
          </Field>
        </FieldGroup>
      </div>

      <DialogFooter className="bg-muted/20 border-t px-5 py-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onOpenChange(false)}
          disabled={isPending}
        >
          {tc("cancel")}
        </Button>
        <Button type="submit" size="default" disabled={isPending}>
          {isPending ? tf("saving") : tc("save")}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function ExchangeRateDialog({
  mode,
  open,
  onOpenChange,
  item,
}: ExchangeRateDialogProps) {
  const t = useTranslations("config.exchangeRate");
  const [isPending, setIsPending] = useState(false);

  const title = mode === "create" ? t("createTitle") : t("editTitle");
  const description = mode === "create" ? t("createDesc") : t("editDesc");

  return (
    <Dialog open={open} onOpenChange={isPending ? undefined : onOpenChange}>
      <DialogContent className="@container gap-0 p-0 sm:max-w-md">
        <DialogHeader className="relative gap-0 px-5 pt-6 pb-4">
          <div className="flex items-start gap-3">
            <div className="bg-muted text-primary flex size-9 shrink-0 items-center justify-center rounded-lg">
              <ArrowLeftRight className="size-4.5" />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-sm">{title}</DialogTitle>
              <DialogDescription className="mt-1">
                {description}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {mode === "create" ? (
          <CreateForm
            onOpenChange={onOpenChange}
            onPendingChange={setIsPending}
          />
        ) : (
          <EditForm
            item={item ?? null}
            onOpenChange={onOpenChange}
            onPendingChange={setIsPending}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
