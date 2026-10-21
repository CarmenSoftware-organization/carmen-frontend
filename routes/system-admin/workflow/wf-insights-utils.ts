import {
  WORKFLOW_TYPE,
  type Role,
  type Stage,
  type SlaUnit,
} from "@/types/workflows";

const UNIT_TO_MINUTES: Record<SlaUnit, number> = {
  minutes: 1,
  hours: 60,
  days: 60 * 24,
};

export type ActionKey = "submit" | "approve" | "reject" | "sendback";
export type RecipientKey = "requestor" | "current_approve" | "next_step";

export interface StageActionCell {
  readonly active: boolean;
  /** จำนวนผู้รับแจ้งเตือนที่เปิดอยู่ของปุ่มนี้ (requestor / current approver / next step) */
  readonly recipients: number;
}

/** หนึ่งแถวของตาราง stage ในแท็บ Insights — ไม่รวมขั้นสุดท้าย (Completed) ที่ไม่มีปุ่มหรือ SLA */
export interface StageRow {
  readonly index: number;
  readonly name: string;
  readonly role: Role;
  readonly minutes: number;
  readonly userCount: number;
  readonly isHod: boolean;
  readonly actions: Record<ActionKey, StageActionCell>;
  /** null = ขั้นนี้ซ่อนฟิลด์ไม่ได้ (create/purchase หรือใบเบิก SR ที่ไม่มียอด) */
  readonly hidePrice: boolean | null;
  readonly hideTotal: boolean | null;
}

export interface QuickStats {
  readonly totalStages: number;
  readonly approverStages: number;
  readonly totalUsers: number;
  readonly hodStages: number;
}

export interface WorkflowInsights {
  readonly stageRows: StageRow[];
  readonly totalCycleMinutes: number;
  readonly stats: QuickStats;
}

export const ACTIONS: readonly ActionKey[] = [
  "submit",
  "approve",
  "reject",
  "sendback",
];
const RECIPIENTS: readonly RecipientKey[] = [
  "requestor",
  "current_approve",
  "next_step",
];

const stageMinutes = (stage: Stage): number => {
  const value = Number(stage.sla);
  if (!Number.isFinite(value) || value <= 0) return 0;
  const unit = (stage.sla_unit as SlaUnit) ?? "hours";
  return value * (UNIT_TO_MINUTES[unit] ?? 60);
};

/**
 * @param stages - stage ของ workflow
 * @param workflowType - ชนิด workflow — ใบเบิก (SR) ไม่มียอด ค่า hide_fields ที่ค้างอยู่ไม่มีผล
 *   จึงถือว่าซ่อนไม่ได้ (ไม่ส่ง = ตามปกติ)
 */
export function computeWorkflowInsights(
  stages: Stage[],
  workflowType?: string,
): WorkflowInsights {
  const safe = stages ?? [];
  // ขั้นสุดท้าย (Completed) ไม่มีปุ่ม/SLA/ผู้อนุมัติ — นับแค่ขั้นก่อนหน้า
  const middle = safe.slice(0, -1);

  const stageRows: StageRow[] = middle.map((stage, index) => {
    // stage create/purchase ไม่ถูกซ่อนราคาเสมอ และ SR ไม่มียอด — ค่าเก่าที่ค้างอยู่ไม่มีผล
    const canHide =
      workflowType !== WORKFLOW_TYPE.SR &&
      stage.role !== "create" &&
      stage.role !== "purchase";
    const actions = Object.fromEntries(
      ACTIONS.map((action) => {
        const a = stage.available_actions?.[action];
        const active = a?.is_active === true;
        const recipients = active
          ? RECIPIENTS.filter((r) => a?.recipients?.[r]?.is_active).length
          : 0;
        return [action, { active, recipients }];
      }),
    ) as Record<ActionKey, StageActionCell>;
    return {
      index,
      name: stage.name || `#${index + 1}`,
      role: stage.role,
      minutes: stageMinutes(stage),
      userCount: stage.assigned_users?.length ?? 0,
      isHod: stage.is_hod === true,
      actions,
      hidePrice: canHide ? stage.hide_fields?.price_per_unit === true : null,
      hideTotal: canHide ? stage.hide_fields?.total_price === true : null,
    };
  });

  const stats: QuickStats = {
    totalStages: safe.length,
    approverStages: middle.filter((s) => s.role === "approve").length,
    totalUsers: safe.reduce(
      (sum, s) => sum + (s.assigned_users?.length ?? 0),
      0,
    ),
    hodStages: middle.filter((s) => s.is_hod === true).length,
  };

  return {
    stageRows,
    totalCycleMinutes: stageRows.reduce((sum, row) => sum + row.minutes, 0),
    stats,
  };
}
