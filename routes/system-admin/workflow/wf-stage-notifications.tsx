import { Controller, useWatch, type UseFormReturn } from "react-hook-form";
import { useTranslations } from "use-intl";
import { CircleAlert } from "lucide-react";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSeparator,
  FieldSet,
} from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { LookupNotificationTemplate } from "@/components/lookup/lookup-noti-tmpl";
import { useLookupResource } from "@/hooks/use-lookup-resource";
import { lookupLabel } from "@/types/lookup";
import { cn } from "@/lib/utils";
import type { Stage } from "@/types/workflows";
import type { WorkflowCreateModel } from "./wf-form-schema";
import { ACTION_DOT_CLASS } from "./wf-action-meta";

type WfAction = "submit" | "approve" | "reject" | "sendback";
type WfRecipient =
  "requestor" | "current_approve" | "next_step" | "previous_step";

interface WfStageNotificationsProps {
  readonly form: UseFormReturn<WorkflowCreateModel>;
  readonly index: number;
  readonly isFirst: boolean;
  readonly isMiddle: boolean;
  readonly isDisabled: boolean;
  readonly watchedStage: Stage | undefined;
  /** โหมดดู — แถวเป็นข้อความ ผู้รับ → ชื่อเทมเพลต แทนสวิตช์กับ select ที่ถูกปิด */
  readonly readOnly?: boolean;
}

const RECIPIENT_KEYS = [
  "requestor",
  "current_approve",
  "next_step",
  "previous_step",
] as const;

export function WfStageNotifications({
  form,
  index,
  isFirst,
  isMiddle,
  isDisabled,
  watchedStage,
  readOnly = false,
}: WfStageNotificationsProps) {
  const t = useTranslations("systemAdmin.workflow");
  const actions = watchedStage?.available_actions;

  // โหมดดูต้องการแค่ชื่อเทมเพลต — ดึงทุก id ของขั้นนี้ในคำขอเดียว (enabled: false = ไม่โหลดรายการ)
  const templateIds = readOnly
    ? Object.values(actions ?? {}).flatMap((action) =>
        RECIPIENT_KEYS.map(
          (r) =>
            action?.recipients?.[r]?.notification_channel?.app
              ?.notification_template_id,
        ).filter((id): id is string => !!id),
      )
    : [];
  const { selectedItems: templates } = useLookupResource(
    "notification_template",
    { search: "", enabled: false, selectedIds: templateIds },
  );
  const templateLabels = new Map(
    templates.map((tpl) => [tpl.id, lookupLabel(tpl)]),
  );
  const slaFlags = watchedStage?.sla_warning_notification?.recipients;
  const slaRecipients = [
    slaFlags?.requestor && t("requester"),
    slaFlags?.current_approve && t("currentApprover"),
  ].filter((label): label is string => !!label);

  const sections: {
    action: WfAction;
    labelKey: string;
    showNextStep: boolean;
  }[] = [];
  if (actions?.submit.is_active) {
    sections.push({
      action: "submit",
      labelKey: "actionSubmit",
      showNextStep: true,
    });
  }
  if (!isFirst && actions?.approve.is_active) {
    sections.push({
      action: "approve",
      labelKey: "actionApprove",
      showNextStep: true,
    });
  }
  if (!isFirst && actions?.reject.is_active) {
    sections.push({
      action: "reject",
      labelKey: "actionReject",
      showNextStep: false,
    });
  }
  if (!isFirst && actions?.sendback.is_active) {
    sections.push({
      action: "sendback",
      labelKey: "actionSendBack",
      showNextStep: true,
    });
  }

  if (sections.length === 0 && !isMiddle) {
    return (
      <p className="text-muted-foreground py-3 text-sm">
        {t("noActiveActions")}
      </p>
    );
  }

  return (
    <FieldGroup className="gap-5">
      {sections.length > 0 && (
        <FieldDescription>{t("notificationsHint")}</FieldDescription>
      )}
      {sections.map((section, i) => (
        <div key={section.action} className="contents">
          {i > 0 && <FieldSeparator />}
          <NotificationSection
            form={form}
            index={index}
            action={section.action}
            label={t(section.labelKey)}
            showNextStep={section.showNextStep}
            isDisabled={isDisabled}
            readOnly={readOnly}
            templateLabels={templateLabels}
          />
        </div>
      ))}

      {isMiddle && readOnly && (
        <>
          {sections.length > 0 && <FieldSeparator />}
          <div className="grid grid-cols-1 gap-x-4 gap-y-1 @lg:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
            <span className="text-foreground text-sm font-medium">
              {t("slaWarning")}
            </span>
            <span
              className={cn(
                "text-sm",
                slaRecipients.length > 0
                  ? "text-foreground"
                  : "text-muted-foreground",
              )}
            >
              {slaRecipients.length > 0
                ? slaRecipients.join(" · ")
                : t("notifyOff")}
            </span>
          </div>
        </>
      )}

      {isMiddle && !readOnly && (
        <>
          {sections.length > 0 && <FieldSeparator />}
          <FieldSet className="gap-3">
            <FieldLegend variant="label" className="mb-0">
              {t("slaWarning")}
            </FieldLegend>
            <FieldDescription>{t("slaWarningHint")}</FieldDescription>
            <div className="flex flex-wrap gap-x-8 gap-y-3">
              <SlaWarningSwitch
                form={form}
                id={`stage-${index}-sla-requestor`}
                name={`data.stages.${index}.sla_warning_notification.recipients.requestor`}
                label={t("requester")}
                isDisabled={isDisabled}
              />
              <SlaWarningSwitch
                form={form}
                id={`stage-${index}-sla-current`}
                name={`data.stages.${index}.sla_warning_notification.recipients.current_approve`}
                label={t("currentApprover")}
                isDisabled={isDisabled}
              />
            </div>
          </FieldSet>
        </>
      )}
    </FieldGroup>
  );
}

