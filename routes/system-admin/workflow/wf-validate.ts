import { type Stage, WORKFLOW_TYPE } from "@/types/workflows";
import { getAllowedRoles } from "./wf-role-colors";

export type IssueSeverity = "error" | "warning" | "info";

export type IssueCode =
  | "no_users_assigned"
  | "no_approval_stage"
  | "no_actions_enabled"
  | "duplicate_name"
  | "missing_create_role"
  | "missing_completed_stage"
  | "no_sla"
  | "empty_name"
  | "role_not_allowed"
  | "submit_only_on_first";

export interface ValidationIssue {
  readonly code: IssueCode;
  readonly severity: IssueSeverity;
  readonly stageIndex?: number;
  readonly stageName?: string;
  readonly translationKey: string;
  readonly translationValues?: Record<string, string | number>;
}

interface ValidationSummary {
  readonly issues: ValidationIssue[];
  readonly errorCount: number;
  readonly warningCount: number;
  readonly infoCount: number;
  readonly isReady: boolean;
}

/**
 * ชนิดที่ submit แล้วเอกสารเป็น in_progress เสมอ — ไม่มีขั้นอนุมัติ = ค้างที่ขั้นสุดท้ายตลอดไป
 * (ชนิดบัญชี post ตอน submit ได้ เพราะ backend จบ workflow ให้เอง) ต้องตรงกับ
 * `workflow-stage-rules.helper.ts` ฝั่ง backend
 */
const NEEDS_APPROVAL_STAGE: ReadonlySet<string> = new Set([
  WORKFLOW_TYPE.PR,
  WORKFLOW_TYPE.PO,
  WORKFLOW_TYPE.SR,
]);

/**
 * ปัญหาที่ทำให้เอกสารค้างจริง — backend ปฏิเสธการบันทึกด้วยกฎเดียวกัน ฟอร์มจึงกัน Save
 * ด้วยสองตัวนี้เท่านั้น error ตัวอื่นในแผงยังเป็นคำแนะนำ
 */
export const SAVE_BLOCKING_CODES: ReadonlySet<IssueCode> = new Set([
  "no_users_assigned",
  "no_approval_stage",
]);

/**
 * ปัญหาแรกที่ทำให้บันทึกไม่ได้ หรือ undefined
 *
 * รับ stage แบบหลวม เพราะ payload ของฟอร์มสร้าง (zod) มี `sla_unit` เป็น string ไม่ใช่ union
 * กฎที่ใช้อ่านแค่ชื่อ/ผู้ใช้/HOD/ขั้นของผู้ขอ จึงไม่กระทบ
 */
export function findSaveBlockingIssue(
  stages: readonly unknown[] | undefined,
  workflowType?: string,
): ValidationIssue | undefined {
  return validateWorkflow((stages ?? []) as Stage[], workflowType).issues.find(
    (i) => SAVE_BLOCKING_CODES.has(i.code),
  );
}

const isAnyActionActive = (stage: Stage): boolean => {
  const a = stage.available_actions;
  if (!a) return false;
  return (
    a.submit?.is_active === true ||
    a.approve?.is_active === true ||
    a.reject?.is_active === true ||
    a.sendback?.is_active === true
  );
};

