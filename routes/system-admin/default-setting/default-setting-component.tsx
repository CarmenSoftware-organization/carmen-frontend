import { useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useTranslations } from "use-intl";
import { FormPageShell } from "@/components/share/form-page-shell";
import { FormToolbar } from "@/components/share/form-toolbar";
import { ErrorState } from "@/components/ui/error-state";
import { DiscardDialog } from "@/components/ui/discard-dialog";
import { useProfile } from "@/hooks/use-profile";
import { useDiscardConfirm } from "@/hooks/use-discard-confirm";
import { useNavigationGuard } from "@/hooks/use-navigation-guard";
import {
  useBusinessUnit,
  useUpdateBusinessUnit,
} from "@/hooks/use-business-unit";
import {
  SettingSection,
  SettingSectionSkeleton,
} from "@/components/ui/setting-section";
import {
  ConfigField,
  CONFIG_ENUM_EMPTY,
} from "../company-profile/company-profile-ui";
import {
  createBusinessSettingSchema,
  toFormValues,
  buildPatch,
  toPatchPayload,
  normalizeConfig,
  mergeSeededConfig,
  type BusinessSettingFormValues,
} from "../company-profile/company-profile-form-schema";
import {
  groupConfigForRender,
  resolveConfigOptions,
} from "../company-profile/company-profile-config-registry";
import {
  useReportFormTemplates,
  type ReportFormOption,
} from "./use-report-form-templates";

const FORM_ID = "default-setting-form";

export interface BuildPrintFormOptionsParams {
  current: string;
  list: ReportFormOption[] | undefined;
  isLoading: boolean;
  isError: boolean;
  unknownLabel: string;
  loadingLabel: string;
  unavailableLabel: string;
  systemDefaultLabel: string;
}

/**
 * รวม options ของ dropdown แบบฟอร์มการพิมพ์
 *
 * เติม option แทน "" (ใช้ค่าเริ่มต้นของระบบ — {@link CONFIG_ENUM_EMPTY}) ไว้หัวรายการเสมอ
 * ไม่ว่าจะกำลังโหลด, โหลดพลาด, หรือโหลดสำเร็จแล้ว เพื่อไม่ให้แถวเป็น Select ว่างที่กดอะไรไม่ได้
 * และเพื่อให้ผู้ดูแลย้อนกลับไปใช้ค่าเริ่มต้นของระบบได้เสมอ
 *
 * ถ้าค่าที่เก็บไว้เป็นค่าที่ไม่ใช่ "" และไม่อยู่ใน list จะเติม option สังเคราะห์อีกตัวต่อจาก
 * option ค่าเริ่มต้น เพื่อไม่ให้ค่าหายตอน Save — ป้ายของ option สังเคราะห์นี้ขึ้นกับสาเหตุ:
 * กำลังโหลด, โหลดไม่สำเร็จ (ยังสรุปไม่ได้ว่า template หายไปจริง), หรือโหลดสำเร็จแล้วแต่ไม่พบ
 * ค่านี้ในรายการ (unknown template จริง) — ค่า "" เองไม่มีวันเข้าเงื่อนไขนี้ เพราะ resolve ไปที่
 * option ค่าเริ่มต้นที่เติมไว้แล้วเสมอ
 */
export function buildPrintFormOptions({
  current,
  list,
  isLoading,
  isError,
  unknownLabel,
  loadingLabel,
  unavailableLabel,
  systemDefaultLabel,
}: BuildPrintFormOptionsParams): ReportFormOption[] {
  const base = list ?? [];
  const systemDefault: ReportFormOption = {
    value: CONFIG_ENUM_EMPTY,
    label: systemDefaultLabel,
  };
  if (!current || base.some((o) => o.value === current)) {
    return [systemDefault, ...base];
  }
  const label = isLoading
    ? loadingLabel
    : isError
      ? unavailableLabel
      : unknownLabel;
  return [systemDefault, { value: current, label }, ...base];
}

