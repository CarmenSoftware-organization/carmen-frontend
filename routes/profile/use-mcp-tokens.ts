import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { API_ENDPOINTS } from "@/constant/api-endpoints";
import { QUERY_KEYS } from "@/constant/query-keys";
import { ApiError } from "@/lib/api-error";
import { httpClient } from "@/lib/http-client";
import type {
  McpToken,
  McpTokenCreated,
  McpTokenStatus,
} from "@/types/mcp-token";

export const mcpTokensQueryKey = [QUERY_KEYS.MCP_TOKENS] as const;

/** สถานะคำนวณฝั่ง client — revoked ชนะ expired */
export function getMcpTokenStatus(
  token: McpToken,
  now: number = Date.now(),
): McpTokenStatus {
  if (token.revoked_at) return "revoked";
  if (new Date(token.expires_at).getTime() <= now) return "expired";
  return "active";
}

export function useMcpTokens() {
  return useQuery<McpToken[]>({
    queryKey: mcpTokensQueryKey,
    queryFn: async () => {
      const res = await httpClient.get(API_ENDPOINTS.MCP_TOKENS);
      if (!res.ok) throw await ApiError.from(res, "Failed to load MCP tokens");
      const json = await res.json();
      return json.data ?? [];
    },
  });
}

export function useCreateMcpToken() {
  const queryClient = useQueryClient();
  return useMutation<McpTokenCreated, ApiError, { name: string }>({
    mutationFn: async (body) => {
      const res = await httpClient.post(API_ENDPOINTS.MCP_TOKENS, body);
      if (!res.ok) throw await ApiError.from(res, "Failed to create MCP token");
      const json = await res.json();
      return json.data;
    },
    // 409 (ครบ 10 ใบ) ต้องขึ้นข้อความจาก API ไม่ใช่ข้อความ 409 ทั่วไปของ api-error-handler
    // response มีโทเค็นดิบ — ห้ามค้างใน MutationCache
    gcTime: 0,
    meta: { preferServerMessage: true },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: mcpTokensQueryKey });
    },
  });
}

export function useRevokeMcpToken() {
  const queryClient = useQueryClient();
  return useMutation<unknown, ApiError, { id: string; doc_version: number }>({
    mutationFn: async ({ id, doc_version }) => {
      const res = await httpClient.delete(
        API_ENDPOINTS.MCP_TOKEN_REVOKE(id, doc_version),
      );
      if (!res.ok) throw await ApiError.from(res, "Failed to revoke MCP token");
      return res.json().catch(() => ({}));
    },
    meta: { preferServerMessage: true },
    // สำเร็จหรือ 409 (doc_version ชน / เพิกถอนไปแล้ว) ก็ต้องโหลดรายการใหม่ทั้งคู่
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: mcpTokensQueryKey });
    },
  });
}
