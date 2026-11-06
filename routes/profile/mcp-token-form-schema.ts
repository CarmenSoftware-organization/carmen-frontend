import { z } from "zod";
import type { TranslationFn } from "@/lib/i18n-schema";
import type { McpTokenScope } from "@/types/mcp-token";
import { DEFAULT_MCP_SCOPES } from "./mcp-token-scopes";

export function createMcpTokenSchema(tv: TranslationFn, tm: TranslationFn) {
  return z.object({
    name: z
      .string()
      .trim()
      .min(1, tv("required", { field: tm("name") }))
      .max(100, tm("nameTooLong")),
    // backend ตอบ 400 เมื่อ scopes เป็น [] — กันไว้ตั้งแต่ฟอร์ม
    scopes: z.array(z.custom<McpTokenScope>()).min(1, tm("scopesRequired")),
  });
}

export type McpTokenFormValues = z.infer<ReturnType<typeof createMcpTokenSchema>>;

export const EMPTY_MCP_TOKEN_FORM: McpTokenFormValues = {
  name: "",
  scopes: [...DEFAULT_MCP_SCOPES],
};
