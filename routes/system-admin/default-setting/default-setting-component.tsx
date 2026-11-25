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
import { isDevAppEnv } from "@/lib/runtime-config";
import { cn } from "@/lib/utils";
import {
  useBusinessUnit,
  useUpdateBusinessUnit,
} from "@/hooks/use-business-unit";
import {
  CompactSection,
  CompactSectionSkeleton,
  FieldGrid,
} from "@/components/share/compact-section";
import {
  ConfigCode,
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
  type ConfigRenderSection,
  type ConfigSectionEntry,
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

/**
 * หมวดของ registry → การ์ดบนหน้า (หมวดที่ไม่อยู่ในนี้ = การ์ดของตัวเอง)
 * PR/SI/PO มีหมวดละค่าเดียว รวมเป็นการ์ด "จัดซื้อและคลัง" ใช้รหัสเอกสารเป็นป้ายแยก ·
 * AP/AR ทุกค่าเป็นคำถามเดียวกัน (ผู้สร้างอนุมัติเองได้ไหม) รวมเป็นการ์ดเดียว ถามครั้งเดียวที่หัวการ์ด
 */
const DOC_CARD_OF_SECTION: Readonly<
  Record<
    string,
    { id: string; titleKey: string; descKey: string; showCode: boolean }
  >
> = {
  pr: {
    id: "purchasing",
    titleKey: "sections.purchasing",
    descKey: "sections.purchasingDesc",
    showCode: true,
  },
  si: {
    id: "purchasing",
    titleKey: "sections.purchasing",
    descKey: "sections.purchasingDesc",
    showCode: true,
  },
  po: {
    id: "purchasing",
    titleKey: "sections.purchasing",
    descKey: "sections.purchasingDesc",
    showCode: true,
  },
  ap: {
    id: "selfApprove",
    titleKey: "sections.selfApprove",
    descKey: "sections.selfApproveDesc",
    showCode: false,
  },
  ar: {
    id: "selfApprove",
    titleKey: "sections.selfApprove",
    descKey: "sections.selfApproveDesc",
    showCode: false,
  },
};

interface DocCard {
  id: string;
  titleKey: string;
  descKey: string;
  /** true = ค่าในการ์ดมาจากหลายเอกสาร ต้องมีป้ายรหัสบอก */
  showCode: boolean;
  entries: { entry: ConfigSectionEntry; section: ConfigRenderSection }[];
}

/** จัดหมวดเอกสารของ registry เป็นการ์ดตามเรื่อง — ลำดับการ์ดตามหมวดแรกที่เจอใน registry */
function groupDocSections(sections: readonly ConfigRenderSection[]): DocCard[] {
  const cards = new Map<string, DocCard>();
  for (const section of sections) {
    const meta = DOC_CARD_OF_SECTION[section.id] ?? {
      id: section.id,
      titleKey: section.titleKey,
      descKey: section.descKey,
      showCode: false,
    };
    let card = cards.get(meta.id);
    if (!card) {
      card = { ...meta, entries: [] };
      cards.set(meta.id, card);
    }
    card.entries.push(...section.entries.map((entry) => ({ entry, section })));
  }
  return [...cards.values()];
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
  // env dev/local: โชว์ config key ใต้ป้าย ให้ทีมอ้างอิง key ที่เก็บใน BU config ได้ทันที
  const showKey = isDevAppEnv();

  const form = useForm<BusinessSettingFormValues>({
    resolver: zodResolver(
      createBusinessSettingSchema(tv, tf),
    ) as Resolver<BusinessSettingFormValues>,
    values: data ? toFormValues(data) : undefined,
  });

  const configGroups = data
    ? groupConfigForRender(mergeSeededConfig(normalizeConfig(data.config)))
    : { sections: [], other: [] };
  // "general" (VAT% / Service%) เป็นค่าของทั้ง BU ไม่ใช่ของเอกสารใบไหน — แยกการ์ดของตัวเอง
  const generalSection = configGroups.sections.find((s) => s.id === "general");
  const docSections = configGroups.sections.filter(
    (s) => s.id !== "printForm" && s.id !== "general",
  );
  // หมวดเอกสาร → การ์ดตามเรื่อง (ดู DOC_CARD_OF_SECTION)
  const docCards = groupDocSections(docSections);
  const printSection = configGroups.sections.find((s) => s.id === "printForm");
  const isBusy = !isProfileReady || isLoading;
  // โหมดดู: ช่องเต็มเฉพาะแบบฟอร์มที่ตั้งเอง ที่เหลือ (ค่า "" = ใช้ค่าระบบ) รวมเป็นรายชื่อ
  const printEntries = printSection?.entries ?? [];
  const printDefaults = printEntries.filter((e) => e.item.value === "");
  const printShown = editing
    ? printEntries
    : printEntries.filter((e) => e.item.value !== "");

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
    update.mutate(toPatchPayload(patch, data), {
      onSuccess: () => {
        toast.success(t("saved"));
        setEditing(false);
      },
      // ไม่ต้อง onError เอง — mutation ตัวนี้ผ่าน MutationCache กลางซึ่ง toast
      // ให้อยู่แล้ว เขียนซ้ำที่นี่ = เด้งสองใบ และใบนี้โยน err.message ดิบซึ่ง
      // เป็นสตริงที่ dev เขียนไว้ ไม่ใช่ข้อความสำหรับผู้ใช้ (ดู lib/api-error.ts)
    });
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
          <CompactSectionSkeleton first className="h-20" />
          <CompactSectionSkeleton className="h-36" />
        </div>
      )}

      {!isError && !isBusy && data && (
        <form id={FORM_ID} onSubmit={onSubmit}>
          {/* PR / SI / PO มีหมวดละ 1–2 ค่า — เดิมกินการ์ดใหญ่หมวดละใบ รวมเป็นรายการเดียว
              แล้วใช้รหัสเอกสารหน้าป้ายบอกว่าค่านั้นเป็นของเอกสารไหน
              layout เต็มความกว้างจอ หลายคอลัมน์ตามความกว้างการ์ด — skill carmen-blue-ui-design */}
          {generalSection && (
            <CompactSection
              first
              title={t(generalSection.titleKey)}
              description={t(generalSection.descKey)}
            >
              <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,15rem),1fr))] gap-x-5 gap-y-3">
                {generalSection.entries.map((entry) => (
                  <ConfigField
                    showKey={showKey}
                    key={entry.item.key}
                    editing={editing}
                    form={form}
                    index={entry.index}
                    item={entry.item}
                    label={t(entry.labelKey)}
                    description={entry.descKey ? t(entry.descKey) : undefined}
                    yesLabel={t("yes")}
                    noLabel={t("no")}
                    suffix={entry.suffix}
                  />
                ))}
              </div>
            </CompactSection>
          )}

          {/* การ์ดละเรื่อง (จัดซื้อและคลัง / มิติ / ผู้สร้างอนุมัติเอง) — เดิมรวมเป็นการ์ด "การทำงานของ
              เอกสาร" ใบเดียว 10 ค่าจาก 6 หมวด ผู้ใช้อ่านแล้วปนกัน แม้แบ่งกลุ่มด้วยหัวตัวเล็กแล้วก็ยังปน
              ค่าในการ์ดแบ่งเต็มแถวด้วย auto-fit · คอนโทรลไม่ยืดตาม (max-w ใน ConfigField) */}
          {docCards.map((card, i) => (
            <CompactSection
              key={card.id}
              first={!generalSection && i === 0}
              title={t(card.titleKey)}
              description={t(card.descKey)}
            >
              {/* การ์ดอนุมัติมี 4 สวิตช์ชื่อสั้น — auto-fit ที่ 1366 ได้ 3+1 (AR Receipt ตกบรรทัดเดียว)
                  จึงแบ่งตายตัว 4 / 2 / 1 ตามความกว้างการ์ด ไม่ให้เหลือตัวเดียวค้างแถว */}
              <div className="@container">
                <div
                  className={cn(
                    "grid gap-x-5 gap-y-3",
                    card.id === "selfApprove"
                      ? "grid-cols-1 @sm:grid-cols-2 @3xl:grid-cols-4"
                      : "grid-cols-[repeat(auto-fit,minmax(min(100%,15rem),1fr))]",
                  )}
                >
                  {card.entries.map(({ entry, section }) => (
                    <ConfigField
                      showKey={showKey}
                      key={entry.item.key}
                      editing={editing}
                      form={form}
                      index={entry.index}
                      item={entry.item}
                      code={
                        card.showCode
                          ? (entry.code ?? t(section.titleKey))
                          : undefined
                      }
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
                  ))}
                </div>
              </div>
            </CompactSection>
          ))}

          {printSection && (
            <CompactSection
              first={!generalSection && docSections.length === 0}
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
              {printShown.length > 0 && (
                <FieldGrid>
                  {printShown.map((entry) => (
                    <ConfigField
                      showKey={showKey}
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
                </FieldGrid>
              )}
              {/* โหมดดู: แบบฟอร์มที่ยังใช้ค่าระบบไม่กินช่องละใบ — 13 ช่องที่เขียนว่า "ใช้ค่าเริ่มต้น
                  ของระบบ" ซ้ำกันคือเสียงรบกวน (มือถือยาว 26 บรรทัด) รวมเป็นรายชื่อบรรทัดเดียว
                  ช่องเต็มเหลือเฉพาะใบที่ตั้งเอง · โหมดแก้ยังเห็นครบทุกใบ */}
              {!editing && printDefaults.length > 0 && (
                <div
                  className={
                    printShown.length > 0 ? "mt-3 border-t pt-3" : undefined
                  }
                >
                  <p className="text-muted-foreground text-xs">
                    {t("config.printFormSystemDefault")}
                  </p>
                  <ul className="mt-1.5 grid grid-cols-[repeat(auto-fill,minmax(min(100%,10.5rem),1fr))] gap-x-4 gap-y-1.5">
                    {printDefaults.map((entry) => (
                      <li
                        key={entry.item.key}
                        title={entry.item.key}
                        className="text-muted-foreground flex min-w-0 items-center gap-1.5 text-xs"
                      >
                        {entry.code && <ConfigCode code={entry.code} />}
                        {t(entry.labelKey)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CompactSection>
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
