import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useBuCode } from "@/hooks/use-bu-code";
import { httpClient } from "@/lib/http-client";
import { ApiError } from "@/lib/api-error";
import { API_ENDPOINTS } from "@/constant/api-endpoints";
import { QUERY_KEYS } from "@/constant/query-keys";

export interface AskAiConfigItem {
  readonly code: string;
  readonly label: string;
  readonly icon_key: string | null;
  readonly icon_url: string | null;
  readonly sort_order: number;
  readonly default_prompt: string;
  readonly default_enabled_for_bu: boolean;
  /** null = ยังไม่เคยตั้ง */
  readonly bu_enabled: boolean | null;
  /** null = ใช้ prompt มาตรฐาน */
  readonly bu_prompt: string | null;
}

/** null / "" = ลบฟิลด์นั้น (กลับไปใช้ค่ามาตรฐาน) */
export interface AskAiSaveBody {
  readonly providers: Record<
    string,
    { enabled?: boolean | null; prompt?: string | null }
  >;
}

/** ค่าตั้งของทุก provider ที่ active สำหรับ BU ปัจจุบัน */
export function useAskAiConfig() {
  const buCode = useBuCode();

  return useQuery<{ items: AskAiConfigItem[] }, ApiError>({
    queryKey: [QUERY_KEYS.ASK_AI_CONFIG, buCode],
    queryFn: async () => {
      const res = await httpClient.get(API_ENDPOINTS.ASK_AI_CONFIG(buCode!));
      if (!res.ok) {
        throw await ApiError.from(res, "Failed to fetch Ask AI config");
      }
      const json = await res.json();
      return { items: Array.isArray(json.data?.items) ? json.data.items : [] };
    },
    enabled: !!buCode,
  });
}

/** บันทึกแล้ว invalidate ทั้งหน้าตั้งค่าและเมนูในหน้า PR */
export function useSaveAskAiConfig() {
  const buCode = useBuCode();
  const queryClient = useQueryClient();

  return useMutation<unknown, ApiError, AskAiSaveBody>({
    mutationFn: async (body) => {
      const res = await httpClient.put(
        API_ENDPOINTS.ASK_AI_CONFIG(buCode!),
        body,
      );
      if (!res.ok) {
        throw await ApiError.from(res, "Failed to save Ask AI config");
      }
      return res.json().catch(() => null);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ASK_AI_CONFIG] });
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.ASK_AI_PROVIDERS],
      });
    },
  });
}

/**
 * enabled ส่งเฉพาะเมื่อต่างจากค่ามาตรฐาน หรือ BU เคยตั้งไว้แล้ว (ไม่งั้น null = ใช้ค่ามาตรฐาน)
 * prompt ว่าง → null
 */
export function buildSaveBody(
  items: readonly AskAiConfigItem[],
  drafts: Record<
    string,
    { readonly enabled: boolean; readonly prompt: string }
  >,
): AskAiSaveBody {
  const providers: AskAiSaveBody["providers"] = {};
  for (const item of items) {
    const d = drafts[item.code] ?? {
      enabled: item.bu_enabled ?? item.default_enabled_for_bu,
      prompt: item.bu_prompt ?? "",
    };
    const sendEnabled =
      d.enabled !== item.default_enabled_for_bu || item.bu_enabled !== null;
    providers[item.code] = {
      enabled: sendEnabled ? d.enabled : null,
      prompt: d.prompt.trim() === "" ? null : d.prompt.trim(),
    };
  }
  return { providers };
}