export default function DefaultSettingComponent() {
  const tm = useTranslations("modules");
  const t = useTranslations("defaultSetting");
  const tv = useTranslations("validation");
  const tf = useTranslations("companyProfile.fields");
  const { defaultBu, isProfileReady } = useProfile();
  const buId = defaultBu?.id;
  const { data, isLoading, isError, refetch } = useBusinessUnit(buId);
  const update = useUpdateBusinessUnit(buId);
  const formTemplates = useReportFormTemplates();
  const [editing, setEditing] = useState(false);

  const form = useForm<BusinessSettingFormValues>({
    resolver: zodResolver(
      createBusinessSettingSchema(tv, tf),
    ) as Resolver<BusinessSettingFormValues>,
    values: data ? toFormValues(data) : undefined,
  });

  const configGroups = data
    ? groupConfigForRender(mergeSeededConfig(normalizeConfig(data.config)))
    : { sections: [], other: [] };
  const docSections = configGroups.sections.filter((s) => s.id !== "printForm");
  const printSection = configGroups.sections.find((s) => s.id === "printForm");
  const isBusy = !isProfileReady || isLoading;

  // มีการแก้ค้าง (dirty) ระหว่างโหมด edit → กัน discard โดยไม่ได้ตั้งใจ
  const hasUnsaved = editing && form.formState.isDirty;
  const discard = useDiscardConfirm({
    isDirty: hasUnsaved,
    isPending: update.isPending,
  });
  const navGuard = useNavigationGuard(hasUnsaved);

  const exitEdit = () => {
    if (data) form.reset(toFormValues(data));
    setEditing(false);
  };
  const handleEdit = () => {
    if (data) form.reset(toFormValues(data));
    setEditing(true);
  };
  const handleCancel = () => discard.confirm(exitEdit);

  const onSubmit = form.handleSubmit((values) => {
    if (!data) return;
    const patch = buildPatch(values, toFormValues(data));
    if (Object.keys(patch).length === 0) {
      setEditing(false);
      return;
    }
    // แนบ doc_version (optimistic lock) + id ของ BU ที่โหลดมา (กันเขียนผิด BU) — ดู toPatchPayload
    update.mutate(
      toPatchPayload(patch, data),
      {
        onSuccess: () => {
          toast.success(t("saved"));
          setEditing(false);
        },
        // ไม่ต้อง onError เอง — mutation ตัวนี้ผ่าน MutationCache กลางซึ่ง toast
        // ให้อยู่แล้ว เขียนซ้ำที่นี่ = เด้งสองใบ และใบนี้โยน err.message ดิบซึ่ง
        // เป็นสตริงที่ dev เขียนไว้ ไม่ใช่ข้อความสำหรับผู้ใช้ (ดู lib/api-error.ts)
      },
    );
  });

  return (
    <FormPageShell
      width="wide"
      header={
        <FormToolbar
          mode={editing ? "edit" : "view"}
          formId={FORM_ID}
          isPending={update.isPending}
          title={tm("defaultSetting")}
          subtitle={t("pageDescription")}
          permissionPrefix="system_admin.business_unit"
          onCancel={handleCancel}
          onEdit={!isError && !isBusy && data ? handleEdit : undefined}
        />
      }
    >
      {isError && (
        <ErrorState message={t("loadError")} onRetry={() => refetch()} />
      )}

      {!isError && isBusy && (
        <div>
          <SettingSectionSkeleton first fields={["full", "full", "full"]} />
          <SettingSectionSkeleton
            fields={["full", "full", "full", "full", "full", "full"]}
          />
        </div>
      )}

      {!isError && !isBusy && data && (
        <form id={FORM_ID} onSubmit={onSubmit}>
          {/* PR / SI / PO มีหมวดละ 1–2 ค่า — เดิมกินการ์ดใหญ่หมวดละใบ รวมเป็นรายการเดียว
              แล้วใช้รหัสเอกสารหน้าแถวบอกว่าค่านั้นเป็นของเอกสารไหน */}
          {docSections.length > 0 && (
            <SettingSection
              first
              plain
              title={t("sections.documents")}
              description={t("sections.documentsDesc")}
            >
              <div className="divide-y">
                {docSections.flatMap((section) =>
                  section.entries.map((entry) => (
                    <ConfigField
                      key={entry.item.key}
                      editing={editing}
                      form={form}
                      index={entry.index}
                      item={entry.item}
                      code={entry.code ?? t(section.titleKey)}
                      label={t(entry.labelKey)}
                      description={entry.descKey ? t(entry.descKey) : undefined}
                      yesLabel={t("yes")}
                      noLabel={t("no")}
                      options={
                        entry.options
                          ? resolveConfigOptions(
                              entry.options,
                              data.calculation_method,
                              entry.item.value,
                            ).map((o) => ({
                              value: o.value,
                              label: t(o.labelKey),
                            }))
                          : undefined
                      }
                    />
                  )),
                )}
              </div>
            </SettingSection>
          )}

          {printSection && (
            <SettingSection
              first={docSections.length === 0}
              plain
              title={t(printSection.titleKey)}
              description={t(printSection.descKey)}
              action={
                formTemplates.isError ? (
                  <p className="text-destructive text-xs" role="alert">
                    {t("config.printFormLoadError")}
                  </p>
                ) : (
                  <p className="text-muted-foreground text-xs tabular-nums">
                    {t("config.printFormCustomCount", {
                      n: printSection.entries.filter((e) => e.item.value !== "")
                        .length,
                      total: printSection.entries.length,
                    })}
                  </p>
                )
              }
            >
              <div className="divide-y">
                {printSection.entries.map((entry) => (
                  <ConfigField
                    key={entry.item.key}
                    editing={editing}
                    form={form}
                    index={entry.index}
                    item={entry.item}
                    code={entry.code}
                    label={t(entry.labelKey)}
                    yesLabel={t("yes")}
                    noLabel={t("no")}
                    emptyIsDefault
                    options={buildPrintFormOptions({
                      current: entry.item.value,
                      list: entry.optionsGroup
                        ? formTemplates.data?.get(entry.optionsGroup)
                        : undefined,
                      isLoading: formTemplates.isLoading,
                      isError: formTemplates.isError,
                      unknownLabel: t("config.printFormUnknown", {
                        id: entry.item.value,
                      }),
                      loadingLabel: t("config.printFormLoading"),
                      unavailableLabel: t("config.printFormUnavailable", {
                        id: entry.item.value,
                      }),
                      systemDefaultLabel: t("config.printFormSystemDefault"),
                    })}
                    disabled={formTemplates.isLoading}
                  />
                ))}
              </div>
            </SettingSection>
          )}
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
