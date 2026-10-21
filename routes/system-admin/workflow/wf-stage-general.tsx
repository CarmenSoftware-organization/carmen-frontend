import { Controller, type UseFormReturn } from "react-hook-form";
import { Checkbox } from "@/components/ui/checkbox";
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
  FieldGroup,
  FieldLabel,
  FieldPlainText,
} from "@/components/ui/field";
import type { Role } from "@/types/workflows";
import type { WorkflowCreateModel } from "./wf-form-schema";
import { getAllowedRoles } from "./wf-role-colors";
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
  /** โหมดดู — ค่าเป็นข้อความแทนช่องที่ถูกปิด (แบบเดียวกับ `WfGeneral`) */
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
    const role = stage?.role as keyof typeof roleLabelKeys | undefined;
    const slaUnit = stage?.sla_unit as
      keyof typeof slaUnitLabelKeys | undefined;

    return (
      <FieldGroup className="gap-4 pt-4">
        <div className="grid grid-cols-1 gap-4 @md:grid-cols-2">
          <Field>
            <FieldLabel>{t("stageName")}</FieldLabel>
            <FieldPlainText>{stage?.name}</FieldPlainText>
          </Field>
          <Field>
            <FieldLabel>{t("stageRole")}</FieldLabel>
            <FieldPlainText>
              {role && roleLabelKeys[role] ? t(roleLabelKeys[role]) : role}
            </FieldPlainText>
          </Field>
        </div>
        <Field>
          <FieldLabel>{tfl("description")}</FieldLabel>
          <FieldPlainText className="whitespace-pre-line">
            {stage?.description}
          </FieldPlainText>
        </Field>
        <div className="grid grid-cols-1 gap-4 @md:grid-cols-2">
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
          <Field>
            <FieldLabel>{t("sla")}</FieldLabel>
            <FieldPlainText className="tabular-nums">
              {stage?.sla
                ? `${stage.sla} ${slaUnit && slaUnitLabelKeys[slaUnit] ? t(slaUnitLabelKeys[slaUnit]) : (slaUnit ?? "")}`
                : null}
            </FieldPlainText>
          </Field>
        </div>
        <div className="grid grid-cols-1 gap-4 @lg:grid-cols-[2fr_1fr_1fr]">
          <Field>
            <FieldLabel>{t("availableActions")}</FieldLabel>
            <FieldPlainText className="flex-wrap gap-1">
              {enabledActions.length > 0 ? enabledActions : null}
            </FieldPlainText>
          </Field>
          <Field>
            <FieldLabel>{t("hideFields")}</FieldLabel>
            <FieldPlainText>{hiddenFields.join(", ")}</FieldPlainText>
          </Field>
          <Field>
            <FieldLabel>{t("showSignatureInReport")}</FieldLabel>
            <FieldPlainText>
              {stage?.is_show_signature ? tc("yes") : tc("no")}
            </FieldPlainText>
          </Field>
        </div>
      </FieldGroup>
    );
  }

  return (
    <FieldGroup className="gap-4 pt-4">
      <div className="grid grid-cols-1 gap-4 @md:grid-cols-2">
        <Field>
          <FieldLabel>{t("stageName")}</FieldLabel>
          <Input
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
                <SelectTrigger>
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
      </div>

      <Field>
        <FieldLabel>{tfl("description")}</FieldLabel>
        <Textarea
          className="min-h-[80px]"
          disabled={isDisabled}
          placeholder={tfl("optional")}
          maxLength={256}
          {...form.register(`data.stages.${index}.description`)}
        />
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
                className="flex gap-3"
              >
                <div className="flex items-center gap-1">
                  <RadioGroupItem
                    value="only_creator"
                    id={`${prefix}-creator-only`}
                  />
                  <label
                    htmlFor={`${prefix}-creator-only`}
                    className="text-sm font-medium"
                  >
                    {t("onlyCreator")}
                  </label>
                </div>
                <div className="flex items-center gap-1">
                  <RadioGroupItem
                    value="all_department"
                    id={`${prefix}-all-dept`}
                  />
                  <label
                    htmlFor={`${prefix}-all-dept`}
                    className="text-sm font-medium"
                  >
                    {t("allDepartment")}
                  </label>
                </div>
              </RadioGroup>
            )}
          />
        </Field>
      )}

      <div className="grid grid-cols-1 gap-4 @md:grid-cols-2">
        <Field>
          <FieldLabel>{t("sla")}</FieldLabel>
          <Input
            type="number"
            size="sm"
            disabled={isDisabled}
            {...form.register(`data.stages.${index}.sla`)}
          />
        </Field>
        <Field>
          <FieldLabel>{t("slaUnit")}</FieldLabel>
          <Controller
            control={form.control}
            name={`data.stages.${index}.sla_unit`}
            render={({ field }) => (
              <Select
                value={field.value}
                onValueChange={field.onChange}
                disabled={isDisabled}
              >
                <SelectTrigger>
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
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-4 @lg:grid-cols-[2fr_1fr_1fr]">
        <div>
          <FieldLabel className="mb-1.5">{t("availableActions")}</FieldLabel>
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            <Field orientation="horizontal">
              <Controller
                control={form.control}
                name={`data.stages.${index}.available_actions.submit.is_active`}
                render={({ field }) => (
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    disabled={isDisabled}
                  />
                )}
              />
              <FieldLabel>{t("actionSubmit")}</FieldLabel>
            </Field>

            {!isFirst && (
              <>
                <Field orientation="horizontal">
                  <Controller
                    control={form.control}
                    name={`data.stages.${index}.available_actions.approve.is_active`}
                    render={({ field }) => (
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        disabled={isDisabled}
                      />
                    )}
                  />
                  <FieldLabel>
                    <Badge variant="success" size="sm" className="font-medium">
                      {t("actionApprove")}
                    </Badge>
                  </FieldLabel>
                </Field>
                <Field orientation="horizontal">
                  <Controller
                    control={form.control}
                    name={`data.stages.${index}.available_actions.reject.is_active`}
                    render={({ field }) => (
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        disabled={isDisabled}
                      />
                    )}
                  />
                  <FieldLabel>
                    <Badge
                      variant="destructive"
                      size="sm"
                      className="font-medium"
                    >
                      {t("actionReject")}
                    </Badge>
                  </FieldLabel>
                </Field>
                <Field orientation="horizontal">
                  <Controller
                    control={form.control}
                    name={`data.stages.${index}.available_actions.sendback.is_active`}
                    render={({ field }) => (
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        disabled={isDisabled}
                      />
                    )}
                  />
                  <FieldLabel>
                    <Badge variant="warning" size="sm" className="font-medium">
                      {t("actionSendBack")}
                    </Badge>
                  </FieldLabel>
                </Field>
              </>
            )}
          </div>
        </div>

        <div>
          <FieldLabel className="mb-1.5">{t("hideFields")}</FieldLabel>
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            <Field orientation="horizontal">
              <Controller
                control={form.control}
                name={`data.stages.${index}.hide_fields.price_per_unit`}
                render={({ field }) => (
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    disabled={isDisabled}
                  />
                )}
              />
              <FieldLabel>{t("pricePerUnit")}</FieldLabel>
            </Field>
            <Field orientation="horizontal">
              <Controller
                control={form.control}
                name={`data.stages.${index}.hide_fields.total_price`}
                render={({ field }) => (
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    disabled={isDisabled}
                  />
                )}
              />
              <FieldLabel>{t("totalPrice")}</FieldLabel>
            </Field>
          </div>
        </div>

        <div>
          <FieldLabel className="mb-1.5">
            {t("showSignatureInReport")}
          </FieldLabel>
          <Field orientation="horizontal">
            <Controller
              control={form.control}
              name={`data.stages.${index}.is_show_signature`}
              render={({ field }) => (
                <Checkbox
                  aria-label={t("showSignatureInReport")}
                  checked={field.value ?? false}
                  onCheckedChange={field.onChange}
                  disabled={isDisabled || signatureDisabled}
                />
              )}
            />
          </Field>
          {signatureDisabled && (
            <p className="text-muted-foreground mt-1 text-xs">
              {t("signatureLimitReached")}
            </p>
          )}
        </div>
      </div>
    </FieldGroup>
  );
}
