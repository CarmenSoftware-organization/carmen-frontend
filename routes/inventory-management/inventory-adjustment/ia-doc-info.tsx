import { useTranslations } from "use-intl";
import {
  Controller,
  useForm,
  useFormState,
  useWatch,
  type Control,
} from "react-hook-form";
import { FieldGrid } from "@/components/share/compact-section";
import { SettingField } from "@/components/share/setting-field";
import {
  Field,
  FieldLabel,
  FieldError,
  FieldDatePicker,
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
  tc,
  tfl,
}: DocumentInfoProps) {
  // อ่าน error ผ่าน useFormState ในคอมโพเนนต์นี้เอง — ตัวนี้ถูกส่งเป็น ribbon ของหัวเอกสาร
  // React Compiler memo element ที่ props คงที่ไว้ อ่าน form.formState.errors จาก prop
  // แล้วกด Save ค่าว่าง ช่องจะไม่ขึ้นแดง
  const { errors } = useFormState({ control: form.control });
  const locationName =
    inventoryAdjustment?.location?.name ?? inventoryAdjustment?.location_name;

  // ช่องหัวใบอยู่ในการ์ดหัวเอกสาร (ribbon ของ FormToolbar) ทรงเดียวกับ PR/PO/GRN/SR
  // โหมดดู = ข้อความล้วน ป้ายจาง + ค่าเด่น ไม่มีกรอบ (กฎ 7) · dense 2 คอลัมน์ตั้งแต่กล่องแคบสุด
  // ตัดสินจาก isView ไม่ใช่ isDisabled — isDisabled รวม isPending ช่องจะกลายเป็นข้อความชั่วขณะตอนกด Save
  // ลำดับช่องเท่ากันทั้งสองโหมด สลับโหมดแล้วช่องไม่ย้ายที่
  if (isView) {
    return (
      <FieldGrid dense>
        <PlainDateValue
          control={form.control}
          dateFormat={dateFormat}
          label={tfl("date")}
        />
        <PlainReasonValue
          control={form.control}
          label={tfl("reason")}
          fallback={
            // ก้อนของ endpoint รายละเอียดมีแค่ id+code (ไม่มี name) ต่างจาก list
            inventoryAdjustment?.adjustment_type?.name ??
            inventoryAdjustment?.adjustment_type?.code ??
            inventoryAdjustment?.adjustment_type_name
          }
        />
        <SettingField label={tfl("location")} value={locationName} />
        <PlainDescriptionValue
          control={form.control}
          label={tfl("description")}
        />
      </FieldGrid>
    );
  }

  // FieldGrid: คอลัมน์ตามความกว้างกล่อง (container query) ไม่ใช่ความกว้างจอ
  return (
    <FieldGrid>
      <Field>
        <FieldLabel required>{tfl("date")}</FieldLabel>
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
                currentPeriodStart ? new Date(currentPeriodStart) : undefined
              }
              // ไม่เกินวันนี้ และไม่เกินท้ายงวด — ใบรับ/จ่ายลงวันที่อนาคตไม่ได้
              toDate={latestIssuableDate(currentPeriodEnd)}
              error={errors.date?.message}
            />
          )}
        />
      </Field>

      <Field>
        <FieldLabel required>{tfl("reason")}</FieldLabel>
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
              error={errors.adjustment_type_id?.message}
            />
          )}
        />
      </Field>

      <Field>
        <FieldLabel required>{tfl("location")}</FieldLabel>
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
              defaultLabel={locationName}
              error={errors.location_id?.message}
              lazy
            />
          )}
        />
      </Field>

      {/* ช่องกว้างช่องเดียวของหัวใบ (gotcha: สองช่องที่กิน 2 คอลัมน์ติดกันตกคนละแถว) */}
      <Field className="@md:col-span-2">
        <FieldLabel htmlFor="inv-adj-description">
          {tfl("description")}
        </FieldLabel>
        <Textarea
          id="inv-adj-description"
          placeholder={tfl("optional")}
          className="text-xs"
          disabled={isDisabled}
          maxLength={256}
          aria-invalid={!!errors.description}
          {...form.register("description")}
        />
        {errors.description?.message && (
          <FieldError>{errors.description.message}</FieldError>
        )}
      </Field>
    </FieldGrid>
  );
}

function PlainDateValue({
  control,
  dateFormat,
  label,
}: {
  readonly control: Control<AdjFormValues>;
  readonly dateFormat: string;
  readonly label: string;
}) {
  const date = useWatch({ control, name: "date" });
  return (
    <SettingField
      label={label}
      value={date ? formatDate(date, dateFormat) : null}
    />
  );
}

function PlainReasonValue({
  control,
  label,
  fallback,
}: {
  readonly control: Control<AdjFormValues>;
  readonly label: string;
  readonly fallback?: string;
}) {
  const adjustmentTypeId = useWatch({ control, name: "adjustment_type_id" });
  // endpoint รายละเอียดมีแค่ id+code ของเหตุผล — ดึงชื่อตาม id (fallback ระหว่างโหลด)
  const { items } = useEntitiesByIds<AdjustmentType>({
    useListHook: useAdjustmentType,
    ids: adjustmentTypeId ? [adjustmentTypeId] : [],
  });
  const name = items.find((at) => at.id === adjustmentTypeId)?.name;
  return <SettingField label={label} value={name ?? fallback} />;
}

function PlainDescriptionValue({
  control,
  label,
}: {
  readonly control: Control<AdjFormValues>;
  readonly label: string;
}) {
  const description = useWatch({ control, name: "description" });
  // เต็มแถวบนมือถือ (dense) · ตั้งแต่ @md กว้างเท่าช่องอื่น — ตาราง audit กินที่ขวาของแถบ
  return (
    <div data-wide="" className="min-w-0 @md:col-span-1!">
      <SettingField label={label} value={description || null} />
    </div>
  );
}
