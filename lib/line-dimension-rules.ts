import { API_ENDPOINTS } from "@/constant/api-endpoints";
import { ApiError } from "@/lib/api-error";
import { httpClient } from "@/lib/http-client";
import { dimensionRefHasValue } from "@/lib/dimension-value";
import type { LineDimensionDocType } from "@/lib/line-dimension-scope";
import type { DimensionMaster } from "@/types/accounting-master";
import type { DimensionRef } from "@/types/gl-dimension";

/** จำนวนบรรทัดสูงสุดต่อหนึ่งคำขอ (เพดานฝั่ง backend) */
const MAX_LINES_PER_REQUEST = 500;

/** บรรทัดที่ส่งไปถามกฎ dimension */
export interface LineDimensionRuleInput {
  key: string;
  doc_type: LineDimensionDocType;
  product_id: string | null;
  location_id: string | null;
  to_location_id?: string | null;
  adjustment_type_id?: string | null;
}

/** บัญชีที่ backend แก้ได้จาก mapping ของบรรทัดนั้น */
export interface LineDimensionAccount {
  movement: string;
  chart_of_accounts_id: string | null;
  account_code: string | null;
  source: string | null;
  issue: string | null;
  location_id: string | null;
  item_group_id: string | null;
  adjustment_type_id: string | null;
  account_mapping_id: string | null;
}

/** กฎของ dimension หนึ่งตัวที่รวมข้ามบัญชีแล้ว (ไม่รวมตัวที่ conflict) */
export interface LineDimensionRule {
  dimension_id: string;
  requirement: "mandatory" | "optional" | "prohibited";
  default_value: DimensionRef | null;
}

/** ผลของบรรทัดหนึ่ง */
export interface LineDimensionRuleResult {
  key: string;
  status: "resolved" | "no_account" | "skipped" | "conflict";
  accounts: LineDimensionAccount[];
  rules: LineDimensionRule[];
  conflict_dimension_ids: string[];
}

/**
 * ถามกฎ dimension ของบรรทัด — แบ่งทีละ 500 บรรทัดแล้วรวมผลตามลำดับ
 *
 * @param buCode - รหัส BU
 * @param lines - บรรทัดที่ต้องการถาม
 */
export async function fetchLineDimensionRules(
  buCode: string,
  lines: LineDimensionRuleInput[],
): Promise<LineDimensionRuleResult[]> {
  const results: LineDimensionRuleResult[] = [];
  for (let i = 0; i < lines.length; i += MAX_LINES_PER_REQUEST) {
    const res = await httpClient.post(
      API_ENDPOINTS.LINE_DIMENSION_RULES(buCode),
      { lines: lines.slice(i, i + MAX_LINES_PER_REQUEST) },
    );
    if (!res.ok) throw await ApiError.from(res, "Failed to load line dimension rules");
    const json = await res.json();
    const data = json?.data;
    if (!Array.isArray(data)) throw new Error("Invalid line dimension rules response");
    results.push(...(data as LineDimensionRuleResult[]));
  }
  return results;
}

/**
 * dimension ที่ต้องแสดงบนบรรทัด: active และมีกฎ mandatory/optional
 * ค่าที่เลือกไว้แล้วแสดงเสมอ แม้ master หรือกฎเปลี่ยนไป
 *
 * @param dimensions - master ของ dimension
 * @param result - ผลกฎของบรรทัดนี้
 * @param selected - ค่าที่เลือกไว้
 */
export function visibleDimensionsForRules(
  dimensions: DimensionMaster[],
  result: LineDimensionRuleResult | undefined,
  selected: DimensionRef[],
): DimensionMaster[] {
  return dimensions.filter((dimension) => {
    if (selected.some((item) => item.dimension_id === dimension.id)) return true;
    if (!dimension.is_active) return false;
    return !!result?.rules.some(
      (rule) =>
        rule.dimension_id === dimension.id && rule.requirement !== "prohibited",
    );
  });
}

/**
 * เติมค่า default ของกฎ mandatory ที่ dimension นั้นยังไม่มีค่า (ไม่เขียนทับของเดิม)
 *
 * @param selected - ค่าที่เลือกไว้
 * @param result - ผลกฎของบรรทัดนี้
 * @returns รายการใหม่ หรือ null ถ้าไม่มีอะไรต้องเติม
 */
export function fillRuleDefaults(
  selected: DimensionRef[],
  result: LineDimensionRuleResult | undefined,
): DimensionRef[] | null {
  if (!result) return null;
  const additions: DimensionRef[] = [];
  for (const rule of result.rules) {
    if (rule.requirement !== "mandatory" || !rule.default_value) continue;
    const existing = selected.find((item) => item.dimension_id === rule.dimension_id);
    if (existing && dimensionRefHasValue(existing)) continue;
    additions.push(rule.default_value);
  }
  if (additions.length === 0) return null;
  const filledIds = new Set(additions.map((item) => item.dimension_id));
  return [
    ...selected.filter((item) => !filledIds.has(item.dimension_id)),
    ...additions,
  ];
}

/** ความผิดปกติของ dimension บนบรรทัด */
export interface LineDimensionViolation {
  key: string;
  dimension_id: string;
  kind: "required" | "prohibited" | "conflict";
}

/**
 * ตรวจก่อนส่ง: conflict รายงานต่อ dimension, resolved ตรวจ required/prohibited
 * (no_account / skipped / ไม่มีผล ข้าม)
 *
 * @param lines - บรรทัดพร้อม dimension ที่เลือก
 * @param results - ผลกฎต่อ key
 */
export function findLineDimensionViolations(
  lines: { key: string; dimensions: DimensionRef[] }[],
  results: Map<string, LineDimensionRuleResult>,
): LineDimensionViolation[] {
  const violations: LineDimensionViolation[] = [];
  for (const line of lines) {
    const result = results.get(line.key);
    if (!result) continue;
    if (result.status === "conflict") {
      for (const id of result.conflict_dimension_ids) {
        violations.push({ key: line.key, dimension_id: id, kind: "conflict" });
      }
      continue;
    }
    if (result.status !== "resolved") continue;
    for (const rule of result.rules) {
      const hasValue = line.dimensions.some(
        (item) => item.dimension_id === rule.dimension_id && dimensionRefHasValue(item),
      );
      if (rule.requirement === "mandatory" && !rule.default_value && !hasValue) {
        violations.push({ key: line.key, dimension_id: rule.dimension_id, kind: "required" });
      } else if (rule.requirement === "prohibited" && hasValue) {
        violations.push({ key: line.key, dimension_id: rule.dimension_id, kind: "prohibited" });
      }
    }
  }
  return violations;
}
