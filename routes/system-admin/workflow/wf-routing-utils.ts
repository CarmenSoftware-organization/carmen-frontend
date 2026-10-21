import type { WorkflowCreateModel } from "./wf-form-schema";

type RoutingRule = WorkflowCreateModel["data"]["routing_rules"][number];

export type RoutingRuleIssue =
  "unknownTrigger" | "noField" | "noValue" | "category" | "badTarget";

/**
 * ขั้นที่เลือกเป็นปลายทางได้ — เฉพาะขั้นที่อยู่หลังขั้นที่กฎทำงาน
 *
 * ขั้นเดิมหรือขั้นก่อนหน้าจะพาเอกสารวนกลับมาเจอกฎเดิมซ้ำ (backend ไม่กันวน)
 * @param stageNames - ชื่อขั้นตามลำดับ
 * @param trigger - ชื่อขั้นที่กฎทำงาน
 * @returns ชื่อขั้นที่เป็นปลายทางได้
 */
export function routingTargetOptions(
  stageNames: string[],
  trigger: string,
): string[] {
  const from = stageNames.indexOf(trigger);
  return from < 0 ? [] : stageNames.slice(from + 1);
}

/**
 * ขั้นที่ถูกข้ามเมื่อกฎนี้ตรงเงื่อนไข (อยู่ระหว่างขั้นที่กฎทำงานกับปลายทาง)
 * @param stageNames - ชื่อขั้นตามลำดับ
 * @param trigger - ชื่อขั้นที่กฎทำงาน
 * @param target - ชื่อขั้นปลายทาง
 * @returns ชื่อขั้นที่ถูกข้าม (ว่างถ้าปลายทางคือขั้นถัดไปตามปกติ)
 */
export function routingSkippedStages(
  stageNames: string[],
  trigger: string,
  target: string,
): string[] {
  const from = stageNames.indexOf(trigger);
  const to = stageNames.indexOf(target);
  if (from < 0 || to <= from) return [];
  return stageNames.slice(from + 1, to);
}

/**
 * ชนิดของ action ตามปลายทาง — backend จัดการ `SKIP_STAGE` กับ `NEXT_STAGE` เหมือนกันทุกอย่าง
 * (ไปที่ `target_stage`) จึงไม่ให้ผู้ใช้เลือกเอง แต่ยังเก็บค่าที่สื่อความหมายไว้ในข้อมูล
 * @param stageNames - ชื่อขั้นตามลำดับ
 * @param trigger - ชื่อขั้นที่กฎทำงาน
 * @param target - ชื่อขั้นปลายทาง
 * @returns `NEXT_STAGE` ถ้าปลายทางคือขั้นถัดไป ไม่งั้น `SKIP_STAGE`
 */
export function routingActionType(
  stageNames: string[],
  trigger: string,
  target: string,
): "SKIP_STAGE" | "NEXT_STAGE" {
  return routingSkippedStages(stageNames, trigger, target).length === 0
    ? "NEXT_STAGE"
    : "SKIP_STAGE";
}

/**
 * เหตุผลที่กฎนี้จะไม่ทำงานตามที่ตั้งใจ — ตรงกับ `evaluateCondition` ของ micro-business:
 * ฟิลด์ว่างหรือค่าว่างให้ผลเป็น false เสมอ และเอกสารยังไม่มี category ระดับเอกสาร
 * (TODO ฝั่ง backend) กฎที่ใช้ category จึงไม่มีวันตรง
 * @param rule - กฎที่จะตรวจ
 * @param stageNames - ชื่อขั้นตามลำดับ
 * @returns ปัญหาแรกที่เจอ หรือ null ถ้ากฎพร้อมใช้
 */
export function routingRuleIssue(
  rule: RoutingRule | undefined,
  stageNames: string[],
): RoutingRuleIssue | null {
  if (!rule) return null;
  if (!stageNames.includes(rule.trigger_stage)) return "unknownTrigger";
  const { field, operator, value, min_value, max_value } = rule.condition;
  if (!field) return "noField";
  if (field === "category") return "category";
  if (field === "total_amount" && operator === "between") {
    if (!min_value || !max_value) return "noValue";
  } else if (!value?.length || !value[0]) {
    return "noValue";
  }
  const target = rule.action.parameters.target_stage;
  if (!routingTargetOptions(stageNames, rule.trigger_stage).includes(target)) {
    return "badTarget";
  }
  return null;
}
