import { Controller, type UseFormReturn } from "react-hook-form";
import { useTranslations } from "use-intl";
import { Field, FieldLabel, FieldDatePicker } from "@/components/ui/field";
import { LookupUserLocation } from "@/components/lookup/lookup-user-location";
import { Input } from "@/components/ui/input";
import { LookupWorkflow } from "@/components/lookup/lookup-workflow";
import { INVENTORY_TYPE } from "@/constant/location";
import { WORKFLOW_TYPE } from "@/types/workflows";
import { STAGE_ROLE } from "@/types/stage-role";
import type { EntityRef } from "@/types/entity-ref";
import { FieldGrid } from "@/components/share/compact-section";
import { SettingField } from "@/components/share/setting-field";
import { useProfile } from "@/hooks/use-profile";
import { formatDate } from "@/lib/date-utils";
import type { SrFormValues } from "./sr-form-schema";

interface LocationInfo {
  readonly name: string;
  readonly code: string;
  readonly location_type?: string;
}

interface SrRequestDetailsProps {
  readonly form: UseFormReturn<SrFormValues>;
  readonly readOnly: boolean;
  readonly disabled: boolean;
  /**
   * แจ้งคลังต้นทางที่เลือกกลับให้ผู้เรียก — optional เพราะตอนนี้ไม่มีใครต้องการ
   * (แท็บ stock movement ดึงชื่อคลังมาจาก API เองแล้ว) คงไว้เพราะฝั่งปลายทางยังใช้
   * และวันไหนมีคนต้องใช้จะได้ไม่ต้องรื้อ dropdown ใหม่
   */
  readonly onFromLocInfoChange?: (info: LocationInfo) => void;
  readonly onToLocInfoChange: (info: LocationInfo) => void;
  readonly role?: string;
  readonly isDraft?: boolean;
  readonly isAdd?: boolean;
  /**
   * คลังต้นทาง/ปลายทางที่บันทึกไว้ในใบ — ใช้เป็น `defaultLabel` ของ lookup
   * list โหลดทีละ 30 คลังที่อยู่หลังหน้าแรกจะหาชื่อไม่เจอแล้วขึ้น placeholder
   * (รวมถึงโหมดดู ซึ่งวาด lookup ที่ถูก disable)
   */
  readonly savedFromLocation?: EntityRef | null;
  readonly savedToLocation?: EntityRef | null;
  /** ชื่อ workflow ของใบ — ฟอร์มถือแค่ id ใช้ตอนช่องเป็นข้อความ */
  readonly workflowName?: string | null;
}

/**
 * ป้ายคลังที่บันทึกไว้ รูปเดียวกับ getLabel ของ LookupUserLocation (`code — name`)
 * เฉพาะตอนค่าในช่องยังเป็นคลังเดิม
 */
function savedLabel(
  value: string,
  saved: EntityRef | null | undefined,
): string | undefined {
  if (!saved?.name || saved.id !== value) return undefined;
  return saved.code ? `${saved.code} — ${saved.name}` : saved.name;
}

