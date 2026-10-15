import { useTranslations } from "use-intl";
import { Controller, useForm, useWatch, type Control } from "react-hook-form";
import { SettingSection } from "@/components/ui/setting-section";
import {
  Field,
  FieldLabel,
  FieldError,
  FieldDatePicker,
  FieldPlainText,
} from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { LookupUserLocation } from "@/components/lookup/lookup-user-location";
import { useAdjustmentType } from "@/hooks/use-adjustment-type";
import { useEntitiesByIds } from "@/hooks/use-entities-by-ids";
import { INVENTORY_TYPE } from "@/constant/location";
import { formatDate } from "@/lib/date-utils";
import type { ADJUSTMENT_TYPE, AdjustmentType } from "@/types/adjustment-type";
import type { InventoryAdjustment } from "@/types/inventory-adjustment";
import { latestIssuableDate, type AdjFormValues } from "./ia-form-schema";
import { LookupAdjustmentType } from "./lookup-adjustment-type";

interface DocumentInfoProps {
  readonly form: ReturnType<typeof useForm<AdjFormValues>>;
  readonly isView: boolean;
  readonly isDisabled: boolean;
  readonly adjustmentKind: ADJUSTMENT_TYPE;
  readonly inventoryAdjustment?: InventoryAdjustment;
  readonly currentPeriodStart?: string;
  readonly currentPeriodEnd?: string;
  readonly dateFormat: string;
  readonly t: ReturnType<typeof useTranslations>;
  readonly tc: ReturnType<typeof useTranslations>;
  readonly tfl: ReturnType<typeof useTranslations>;
}

export function DocumentInfo({
  form,
  isView,
  isDisabled,
  adjustmentKind,
  inventoryAdjustment,
  currentPeriodStart,
  currentPeriodEnd,
  dateFormat,
  t,
  tc,
  tfl,
}: DocumentInfoProps) {
  // section แบบเดียวกับ price-list / company-profile: ไม่มี Card — หัวข้อ+คำอธิบาย
  // อยู่คอลัมน์ซ้าย field อยู่ขวา คั่น section ด้วยเส้นบน (SettingSection จัดให้)
  // label ใน view mode ไม่ต้องใส่ text-muted-foreground/font-normal เอง — Field
  // หุบให้อัตโนมัติเมื่อลูกเป็น FieldPlainText
  return (
    <SettingSection
      first
      title={t("docInfo")}
      description={t("docInfoDesc")}
      plain={isView}
    >
      {/* โหมดดู: 4 ช่องอ่านอย่างเดียวจบในแถวเดียวบนจอกว้าง (หน้า wide การ์ดยาวพอ ~200px/ช่อง)
          ลงมา 2 คอลัมน์บนจอแคบ · โหมดแก้ไขใช้ grid 2 คอลัมน์ของ SettingSection ตามเดิม
          เพราะ lookup/textarea ต้องการความกว้าง */}
      <DocInfoGrid isView={isView}>
        <Field>
          <FieldLabel required={!isView}>{tfl("date")}</FieldLabel>
          {isView ? (
            <PlainDateValue control={form.control} dateFormat={dateFormat} />
          ) : (
            <Controller
              control={form.control}
              name="date"
              render={({ field }) => (
                <FieldDatePicker
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={isDisabled}
                  placeholder={tc("selectDate")}
                  className="w-full text-xs"
                  fromDate={
                    currentPeriodStart
                      ? new Date(currentPeriodStart)
                      : undefined
                  }
                  // ไม่เกินวันนี้ และไม่เกินท้ายงวด — ใบรับ/จ่ายลงวันที่อนาคตไม่ได้
                  toDate={latestIssuableDate(currentPeriodEnd)}
                  error={form.formState.errors.date?.message}
                />
              )}
            />
          )}
        </Field>

        <Field>
          <FieldLabel required={!isView}>{tfl("reason")}</FieldLabel>
          {isView ? (
            <PlainReasonValue
              control={form.control}
              fallback={
                // ก้อนของ endpoint รายละเอียดมีแค่ id+code (ไม่มี name) ต่างจาก list
                inventoryAdjustment?.adjustment_type?.name ??
                inventoryAdjustment?.adjustment_type?.code ??
                inventoryAdjustment?.adjustment_type_name
              }
            />
          ) : (
            <Controller
              control={form.control}
              name="adjustment_type_id"
              render={({ field }) => (
                <LookupAdjustmentType
                  value={field.value ?? ""}
                  onValueChange={field.onChange}
                  kind={adjustmentKind}
                  disabled={isDisabled}
                  className="w-full text-xs"
                  error={form.formState.errors.adjustment_type_id?.message}
                />
              )}
            />
          )}
        </Field>

        {/* โหมดดู: Location ครึ่งแถวคู่กับ Description — ข้อมูลอ่านอย่างเดียว 4 ช่องจบใน 2 แถว
          ไม่ต้องกินเต็มแถว · โหมดแก้ไขยังเต็มแถวเพราะ lookup ต้องการความกว้าง */}
        <Field className={isView ? "min-w-0" : "sm:col-span-2"}>
          <FieldLabel required={!isView}>{tfl("location")}</FieldLabel>
          {isView ? (
            <FieldPlainText>
              {inventoryAdjustment?.location?.name ??
                inventoryAdjustment?.location_name}
            </FieldPlainText>
          ) : (
            <Controller
              control={form.control}
              name="location_id"
              render={({ field }) => (
                <LookupUserLocation
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={isDisabled}
                  className="text-xs"
                  locationTypes={[
                    INVENTORY_TYPE.INVENTORY,
                    INVENTORY_TYPE.CONSIGNMENT,
                  ]}
                  defaultLabel={
                    inventoryAdjustment?.location?.name ??
                    inventoryAdjustment?.location_name
                  }
                  error={form.formState.errors.location_id?.message}
                  lazy
                />
              )}
            />
          )}
        </Field>

        <Field className={isView ? "min-w-0" : "sm:col-span-2"}>
          <FieldLabel htmlFor="inv-adj-description">
            {tfl("description")}
          </FieldLabel>
          {isView ? (
            <PlainDescriptionValue control={form.control} />
          ) : (
            <>
              <Textarea
                id="inv-adj-description"
                placeholder={tfl("optional")}
                className="text-xs"
                disabled={isDisabled}
                maxLength={256}
                aria-invalid={!!form.formState.errors.description}
                {...form.register("description")}
              />
              {form.formState.errors.description?.message && (
                <FieldError>
                  {form.formState.errors.description.message}
                </FieldError>
              )}
            </>
          )}
        </Field>
      </DocInfoGrid>
    </SettingSection>
  );
}

