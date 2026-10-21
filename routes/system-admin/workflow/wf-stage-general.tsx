import { Controller, type Path, type UseFormReturn } from "react-hook-form";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { useTranslations } from "use-intl";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldPlainText,
  FieldSeparator,
  FieldSet,
} from "@/components/ui/field";
import { cn } from "@/lib/utils";
import { WORKFLOW_TYPE, type Role } from "@/types/workflows";
import type { WorkflowCreateModel } from "./wf-form-schema";
import { getAllowedRoles } from "./wf-role-colors";
import { ACTION_ROWS } from "./wf-action-meta";
import {
  isSignatureCheckboxDisabled,
  type SignatureStageLike,
} from "./wf-signature-limit";

const slaUnitValues = ["minutes", "hours", "days"] as const;

interface WfStageGeneralProps {
  readonly form: UseFormReturn<WorkflowCreateModel>;
  readonly index: number;
  readonly isFirst: boolean;
  readonly isDisabled: boolean;
  readonly isNameDisabled: boolean;
  /** โหมดดู — ค่าเป็นข้อความแทนช่องที่ถูกปิด */
  readonly readOnly?: boolean;
}

export function WfStageGeneral({
  form,
  index,
  isFirst,
  isDisabled,
  isNameDisabled,
  readOnly = false,
}: WfStageGeneralProps) {
  const t = useTranslations("systemAdmin.workflow");
  const tfl = useTranslations("field");
  const tc = useTranslations("common");
  const prefix = `data.stages.${index}` as const;

  const watchedStages = form.watch("data.stages") as
    SignatureStageLike[] | undefined;
  const signatureDisabled = isSignatureCheckboxDisabled(
    watchedStages ?? [],
    index,
  );

  // role ที่เลือกได้ขึ้นกับชนิด workflow — ถ้าค่าที่บันทึกไว้ไม่อยู่ในรายการ (ข้อมูลเก่าก่อนมีกติกา
  // นี้) ยังโชว์ค่านั้นไว้ให้เห็นว่าต้องแก้ แทนที่ Select จะว่างเปล่า — รางขึ้น error ให้อยู่แล้ว
  const workflowType = form.watch("workflow_type");
  const currentRole = form.watch(`data.stages.${index}.role`) as
    Role | undefined;
  const allowedRoles = getAllowedRoles(workflowType);
  const roleValues =
    currentRole && !allowedRoles.includes(currentRole)
      ? [...allowedRoles, currentRole]
      : allowedRoles;

  // ฟีเจอร์ซ่อนราคาไม่มีผลกับใบเบิก (SR ไม่มียอด) และ stage create/purchase (ไม่ถูกซ่อนเสมอ)
  const hideFieldsApplicable =
    workflowType !== WORKFLOW_TYPE.SR &&
    currentRole !== "create" &&
    currentRole !== "purchase";

  const roleLabelKeys = {
    create: "roleCreate",
    approve: "roleApprove",
    purchase: "rolePurchase",
    issue: "roleIssue",
  } as const;

  const slaUnitLabelKeys = {
    minutes: "slaMinutes",
    hours: "slaHours",
    days: "slaDays",
  } as const;

  if (readOnly) {
    const stage = form.getValues(prefix);
    const actions = stage?.available_actions;
    const enabledActions = [
      actions?.submit?.is_active && (
        <Badge key="submit" variant="invert-light" size="sm">
          {t("actionSubmit")}
        </Badge>
      ),
      !isFirst && actions?.approve?.is_active && (
        <Badge key="approve" variant="success-light" size="sm">
          {t("actionApprove")}
        </Badge>
      ),
      !isFirst && actions?.reject?.is_active && (
        <Badge key="reject" variant="destructive-light" size="sm">
          {t("actionReject")}
        </Badge>
      ),
      !isFirst && actions?.sendback?.is_active && (
        <Badge key="sendback" variant="warning-light" size="sm">
          {t("actionSendBack")}
        </Badge>
      ),
    ].filter(Boolean);
    const hiddenFields = [
      stage?.hide_fields?.price_per_unit && t("pricePerUnit"),
      stage?.hide_fields?.total_price && t("totalPrice"),
    ].filter(Boolean);
    const description = stage?.description?.trim();

    // ชื่อ role และ SLA อยู่บนหัวของขั้นแล้ว (มาร์กเกอร์ + บรรทัดรอง) — ที่นี่เหลือแค่ค่าที่หัวไม่ได้บอก
    // วางใน grid สองคอลัมน์ชุดเดียว ช่องที่ไม่เกี่ยวกับขั้นนี้หายไปโดยแถวไม่เหลื่อมกัน
    return (
      <div className="@container pt-4">
        <FieldGroup className="grid grid-cols-1 gap-x-6 gap-y-5 @md:grid-cols-2">
          <Field>
            <FieldLabel>{t("availableActions")}</FieldLabel>
            <FieldPlainText className="flex-wrap gap-1">
              {enabledActions.length > 0 ? enabledActions : null}
            </FieldPlainText>
          </Field>
          <Field>
            <FieldLabel>{t("showSignatureInReport")}</FieldLabel>
            <FieldPlainText>
              {stage?.is_show_signature ? tc("yes") : tc("no")}
            </FieldPlainText>
          </Field>
          {isFirst && (
            <Field>
              <FieldLabel>{t("creatorAccess")}</FieldLabel>
              <FieldPlainText>
                {stage?.creator_access === "all_department"
                  ? t("allDepartment")
                  : t("onlyCreator")}
              </FieldPlainText>
            </Field>
          )}
          {hideFieldsApplicable && (
            <Field>
              <FieldLabel>{t("hideFields")}</FieldLabel>
              <FieldPlainText>{hiddenFields.join(", ")}</FieldPlainText>
            </Field>
          )}
          {stage?.is_hod && (
            <Field>
              <FieldLabel>{t("isHod")}</FieldLabel>
              <FieldPlainText>{tc("yes")}</FieldPlainText>
            </Field>
          )}
          {description && (
            <Field className="@md:col-span-2">
              <FieldLabel>{tfl("description")}</FieldLabel>
              <FieldPlainText className="whitespace-pre-line">
                {description}
              </FieldPlainText>
            </Field>
          )}
        </FieldGroup>
      </div>
    );
  }

  return (
    <FieldGroup className="gap-5 pt-4">
      <div className="grid grid-cols-1 gap-4 @md:grid-cols-2 @2xl:grid-cols-3">
        <Field>
          <FieldLabel htmlFor={`${prefix}-name`}>{t("stageName")}</FieldLabel>
          <Input
            id={`${prefix}-name`}
            size="sm"
            disabled={isDisabled || isNameDisabled}
            {...form.register(`data.stages.${index}.name`)}
          />
        </Field>

        <Field>
          <FieldLabel>{t("stageRole")}</FieldLabel>
          <Controller
            control={form.control}
            name={`data.stages.${index}.role`}
            render={({ field }) => (
              <Select
                value={field.value}
                onValueChange={field.onChange}
                disabled={isDisabled}
              >
                <SelectTrigger aria-label={t("stageRole")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {roleValues.map((value) => (
                    <SelectItem
                      key={value}
                      value={value}
                      disabled={!allowedRoles.includes(value)}
                    >
                      {t(roleLabelKeys[value])}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </Field>

        {/* SLA เป็นค่าเดียว (จำนวน + หน่วย) จึงอยู่ช่องเดียวกัน ไม่แยกเป็นสอง field เต็มแถว */}
        <Field>
          <FieldLabel htmlFor={`${prefix}-sla`}>{t("sla")}</FieldLabel>
          <div className="grid grid-cols-[minmax(0,1fr)_8rem] gap-2">
            <Input
              id={`${prefix}-sla`}
              type="number"
              size="sm"
              className="tabular-nums"
              disabled={isDisabled}
              {...form.register(`data.stages.${index}.sla`)}
            />
            <Controller
              control={form.control}
              name={`data.stages.${index}.sla_unit`}
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={isDisabled}
                >
                  <SelectTrigger aria-label={t("slaUnit")} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {slaUnitValues.map((value) => (
                      <SelectItem key={value} value={value}>
                        {t(slaUnitLabelKeys[value])}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
        </Field>

        {isFirst && (
          <Field>
            <FieldLabel>{t("creatorAccess")}</FieldLabel>
            <Controller
              control={form.control}
              name={`data.stages.${index}.creator_access`}
              render={({ field }) => (
                <RadioGroup
                  value={field.value ?? "only_creator"}
                  onValueChange={field.onChange}
                  disabled={isDisabled}
                  className="flex min-h-8 items-center gap-4"
                >
                  <Field orientation="horizontal" className="w-auto gap-2">
                    <RadioGroupItem
                      value="only_creator"
                      id={`${prefix}-creator-only`}
                    />
                    <FieldLabel
                      htmlFor={`${prefix}-creator-only`}
                      className="font-normal"
                    >
                      {t("onlyCreator")}
                    </FieldLabel>
                  </Field>
                  <Field orientation="horizontal" className="w-auto gap-2">
                    <RadioGroupItem
                      value="all_department"
                      id={`${prefix}-all-dept`}
                    />
                    <FieldLabel
                      htmlFor={`${prefix}-all-dept`}
                      className="font-normal"
                    >
                      {t("allDepartment")}
                    </FieldLabel>
                  </Field>
                </RadioGroup>
              )}
            />
          </Field>
        )}
      </div>

      <Field>
        <FieldLabel htmlFor={`${prefix}-description`}>
          {tfl("description")}
        </FieldLabel>
        <Textarea
          id={`${prefix}-description`}
          className="min-h-14"
          disabled={isDisabled}
          placeholder={tfl("optional")}
          maxLength={256}
          {...form.register(`data.stages.${index}.description`)}
        />
      </Field>

      <FieldSeparator />

      <FieldSet className="gap-3">
        <FieldLegend variant="label" className="mb-0">
          {t("availableActions")}
        </FieldLegend>
        <FieldDescription>{t("availableActionsHint")}</FieldDescription>
        <div className="grid grid-cols-1 gap-x-6 gap-y-3 @lg:grid-cols-3">
          {/* Submit มีความหมายเฉพาะ stage แรก — stage อนุมัติไม่ต้องเห็นตัวเลือกนี้ */}
          {isFirst ? (
            <StageSwitchRow
              form={form}
              id={`${prefix}-action-submit`}
              name={`data.stages.${index}.available_actions.submit.is_active`}
              label={t("actionSubmit")}
              description={t("actionSubmitHint")}
              disabled={isDisabled}
            />
          ) : (
            ACTION_ROWS.map((action) => (
              <StageSwitchRow
                key={action.key}
                form={form}
                id={`${prefix}-action-${action.key}`}
                name={`data.stages.${index}.available_actions.${action.key}.is_active`}
                label={
                  <>
                    <span
                      aria-hidden="true"
                      className={cn("size-2 rounded-full", action.dotClass)}
                    />
                    {t(action.labelKey)}
                  </>
                }
                description={t(action.hintKey)}
                disabled={isDisabled}
              />
            ))
          )}
        </div>
      </FieldSet>

      <FieldSeparator />

      <FieldSet className="gap-3">
        <FieldLegend variant="label" className="mb-0">
          {t("visibilitySection")}
        </FieldLegend>
        <FieldDescription>{t("visibilitySectionHint")}</FieldDescription>
        <div className="grid grid-cols-1 gap-x-6 gap-y-3 @lg:grid-cols-3">
          {hideFieldsApplicable && (
            <>
              <StageSwitchRow
                form={form}
                id={`${prefix}-hide-price-per-unit`}
                name={`data.stages.${index}.hide_fields.price_per_unit`}
                label={t("hidePricePerUnit")}
                description={t("hidePricePerUnitHint")}
                disabled={isDisabled}
              />
              <StageSwitchRow
                form={form}
                id={`${prefix}-hide-total-price`}
                name={`data.stages.${index}.hide_fields.total_price`}
                label={t("hideTotalPrice")}
                description={t("hideTotalPriceHint")}
                disabled={isDisabled}
              />
            </>
          )}
          <StageSwitchRow
            form={form}
            id={`${prefix}-show-signature`}
            name={`data.stages.${index}.is_show_signature`}
            label={t("showSignatureInReport")}
            description={
              signatureDisabled
                ? t("signatureLimitReached")
                : t("showSignatureHint")
            }
            disabled={isDisabled || signatureDisabled}
          />
        </div>
      </FieldSet>
    </FieldGroup>
  );
}

type StageSwitchName = Extract<
  Path<WorkflowCreateModel>,
  | `data.stages.${number}.available_actions.${string}.is_active`
  | `data.stages.${number}.hide_fields.${string}`
  | `data.stages.${number}.is_show_signature`
>;

/**
 * แถวตั้งค่าแบบเปิด/ปิดของ stage — switch + ชื่อ + คำอธิบายสั้น (pattern เดียวกับหน้า settings อื่น)
 * @param form - ฟอร์ม workflow
 * @param id - id ของ switch ผูกกับ label
 * @param name - path ของค่า boolean ในฟอร์ม
 * @param label - ชื่อการตั้งค่า (ใส่จุดสีนำหน้าได้)
 * @param description - คำอธิบายว่าเปิดแล้วเกิดอะไร
 * @param disabled - ปิดการแก้ไข
 */
function StageSwitchRow({
  form,
  id,
  name,
  label,
  description,
  disabled,
}: {
  readonly form: UseFormReturn<WorkflowCreateModel>;
  readonly id: string;
  readonly name: StageSwitchName;
  readonly label: React.ReactNode;
  readonly description: string;
  readonly disabled: boolean;
}) {
  return (
    <Controller
      control={form.control}
      name={name}
      render={({ field }) => (
        <Field orientation="horizontal" data-disabled={disabled}>
          <Switch
            id={id}
            checked={Boolean(field.value)}
            onCheckedChange={field.onChange}
            disabled={disabled}
          />
          <FieldContent className="gap-0.5">
            <FieldLabel htmlFor={id} className="font-medium">
              {label}
            </FieldLabel>
            <FieldDescription>{description}</FieldDescription>
          </FieldContent>
        </Field>
      )}
    />
  );
}
