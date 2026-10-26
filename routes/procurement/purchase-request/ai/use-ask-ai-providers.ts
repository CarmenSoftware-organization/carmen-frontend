import { useQuery } from "@tanstack/react-query";
import { useBuCode } from "@/hooks/use-bu-code";
import { httpClient } from "@/lib/http-client";
import { ApiError } from "@/lib/api-error";
import { API_ENDPOINTS } from "@/constant/api-endpoints";
import { QUERY_KEYS } from "@/constant/query-keys";

export interface AskAiProvider {
  readonly code: string;
  readonly label: string;
  readonly icon_key: string | null;
  readonly icon_url: string | null;
  readonly url_template: string;
  readonly prompt: string;
}

/**
 * Hook ดึงรายการ AI provider ที่ BU นี้ใช้ได้ (เรียงตาม sort_order แล้ว)
 * ดึงตอน mount ไม่ใช่ตอนเปิดเมนู เพื่อให้เมนูพร้อมทันทีที่ผู้ใช้กด
 */
export function useAskAiProviders() {
  const buCode = useBuCode();

  return useQuery<AskAiProvider[], ApiError>({
    queryKey: [QUERY_KEYS.ASK_AI_PROVIDERS, buCode],
    queryFn: async () => {
      const res = await httpClient.get(API_ENDPOINTS.ASK_AI_PROVIDERS(buCode!));
      if (!res.ok) {
        throw await ApiError.from(res, "Failed to fetch Ask AI providers");
      }
      const json = await res.json();
      return Array.isArray(json.data) ? json.data : [];
    },
    enabled: !!buCode,
    staleTime: 60_000,
  });
}
