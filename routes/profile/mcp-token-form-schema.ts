import { z } from "zod";
import type { TranslationFn } from "@/lib/i18n-schema";

export function createMcpTokenSchema(tv: TranslationFn, tm: TranslationFn) {
  return z.object({
    name: z
      .string()
      .trim()
      .min(1, tv("required", { field: tm("name") }))
      .max(100, tm("nameTooLong")),
  });
}

export type McpTokenFormValues = z.infer<ReturnType<typeof createMcpTokenSchema>>;

export const EMPTY_MCP_TOKEN_FORM: McpTokenFormValues = { name: "" };
