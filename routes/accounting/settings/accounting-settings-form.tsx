import { useState } from "react";
import {
  Controller,
  useForm,
  type Control,
  type Resolver,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useLocale, useTranslations } from "use-intl";
import { z } from "zod";
import { FormPageShell } from "@/components/share/form-page-shell";
import { FormToolbar } from "@/components/share/form-toolbar";
import { ErrorState } from "@/components/ui/error-state";
import { DiscardDialog } from "@/components/ui/discard-dialog";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldSelect,
} from "@/components/ui/field";
import { SelectContent, SelectItem } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  SettingSection,
  SettingSectionSkeleton,
} from "@/components/ui/setting-section";
import { LookupChartOfAccountById } from "@/components/lookup/lookup-chart-of-account-by-id";
import {
  fetchAppConfigByKey,
  useAppConfigByKey,
  useUpsertAppConfig,
} from "@/hooks/use-app-config";
import { useBuCode } from "@/hooks/use-bu-code";
import { useCan } from "@/hooks/use-can";
import { useDiscardConfirm } from "@/hooks/use-discard-confirm";
import { useNavigationGuard } from "@/hooks/use-navigation-guard";
import { PERMISSIONS } from "@/constant/permissions";
import { QUERY_KEYS } from "@/constant/query-keys";
import { ApiError } from "@/lib/api-error";
import {
  GL_SETTING_KEY,
  GL_UUID_FIELDS,
  toGlSettingForm,
  toGlSettingValue,
  type GlSettingForm,
  type GlUuidField,
} from "./gl-setting-value";
import {
  useGlJvPrefixOptions,
  type GlJvPrefixOption,
} from "./use-gl-jv-prefix-options";

const FORM_ID = "accounting-settings-form";

/** ค่าที่ว่างในโหมดดู — placeholder "Select …" ของ picker ฟังเหมือนชวนให้กด */
const VIEW_EMPTY = "—";

/** Radix Select ใช้ "" เป็น value ไม่ได้ — ตัวเลือก "ไม่ระบุ" ของช่อง prefix ใช้ค่านี้แทน */
const PREFIX_NONE = "__gl_prefix_none__";

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

type Translate = ReturnType<typeof useTranslations>;

function createSchema(tv: Translate, monthLabel: string) {
  const uuidShape = Object.fromEntries(
    GL_UUID_FIELDS.map((key) => [key, z.string().nullable()]),
  ) as Record<GlUuidField, z.ZodNullable<z.ZodString>>;
  const monthMessage = tv("required", { field: monthLabel });
  return z.object({
    fiscal_year_start_month: z
      .number({ error: monthMessage })
      .int({ error: monthMessage })
      .min(1, { error: monthMessage })
      .max(12, { error: monthMessage }),
    allow_post_to_closed_period: z.boolean(),
    ...uuidShape,
  });
}

/** ชื่อเดือนตามภาษาของแอป (1 = มกราคม) — ใช้ UTC กันเดือนเลื่อนตาม timezone */
function monthName(locale: string, month: number): string {
  return new Intl.DateTimeFormat(locale, {
    month: "long",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(2000, month - 1, 1)));
}

type FieldProps = {
  readonly control: Control<GlSettingForm>;
  readonly name: GlUuidField;
  readonly label: string;
  readonly hint?: string;
  readonly editing: boolean;
};

function AccountField({ control, name, label, hint, editing }: FieldProps) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <Field>
          <FieldLabel>{label}</FieldLabel>
          <LookupChartOfAccountById
            value={field.value}
            onValueChange={field.onChange}
            disabled={!editing}
            placeholder={editing ? undefined : VIEW_EMPTY}
          />
          {hint && <FieldDescription>{hint}</FieldDescription>}
        </Field>
      )}
    />
  );
}

