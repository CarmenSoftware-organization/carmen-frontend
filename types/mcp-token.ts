/** แถวโทเค็น MCP ตามที่ GET /api/user/mcp-tokens คืน — ไม่มีโทเค็นดิบ */
export interface McpToken {
  id: string;
  name: string;
  token_prefix: string;
  expires_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
  created_at: string | null;
  doc_version: number;
}

/** response ของ POST — `token` ปรากฏที่นี่ครั้งเดียว */
export interface McpTokenCreated {
  id: string;
  name: string;
  token_prefix: string;
  token: string;
  expires_at: string;
  doc_version: number;
}

export type McpTokenStatus = "active" | "expired" | "revoked";
