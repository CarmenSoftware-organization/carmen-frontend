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

export interface StageSlaRow {
  readonly index: number;
  readonly name: string;
  readonly minutes: number;
  readonly role: Role;
  readonly isFirst: boolean;
  readonly isLast: boolean;
}

export interface RoleDistributionRow {
  readonly role: Role;
  readonly count: number;
}

export type ActionKey = "submit" | "approve" | "reject" | "sendback";
export type RecipientKey = "requestor" | "current_approve" | "next_step";

export interface ActionCoverageRow {
  readonly action: ActionKey;
  readonly activeCount: number;
  readonly totalStages: number;
}

export interface RecipientCoverageRow {
  readonly recipient: RecipientKey;
  readonly count: number;
  readonly totalActiveActions: number;
}

export interface QuickStats {
  readonly totalStages: number;
  readonly approverStages: number;
  readonly totalUsers: number;
  readonly hodStages: number;
  readonly hiddenPriceCount: number;
  readonly hiddenTotalCount: number;
}

export interface WorkflowInsights {
  readonly stageSla: StageSlaRow[];
  readonly maxStageMinutes: number;
  readonly totalCycleMinutes: number;
  readonly roleDistribution: RoleDistributionRow[];
  readonly actionCoverage: ActionCoverageRow[];
  readonly recipientCoverage: RecipientCoverageRow[];
  readonly stats: QuickStats;
}

const ROLES: Role[] = ["create", "approve", "purchase", "issue"];
const ACTIONS: ActionKey[] = ["submit", "approve", "reject", "sendback"];
const RECIPIENTS: RecipientKey[] = [
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
 *   จึงไม่นับ (ไม่ส่ง = นับตามปกติ)
 */
export function computeWorkflowInsights(
  stages: Stage[],
  workflowType?: string,
): WorkflowInsights {
  const safe = stages ?? [];

  const stageSla: StageSlaRow[] = safe.map((stage, index) => ({
    index,
    name: stage.name ?? `#${index + 1}`,
    minutes: stageMinutes(stage),
    role: stage.role,
    isFirst: index === 0,
    isLast: index === safe.length - 1,
  }));

  const middleStages = stageSla.filter((row) => !row.isLast);
  const maxStageMinutes = middleStages.reduce(
    (max, row) => (row.minutes > max ? row.minutes : max),
    0,
  );
  const totalCycleMinutes = middleStages.reduce(
    (sum, row) => sum + row.minutes,
    0,
  );

  const roleDistribution: RoleDistributionRow[] = ROLES.map((role) => ({
    role,
    count: safe.filter((s, i) => s.role === role && i !== safe.length - 1)
      .length,
  })).filter((row) => row.count > 0);

  const middle = safe.slice(0, -1);

  const actionCoverage: ActionCoverageRow[] = ACTIONS.map((action) => ({
    action,
    activeCount: middle.filter(
      (s) => s.available_actions?.[action]?.is_active === true,
    ).length,
    totalStages: middle.length,
  }));

  const totalActiveActions = actionCoverage.reduce(
    (sum, row) => sum + row.activeCount,
    0,
  );

  const recipientCoverage: RecipientCoverageRow[] = RECIPIENTS.map(
    (recipient) => {
      let count = 0;
      for (const stage of middle) {
        for (const action of ACTIONS) {
          const a = stage.available_actions?.[action];
          if (a?.is_active && a.recipients?.[recipient]?.is_active) count++;
        }
      }
      return { recipient, count, totalActiveActions };
    },
  );

  const totalUsers = safe.reduce(
    (sum, s) => sum + (s.assigned_users?.length ?? 0),
    0,
  );

  const hideEligible =
    workflowType === WORKFLOW_TYPE.SR
      ? []
      : middle.filter((s) => s.role !== "create" && s.role !== "purchase");

  const stats: QuickStats = {
    totalStages: safe.length,
    approverStages: middle.filter((s) => s.role === "approve").length,
    totalUsers,
    hodStages: middle.filter((s) => s.is_hod === true).length,
    // stage create/purchase ไม่ถูกซ่อนราคาเสมอ และ SR ไม่มียอด — ค่าเก่าที่ค้างอยู่ไม่นับ
    hiddenPriceCount: hideEligible.filter(
      (s) => s.hide_fields?.price_per_unit === true,
    ).length,
    hiddenTotalCount: hideEligible.filter(
      (s) => s.hide_fields?.total_price === true,
    ).length,
  };

  return {
    stageSla,
    maxStageMinutes,
    totalCycleMinutes,
    roleDistribution,
    actionCoverage,
    recipientCoverage,
    stats,
  };
}
