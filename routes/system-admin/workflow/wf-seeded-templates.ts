import type { Stage } from "@/types/workflows";

/** code (`wf.<action>.<slot>`) → id ของเทมเพลตระบบที่ backend seed ไว้ */
export type SeededTemplateIds = ReadonlyMap<string, string>;

const ACTIONS = ["submit", "approve", "reject", "sendback"] as const;
const SLOTS = ["requestor", "current_approve", "next_step"] as const;

/**
 * เติม template เริ่มต้นให้ช่องที่ยังว่าง (`""`) ตาม code `wf.<action>.<slot>`
 * ช่องที่ผู้ใช้เลือกไว้แล้ว และสวิตช์ทุกตัว ไม่ถูกแตะ — `wf.complete.requestor`
 * ไม่ต้องเติม เพราะ backend ใช้เองตอนส่งจริงเมื่ออนุมัติขั้นสุดท้าย
 */
export function fillSeededTemplateIds<
  S extends { available_actions: Stage["available_actions"] },
>(stages: S[], ids: SeededTemplateIds): S[] {
  if (ids.size === 0) return stages;
  return stages.map((stage) => {
    const available_actions = { ...stage.available_actions };
    for (const action of ACTIONS) {
      const current = available_actions[action];
      if (!current) continue;
      const recipients = { ...current.recipients };
      for (const slot of SLOTS) {
        const recipient = recipients[slot];
        const app = recipient?.notification_channel?.app;
        if (!app || app.notification_template_id !== "") continue;
        const id = ids.get(`wf.${action}.${slot}`);
        if (!id) continue;
        recipients[slot] = {
          ...recipient,
          notification_channel: {
            ...recipient.notification_channel,
            app: { ...app, notification_template_id: id },
          },
        };
      }
      available_actions[action] = { ...current, recipients };
    }
    return { ...stage, available_actions };
  });
}
