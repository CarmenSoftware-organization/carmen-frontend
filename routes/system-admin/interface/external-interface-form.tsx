import { useEffect, useMemo, useRef, useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { useNavigate } from "react-router";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useTranslations } from "use-intl";
import { scrollToFirstInvalidField } from "@/lib/form-helpers";
import { useInterfaceConfig } from "./use-interface-config";
import { ErrorState } from "@/components/ui/error-state";
import { ExternalApiAccessSection } from "./external-api-access-section";
import { ExternalApiDocsSection } from "./external-api-docs-section";
import { InterfacePageLayout } from "./interface-page-layout";
import {
  AccountingFields,
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
  const te = useTranslations("systemAdmin.interface.accounting.external");
  const navigate = useNavigate();
  const glRef = useRef<GlDefaultsHandle>(null);
  const [glDirty, setGlDirty] = useState(false);
  const [glBusy, setGlBusy] = useState(false);
  // ปุ่ม retry ของ gl_setting ต้องอยู่นอก <fieldset disabled> ของ layout ไม่งั้นกดไม่ได้ในโหมดอ่าน
  const [glRetry, setGlRetry] = useState<(() => void) | null>(null);
  const glBinding = useMemo(
    () => ({
      handleRef: glRef,
      onDirtyChange: setGlDirty,
      onBusyChange: setGlBusy,
      onLoadErrorChange: (retry: (() => void) | null) =>
        setGlRetry(() => retry),
    }),
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

  // ห่อเป็น handler เพราะข้างในอ่าน glRef — เรียกตอน render ไม่ได้ (react-hooks/refs)
  const submit = (e?: React.BaseSyntheticEvent) =>
    form.handleSubmit(
      (values) =>
        save(toApiValue(values), {
          onSuccess: () => {
            if (glRef.current) {
              glRef.current.save(done, () =>
                toast.error(te("partialSaveFailed")),
              );
            } else done();
          },
        }),
      () => scrollToFirstInvalidField(),
    )(e);

  return (
    <InterfacePageLayout
      title={ta("brand.external")}
      description={ta("desc")}
      onSave={submit}
      onCancel={() => {
        form.reset(value ? toFormValues(value) : EMPTY_ACCOUNTING);
        glRef.current?.reset();
      }}
      isSaving={isSaving || glBusy}
      isLoading={isLoading}
      isError={isError}
      isDirty={form.formState.isDirty || glDirty}
      onRetry={refetch}
      errorMessage={t("loadError")}
      saveLabel={t("save")}
      notice={
        glRetry ? (
          <ErrorState message={te("glLoadError")} onRetry={glRetry} />
        ) : undefined
      }
      afterForm={
        <>
          <ExternalApiAccessSection />
          <ExternalApiDocsSection />
        </>
      }
    >
      <AccountingFields form={form} />

      <GlDefaultsHandleProvider value={glBinding}>
        <ExternalGlDefaultsSection />
      </GlDefaultsHandleProvider>
    </InterfacePageLayout>
  );
}
