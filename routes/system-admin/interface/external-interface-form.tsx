import { useEffect, useMemo, useRef, useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { useNavigate } from "react-router";
import { zodResolver } from "@hookform/resolvers/zod";
import { Zap } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";
import { scrollToFirstInvalidField } from "@/lib/form-helpers";
import { useInterfaceConfig } from "./use-interface-config";
import { ErrorState } from "@/components/ui/error-state";
import { PERMISSIONS } from "@/constant/permissions";
import { useCan } from "@/hooks/use-can";
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

const CONFIG_KEY = "interface_export_external";

/**
 * เส้นแบ่งโซน "มีผลทันที" — ส่วน API ด้านล่างไม่อยู่ในรอบ Edit/Save ของฟอร์มด้านบน
 * แต่ใช้ SettingSection หน้าตาเดียวกัน ไม่มีเส้นนี้ผู้ใช้จะคิดว่าต้องกด Edit ก่อน
 * หรือสลับสถานะ key แล้วรอกด Save
 */
function LiveZoneDivider({
  title,
  hint,
}: {
  readonly title: string;
  readonly hint: string;
}) {
  // แถบเต็มความกว้าง ไม่ใช่ grid ของ SettingSection — แบบเดิม (หัวซ้าย + เส้นขวา) อ่านเป็น
  // section ที่ไม่มีการ์ด ไม่ใช่เส้นแบ่งโซน
  return (
    <div className="bg-muted/40 mt-12 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-dashed px-4 py-2.5">
      <Zap aria-hidden="true" className="text-primary size-4 shrink-0" />
      <p className="text-sm font-semibold">{title}</p>
      <p className="text-muted-foreground text-xs">{hint}</p>
    </div>
  );
}

/**
 * หน้า config ของ brand `external` ในหมวด Export tools — ใช้ฟิลด์ของฟอร์ม accounting ทั่วไปเฉพาะ Vendor fallbacks
 * (รหัสบัญชี/รหัสแผนก — ไม่มี Default invoice value)
 * (config `interface_export_external` · ซ่อน Connection/Posting เพราะระบบภายนอกดึงเองผ่าน API key)
 * บวกส่วนบัญชีตั้งต้น (`gl_setting`)
 *
 * ปุ่ม Save ปุ่มเดียวบันทึกทั้งสองก้อน: interface config ก่อน แล้วค่อย `gl_setting`
 * (เฉพาะเมื่อแก้ส่วนบัญชี) เพื่อไม่ให้เขียน `gl_setting` ทับโดยไม่จำเป็น
 *
 * @returns React element ของหน้า external interface
 */
export default function ExternalInterfaceForm() {
  const t = useTranslations("systemAdmin.interface");
  const te = useTranslations("systemAdmin.interface.export");
  const navigate = useNavigate();
  const { can } = useCan();
  const showApiZone = can(PERMISSIONS.system_admin.bu_api_key.view);
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
      title={te("brand.external")}
      description={te("desc")}
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
          {showApiZone && (
            <LiveZoneDivider title={te("liveZone")} hint={te("liveZoneHint")} />
          )}
          <ExternalApiAccessSection />
          <ExternalApiDocsSection />
        </>
      }
    >
      <AccountingFields
        form={form}
        hideConnection
        hidePosting
        hideInvoiceValue
      />

      <GlDefaultsHandleProvider value={glBinding}>
        <ExternalGlDefaultsSection />
      </GlDefaultsHandleProvider>
    </InterfacePageLayout>
  );
}
