import { useState } from "react";
import { useForm, Controller, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useTranslations } from "use-intl";
import { FormPageShell } from "@/components/share/form-page-shell";
import { FormToolbar } from "@/components/share/form-toolbar";
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
import type { BusinessUnitNumberFormat } from "@/types/business-unit";
import {
  SettingSection,
  SettingSectionSkeleton,
} from "@/components/ui/setting-section";
import {
  SettingField,
  EditableField,
  SelectField,
  NumberFormatField,
  VIEW_BOX_CLASS,
} from "./company-profile-ui";
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

/**
 * หน้า Company Profile (system-admin) — แสดง/แก้ไขรายละเอียด business unit ปัจจุบัน
 * (จาก `useProfile().defaultBu`) จัดเป็น section ตาม layout settings
 *
 * โหมด view = read-only, กด Edit → field กลายเป็น input (toggle ในหน้าเดียว)
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

  return (
    <FormPageShell
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
        <div>
          {/* mirror each real section's field layout so the skeleton is as tall */}
          <SettingSectionSkeleton
            first
            fields={[
              "half",
              "half",
              "half",
              "full",
              "full",
              "half",
              "half",
              "half",
              "half",
            ]}
          />
          <SettingSectionSkeleton
            fields={["full", "half", "half", "full", "half"]}
          />
          <SettingSectionSkeleton
            fields={["full", "half", "half", "half", "half", "full", "half"]}
          />
          <SettingSectionSkeleton fields={["half", "half"]} />
          <SettingSectionSkeleton
            fields={["half", "half", "half", "half", "half", "half"]}
          />
          <SettingSectionSkeleton fields={["half", "half", "half"]} />
        </div>
      )}

      {!isError && !isBusy && data && (
        <form id={FORM_ID} onSubmit={onSubmit}>
          {/* General */}
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
              fullWidth
            />
            <EditableField
              editing={editing}
              form={form}
              name="alias_name"
              label={t("fields.aliasName")}
              description={t("fields.aliasNameDesc")}
              displayValue={data.alias_name}
            />
            <SettingField
              label={t("fields.clusterName")}
              description={editing ? t("fields.clusterNameDesc") : undefined}
              value={data.cluster_name}
            />
            {/* costing method: read-only เสมอ (แก้ผ่านหน้านี้ไม่ได้)
                "Max license users" ถูกถอดออกจากหน้านี้ — ที่นั่งไม่ใช่เลขตัวเดียวบน BU อีกแล้ว แต่เป็น
                ผลรวมของใบ license ที่ยังคุ้มครองอยู่ (tb_business_unit_license → v_business_unit_seat)
                และจัดการที่ carmen-platform เท่านั้น ช่องนี้จะว่างถาวรเมื่อคอลัมน์เดิมถูกลบ จึงกลาย
                เป็นการโชว์แนวคิดที่เลิกใช้แล้วให้ผู้ใช้เปล่า ๆ
                "Max license users" is gone: seats are no longer a single number on the BU but the
                sum of the licences currently in effect, managed only in carmen-platform. The field
                would be permanently blank once the old column drops. */}
            <SettingField
              label={t("fields.calculationMethod")}
              description={
                editing ? t("fields.calculationMethodDesc") : undefined
              }
              value={
                data.calculation_method &&
                CALCULATION_METHOD_LABEL_KEYS[data.calculation_method]
                  ? tf(CALCULATION_METHOD_LABEL_KEYS[data.calculation_method])
                  : data.calculation_method
              }
            />
            <div className="min-w-0 space-y-1">
              <div className="text-foreground text-xs font-semibold">
                {t("fields.defaultCurrencyId")}
              </div>
              {editing && (
                <p className="text-muted-foreground/80 text-micro leading-snug">
                  {t("fields.defaultCurrencyIdDesc")}
                </p>
              )}
              {/* default currency: read-only เสมอเหมือน costing method — ค่าไม่เคยเปลี่ยน
                  buildPatch จึงไม่ส่งช่องนี้ไป backend */}
              <Controller
                control={form.control}
                name="default_currency_id"
                render={({ field }) => (
                  <LookupCurrency
                    value={field.value ?? ""}
                    onValueChange={field.onChange}
                    readOnly
                    // ใช้กรอบเดียวกับช่องอื่น (ค่าตั้งต้นของ FieldPlainText ไม่มีกรอบ)
                    className={VIEW_BOX_CLASS}
                  />
                )}
              />
            </div>
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

          {/* Hotel */}
          <SettingSection
            title={t("sections.hotel")}
            description={t("sections.hotelDesc")}
          >
            <EditableField
              editing={editing}
              form={form}
              name="hotel_name"
              label={t("fields.hotelName")}
              description={t("fields.hotelNameDesc")}
              displayValue={data.hotel_name}
              fullWidth
            />
            <EditableField
              editing={editing}
              form={form}
              name="hotel_email"
              label={t("fields.hotelEmail")}
              description={t("fields.hotelEmailDesc")}
              displayValue={data.hotel_email}
            />
            <EditableField
              editing={editing}
              form={form}
              name="hotel_tel"
              label={t("fields.hotelTel")}
              description={t("fields.hotelTelDesc")}
              displayValue={data.hotel_tel}
            />
            <EditableField
              editing={editing}
              form={form}
              name="hotel_address_line1"
              label={t("fields.hotelAddressLine1")}
              description={t("fields.hotelAddressLine1Desc")}
              displayValue={data.hotel_address_line1}
              maxLength={256}
              fullWidth
            />
            <EditableField
              editing={editing}
              form={form}
              name="hotel_address_line2"
              label={t("fields.hotelAddressLine2")}
              description={t("fields.hotelAddressLine2Desc")}
              displayValue={data.hotel_address_line2}
              maxLength={256}
              fullWidth
            />
            <EditableField
              editing={editing}
              form={form}
              name="hotel_sub_district"
              label={t("fields.hotelSubDistrict")}
              description={t("fields.hotelSubDistrictDesc")}
              displayValue={data.hotel_sub_district}
            />
            <EditableField
              editing={editing}
              form={form}
              name="hotel_district"
              label={t("fields.hotelDistrict")}
              description={t("fields.hotelDistrictDesc")}
              displayValue={data.hotel_district}
            />
            <EditableField
              editing={editing}
              form={form}
              name="hotel_city"
              label={t("fields.hotelCity")}
              description={t("fields.hotelCityDesc")}
              displayValue={data.hotel_city}
            />
            <EditableField
              editing={editing}
              form={form}
              name="hotel_province"
              label={t("fields.hotelProvince")}
              description={t("fields.hotelProvinceDesc")}
              displayValue={data.hotel_province}
            />
            <EditableField
              editing={editing}
              form={form}
              name="hotel_postal_code"
              label={t("fields.hotelPostalCode")}
              description={t("fields.hotelPostalCodeDesc")}
              displayValue={data.hotel_postal_code}
            />
            <EditableField
              editing={editing}
              form={form}
              name="hotel_country"
              label={t("fields.hotelCountry")}
              description={t("fields.hotelCountryDesc")}
              displayValue={data.hotel_country}
            />
          </SettingSection>

          {/* Company */}
          <SettingSection
            title={t("sections.company")}
            description={t("sections.companyDesc")}
          >
            <EditableField
              editing={editing}
              form={form}
              name="company_name"
              label={t("fields.companyName")}
              description={t("fields.companyNameDesc")}
              displayValue={data.company_name}
              fullWidth
            />
            <EditableField
              editing={editing}
              form={form}
              name="branch_no"
              label={t("fields.branchNo")}
              description={t("fields.branchNoDesc")}
              displayValue={data.branch_no}
            />
            <EditableField
              editing={editing}
              form={form}
              name="tax_no"
              label={t("fields.taxNo")}
              description={t("fields.taxNoDesc")}
              displayValue={data.tax_no}
            />
            <EditableField
              editing={editing}
              form={form}
              name="company_email"
              label={t("fields.companyEmail")}
              description={t("fields.companyEmailDesc")}
              displayValue={data.company_email}
            />
            <EditableField
              editing={editing}
              form={form}
              name="company_tel"
              label={t("fields.companyTel")}
              description={t("fields.companyTelDesc")}
              displayValue={data.company_tel}
            />
            <EditableField
              editing={editing}
              form={form}
              name="company_address_line1"
              label={t("fields.companyAddressLine1")}
              description={t("fields.companyAddressLine1Desc")}
              displayValue={data.company_address_line1}
              maxLength={256}
              fullWidth
            />
            <EditableField
              editing={editing}
              form={form}
              name="company_address_line2"
              label={t("fields.companyAddressLine2")}
              description={t("fields.companyAddressLine2Desc")}
              displayValue={data.company_address_line2}
              maxLength={256}
              fullWidth
            />
            <EditableField
              editing={editing}
              form={form}
              name="company_sub_district"
              label={t("fields.companySubDistrict")}
              description={t("fields.companySubDistrictDesc")}
              displayValue={data.company_sub_district}
            />
            <EditableField
              editing={editing}
              form={form}
              name="company_district"
              label={t("fields.companyDistrict")}
              description={t("fields.companyDistrictDesc")}
              displayValue={data.company_district}
            />
            <EditableField
              editing={editing}
              form={form}
              name="company_city"
              label={t("fields.companyCity")}
              description={t("fields.companyCityDesc")}
              displayValue={data.company_city}
            />
            <EditableField
              editing={editing}
              form={form}
              name="company_province"
              label={t("fields.companyProvince")}
              description={t("fields.companyProvinceDesc")}
              displayValue={data.company_province}
            />
            <EditableField
              editing={editing}
              form={form}
              name="company_postal_code"
              label={t("fields.companyPostalCode")}
              description={t("fields.companyPostalCodeDesc")}
              displayValue={data.company_postal_code}
            />
            <EditableField
              editing={editing}
              form={form}
              name="company_country"
              label={t("fields.companyCountry")}
              description={t("fields.companyCountryDesc")}
              displayValue={data.company_country}
            />
          </SettingSection>

          {/* Branding (read-only — upload flow อยู่ที่หน้า profile) */}
          <SettingSection
            title={t("sections.branding")}
            description={t("sections.brandingDesc")}
          >
            <SettingField
              label={t("fields.logo")}
              description={t("fields.logoDesc")}
            >
              <BrandImage url={data.logo?.url} shape="landscape" />
            </SettingField>
            <SettingField
              label={t("fields.avatar")}
              description={t("fields.avatarDesc")}
            >
              <BrandImage url={data.avatar?.url} shape="round" />
            </SettingField>
          </SettingSection>

          {/* Date & Time */}
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

          {/* Number Formats */}
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

function BrandImage({
  url,
  shape,
}: {
  readonly url: string | undefined;
  readonly shape: "landscape" | "round";
}) {
  const t = useTranslations("companyProfile");
  const box =
    shape === "landscape" ? "h-16 w-32 rounded-md" : "size-16 rounded-full";
  const fit = shape === "landscape" ? "object-contain" : "object-cover";
  return (
    <div
      className={`bg-muted/50 relative flex items-center justify-center overflow-hidden border ${box}`}
    >
      {url ? (
        <img
          src={url}
          alt=""
          className={`absolute inset-0 size-full ${fit}`}
          loading="lazy"
        />
      ) : (
        <span className="text-muted-foreground/60 text-micro-legal">
          {t("noImage")}
        </span>
      )}
    </div>
  );
}
