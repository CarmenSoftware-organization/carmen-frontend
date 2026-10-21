import { z } from "zod";
import type { TranslationFn } from "@/lib/i18n-schema";
import {
  WORKFLOW_TYPE,
  type Recipients,
  type RecipientNotification,
  type Stage,
  type Workflow,
} from "@/types/workflows";

export function emptyRecipientNotification(
  isActive = false,
): RecipientNotification {
  return {
    is_active: isActive,
    is_notification: isActive,
    notification_channel: {
      app: { is_active: isActive, notification_template_id: "" },
      email: { is_active: false, notification_template_id: "" },
    },
  };
}

export function makeRecipients(
  requestor: boolean,
  currentApprove: boolean,
  nextStep: boolean,
  previousStep = false,
): Recipients {
  return {
    requestor: emptyRecipientNotification(requestor),
    current_approve: emptyRecipientNotification(currentApprove),
    next_step: emptyRecipientNotification(nextStep),
    previous_step: emptyRecipientNotification(previousStep),
  };
}

export function createWorkflowFormSchema(tv: TranslationFn, tf: TranslationFn) {
  return z.object({
    name: z
      .string()
      .min(1, tv("required", { field: tf("workflowName") }))
      .max(100),
    workflow_type: z
      .string()
      .min(1, tv("required", { field: tf("workflowType") })),
    is_active: z.boolean(),
    description: z.string().optional(),
  });
}

export const createWorkflowSchema = z.object({
  name: z.string().min(1, "Workflow name is required").max(100),
  workflow_type: z.string().min(1, "Workflow type is required"),
  is_active: z.boolean(),
  description: z.string().optional(),
});

export type WorkflowFormValues = z.infer<typeof createWorkflowSchema>;

export const EMPTY_FORM: WorkflowFormValues = {
  name: "",
  workflow_type: WORKFLOW_TYPE.PR,
  is_active: true,
  description: "",
};

const channelConfigSchema = z.object({
  is_active: z.boolean(),
  notification_template_id: z.string(),
});

// row เก่าเก็บ recipient เป็น boolean ล้วน — ยอมรับแล้วแปลงเป็น object shape ใหม่
// ไม่งั้น safeParse ตกทั้ง data แล้ว stages หายทั้งชุด (ดู `getWorkflowFormDefaults`)
const recipientNotificationSchema = z.union([
  z.boolean().transform((isActive) => emptyRecipientNotification(isActive)),
  z.object({
    is_active: z.boolean(),
    is_notification: z.boolean(),
    notification_channel: z.object({
      app: channelConfigSchema,
      email: channelConfigSchema,
    }),
  }),
]);

const recipientsSchema = z.object({
  requestor: recipientNotificationSchema,
  current_approve: recipientNotificationSchema,
  next_step: recipientNotificationSchema,
  // ต้องประกาศไว้ ไม่งั้น zod ตัดทิ้งตอน parse แล้วค่าที่ตั้งไว้หายเมื่อกดเซฟ
  previous_step: recipientNotificationSchema.optional(),
});

const actionSchema = z.object({
  is_active: z.boolean(),
  recipients: recipientsSchema,
});