export function SrRequestDetails({
  form,
  readOnly,
  disabled,
  onFromLocInfoChange,
  onToLocInfoChange,
  role,
  isDraft = true,
  isAdd = false,
  savedFromLocation,
  savedToLocation,
  workflowName,
}: SrRequestDetailsProps) {
  "use no memo";
  const t = useTranslations("storeOperation.storeRequisition");
  const tfl = useTranslations("field");

  const errors = form.formState.errors;
  const srDate = form.watch("sr_date");
  const fromLocationId = form.watch("from_location_id");

  // role-based lock = ขั้น approve/issue/view ห้ามแก้ทั้ง section (ถาวร ไม่ใช่ pending)
  const isReadOnly =
    readOnly ||
    role === STAGE_ROLE.APPROVE ||
    role === STAGE_ROLE.ISSUE ||
    role === STAGE_ROLE.VIEW_ONLY;
  const fieldDisabled = disabled || isReadOnly;
  const { dateFormat } = useProfile();

  // อ่านอย่างเดียว (โหมดดู หรือ role ที่ล็อกทั้ง section) = ข้อความล้วน ป้ายจาง + ค่าเด่น
  // ไม่ใช่ control ที่ถูก disable — กรอบมีเฉพาะช่องที่กรอกได้จริง (กฎ 7 ของ
  // carmen-blue-ui-design) · ลำดับช่องเท่าเดิม สลับโหมดแล้วช่องไม่ย้ายที่
  // ช่องที่คลังเป็นค่าที่บันทึกไว้แล้ว จึงใช้ป้าย saved (`code — name`) ได้ตรง ๆ
  if (isReadOnly) {
    const locLabel = (saved: EntityRef | null | undefined) =>
      saved?.name
        ? saved.code
          ? `${saved.code} — ${saved.name}`
          : saved.name
        : null;
    return (
      <FieldGrid>
        <SettingField label={tfl("workflow")} value={workflowName} />
        <SettingField
          label={tfl("expectedDate")}
          value={
            formatDate(form.getValues("expected_date"), dateFormat) || null
          }
        />
        <SettingField
          label={tfl("fromLocation")}
          value={locLabel(savedFromLocation)}
        />
        <SettingField
          label={tfl("toLocation")}
          value={locLabel(savedToLocation)}
        />
        <SettingField
          label={tfl("description")}
          value={form.getValues("description")}
          fullWidth
        />
      </FieldGrid>
    );
  }

  return (
    // FieldGrid: คอลัมน์ตามความกว้างกล่อง (container query) ไม่ใช่ความกว้างจอ
    <FieldGrid>
      {/* workflow อยู่ที่นี่ที่เดียวทุกโหมด — พ้น draft แล้วล็อกด้วย disabled
          ไม่ใช่ซ่อนแล้วไปโผล่บนแถบหัว (ฟิลด์เดียวกันไม่ควรมีสองที่อยู่) */}
      {!isDraft ? (
        // พ้น draft แล้ว workflow ล็อกถาวร → ข้อความ
        <SettingField label={tfl("workflow")} value={workflowName} />
      ) : (
        <Field>
          <FieldLabel required>{tfl("workflow")}</FieldLabel>
          <Controller
            control={form.control}
            name="workflow_id"
            render={({ field }) => (
              <LookupWorkflow
                value={field.value}
                onValueChange={field.onChange}
                workflowType={WORKFLOW_TYPE.SR}
                creatableOnly={isAdd}
                disabled={fieldDisabled}
                error={errors.workflow_id?.message}
                className="text-xs"
              />
            )}
          />
        </Field>
      )}
      <Field>
        <FieldLabel required>{tfl("expectedDate")}</FieldLabel>
        <Controller
          control={form.control}
          name="expected_date"
          render={({ field }) => (
            <FieldDatePicker
              value={field.value}
              onValueChange={field.onChange}
              disabled={fieldDisabled || !srDate}
              fromDate={srDate ? new Date(srDate) : undefined}
              placeholder={t("pickExpectedDate")}
              className="w-full"
              error={errors.expected_date?.message}
            />
          )}
        />
      </Field>

      <Field>
        <FieldLabel required>{tfl("fromLocation")}</FieldLabel>
        <Controller
          control={form.control}
          name="from_location_id"
          render={({ field }) => (
            <LookupUserLocation
              value={field.value}
              onValueChange={(val) => {
                field.onChange(val);
                if (val && val === form.getValues("to_location_id")) {
                  form.setValue("to_location_id", "");
                  onToLocInfoChange({ name: "", code: "" });
                }
              }}
              onItemChange={(item) =>
                onFromLocInfoChange?.({
                  name: item?.name ?? "",
                  code: item?.code ?? "",
                  location_type: item?.location_type,
                })
              }
              defaultLabel={savedLabel(field.value, savedFromLocation)}
              disabled={fieldDisabled}
              locationTypes={[
                INVENTORY_TYPE.INVENTORY,
                INVENTORY_TYPE.CONSIGNMENT,
              ]}
              popoverWidth="w-[min(92vw,31.25rem)]"
              className="text-xs"
              error={errors.from_location_id?.message}
            />
          )}
        />
      </Field>

      <Field>
        <FieldLabel required>{tfl("toLocation")}</FieldLabel>
        <Controller
          control={form.control}
          name="to_location_id"
          render={({ field }) => (
            <LookupUserLocation
              value={field.value}
              onValueChange={field.onChange}
              onItemChange={(item) =>
                onToLocInfoChange({
                  name: item?.name ?? "",
                  code: item?.code ?? "",
                  location_type: item?.location_type,
                })
              }
              defaultLabel={savedLabel(field.value, savedToLocation)}
              disabled={fieldDisabled || !fromLocationId}
              excludeIds={
                fromLocationId ? new Set([fromLocationId]) : undefined
              }
              popoverWidth="w-[min(92vw,31.25rem)]"
              className="text-xs"
              error={errors.to_location_id?.message}
            />
          )}
        />
      </Field>

      {/* คำอธิบายต่อท้ายคลังปลายทาง อยู่ในตารางเดียวกับช่องอื่น ไม่ใช่ก้อนแยก
          ใต้ฟอร์ม — ช่องบรรทัดเดียวกว้าง 2 คอลัมน์ ไม่ใช่ Textarea เพราะจำกัด
          256 ตัวอักษรอยู่แล้ว เป็นข้อความสั้น ไม่ใช่บันทึกยาว */}
      <Field className="@md:col-span-2">
        <FieldLabel htmlFor="sr-description">{tfl("description")}</FieldLabel>
        <Input
          id="sr-description"
          placeholder={t("optionalDescription")}
          maxLength={256}
          disabled={fieldDisabled}
          className="text-xs"
          {...form.register("description")}
        />
      </Field>
    </FieldGrid>
  );
}