interface NotificationSectionProps {
  readonly form: UseFormReturn<WorkflowCreateModel>;
  readonly index: number;
  readonly action: WfAction;
  readonly label: string;
  readonly showNextStep: boolean;
  readonly isDisabled: boolean;
  readonly readOnly: boolean;
  readonly templateLabels: ReadonlyMap<string, string>;
}

function NotificationSection({
  form,
  index,
  action,
  label,
  showNextStep,
  isDisabled,
  readOnly,
  templateLabels,
}: NotificationSectionProps) {
  const t = useTranslations("systemAdmin.workflow");
  const dotClass = action === "submit" ? null : ACTION_DOT_CLASS[action];
  const rowProps = {
    form,
    index,
    action,
    isDisabled,
    readOnly,
    templateLabels,
  };

  return (
    <FieldSet className="gap-3">
      <FieldLegend variant="label" className="mb-0 flex items-center gap-2">
        {dotClass && (
          <span
            aria-hidden="true"
            className={cn("size-2 rounded-full", dotClass)}
          />
        )}
        {label}
      </FieldLegend>
      <div className="flex flex-col gap-3">
        <RecipientRow
          {...rowProps}
          recipient="requestor"
          label={t("requester")}
        />
        {/* ไม่มีแถว `current_approve` — dispatcher ส่งช่องนั้นให้คนที่เพิ่งกดเอง (submit = ผู้ขอ ซ้ำกับแถวบน)
            reject ใช้ `previous_step` แทนสำหรับผู้อนุมัติขั้นก่อนหน้า */}
        {action === "reject" && (
          <RecipientRow
            {...rowProps}
            recipient="previous_step"
            label={t("previousApprovers")}
          />
        )}
        {showNextStep && (
          <RecipientRow
            {...rowProps}
            recipient="next_step"
            label={
              action === "sendback" ? t("sendbackReceiver") : t("nextApprover")
            }
          />
        )}
      </div>
      {action === "approve" && (
        <p className="text-muted-foreground text-xs">{t("approveFinalHint")}</p>
      )}
    </FieldSet>
  );
}

interface RecipientRowProps {
  readonly form: UseFormReturn<WorkflowCreateModel>;
  readonly index: number;
  readonly action: WfAction;
  readonly recipient: WfRecipient;
  readonly label: string;
  readonly isDisabled: boolean;
  readonly readOnly: boolean;
  readonly templateLabels: ReadonlyMap<string, string>;
}

/**
 * ผู้รับหนึ่งคน = แถวเดียวตำแหน่งคงที่: สวิตช์ · ชื่อผู้รับ · ช่องทาง · template
 * สวิตช์ตัวเดียวคุม is_active / is_notification / ช่องทางในแอปพร้อมกัน (ตอนบันทึก
 * `syncRecipientChannels` ปรับข้อมูลเก่าให้ตรงอีกชั้น) ช่อง template ไม่หายตอนปิด
 * แค่ถูก disable — หน้าจึงไม่ดีดเวลาสลับ
 */