export const wfFormSchema = z.object({
  id: z.uuid().optional(),
  doc_version: z.number().optional(),
  name: z.string().min(1).max(100),
  workflow_type: z.string(),
  is_active: z.boolean(),
  data: z.object({
    document_reference_pattern: z.string(),
    // เฉพาะ workflow ของ PO — เปิดแล้วใบสั่งซื้อจะพิมพ์ลายเซ็นของ PR ต้นทางก่อน แล้วตามด้วยของตัวเอง
    //
    // ต้องประกาศไว้ตรงนี้ ไม่งั้น zod ตัดทิ้งตอน `parseWorkflowData` แล้วหน้านี้ PUT `data` ทั้งก้อน
    // กลับไป (รวมถึงปุ่ม toggle/duplicate ในหน้า list) ค่าที่เปิดไว้จะโดนปิดเงียบ ๆ ทุกครั้งที่มีคนกดเซฟ
    inherit_signature_from_pr: z.boolean().optional(),
    stages: z.array(
      z.object({
        name: z.string().min(1).max(100),
        description: z.string().optional(),
        sla: z.string(),
        sla_unit: z.string(),
        role: z.string().optional(),
        creator_access: z.string().optional(),
        available_actions: z.object({
          submit: actionSchema,
          approve: actionSchema,
          reject: actionSchema,
          sendback: actionSchema,
        }),
        hide_fields: z.object({
          price_per_unit: z.boolean(),
          total_price: z.boolean(),
        }),
        is_show_signature: z.boolean().optional(),
        assigned_users: z
          .array(
            z.object({
              user_id: z.string(),
              firstname: z.string(),
              middlename: z.string(),
              lastname: z.string(),
              email: z.string(),
              department: z
                .object({
                  id: z.string().optional(),
                  name: z.string().optional(),
                })
                .optional(),
              initials: z.string().optional(),
            }),
          )
          .optional(),
        is_hod: z.boolean().optional(),
        sla_warning_notification: z
          .object({
            recipients: z.object({
              requestor: z.boolean().default(false),
              current_approve: z.boolean().default(false),
            }),
            template: z.string().optional(),
          })
          .optional(),
      }),
    ),
    routing_rules: z.array(
      z.object({
        name: z.string(),
        description: z.string(),
        trigger_stage: z.string(),
        condition: z.object({
          field: z.string(),
          operator: z.enum(["eq", "lt", "gt", "lte", "gte", "between"]),
          value: z.array(z.string()),
          min_value: z.string().optional(),
          max_value: z.string().optional(),
        }),
        action: z.object({
          type: z.enum(["SKIP_STAGE", "NEXT_STAGE"]),
          parameters: z.object({ target_stage: z.string() }),
        }),
      }),
    ),
    notifications: z.array(z.object({})),
    notification_templates: z.array(z.object({})),
    // เก็บแค่ id ตามสัญญาฝั่ง backend (micro-business `workflow.types.ts`: `products: string[]`)
    // เดิมหน้านี้เก็บอ็อบเจ็กต์สินค้าเต็มใบ ซึ่งใหญ่กว่า id ล้วนราว 14 เท่า — BU ที่มีสินค้า 2,594
    // รายการกลายเป็น body ~1.4 MB ตอนกด Save และ gateway ปฏิเสธทิ้งด้วย "request entity too
    // large" นอกจากขนาดแล้วสำเนา name/code/category ที่ฝังอยู่ยังเก่าค้างเมื่อสินค้าถูกแก้ทีหลัง
    // ชื่อกับหมวดที่จะแสดงผลให้ resolve จากรายการสินค้าสด (`allProducts`) เอา
    //
    // ยอมอ่านรูปแบบเก่า (อ็อบเจ็กต์) แล้วยุบเหลือ id เพราะ `getWorkflowFormDefaults` ตั้งใจ throw
    // เมื่อ parse ไม่ผ่าน — ถ้ารับแค่ string ล้วน workflow ที่เคยเซฟด้วยโค้ดรุ่นก่อนจะเปิดหน้าแก้ไข
    // ไม่ได้เลย เอกสารเก่าจะถูกเขียนกลับเป็น id ล้วนเองตอน save ครั้งถัดไป
    products: z.array(
      z.union([
        z.string(),
        z.object({ id: z.string() }).transform((p) => p.id),
      ]),
    ),
  }),
  description: z.string().optional(),
});

export type WorkflowCreateModel = z.infer<typeof wfFormSchema>;

export const DEFAULT_WORKFLOW_DATA: WorkflowCreateModel["data"] = {
  document_reference_pattern: "PR-{YYYY}-{MM}-{####}",
  stages: [],
  routing_rules: [],
  notifications: [],
  notification_templates: [],
  products: [],
};

export class WorkflowDataParseError extends Error {
  constructor() {
    super("Workflow data does not match the current schema");
    this.name = "WorkflowDataParseError";
  }
}

export function parseWorkflowData(data: unknown) {
  return wfFormSchema.shape.data.safeParse(data);
}

/**
 * แปลง workflow จาก API เป็นค่าตั้งต้นของฟอร์ม
 *
 * parse ไม่ผ่านให้ throw ห้าม fallback เป็นค่าว่าง — ค่าที่ได้ตัวนี้ถูกส่งกลับไป
 * PUT ทั้งก้อน (ทั้งหน้า detail และปุ่ม toggle/duplicate ในหน้า list) ถ้าเงียบไว้
 * stages จริงในฐานข้อมูลจะโดนเขียนทับด้วยของว่างโดยไม่มีใครรู้
 *
 * @throws {WorkflowDataParseError} เมื่อ `workflow.data` ไม่ตรง schema ปัจจุบัน
 */
export function getWorkflowFormDefaults(
  workflow: Workflow,
): WorkflowCreateModel {
  const parsedData = parseWorkflowData(workflow.data);
  if (!parsedData.success) throw new WorkflowDataParseError();

  return {
    id: workflow.id,
    name: workflow.name,
    workflow_type: workflow.workflow_type,
    is_active: workflow.is_active,
    description: workflow.description ?? "",
    data: {
      ...parsedData.data,
      stages: moveRejectPreviousApprover(parsedData.data.stages),
    },
  };
}

