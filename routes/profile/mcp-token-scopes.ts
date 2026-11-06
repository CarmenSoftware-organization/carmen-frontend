import type { McpTokenScope } from "@/types/mcp-token";

export type McpScopeGroupKey = "read" | "write" | "api";

export interface McpScopeGroup {
  readonly key: McpScopeGroupKey;
  readonly scopes: readonly McpTokenScope[];
}

/**
 * กลุ่ม scope ที่ให้เลือกตอนสร้างโทเค็น — ลำดับเดียวกับที่แสดงในฟอร์ม
 * write และ api ต้องขอระบุเองเสมอ (backend ไม่เคยให้เป็น default)
 */
export const MCP_SCOPE_GROUPS: readonly McpScopeGroup[] = [
  { key: "read", scopes: ["read:master", "read:procurement", "read:recipe", "read:inventory"] },
  { key: "write", scopes: ["write:master", "write:recipe", "write:inventory"] },
  { key: "api", scopes: ["read:api", "write:api"] },
];

/** ค่าเริ่มต้นของฟอร์ม = scope อ่านทั้งหมด ตรงกับ default ของ backend ตอนไม่ระบุ scope */
export const DEFAULT_MCP_SCOPES: readonly McpTokenScope[] = MCP_SCOPE_GROUPS[0].scopes;

/** คีย์ i18n ของ scope — ":" ใช้ในคีย์ของ use-intl ไม่ได้ */
export function getMcpScopeMessageKey(scope: McpTokenScope): string {
  return scope.replace(":", "_");
}
