import { useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CopyPlus } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";
import { cn } from "@/lib/utils";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  EditableField,
  SelectField,
  NumberFormatField,
} from "./company-profile-ui";
import { IdentityCard, IdentityCardSkeleton } from "./company-profile-identity";
import { AddressView, type AddressParts } from "./company-profile-address";
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
  toPatchPayload,
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

/**
 * หน้านี้เป็นฟอร์มเต็มความกว้างจอ — ไม่มีเพดานความกว้างและไม่มีคอลัมน์หัวข้อเปล่า ๆ
 * ด้านซ้าย พื้นที่ที่ได้เพิ่มเมื่อจอกว้างขึ้นถูกใช้สองทาง:
 *
 * 1. section ที่เป็นคู่กัน (โรงแรม|บริษัท, วันเวลา|ตัวเลข) วางเคียงกันตั้งแต่ Full HD
 *    ขึ้นไป (`SECTION_PAIR`) — ต่ำกว่านั้นเรียงลงมาเต็มความกว้าง
 * 2. จำนวนคอลัมน์ของช่องกรอกโตตาม **ความกว้างของการ์ดเอง** (container query ใน
 *    `FieldGrid`) ไม่ใช่ของจอ — การ์ดครึ่งจอกับการ์ดเต็มจอจึงใช้กฎเดียวกันได้ และ
 *    พับ/กาง sidebar แล้วยังถูก
 *
 * ผลต่อขนาดจอ (sidebar กาง): mobile 1 คอลัมน์ · tablet 2 · 1366 3 · Full HD
 * การ์ดเต็ม 6 / การ์ดคู่ 3 · 4K การ์ดเต็มและการ์ดคู่ 6
 */
const SECTION_PAIR =
  "min-[1700px]:grid min-[1700px]:grid-cols-2 min-[1700px]:items-start min-[1700px]:gap-x-5";

function FieldGrid({ children }: { readonly children: React.ReactNode }) {
  return (
    <div className="@container">
      <div className="grid gap-x-5 gap-y-3 @md:grid-cols-2 @3xl:grid-cols-3 @5xl:grid-cols-4 @min-[96rem]:grid-cols-6">
        {children}
      </div>
    </div>
  );
}

/**
 * section แบบกะทัดรัดของหน้านี้ — หัวข้อกับคำอธิบายอยู่บรรทัดเดียวกัน การ์ด padding 16px
 * ระยะระหว่าง section 20px ไม่มีเส้นคั่น (ขอบการ์ดแยก section ให้อยู่แล้ว)
 *
 * ไม่ใช้ `SettingSection` กลาง: ตัวนั้นเว้น 32px + เส้น + 32px ระหว่าง section และ
 * padding 24px ซึ่งเหมาะกับฟอร์มยาวคอลัมน์เดียว แต่หน้านี้เรียงช่องหลายคอลัมน์จนแต่ละ
 * section เหลือ 1–3 แถว ระยะห่างจึงกินที่มากกว่าเนื้อหา
 */
function Section({
  title,
  description,
  action,
  first,
  children,
}: {
  readonly title: string;
  readonly description?: string;
  readonly action?: React.ReactNode;
  readonly first?: boolean;
  readonly children: React.ReactNode;
}) {
  return (
    <section className={cn(!first && "mt-5")}>
      <div className="mb-2 flex min-h-7 flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-2">
          <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
          {description && (
            <p className="text-muted-foreground text-xs">{description}</p>
          )}
        </div>
        {action}
      </div>
      <div className="bg-card rounded-xl border p-4 shadow-sm">{children}</div>
    </section>
  );
}

/** โครงรอโหลดของหนึ่ง section — หัวข้อ + การ์ดเต็มความกว้าง */
function SectionSkeleton({
  className,
  first,
}: {
  readonly className: string;
  readonly first?: boolean;
}) {
  return (
    <div className={cn("space-y-2", !first && "mt-5")}>
      <Skeleton className="h-5 w-32" />
      <Skeleton className={cn("w-full rounded-xl", className)} />
    </div>
  );
}

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
 * ที่แก้ได้ เต็มความกว้างจอ (ไม่มีเมนูข้าม section — ถอดออกตามคำขอ 2026-11-12
 * หน้าสั้นลงจนไม่ต้องใช้แล้วเมื่อช่องเรียงหลายคอลัมน์) ที่อยู่โรงแรม/บริษัทในโหมดดู
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

  /**
   * ไม่ส่ง description ให้ช่องที่อยู่/ชื่อ — ข้อความพวกนั้นแค่ทวนป้าย ("Hotel Email:
   * Contact email of the hotel") แต่กินความสูงเพิ่มหนึ่งบรรทัดต่อช่อง × 22 ช่อง
   * ช่องที่คำอธิบายบอกอะไรเพิ่มจริง (เลขภาษี/สาขา, รูปแบบวันที่/ตัวเลข) ยังมีอยู่
   */
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
        // โครงเดียวกับตอนโหลดเสร็จ (การ์ดเต็มความกว้าง) ไม่ให้เนื้อหากระโดดตอนข้อมูลมา
        <div className="space-y-5">
          <IdentityCardSkeleton />
          <SectionSkeleton first className="h-16" />
          <div className={SECTION_PAIR}>
            <SectionSkeleton className="h-28" />
            <SectionSkeleton className="h-28" />
          </div>
          <div className={SECTION_PAIR}>
            <SectionSkeleton className="h-28" />
            <SectionSkeleton className="h-28" />
          </div>
        </div>
      )}

      {!isError && !isBusy && data && (
        <div className="min-w-0 space-y-5">
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
                    ? tf(CALCULATION_METHOD_LABEL_KEYS[data.calculation_method])
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
            <div>
              <Section
                first
                title={t("sections.general")}
                description={t("sections.generalDesc")}
              >
                <FieldGrid>
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
                </FieldGrid>
              </Section>
            </div>

            <div className={SECTION_PAIR}>
              {/* Hotel */}
              <div>
                <Section
                  title={t("sections.hotel")}
                  description={t("sections.hotelDesc")}
                >
                  {editing ? (
                    <FieldGrid>
                      <EditableField
                        editing
                        form={form}
                        name="hotel_name"
                        label={t("fields.hotelName")}
                        fullWidth
                      />
                      {addressFields("hotel")}
                    </FieldGrid>
                  ) : (
                    <AddressView address={addressOf(data, "hotel")} />
                  )}
                </Section>
              </div>

              {/* Company — ข้อมูลที่ไปขึ้นหัวเอกสาร/ใบกำกับ */}
              <div>
                <Section
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
                    <FieldGrid>
                      <EditableField
                        editing
                        form={form}
                        name="company_name"
                        label={t("fields.companyName")}
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
                    </FieldGrid>
                  ) : (
                    <AddressView
                      printed
                      address={addressOf(data, "company")}
                      legal={[
                        { label: t("fields.taxNo"), value: data.tax_no },
                        {
                          label: t("fields.branchNo"),
                          value: data.branch_no,
                        },
                      ]}
                    />
                  )}
                </Section>
              </div>
            </div>

            <div className={SECTION_PAIR}>
              {/* Date & Time */}
              <div>
                <Section
                  title={t("sections.dateTime")}
                  description={t("sections.dateTimeDesc")}
                >
                  <FieldGrid>
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
                  </FieldGrid>
                </Section>
              </div>

              {/* Number Formats */}
              <div>
                <Section
                  title={t("sections.numberFormats")}
                  description={t("sections.numberFormatsDesc")}
                >
                  <FieldGrid>
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
                  </FieldGrid>
                </Section>
              </div>
            </div>
          </form>
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