/**
 * ย้ายค่าแถว "ผู้อนุมัติขั้นก่อนหน้า" ตอนปฏิเสธจาก `current_approve` ไป `previous_step`
 *
 * หน้านี้เคยผูกแถวนั้นกับ `current_approve` แต่ dispatcher ฝั่ง backend ส่ง `current_approve`
 * ให้ผู้กดปฏิเสธเอง ส่วนผู้อนุมัติขั้นก่อนหน้าคือ `previous_step` — stage ไหนที่ reject ยังไม่มี
 * `previous_step` ให้ยกค่าเดิมของ `current_approve` ไปไว้ที่ `previous_step` แล้วปิด
 * `current_approve` (ตรงกับ seed step `move-reject-previous` ของ backend) stage ที่มี
 * `previous_step` แล้วไม่แตะ จึงเรียกซ้ำได้ ไม่แก้ของเดิม
 * @param stages - stage ที่ parse แล้ว
 * @returns สำเนาที่ reject ของทุก stage มี `previous_step`
 */
export function moveRejectPreviousApprover<
  S extends { available_actions: { reject: { recipients: Recipients } } },
>(stages: S[]): S[] {
  return stages.map((stage) => {
    const reject = stage.available_actions.reject;
    if (reject.recipients.previous_step !== undefined) return stage;
    return {
      ...stage,
      available_actions: {
        ...stage.available_actions,
        reject: {
          ...reject,
          recipients: {
            ...reject.recipients,
            previous_step: reject.recipients.current_approve,
            current_approve: emptyRecipientNotification(false),
          },
        },
      },
    };
  });
}

export function buildDefaultStages(): Stage[] {
  return [
    {
      name: "Create Request",
      description: "",
      sla: "24",
      sla_unit: "hours",
      role: "create",
      creator_access: "only_creator",
      available_actions: {
        submit: {
          is_active: true,
          recipients: makeRecipients(true, false, true),
        },
        approve: {
          is_active: false,
          recipients: makeRecipients(false, false, false),
        },
        reject: {
          is_active: false,
          recipients: makeRecipients(false, false, false),
        },
        sendback: {
          is_active: false,
          recipients: makeRecipients(false, false, false),
        },
      },
      hide_fields: { price_per_unit: false, total_price: false },
      is_show_signature: false,
      assigned_users: [],
    },
    {
      name: "Completed",
      description: "",
      sla: "0",
      sla_unit: "hours",
      role: "approve",
      available_actions: {
        submit: {
          is_active: false,
          recipients: makeRecipients(false, false, false),
        },
        approve: {
          is_active: false,
          recipients: makeRecipients(false, false, false),
        },
        reject: {
          is_active: false,
          recipients: makeRecipients(false, false, false),
        },
        sendback: {
          is_active: false,
          recipients: makeRecipients(false, false, false),
        },
      },
      hide_fields: { price_per_unit: false, total_price: false },
      is_show_signature: false,
      assigned_users: [],
    },
  ];
}

export function mapToPayload(values: WorkflowFormValues): WorkflowCreateModel {
  return {
    id: crypto.randomUUID(),
    name: values.name,
    workflow_type: values.workflow_type,
    is_active: values.is_active,
    description: values.description ?? "",
    data: {
      document_reference_pattern: "PR-{YYYY}-{MM}-{####}",
      stages: buildDefaultStages(),
      routing_rules: [],
      notifications: [],
      notification_templates: [],
      products: [],
    },
  };
}

/**
 * ทำให้ "เปิดผู้รับ = ส่งในแอป" เป็นจริงตอนบันทึก — UI มีสวิตช์เดียวต่อผู้รับ แต่ dispatcher
 * ฝั่ง backend ตัดสินจาก 3 flag (`is_active`, `is_notification`, `notification_channel.app.is_active`)
 * workflow เก่าที่เคยติ๊ก In-app แยกไว้ไม่ตรงกับผู้รับ จะถูกปรับให้ตรงกันเมื่อบันทึกครั้งถัดไป
 * @param data - ข้อมูล workflow จากฟอร์ม
 * @returns สำเนาที่ flag ช่องทางในแอปของทุกผู้รับตรงกับสวิตช์ผู้รับ
 */
export function syncRecipientChannels(
  data: WorkflowCreateModel["data"],
): WorkflowCreateModel["data"] {
  return {
    ...data,
    stages: data.stages.map((stage) => ({
      ...stage,
      available_actions: Object.fromEntries(
        Object.entries(stage.available_actions).map(([action, config]) => [
          action,
          {
            ...config,
            recipients: Object.fromEntries(
              Object.entries(config.recipients)
                // `previous_step` เป็น optional — ข้ามคีย์ที่ไม่มีค่า
                .filter(
                  (entry): entry is [string, RecipientNotification] =>
                    entry[1] !== undefined,
                )
                .map(([slot, recipient]) => [
                  slot,
                  {
                    ...recipient,
                    is_notification: recipient.is_active,
                    notification_channel: {
                      ...recipient.notification_channel,
                      app: {
                        ...recipient.notification_channel.app,
                        is_active: recipient.is_active,
                      },
                    },
                  },
                ]),
            ),
          },
        ]),
      ) as typeof stage.available_actions,
    })),
  };
}
