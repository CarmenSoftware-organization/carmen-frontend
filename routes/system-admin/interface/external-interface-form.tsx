import { useEffect, useMemo, useRef, useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { useNavigate } from "react-router";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useTranslations } from "use-intl";
import { SettingSection } from "@/components/ui/setting-section";
import { scrollToFirstInvalidField } from "@/lib/form-helpers";
import { useInterfaceConfig } from "./use-interface-config";
import { InterfacePageLayout } from "./interface-page-layout";
import { TextField, EnumField, ToggleField } from "./interface-fields";
import {
  accountingSchema,
  EMPTY_ACCOUNTING,
  toFormValues,
  toApiValue,
  type AccountingFormValues,
} from "./accounting-interface-form";
import {
  ExternalGlDefaultsSection,
  GlDefaultsHandleProvider,
  type GlDefaultsHandle,
} from "./external-gl-defaults-section";

const CONFIG_KEY = "interface_accounting_external";
const FORMATS = accountingSchema.shape.export_format.options;
const FREQUENCIES = accountingSchema.shape.posting_frequency.options;

/**
 * หน้า config ของ Accounting brand `external` — ฟิลด์ทั้งหมดเหมือนฟอร์ม accounting ทั่วไป
 * (config `interface_accounting_external`) บวกส่วนบัญชีตั้งต้น (`gl_setting`)
 *
 * ปุ่ม Save ปุ่มเดียวบันทึกทั้งสองก้อน: interface config ก่อน แล้วค่อย `gl_setting`
 * (เฉพาะเมื่อแก้ส่วนบัญชี) เพื่อไม่ให้เขียน `gl_setting` ทับโดยไม่จำเป็น
 *
 * @returns React element ของหน้า external interface
 */
export default function ExternalInterfaceForm() {
  const t = useTranslations("systemAdmin.interface");
  const ta = useTranslations("systemAdmin.interface.accounting");
  const navigate = useNavigate();
  const glRef = useRef<GlDefaultsHandle>(null);
  const [glDirty, setGlDirty] = useState(false);
  const glBinding = useMemo(
    () => ({ handleRef: glRef, onDirtyChange: setGlDirty }),
    [],
  );
  const { value, isLoading, isError, refetch, save, isSaving } =
    useInterfaceConfig(CONFIG_KEY);

  const form = useForm<AccountingFormValues>({
    resolver: zodResolver(accountingSchema) as Resolver<AccountingFormValues>,
    defaultValues: EMPTY_ACCOUNTING,
  });

  useEffect(() => {
    if (value) form.reset(toFormValues(value));
  }, [value, form]);

  const done = () => {
    toast.success(t("saved"));
    // guard ดักเฉพาะคลิกลิงก์/back ไม่ดัก navigate() จากโค้ด จึงไม่ต้อง reset ก่อน
    navigate("/system-admin/interface");
  };

  const submit = form.handleSubmit(
    (values) =>
      save(toApiValue(values), {
        onSuccess: () => {
          if (glRef.current) glRef.current.save(done);
          else done();
        },
      }),
    () => scrollToFirstInvalidField(),
  );

  return (
    <InterfacePageLayout
      title={ta("brand.external")}
      description={ta("desc")}
      onSave={submit}
      onCancel={() => {
        form.reset(value ? toFormValues(value) : EMPTY_ACCOUNTING);
        glRef.current?.reset();
      }}
      isSaving={isSaving}
      isLoading={isLoading}
      isError={isError}
      isDirty={form.formState.isDirty || glDirty}
      onRetry={refetch}
      errorMessage={t("loadError")}
      saveLabel={t("save")}
    >
      <SettingSection
        first
        title={ta("connection")}
        description={ta("connectionDesc")}
      >
        <ToggleField
          label={t("enabled")}
          checked={form.watch("enabled")}
          onChange={(v) => form.setValue("enabled", v, { shouldDirty: true })}
        />
        <TextField
          label={t("endpoint")}
          field={form.register("endpoint")}
          error={form.formState.errors.endpoint?.message}
          placeholder="https://gl.example.com"
          className="sm:col-span-2"
        />
      </SettingSection>

      <SettingSection title={ta("defaults")} description={ta("defaultsDesc")}>
        <TextField
          label={ta("defaultAccountCode")}
          field={form.register("default_account_code")}
          error={form.formState.errors.default_account_code?.message}
          placeholder="1000"
        />
        <TextField
          label={ta("defaultDepartmentCode")}
          field={form.register("default_department_code")}
          error={form.formState.errors.default_department_code?.message}
          placeholder="D1"
        />
        <TextField
          label={ta("defaultInvoiceValue")}
          field={form.register("default_invoice_value")}
          error={form.formState.errors.default_invoice_value?.message}
          placeholder="0"
        />
      </SettingSection>

      <SettingSection title={ta("posting")} description={ta("postingDesc")}>
        <EnumField
          label={ta("exportFormat")}
          value={form.watch("export_format")}
          options={FORMATS}
          optionLabel={(f) => ta(`formatOption.${f}`)}
          onChange={(v) =>
            form.setValue("export_format", v, { shouldDirty: true })
          }
        />
        <EnumField
          label={ta("postingFrequency")}
          value={form.watch("posting_frequency")}
          options={FREQUENCIES}
          optionLabel={(f) => t(`frequencyOption.${f}`)}
          onChange={(v) =>
            form.setValue("posting_frequency", v, { shouldDirty: true })
          }
        />
      </SettingSection>

      <GlDefaultsHandleProvider value={glBinding}>
        <ExternalGlDefaultsSection />
      </GlDefaultsHandleProvider>
    </InterfacePageLayout>
  );
}
