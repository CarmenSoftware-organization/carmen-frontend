import { useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CopyPlus } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";
import { FormPageShell } from "@/components/share/form-page-shell";
import { FormToolbar } from "@/components/share/form-toolbar";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { LookupCurrency } from "@/components/lookup/lookup-currency";
import { DiscardDialog } from "@/components/ui/discard-dialog";
import { useProfile } from "@/hooks/use-profile";
import { useDiscardConfirm } from "@/hooks/use-discard-confirm";
import { useNavigationGuard } from "@/hooks/use-navigation-guard";
import {
  useBusinessUnit,
  useUpdateBusinessUnit,
} from "@/hooks/use-business-unit";
import type {
  BusinessUnitDetail,
  BusinessUnitNumberFormat,
} from "@/types/business-unit";
import {
  SettingSection,
  SettingSectionSkeleton,
} from "@/components/ui/setting-section";
import {
  EditableField,
  SelectField,
  NumberFormatField,
} from "./company-profile-ui";
import { IdentityCard, IdentityCardSkeleton } from "./company-profile-identity";
import { AddressView, type AddressParts } from "./company-profile-address";
import { SectionNav } from "./company-profile-nav";
import {
  TIMEZONES,
  DATE_FORMATS,
  DATE_TIME_FORMATS,
  TIME_FORMATS,
  SHORT_TIME_FORMATS,
  LONG_TIME_FORMATS,
  LOCALES,
} from "./company-profile-options";
import {
  createBusinessSettingSchema,
  toFormValues,
  buildPatch,
  type BusinessSettingFormValues,
} from "./company-profile-form-schema";
import {
  datePatternExample,
  timezoneExample,
  numberExample,
} from "./company-profile-examples";

const FORM_ID = "company-profile-form";

/**
 * i18n key (relative to `companyProfile.fields`) ของแต่ละค่า `calculation_method`
 * ที่รู้จัก — ใช้แปลค่าดิบจาก backend เป็น label ที่แปลแล้วในหน้า view-only
 * ค่าที่ไม่อยู่ใน map นี้ (unknown/ว่าง) จะ fallback ไปแสดงค่าดิบแทน
 *
 * i18n key (relative to `companyProfile.fields`) for each known
 * `calculation_method` value — translates the raw backend value into a
 * localized label on the read-only view. A value not in this map (unknown/
 * empty) falls back to showing the raw value.
 */
const CALCULATION_METHOD_LABEL_KEYS: Readonly<Record<string, string>> = {
  average: "calculationMethodOptions.average",
  fifo: "calculationMethodOptions.fifo",
  average_per_location: "calculationMethodOptions.averagePerLocation",
};

/** id ของ section (anchor ของ SectionNav) */
const SECTION_IDS = {
  general: "cp-general",
  hotel: "cp-hotel",
  company: "cp-company",
  dateTime: "cp-date-time",
  numberFormats: "cp-number-formats",
} as const;

/** ช่องที่อยู่/ติดต่อที่ "คัดลอกจากโรงแรม" เขียนทับให้ฝั่งบริษัท (ไม่รวมชื่อ — ชื่อนิติบุคคลคนละชื่อกับโรงแรม) */
const COPYABLE_ADDRESS_SUFFIXES = [
  "address_line1",
  "address_line2",
  "sub_district",
  "district",
  "city",
  "province",
  "postal_code",
  "country",
  "email",
  "tel",
] as const;

type AddressPrefix = "hotel" | "company";

function addressOf(
  data: BusinessUnitDetail,
  prefix: AddressPrefix,
): AddressParts {
  return {
    name: data[`${prefix}_name`],
    line1: data[`${prefix}_address_line1`],
    line2: data[`${prefix}_address_line2`],
    subDistrict: data[`${prefix}_sub_district`],
    district: data[`${prefix}_district`],
    city: data[`${prefix}_city`],
    province: data[`${prefix}_province`],
    postalCode: data[`${prefix}_postal_code`],
    country: data[`${prefix}_country`],
    email: data[`${prefix}_email`],
    tel: data[`${prefix}_tel`],
  };
}

