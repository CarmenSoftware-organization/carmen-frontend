import { useTranslations } from "use-intl";
import {
  Controller,
  useFormState,
  useWatch,
  type UseFormReturn,
} from "react-hook-form";
import { Field, FieldInput, FieldLabel } from "@/components/ui/field";
import { FieldGrid } from "@/components/share/compact-section";
import { SettingField } from "@/components/share/setting-field";
import { DocAuditLine } from "@/components/share/doc-audit-line";
import { StatusSwitch } from "@/components/ui/status-switch";
import { Textarea } from "@/components/ui/textarea";
import { LookupWorkflow } from "@/components/lookup/lookup-workflow";
import { WORKFLOW_TYPE } from "@/types/workflows";
import type { Audit } from "@/types/audit";
import type { PrtFormValues } from "./prt-form-schema";

interface PrtGeneralFieldsProps {
  readonly form: UseFormReturn<PrtFormValues>;
  readonly readOnly: boolean;
  readonly disabled: boolean;
  readonly workflowName?: string;
  readonly isAdd?: boolean;
  readonly audit?: Audit;
  readonly docVersion?: number;
}

/**
 * ช่องข้อมูลหัวใบ — ส่งเป็น `ribbon` ของการ์ดหัวเอกสาร (ทรงเดียวกับ `pr-header.tsx`)
 * ไม่ใช่การ์ด General แยกใต้หัวอีกใบ
 *
 * โหมดดู: Workflow + Description เป็นข้อความ (ชื่ออยู่ที่ title, สถานะอยู่ที่ badge แล้ว) ตาราง
 * audit ชิดขวาของแถบเดียวกัน · โหมดแก้/สร้าง: Workflow · Name · Status · Description เป็นช่องกรอก
 * ช่องอยู่นอก `<form>` แต่ register กับ RHF แล้ว ปุ่ม Save (form="prt-form") ส่งค่าครบ —
 * Enter ในช่องจึงไม่ submit เหมือน PR
 */
export function PrtGeneralFields({
  form,
  readOnly,
  disabled,
  workflowName,
  isAdd,
  audit,
  docVersion,
}: PrtGeneralFieldsProps) {
  const t = useTranslations("procurement.purchaseRequestTemplate");
  const tfl = useTranslations("field");
  // subscribe เองด้วย useFormState — คอมโพเนนต์นี้ถูกส่งเป็น ribbon ของ FormToolbar ซึ่ง
  // React Compiler memo element ไว้ (props คงที่) อ่าน `form.formState.errors` จาก prop
  // จึงไม่ re-render ตอน validate กด Save ชื่อว่างแล้วไม่ขึ้นแดงเลย
  const { errors } = useFormState({ control: form.control });
  const watchedDescription = useWatch({
    control: form.control,
    name: "description",
  });

  // ml-4 หักล้าง -ml-4 ของ DocFormHeader ให้ช่องแรกเสมอกับ title (เหมือน PR)
  return (
    <div className="ml-4 flex min-w-0 flex-1 flex-wrap items-end gap-x-5 gap-y-3">
      <div className="min-w-0 flex-1 basis-72">
        {readOnly ? (
          <FieldGrid dense>
            <SettingField label={tfl("workflow")} value={workflowName} />
            {/* data-wide = เต็มแถวบนมือถือ · ตั้งแต่ @md คอลัมน์เดียว (ตาราง audit กินที่ขวา) */}
            <div data-wide="" className="min-w-0 @md:col-span-1!">
              <SettingField
                label={tfl("description")}
                value={watchedDescription}
              />
            </div>
          </FieldGrid>
        ) : (
          <FieldGrid>
            <Field>
              <FieldLabel required>{tfl("workflow")}</FieldLabel>
              <Controller
                control={form.control}
                name="workflow_id"
                render={({ field }) => (
                  <LookupWorkflow
                    value={field.value}
                    onValueChange={field.onChange}
                    workflowType={WORKFLOW_TYPE.PR}
                    creatableOnly={isAdd}
                    disabled={disabled}
                    error={errors.workflow_id?.message}
                    className="w-full"
                  />
                )}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="prt-name" required>
                {tfl("name")}
              </FieldLabel>
              <FieldInput
                id="prt-name"
                placeholder={t("namePlaceholder")}
                disabled={disabled}
                maxLength={100}
                error={errors.name?.message}
                {...form.register("name")}
              />
            </Field>

            {/* สถานะมาก่อนคำอธิบาย — ช่องสั้นสามช่องเต็มแถวแรก ของเดิมสถานะตกไปโดด ๆ แถวสอง */}
            <Controller
              control={form.control}
              name="is_active"
              render={({ field }) => (
                <StatusSwitch
                  id="prt-is-active"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  disabled={disabled}
                />
              )}
            />

            <Field className="@md:col-span-2">
              <FieldLabel htmlFor="prt-description">
                {tfl("description")}
              </FieldLabel>
              <Textarea
                id="prt-description"
                placeholder={tfl("optional")}
                rows={2}
                disabled={disabled}
                maxLength={256}
                className="resize-none"
                {...form.register("description")}
              />
            </Field>
          </FieldGrid>
        )}
      </div>
      {readOnly && (
        <DocAuditLine
          audit={audit}
          docVersion={docVersion}
          className="ms-auto hidden sm:table"
        />
      )}
    </div>
  );
}
