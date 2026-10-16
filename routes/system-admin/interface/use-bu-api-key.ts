import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
} from "@tanstack/react-query";
import { useBuCode } from "@/hooks/use-bu-code";
import { cleanServerMessage, useApiMutation } from "@/hooks/use-api-mutation";
import { httpClient } from "@/lib/http-client";
import { ApiError } from "@/lib/api-error";
import { API_ENDPOINTS } from "@/constant/api-endpoints";
import { QUERY_KEYS } from "@/constant/query-keys";

/** สรุปกุญแจ API ขาเข้าของ BU — ไม่มี secret */
export interface BuApiKeyInfo {
  readonly exists: boolean;
  readonly client_id: string | null;
  readonly secret_last4: string | null;
  readonly is_active: boolean | null;
  readonly last_used_at: string | null;
  readonly created_by_name: string | null;
  readonly created_at: string | null;
  /** null = backend ไม่ได้ตั้ง origin สาธารณะ — caller fallback เอง */
  readonly base_url: string | null;
}

export interface BuApiKeyCredential {
  readonly client_id: string;
  readonly secret: string;
}

/**
 * อ่านกุญแจ API ของ BU (ไม่มี secret)
 *
 * @param enabled - false = ไม่ยิง (ไม่มีสิทธิ์ view หรือใบ INF ไม่ครอบ — backend จะตอบ 403)
 * @returns query ของ `BuApiKeyInfo`
 */
export function useBuApiKey(enabled: boolean) {
  const buCode = useBuCode();
  return useQuery<BuApiKeyInfo>({
    queryKey: [QUERY_KEYS.BU_API_KEY, buCode],
    queryFn: async () => {
      const res = await httpClient.get(API_ENDPOINTS.BU_API_KEY(buCode!));
      if (!res.ok) throw await ApiError.from(res, "Failed to load API key");
      const json = await res.json();
      return json.data;
    },
    enabled: enabled && !!buCode,
  });
}

/**
 * mutation ที่คืน secret — ใช้ `useMutation` ตรง ๆ ด้วย `gcTime: 0` เพื่อไม่ให้ secret
 * ค้างใน mutation cache (ผลลัพธ์ส่งให้ caller ถือใน state ของตัวเองเท่านั้น)
 * และไม่เก็บใน query cache เลย
 */
function useSecretMutation<TVariables = void>(
  call: (buCode: string, variables: TVariables) => Promise<Response>,
  opts: { invalidate: boolean; errorMessage: string },
) {
  const buCode = useBuCode();
  const queryClient = useQueryClient();
  return useMutation<
    { client_id?: string; secret: string },
    ApiError,
    TVariables
  >({
    gcTime: 0,
    mutationFn: async (variables) => {
      if (!buCode)
        throw new ApiError("MISSING_REQUIRED_FIELD", "Missing buCode");
      const res = await call(buCode, variables);
      if (!res.ok)
        throw await ApiError.from(res, opts.errorMessage, cleanServerMessage);
      const json = await res.json();
      return json.data;
    },
    onSuccess: () => {
      if (opts.invalidate)
        void queryClient.invalidateQueries({
          queryKey: [QUERY_KEYS.BU_API_KEY],
        });
    },
  });
}

/** สร้างกุญแจ (409 ถ้ามีแล้ว) — คืน client_id + secret ครั้งเดียว */
export function useCreateBuApiKey(): UseMutationResult<
  { client_id?: string; secret: string },
  ApiError,
  void
> {
  return useSecretMutation(
    (buCode) => httpClient.post(API_ENDPOINTS.BU_API_KEY(buCode)),
    { invalidate: true, errorMessage: "Failed to create API key" },
  );
}

/** ออก secret ใหม่ทับของเดิม — secret เก่าใช้ไม่ได้ทันที */
export function useRegenerateBuApiKey() {
  return useSecretMutation(
    (buCode) =>
      httpClient.post(`${API_ENDPOINTS.BU_API_KEY(buCode)}/regenerate`),
    { invalidate: true, errorMessage: "Failed to regenerate API key" },
  );
}

/** เปิดเผย secret — backend บันทึกทุกครั้งที่เรียก จึงห้าม cache/เรียกซ้ำโดยไม่จำเป็น */
export function useRevealBuApiKey() {
  return useSecretMutation(
    (buCode) => httpClient.post(`${API_ENDPOINTS.BU_API_KEY(buCode)}/reveal`),
    { invalidate: false, errorMessage: "Failed to reveal API secret" },
  );
}

/** เปิด/ปิดใช้งานกุญแจ */
export function useSetBuApiKeyActive() {
  return useApiMutation<boolean>({
    mutationFn: (isActive, buCode) =>
      httpClient.patch(API_ENDPOINTS.BU_API_KEY(buCode), {
        is_active: isActive,
      }),
    invalidateKeys: [QUERY_KEYS.BU_API_KEY],
    errorMessage: "Failed to update API key status",
  });
}