function RecipientRow({
  form,
  index,
  action,
  recipient,
  label,
  isDisabled,
  readOnly,
  templateLabels,
}: RecipientRowProps) {
  const t = useTranslations("systemAdmin.workflow");
  const base =
    `data.stages.${index}.available_actions.${action}.recipients.${recipient}` as const;
  const id = `stage-${index}-${action}-${recipient}`;

  const isActive = useWatch({
    control: form.control,
    name: `${base}.is_active`,
  });
  const templateId = useWatch({
    control: form.control,
    name: `${base}.notification_channel.app.notification_template_id`,
  });
  // dispatcher ฝั่ง backend ข้ามผู้รับที่ไม่มี template (`no_template_id`) — เตือนให้เห็นก่อนบันทึก
  const missingTemplate = Boolean(isActive) && !templateId;

  // โหมดดู: ชื่อเทมเพลตเป็นข้อมูลหลักของแถว จึงเป็นตัวหนังสือสีปกติ ไม่ใช่ select ที่ถูกปิดจนจาง
  // ช่องทางตัดออก — เหลือในแอปช่องทางเดียว
  if (readOnly) {
    return (
      <div className="grid grid-cols-1 gap-x-4 gap-y-0.5 @lg:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
        <span className="text-muted-foreground text-sm">{label}</span>
        {!isActive ? (
          <span className="text-muted-foreground text-sm">
            {t("notifyOff")}
          </span>
        ) : missingTemplate ? (
          <span className="text-warning-ink flex items-center gap-1 text-sm">
            <CircleAlert className="size-3.5 shrink-0" aria-hidden="true" />
            {t("templateMissing")}
          </span>
        ) : (
          <span className="text-foreground min-w-0 text-sm">
            {(templateId && templateLabels.get(templateId)) ?? "…"}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 items-start gap-x-4 gap-y-1.5 @lg:grid-cols-[minmax(0,14rem)_auto_minmax(0,1fr)]">
      <Controller
        control={form.control}
        name={`${base}.is_active`}
        render={({ field }) => (
          <Field orientation="horizontal" className="min-h-8 gap-2">
            <Switch
              id={id}
              checked={Boolean(field.value)}
              onCheckedChange={(checked) => {
                field.onChange(checked);
                form.setValue(`${base}.is_notification`, checked, {
                  shouldDirty: true,
                });
                form.setValue(
                  `${base}.notification_channel.app.is_active`,
                  checked,
                  { shouldDirty: true },
                );
              }}
              disabled={isDisabled}
            />
            <FieldLabel htmlFor={id} className="font-medium">
              {label}
            </FieldLabel>
          </Field>
        )}
      />
      <span className="text-muted-foreground hidden min-h-8 items-center text-xs @lg:flex">
        {t("channelApp")}
      </span>
      <div className="flex flex-col gap-1">
        <Controller
          control={form.control}
          name={`${base}.notification_channel.app.notification_template_id`}
          render={({ field }) => (
            <LookupNotificationTemplate
              value={field.value ?? ""}
              onValueChange={field.onChange}
              channelType="app"
              disabled={isDisabled || !isActive}
              className="w-full"
            />
          )}
        />
        {missingTemplate && (
          <p className="text-warning-ink flex items-center gap-1 text-xs">
            <CircleAlert className="size-3.5 shrink-0" aria-hidden="true" />
            {t("templateMissing")}
          </p>
        )}
      </div>
    </div>
  );
}

interface SlaWarningSwitchProps {
  readonly form: UseFormReturn<WorkflowCreateModel>;
  readonly id: string;
  readonly name: `data.stages.${number}.sla_warning_notification.recipients.${"requestor" | "current_approve"}`;
  readonly label: string;
  readonly isDisabled: boolean;
}

function SlaWarningSwitch({
  form,
  id,
  name,
  label,
  isDisabled,
}: SlaWarningSwitchProps) {
  return (
    <Controller
      control={form.control}
      name={name}
      render={({ field }) => (
        <Field orientation="horizontal" className="w-auto gap-2">
          <Switch
            id={id}
            checked={Boolean(field.value)}
            onCheckedChange={field.onChange}
            disabled={isDisabled}
          />
          <FieldLabel htmlFor={id} className="font-medium">
            {label}
          </FieldLabel>
        </Field>
      )}
    />
  );
}
