import { useQueryClient } from "@tanstack/react-query";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { httpClient } from "@/lib/http-client";
import { API_ENDPOINTS } from "@/constant/api-endpoints";
import { QUERY_KEYS } from "@/constant/query-keys";
import type { DeviceLoginPoll, DeviceLoginStart } from "@/types/email-profile";

/** gateway ห่อทุกผลลัพธ์ไว้ใต้ `data` — useApiMutation คืน body ทั้งก้อน ไม่แกะให้ */
interface Envelope<T> {
  data: T;
}

/**
 * เริ่ม / ตรวจสถานะการเชื่อมต่อบัญชี Microsoft (device code) ของโปรไฟล์ `oauth2_delegated`
 *
 * เมื่อ poll ได้ `connected` ตัวเรียกต้องเรียก `refreshProfiles()` เพื่อให้หน้า list เห็น
 * `connected_at` ใหม่ — ตัว loop อยู่ใน dialog ไม่ใช่ที่นี่ เพื่อให้หยุดตามอายุของ dialog
 */
export function useEmailProfileOAuth() {
  const queryClient = useQueryClient();
  const start = useApiMutation<
    { profile_id: string },
    Envelope<DeviceLoginStart>
  >({
    mutationFn: (body, buCode) =>
      httpClient.post(
        API_ENDPOINTS.APP_CONFIG_EMAIL_PROFILE_OAUTH_START(buCode),
        body,
      ),
    errorMessage: "Could not start Microsoft sign-in",
    meta: { skipGlobalErrorToast: true },
  });
  const poll = useApiMutation<
    { profile_id: string; handle: string },
    Envelope<DeviceLoginPoll>
  >({
    mutationFn: (body, buCode) =>
      httpClient.post(
        API_ENDPOINTS.APP_CONFIG_EMAIL_PROFILE_OAUTH_POLL(buCode),
        body,
      ),
    errorMessage: "Microsoft sign-in check failed",
    meta: { skipGlobalErrorToast: true },
  });

  return {
    start: async (profileId: string) =>
      (await start.mutateAsync({ profile_id: profileId })).data,
    poll: async (profileId: string, handle: string) =>
      (await poll.mutateAsync({ profile_id: profileId, handle })).data,
    /** key shape เดียวกับ `invalidateKeys` ของ useApiMutation (prefix `[key]` ไม่ต่อ buCode) */
    refreshProfiles: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.APP_CONFIGS] }),
        queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.EMAIL_SENDERS] }),
      ]),
  };
}
