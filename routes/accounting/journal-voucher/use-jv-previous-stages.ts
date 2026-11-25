import { useQuery } from "@tanstack/react-query";
import { useBuCode } from "@/hooks/use-bu-code";
import { httpClient } from "@/lib/http-client";
import { API_ENDPOINTS } from "@/constant/api-endpoints";
import { QUERY_KEYS } from "@/constant/query-keys";
import type { PreviousStage } from "@/routes/accounting/shared/send-back-fields";

/** ขั้นก่อนหน้าที่ส่งกลับไปได้ — โหลดเมื่อเปิด dialog ส่งกลับเท่านั้น */
export function useJvPreviousStages(id: string | undefined, enabled: boolean) {
  const buCode = useBuCode();
  return useQuery<PreviousStage[]>({
    queryKey: [QUERY_KEYS.GL_JV_PREVIOUS_STAGES, buCode, id],
    queryFn: async () => {
      const res = await httpClient.get(
        API_ENDPOINTS.GL_JV_PREVIOUS_STAGES(buCode!, id!),
      );
      if (!res.ok) throw new Error("Failed to fetch previous stages");
      const json = await res.json();
      return Object.entries(json.data ?? {}).map(([key, name]) => ({
        key,
        name: name as string,
      }));
    },
    enabled: !!buCode && !!id && enabled,
  });
}