function DocInfoGrid({
  isView,
  children,
}: {
  readonly isView: boolean;
  readonly children: React.ReactNode;
}) {
  if (!isView) return <>{children}</>;
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">{children}</div>
  );
}

function PlainDateValue({
  control,
  dateFormat,
}: {
  readonly control: Control<AdjFormValues>;
  readonly dateFormat: string;
}) {
  const date = useWatch({ control, name: "date" });
  return (
    <FieldPlainText>{date ? formatDate(date, dateFormat) : ""}</FieldPlainText>
  );
}

function PlainReasonValue({
  control,
  fallback,
}: {
  readonly control: Control<AdjFormValues>;
  readonly fallback?: string;
}) {
  const adjustmentTypeId = useWatch({ control, name: "adjustment_type_id" });
  // endpoint รายละเอียดมีแค่ id+code ของเหตุผล — ดึงชื่อตาม id (fallback ระหว่างโหลด)
  const { items } = useEntitiesByIds<AdjustmentType>({
    useListHook: useAdjustmentType,
    ids: adjustmentTypeId ? [adjustmentTypeId] : [],
  });
  const name = items.find((at) => at.id === adjustmentTypeId)?.name;
  return <FieldPlainText>{name ?? fallback}</FieldPlainText>;
}

function PlainDescriptionValue({
  control,
}: {
  readonly control: Control<AdjFormValues>;
}) {
  const description = useWatch({ control, name: "description" });
  return (
    <FieldPlainText>
      {description ? (
        <span className="break-words whitespace-pre-wrap">{description}</span>
      ) : (
        ""
      )}
    </FieldPlainText>
  );
}
