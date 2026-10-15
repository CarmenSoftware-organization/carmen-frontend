import { useQuery } from "@tanstack/react-query";
import { useBuCode } from "@/hooks/use-bu-code";
import { httpClient } from "@/lib/http-client";
import { ApiError } from "@/lib/api-error";
import { CACHE_STATIC } from "@/lib/cache-config";
import { QUERY_KEYS } from "@/constant/query-keys";
import { API_ENDPOINTS } from "@/constant/api-endpoints";
import {
  DEFAULT_ATTACHMENT_POLICY,
  type AttachmentPolicy,
} from "@/lib/attachment-policy";

/**
 * นโยบายไฟล์แนบของ BU ปัจจุบัน — ระหว่างโหลด / ดึงไม่สำเร็จ (เช่น backend ยังไม่ deploy ได้ 404)
 * คืนค่าเริ่มต้นแทน ไม่บล็อกการแนบไฟล์ · key ผูก buCode สลับ BU แล้วได้ค่าใหม่
 * query error ไม่ขึ้น toast (MutationCache เท่านั้นที่ toast) จึงไม่ต้องกดเงียบ
 */
export function useAttachmentPolicy(): AttachmentPolicy {
  const buCode = useBuCode();
  const { data } = useQuery<AttachmentPolicy, ApiError>({
    queryKey: [QUERY_KEYS.ATTACHMENT_POLICY, buCode],
    queryFn: async () => {
      const res = await httpClient.get(
        API_ENDPOINTS.ATTACHMENT_POLICY(buCode!),
      );
      if (!res.ok)
        throw await ApiError.from(res, "Failed to fetch attachment policy");
      const json = await res.json();
      return json.data;
    },
    ...CACHE_STATIC,
    retry: false,
    enabled: !!buCode,
  });
  return data ?? DEFAULT_ATTACHMENT_POLICY;
}