function PrefixField({
  control,
  name,
  label,
  hint,
  editing,
  options,
  isLoading,
  noneLabel,
  unknownLabel,
}: FieldProps & {
  readonly options: GlJvPrefixOption[];
  readonly isLoading: boolean;
  readonly noneLabel: string;
  readonly unknownLabel: string;
}) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => {
        const current = field.value;
        // prefix ที่เก็บไว้แต่ไม่อยู่ในรายการ (กำลังโหลด / ถูกลบ) — เติม option ไว้
        // ไม่งั้น Select แสดงว่างและค่าดูเหมือนหายทั้งที่ยังอยู่
        const list =
          current && !options.some((o) => o.value === current)
            ? [{ value: current, label: unknownLabel }, ...options]
            : options;
        return (
          <Field>
            <FieldLabel>{label}</FieldLabel>
            <FieldSelect
              value={current ?? PREFIX_NONE}
              onValueChange={(v) =>
                field.onChange(v === PREFIX_NONE ? null : v)
              }
              disabled={!editing || isLoading}
            >
              <SelectContent>
                <SelectItem value={PREFIX_NONE}>
                  {editing ? noneLabel : VIEW_EMPTY}
                </SelectItem>
                {list.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </FieldSelect>
            {hint && <FieldDescription>{hint}</FieldDescription>}
          </Field>
        );
      }}
    />
  );
}

/**
 * หน้าตั้งค่า Accounting — อ่าน/เขียน app-config key `gl_setting` ของ BU ครบทั้ง 15 ช่อง
 * (ระบบบัญชีของเราเองใช้ตอนลง AP Invoice / AP Payment / AR และงวดบัญชี GL)
 *
 * บันทึก: PUT **แทนที่ทั้งก้อน** จึงดึงค่าล่าสุดจาก server ใหม่ (`staleTime: 0`) ทุกครั้ง
 * ก่อน merge — cache อาจเก่าถึง 30 นาที (`CACHE_STATIC`) และ key ที่ฟอร์มไม่รู้จักต้องอยู่ครบ
 * 404 = ยังไม่เคยมีแถว → สร้างใหม่ (เดือนเริ่มปีบัญชีอยู่ในก้อนเสมอ ซึ่ง backend บังคับ)
 *
 * เขียนได้เมื่อสัญญายังเขียนได้ (`canWrite`) และมีสิทธิ์ `configuration.app_config.update`
 * (สิทธิ์ที่ gateway ตรวจตอน PUT) — ไม่ผ่าน = หน้าอ่านอย่างเดียว ไม่มีปุ่ม Edit
 */