/**
 * หน้า Company Profile (system-admin) — แสดง/แก้ไขรายละเอียด business unit ปัจจุบัน
 * (จาก `useProfile().defaultBu`)
 *
 * โครงหน้า: การ์ดตัวตน (โลโก้ · ชื่อ · ค่าที่ล็อก) อยู่บนสุด แล้วตามด้วย section
 * ที่แก้ได้ เมนูข้าม section อยู่ด้านซ้ายบนจอกว้าง ที่อยู่โรงแรม/บริษัทในโหมดดู
 * จัดเป็นบล็อกแบบหัวจดหมาย กด Edit แล้วค่อยแตกเป็นช่องกรอก
 *
 * Save ส่งเฉพาะ field ที่เปลี่ยน (`PATCH` partial). ดึงข้อมูลจาก
 * `GET api/business-units` — แสดงทุก field ยกเว้น `users[]`
 *
 * @returns React element ของหน้า company profile
 */

export default function CompanyProfileComponent() {
  const tm = useTranslations("modules");
  const t = useTranslations("companyProfile");
  const tv = useTranslations("validation");
  const tf = useTranslations("companyProfile.fields");
  const { defaultBu, isProfileReady } = useProfile();
  const buId = defaultBu?.id;
  const { data, isLoading, isError, refetch } = useBusinessUnit(buId);
  const update = useUpdateBusinessUnit(buId);
  const [editing, setEditing] = useState(false);
  // เวลาอ้างอิงของตัวอย่างวันที่/เวลา — จับครั้งเดียวต่อการเปิดหน้า ไม่ให้ตัวอย่าง
  // ขยับเองระหว่างอ่าน
  const [now] = useState(() => new Date());
  const dateExample = (pattern: string) => datePatternExample(pattern, now);

  const form = useForm<BusinessSettingFormValues>({
    resolver: zodResolver(
      createBusinessSettingSchema(tv, tf),
    ) as Resolver<BusinessSettingFormValues>,
    values: data ? toFormValues(data) : undefined,
  });

  const fmtNumber = (f: BusinessUnitNumberFormat | null | undefined) =>
    f
      ? `${f.locales} · ${t("minDigits", { n: f.minimumIntegerDigits })}`
      : null;

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

  // กด Cancel ตอนมีการแก้ค้าง → confirm ก่อน (ผ่าน useDiscardConfirm)
  const handleCancel = () => discard.confirm(exitEdit);

  // ที่อยู่บริษัทมักเป็นที่เดียวกับโรงแรม — คัดลอกค่าที่กรอกอยู่ (ไม่ใช่ค่าที่บันทึกแล้ว)
  const copyHotelAddress = () => {
    for (const suffix of COPYABLE_ADDRESS_SUFFIXES) {
      form.setValue(`company_${suffix}`, form.getValues(`hotel_${suffix}`), {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
  };

  const onSubmit = form.handleSubmit((values) => {
    if (!data) return;
    const patch = buildPatch(values, toFormValues(data));
    if (Object.keys(patch).length === 0) {
      setEditing(false);
      return;
    }
    // แนบ doc_version (optimistic lock) ไปกับ payload เพื่อกัน 409 version ค้าง
    update.mutate(
      { ...patch, doc_version: data.doc_version },
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

  const sections = [
    { id: SECTION_IDS.general, title: t("sections.general") },
    { id: SECTION_IDS.hotel, title: t("sections.hotel") },
    { id: SECTION_IDS.company, title: t("sections.company") },
    { id: SECTION_IDS.dateTime, title: t("sections.dateTime") },
    { id: SECTION_IDS.numberFormats, title: t("sections.numberFormats") },
  ];

  /** ช่องกรอกที่อยู่/ติดต่อของ hotel หรือ company — ลำดับและความกว้างเดียวกันทั้งสองชุด */
  const addressFields = (prefix: AddressPrefix) => {
    const cap = prefix === "hotel" ? "hotel" : "company";
    const field = (
      suffix: string,
      key: string,
      opts?: { fullWidth?: boolean; maxLength?: number },
    ) => (
      <EditableField
        editing
        form={form}
        name={`${prefix}_${suffix}` as keyof BusinessSettingFormValues}
        label={t(`fields.${cap}${key}`)}
        description={t(`fields.${cap}${key}Desc`)}
        {...opts}
      />
    );
    return (
      <>
        {field("email", "Email")}
        {field("tel", "Tel")}
        {field("address_line1", "AddressLine1", {
          fullWidth: true,
          maxLength: 256,
        })}
        {field("address_line2", "AddressLine2", {
          fullWidth: true,
          maxLength: 256,
        })}
        {field("sub_district", "SubDistrict")}
        {field("district", "District")}
        {field("city", "City")}
        {field("province", "Province")}
        {field("postal_code", "PostalCode")}
        {field("country", "Country")}
      </>
    );
  };

  return (
    <FormPageShell
      width="wide"
      header={
        <FormToolbar
          mode={editing ? "edit" : "view"}
          formId={FORM_ID}
          isPending={update.isPending}
          title={tm("companyProfile")}
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
        <div className="space-y-8">
          <IdentityCardSkeleton />
          {/* mirror each real section's field layout so the skeleton is as tall */}
          <div>
            <SettingSectionSkeleton
              first
              fields={["full", "half", "half", "tall", "full"]}
            />
            <SettingSectionSkeleton fields={["tall"]} />
            <SettingSectionSkeleton fields={["tall"]} />
            <SettingSectionSkeleton
              fields={["half", "half", "half", "half", "half", "half"]}
            />
            <SettingSectionSkeleton fields={["half", "half", "half"]} />
          </div>
        </div>
      )}

      {!isError && !isBusy && data && (
        <div className="lg:grid lg:grid-cols-[10rem_minmax(0,1fr)] lg:gap-10">
          <SectionNav sections={sections} label={t("sectionNav")} />

          <div className="min-w-0 space-y-8">
            <IdentityCard
              name={data.name}
              alias={data.alias_name}
              logoUrl={data.logo?.url}
              avatarUrl={data.avatar?.url}
              facts={[
                { label: t("fields.clusterName"), value: data.cluster_name },
                {
                  label: t("fields.calculationMethod"),
                  value:
                    data.calculation_method &&
                    CALCULATION_METHOD_LABEL_KEYS[data.calculation_method]
                      ? tf(
                          CALCULATION_METHOD_LABEL_KEYS[
                            data.calculation_method
                          ],
                        )
                      : data.calculation_method,
                },
                {
                  // default currency: read-only เสมอ — ไม่อยู่ในฟอร์ม buildPatch จึงไม่ส่งไป backend
                  label: t("fields.defaultCurrencyId"),
                  value: data.default_currency_id ? (
                    <LookupCurrency
                      value={data.default_currency_id}
                      onValueChange={() => {}}
                      readOnly
                      className="min-h-0 p-0 text-sm font-medium"
                    />
                  ) : null,
                },
              ]}
            />

            <form id={FORM_ID} onSubmit={onSubmit}>
              {/* General — costing method / currency / business group ย้ายไปการ์ดตัวตน (ล็อก)
                  "Max license users" ถูกถอดออกจากหน้านี้ — ที่นั่งไม่ใช่เลขตัวเดียวบน BU อีกแล้ว แต่เป็น
                  ผลรวมของใบ license ที่ยังคุ้มครองอยู่ (tb_business_unit_license → v_business_unit_seat)
                  และจัดการที่ carmen-backstage เท่านั้น
                  "Max license users" is gone: seats are no longer a single number on the BU but the
                  sum of the licences currently in effect, managed only in carmen-backstage. */}
              <div id={SECTION_IDS.general}>
                <SettingSection
                  first
                  title={t("sections.general")}
                  description={t("sections.generalDesc")}
                >
                  <EditableField
                    editing={editing}
                    form={form}
                    name="name"
                    label={t("fields.name")}
                    description={t("fields.nameDesc")}
                    displayValue={data.name}
                  />
                  <EditableField
                    editing={editing}
                    form={form}
                    name="alias_name"
                    label={t("fields.aliasName")}
                    description={t("fields.aliasNameDesc")}
                    displayValue={data.alias_name}
                  />
                  <EditableField
                    editing={editing}
                    form={form}
                    name="description"
                    type="textarea"
                    label={t("fields.description")}
                    description={t("fields.descriptionDesc")}
                    displayValue={data.description}
                    fullWidth
                  />
                  <EditableField
                    editing={editing}
                    form={form}
                    name="info"
                    label={t("fields.info")}
                    description={t("fields.infoDesc")}
                    displayValue={data.info}
                    maxLength={256}
                    fullWidth
                  />
                </SettingSection>
              </div>

              {/* Hotel */}
              <div id={SECTION_IDS.hotel}>
                <SettingSection
                  title={t("sections.hotel")}
                  description={t("sections.hotelDesc")}
                >
                  {editing ? (
                    <>
                      <EditableField
                        editing
                        form={form}
                        name="hotel_name"
                        label={t("fields.hotelName")}
                        description={t("fields.hotelNameDesc")}
                        fullWidth
                      />
                      {addressFields("hotel")}
                    </>
                  ) : (
                    <AddressView address={addressOf(data, "hotel")} />
                  )}
                </SettingSection>
              </div>

              {/* Company — ข้อมูลที่ไปขึ้นหัวเอกสาร/ใบกำกับ */}
              <div id={SECTION_IDS.company}>
                <SettingSection
                  title={t("sections.company")}
                  description={t("sections.companyDesc")}
                  action={
                    editing ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={copyHotelAddress}
                      >
                        <CopyPlus aria-hidden />
                        {t("address.copyFromHotel")}
                      </Button>
                    ) : undefined
                  }
                >
                  {editing ? (
                    <>
                      <EditableField
                        editing
                        form={form}
                        name="company_name"
                        label={t("fields.companyName")}
                        description={t("fields.companyNameDesc")}
                        fullWidth
                      />
                      <EditableField
                        editing
                        form={form}
                        name="tax_no"
                        label={t("fields.taxNo")}
                        description={t("fields.taxNoDesc")}
                      />
                      <EditableField
                        editing
                        form={form}
                        name="branch_no"
                        label={t("fields.branchNo")}
                        description={t("fields.branchNoDesc")}
                      />
                      {addressFields("company")}
                    </>
                  ) : (
                    <AddressView
                      printed
                      address={addressOf(data, "company")}
                      legal={[
                        { label: t("fields.taxNo"), value: data.tax_no },
                        { label: t("fields.branchNo"), value: data.branch_no },
                      ]}
                    />
                  )}
                </SettingSection>
              </div>

              {/* Date & Time */}
              <div id={SECTION_IDS.dateTime}>
                <SettingSection
                  title={t("sections.dateTime")}
                  description={t("sections.dateTimeDesc")}
                >
                  <SelectField
                    editing={editing}
                    form={form}
                    name="timezone"
                    options={TIMEZONES}
                    label={t("fields.timezone")}
                    description={t("fields.timezoneDesc")}
                    placeholder={t("fields.timezone")}
                    displayValue={data.timezone}
                    exampleOf={(tz) => timezoneExample(tz, now)}
                  />
                  <SelectField
                    editing={editing}
                    form={form}
                    name="date_format"
                    options={DATE_FORMATS}
                    label={t("fields.dateFormat")}
                    description={t("fields.dateFormatDesc")}
                    placeholder={t("fields.dateFormat")}
                    displayValue={data.date_format}
                    exampleOf={dateExample}
                    mono
                  />
                  <SelectField
                    editing={editing}
                    form={form}
                    name="date_time_format"
                    options={DATE_TIME_FORMATS}
                    label={t("fields.dateTimeFormat")}
                    description={t("fields.dateTimeFormatDesc")}
                    placeholder={t("fields.dateTimeFormat")}
                    displayValue={data.date_time_format}
                    exampleOf={dateExample}
                    mono
                  />
                  <SelectField
                    editing={editing}
                    form={form}
                    name="time_format"
                    options={TIME_FORMATS}
                    label={t("fields.timeFormat")}
                    description={t("fields.timeFormatDesc")}
                    placeholder={t("fields.timeFormat")}
                    displayValue={data.time_format}
                    exampleOf={dateExample}
                    mono
                  />
                  <SelectField
                    editing={editing}
                    form={form}
                    name="short_time_format"
                    options={SHORT_TIME_FORMATS}
                    label={t("fields.shortTimeFormat")}
                    description={t("fields.shortTimeFormatDesc")}
                    placeholder={t("fields.shortTimeFormat")}
                    displayValue={data.short_time_format}
                    exampleOf={dateExample}
                    mono
                  />
                  <SelectField
                    editing={editing}
                    form={form}
                    name="long_time_format"
                    options={LONG_TIME_FORMATS}
                    label={t("fields.longTimeFormat")}
                    description={t("fields.longTimeFormatDesc")}
                    placeholder={t("fields.longTimeFormat")}
                    displayValue={data.long_time_format}
                    exampleOf={dateExample}
                    mono
                  />
                </SettingSection>
              </div>

              {/* Number Formats */}
              <div id={SECTION_IDS.numberFormats}>
                <SettingSection
                  title={t("sections.numberFormats")}
                  description={t("sections.numberFormatsDesc")}
                >
                  <NumberFormatField
                    editing={editing}
                    form={form}
                    name="amount_format"
                    label={t("fields.amountFormat")}
                    description={t("fields.amountFormatDesc")}
                    // จำนวนเงินใช้แค่ locale — ดู formatAmount ใน lib/currency-utils.ts
                    displayValue={data.amount_format?.locales ?? null}
                    localeOptions={LOCALES}
                    localesPlaceholder={t("fields.locales")}
                    digitsPlaceholder={t("fields.minimumIntegerDigits")}
                    showDigits={false}
                    // 2 ตำแหน่งตาม formatAmount
                    example={numberExample(data.amount_format?.locales, 2)}
                  />
                  <NumberFormatField
                    editing={editing}
                    form={form}
                    name="quantity_format"
                    label={t("fields.quantityFormat")}
                    description={t("fields.quantityFormatDesc")}
                    displayValue={fmtNumber(data.quantity_format)}
                    // ทศนิยมจริงมาจาก decimal_place ของหน่วย — 2 คือ fallback ของ
                    // useQuantityFormatter ไม่ใช่ค่าจากช่องนี้
                    example={numberExample(data.quantity_format?.locales, 2)}
                    localeOptions={LOCALES}
                    localesPlaceholder={t("fields.locales")}
                    digitsPlaceholder={t("fields.minimumIntegerDigits")}
                  />
                  <NumberFormatField
                    editing={editing}
                    form={form}
                    name="recipe_format"
                    label={t("fields.recipeFormat")}
                    description={t("fields.recipeFormatDesc")}
                    displayValue={fmtNumber(data.recipe_format)}
                    // useRecipeFormatter ใช้ minimumIntegerDigits เป็นจำนวนทศนิยม
                    example={numberExample(
                      data.recipe_format?.locales,
                      data.recipe_format?.minimumIntegerDigits ?? 5,
                    )}
                    localeOptions={LOCALES}
                    localesPlaceholder={t("fields.locales")}
                    digitsPlaceholder={t("fields.minimumIntegerDigits")}
                  />
                </SettingSection>
              </div>
            </form>
          </div>
        </div>
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