export function validateWorkflow(
  stages: Stage[],
  workflowType?: string,
): ValidationSummary {
  const issues: ValidationIssue[] = [];

  if (!stages || stages.length === 0) {
    return {
      issues: [],
      errorCount: 0,
      warningCount: 0,
      infoCount: 0,
      isReady: true,
    };
  }

  const lastIndex = stages.length - 1;
  const allowedRoles = getAllowedRoles(workflowType);
  const seenNames = new Map<string, number[]>();

  stages.forEach((stage, index) => {
    const isFirst = index === 0;
    const isLast = index === lastIndex;
    // ขั้นที่ผู้ขอทำเอง (only_creator) มีคนทำ action อยู่แล้ว แม้ไม่มี assigned_users
    const isHod =
      (stage.is_hod ?? false) || stage.creator_access === "only_creator";
    const userCount = stage.assigned_users?.length ?? 0;
    const trimmedName = (stage.name ?? "").trim();

    if (!trimmedName) {
      issues.push({
        code: "empty_name",
        severity: "warning",
        stageIndex: index,
        stageName: trimmedName || `#${index + 1}`,
        translationKey: "issueEmptyName",
      });
    } else {
      const existing = seenNames.get(trimmedName) ?? [];
      existing.push(index);
      seenNames.set(trimmedName, existing);
    }

    if (!isFirst && !isLast && !isHod && userCount === 0) {
      issues.push({
        code: "no_users_assigned",
        severity: "error",
        stageIndex: index,
        stageName: trimmedName || `#${index + 1}`,
        translationKey: "issueNoUsers",
        translationValues: { stage: trimmedName || `#${index + 1}` },
      });
    }

    // ขั้นจบไม่มี role ให้เลือก (หน้าจอไม่มีฟอร์มให้) จึงไม่ตรวจ
    if (!isLast && stage.role && !allowedRoles.includes(stage.role)) {
      issues.push({
        code: "role_not_allowed",
        severity: "error",
        stageIndex: index,
        stageName: trimmedName || `#${index + 1}`,
        translationKey: "issueRoleNotAllowed",
        translationValues: { stage: trimmedName || `#${index + 1}` },
      });
    }

    if (!isFirst && !isLast && !isAnyActionActive(stage)) {
      issues.push({
        code: "no_actions_enabled",
        severity: "error",
        stageIndex: index,
        stageName: trimmedName || `#${index + 1}`,
        translationKey: "issueNoActions",
        translationValues: { stage: trimmedName || `#${index + 1}` },
      });
    }

    if (!isFirst && !isLast) {
      const slaNumber = Number(stage.sla);
      if (!Number.isFinite(slaNumber) || slaNumber <= 0) {
        issues.push({
          code: "no_sla",
          severity: "warning",
          stageIndex: index,
          stageName: trimmedName || `#${index + 1}`,
          translationKey: "issueNoSla",
          translationValues: { stage: trimmedName || `#${index + 1}` },
        });
      }
    }
  });

  if (
    workflowType &&
    NEEDS_APPROVAL_STAGE.has(workflowType) &&
    stages.length < 3
  ) {
    issues.push({
      code: "no_approval_stage",
      severity: "error",
      translationKey: "issueNoApprovalStage",
    });
  }

  if (stages[0]?.role !== "create") {
    issues.push({
      code: "missing_create_role",
      severity: "error",
      stageIndex: 0,
      stageName: stages[0]?.name,
      translationKey: "issueFirstNotCreate",
    });
  }

  const lastStage = stages[lastIndex];
  const lastNameLower = (lastStage?.name ?? "").toLowerCase();
  if (lastNameLower !== "completed" && !lastNameLower.includes("complet")) {
    issues.push({
      code: "missing_completed_stage",
      severity: "warning",
      stageIndex: lastIndex,
      stageName: lastStage?.name,
      translationKey: "issueLastNotCompleted",
    });
  }

  for (const [name, indices] of seenNames.entries()) {
    if (indices.length > 1) {
      indices.forEach((idx) => {
        issues.push({
          code: "duplicate_name",
          severity: "error",
          stageIndex: idx,
          stageName: name,
          translationKey: "issueDuplicateName",
          translationValues: { name },
        });
      });
    }
  }

  const errorCount = issues.filter((i) => i.severity === "error").length;
  const warningCount = issues.filter((i) => i.severity === "warning").length;
  const infoCount = issues.filter((i) => i.severity === "info").length;

  return {
    issues,
    errorCount,
    warningCount,
    infoCount,
    isReady: errorCount === 0,
  };
}