export function AccountingSettingsForm() {
  const tm = useTranslations("modules");
  const t = useTranslations("accounting.settings");
  const tv = useTranslations("validation");
  const locale = useLocale();
  const buCode = useBuCode();
  const queryClient = useQueryClient();
  const { can, canWrite } = useCan();
  const writable = canWrite && can(PERMISSIONS.configuration.app_config.update);

  const query = useAppConfigByKey(GL_SETTING_KEY);
  const upsert = useUpsertAppConfig();
  const prefixes = useGlJvPrefixOptions();
  const [editing, setEditing] = useState(false);
  const [isFetchingFresh, setIsFetchingFresh] = useState(false);

  // 404 = BU ยังไม่เคยบันทึก gl_setting — เป็นสถานะปกติ แสดงฟอร์มค่าตั้งต้น ไม่ใช่หน้า error
  const isNotFound =
    query.error instanceof ApiError && query.error.statusCode === 404;
  const isError = query.isError && !isNotFound;
  // isPending ไม่ใช่ isLoading — query ถูกปิดไว้จนกว่าจะรู้ buCode (fetchStatus "idle")
  const isBusy = query.isPending && !isNotFound;
  const loaded = !isBusy && !isError;
  const saved = loaded
    ? toGlSettingForm(isNotFound ? undefined : query.data?.value)
    : undefined;

  const form = useForm<GlSettingForm>({
    resolver: zodResolver(
      createSchema(tv, t("fields.fiscalYearStartMonth")),
    ) as Resolver<GlSettingForm>,
    values: saved,
    // refetch เบื้องหลัง (เช่นตอน fetch ค่าล่าสุดก่อนบันทึก) ต้องไม่ทับช่องที่ผู้ใช้กำลังแก้
    resetOptions: { keepDirtyValues: true },
  });

  const isSaving = isFetchingFresh || upsert.isPending;
  const hasUnsaved = editing && form.formState.isDirty;
  const discard = useDiscardConfirm({
    isDirty: hasUnsaved,
    isPending: isSaving,
  });
  const navGuard = useNavigationGuard(hasUnsaved);

  const exitEdit = () => {
    if (saved) form.reset(saved);
    setEditing(false);
  };
  const handleEdit = () => {
    if (saved) form.reset(saved);
    setEditing(true);
  };
  const handleCancel = () => discard.confirm(exitEdit);

  const onSubmit = form.handleSubmit(async (values) => {
    if (!buCode) return;
    let fresh: Record<string, unknown> | undefined;
    setIsFetchingFresh(true);
    try {
      const row = await queryClient.fetchQuery({
        queryKey: [QUERY_KEYS.APP_CONFIGS, buCode, GL_SETTING_KEY],
        queryFn: () => fetchAppConfigByKey(buCode, GL_SETTING_KEY),
        staleTime: 0,
      });
      fresh = row.value;
    } catch (e) {
      if (!(e instanceof ApiError && e.statusCode === 404)) {
        // อ่านค่าล่าสุดไม่ได้ = ไม่รู้ว่า merge บนอะไร — ยกเลิกดีกว่าเขียนทับ key อื่นทิ้ง
        toast.error(t("freshLoadError"));
        return;
      }
      fresh = undefined;
    } finally {
      setIsFetchingFresh(false);
    }
    upsert.mutate(
      { key: GL_SETTING_KEY, value: toGlSettingValue(values, fresh) },
      {
        onSuccess: () => {
          toast.success(t("saved"));
          form.reset(values);
          setEditing(false);
        },
        // ไม่ต้อง onError — MutationCache กลาง toast ให้แล้ว
      },
    );
  });

  const control = form.control;
  const monthError = form.formState.errors.fiscal_year_start_month?.message;
  const prefixProps = {
    options: prefixes.options,
    isLoading: prefixes.isLoading,
    noneLabel: t("prefixNone"),
    unknownLabel: t("prefixUnknown"),
  };
  const apPostingHint = t("hints.apPosting");

  return (
    <FormPageShell
      header={
        <FormToolbar
          mode={editing ? "edit" : "view"}
          formId={FORM_ID}
          isPending={isSaving}
          title={tm("accountingSettings")}
          subtitle={writable ? t("pageDescription") : t("readOnlyNote")}
          permissionPrefix="configuration.app_config"
          onCancel={handleCancel}
          onEdit={writable && loaded ? handleEdit : undefined}
        />
      }
    >
      {isError && (
        <ErrorState message={t("loadError")} onRetry={() => query.refetch()} />
      )}

      {isBusy && (
        <div>
          <SettingSectionSkeleton first fields={["half", "half", "half"]} />
          <SettingSectionSkeleton fields={["half", "half", "half", "half"]} />
          <SettingSectionSkeleton fields={["half", "half"]} />
        </div>
      )}

      {loaded && (
        <form id={FORM_ID} onSubmit={onSubmit}>
          <SettingSection
            first
            title={t("sections.generalLedger")}
            description={t("sections.generalLedgerDesc")}
          >
            <Controller
              control={control}
              name="fiscal_year_start_month"
              render={({ field }) => (
                <Field>
                  <FieldLabel required={editing}>
                    {t("fields.fiscalYearStartMonth")}
                  </FieldLabel>
                  <FieldSelect
                    value={String(field.value)}
                    onValueChange={(v) => field.onChange(Number(v))}
                    disabled={!editing}
                    error={monthError}
                  >
                    <SelectContent>
                      {MONTHS.map((m) => (
                        <SelectItem key={m} value={String(m)}>
                          {monthName(locale, m)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </FieldSelect>
                  <FieldDescription>{t("hints.fiscalYear")}</FieldDescription>
                  <FieldError>{monthError}</FieldError>
                </Field>
              )}
            />
            <AccountField
              control={control}
              name="retained_earnings_account_id"
              label={t("fields.retainedEarningsAccount")}
              editing={editing}
            />
            <PrefixField
              control={control}
              name="reversal_prefix_id"
              label={t("fields.reversalPrefix")}
              editing={editing}
              {...prefixProps}
            />
            <PrefixField
              control={control}
              name="auto_jv_prefix_id"
              label={t("fields.autoJvPrefix")}
              editing={editing}
              {...prefixProps}
            />
            <Controller
              control={control}
              name="allow_post_to_closed_period"
              render={({ field }) => (
                <Field orientation="horizontal" className="sm:col-span-2">
                  <Switch
                    id="allow_post_to_closed_period"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    disabled={!editing}
                  />
                  <FieldContent>
                    <FieldLabel htmlFor="allow_post_to_closed_period">
                      {t("fields.allowPostToClosedPeriod")}
                    </FieldLabel>
                    <FieldDescription>
                      {t("hints.allowPostToClosedPeriod")}
                    </FieldDescription>
                  </FieldContent>
                </Field>
              )}
            />
          </SettingSection>

          <SettingSection
            title={t("sections.accountsPayable")}
            description={t("sections.accountsPayableDesc")}
          >
            <AccountField
              control={control}
              name="ap_control_account_id"
              label={t("fields.apControlAccount")}
              hint={apPostingHint}
              editing={editing}
            />
            <AccountField
              control={control}
              name="input_vat_account_id"
              label={t("fields.inputVatAccount")}
              hint={apPostingHint}
              editing={editing}
            />
            <AccountField
              control={control}
              name="wht_payable_account_id"
              label={t("fields.whtPayableAccount")}
              editing={editing}
            />
            <AccountField
              control={control}
              name="advance_deposit_account_id"
              label={t("fields.advanceDepositAccount")}
              editing={editing}
            />
            <AccountField
              control={control}
              name="realized_fx_gain_account_id"
              label={t("fields.realizedFxGainAccount")}
              editing={editing}
            />
            <AccountField
              control={control}
              name="realized_fx_loss_account_id"
              label={t("fields.realizedFxLossAccount")}
              editing={editing}
            />
            <PrefixField
              control={control}
              name="ap_jv_prefix_id"
              label={t("fields.apJvPrefix")}
              editing={editing}
              {...prefixProps}
            />
          </SettingSection>

          <SettingSection
            title={t("sections.accountsReceivable")}
            description={t("sections.accountsReceivableDesc")}
          >
            <AccountField
              control={control}
              name="ar_control_account_id"
              label={t("fields.arControlAccount")}
              editing={editing}
            />
            <AccountField
              control={control}
              name="output_vat_account_id"
              label={t("fields.outputVatAccount")}
              editing={editing}
            />
            <PrefixField
              control={control}
              name="ar_jv_prefix_id"
              label={t("fields.arJvPrefix")}
              editing={editing}
              {...prefixProps}
            />
          </SettingSection>
        </form>
      )}

      {/* Cancel ตอนมีการแก้ค้าง */}
      <DiscardDialog {...discard.dialogProps} variant="warning" />
      {/* นำทางออก/กด back ระหว่างแก้ค้าง */}
      <DiscardDialog
        open={navGuard.isOpen}
        onOpenChange={(o) => {
          if (!o) navGuard.cancel();
        }}
        onConfirm={navGuard.confirm}
        onCancel={navGuard.cancel}
        variant="warning"
      />
    </FormPageShell>
  );
}
