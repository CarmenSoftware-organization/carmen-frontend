import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useBuCode } from "@/hooks/use-bu-code";
import { ApiError } from "@/lib/api-error";
import type { ApiErrorMeta } from "@/lib/api-error-handler";

/**
 * Helper สำหรับ optimistic update: ลบ item ตาม id ออกจาก paginated list cache
 *
 * ใช้ร่วมกับ `optimisticList.updater` ของ `useApiMutation`
 * ปรับ `paginate.total` ลง 1 แต่ไม่น้อยกว่า 0 ถ้า shape ไม่ match จะคืน old เดิม
 *
 * @param old - ข้อมูลเดิมใน cache
 * @param id - id ของ item ที่ต้องการลบ
 * @returns ข้อมูลใหม่หลังลบ item แล้ว
 * @example
 * ```ts
 * useApiMutation({
 *   mutationFn: (id, bu) => api.remove(bu, id),
 *   optimisticList: { queryKeyPrefix: ["vendors"], updater: removeFromListById },
 * });
 * ```
 */
export function removeFromListById<T extends { id: string }>(
  old: unknown,
  id: string,
): unknown {
  const data = old as { data?: T[]; paginate?: { total?: number } } | undefined;
  if (!data?.data) return old;
  return {
    ...data,
    data: data.data.filter((item) => item.id !== id),
    paginate: data.paginate
      ? { ...data.paginate, total: Math.max(0, (data.paginate.total ?? 1) - 1) }
      : data.paginate,
  };
}

/**
 * ทำความสะอาด error message จาก server โดยตัด placeholder ที่ backend ไม่ได้
 * substitute (เช่น `"Validation failed: {errors}"` → `"Validation failed"`)
 *
 * บาง endpoint คืน message template ที่ยังมี `{...}` ค้างอยู่ frontend แสดง
 * server message ตรง ๆ จึงต้อง strip ออกกัน toast โชว์ literal `{errors}`
 * ถ้าตัดแล้วเหลือว่างให้ fallback เป็นข้อความสำรอง
 *
 * @param message - ข้อความจาก server (อาจมี placeholder ค้าง)
 * @param fallback - ข้อความสำรองเมื่อไม่มี message หรือเหลือว่างหลัง strip
 * @returns ข้อความที่สะอาดแล้ว
 * @example
 * ```ts
 * cleanServerMessage("Validation failed: {errors}", "Request failed"); // "Validation failed"
 * cleanServerMessage("{errors}", "Request failed"); // "Request failed"
 * ```
 */
export function cleanServerMessage(
  message: string | undefined,
  fallback: string,
): string {
  // guard: server อาจส่ง message เป็น non-string (object/array) → .replace crash
  if (!message || typeof message !== "string") return fallback;
  // ตัด placeholder `{...}` ที่ค้าง พร้อม separator นำหน้า (": ", " - ", " ")
  const cleaned = message.replace(/\s*[:-]?\s*\{[^}]*\}/g, "").trim();
  return cleaned || fallback;
}

interface UseApiMutationOptions<TVariables> {
  mutationFn: (variables: TVariables, buCode: string) => Promise<Response>;
  invalidateKeys?: readonly unknown[];
  /** Mark caches stale without refetching a form that is about to navigate away. */
  invalidateRefetchType?: "active" | "none";
  errorMessage?: string;
  meta?: ApiErrorMeta;
  optimistic?: {
    queryKey: readonly unknown[];
    updater: (old: unknown, variables: TVariables) => unknown;
  };
  optimisticList?: {
    queryKeyPrefix: readonly unknown[];
    updater: (old: unknown, variables: TVariables) => unknown;
  };
}

export function useApiMutation<TVariables, TResponse = unknown>({
  mutationFn,
  invalidateKeys,
  invalidateRefetchType,
  errorMessage = "Request failed",
  meta,
  optimistic,
  optimisticList,
}: UseApiMutationOptions<TVariables>) {
  const buCode = useBuCode();
  const queryClient = useQueryClient();

  return useMutation<
    TResponse,
    ApiError,
    TVariables,
    { previous?: unknown; previousList?: [readonly unknown[], unknown][] }
  >({
    meta,
    mutationFn: async (variables) => {
      if (!buCode)
        throw new ApiError("MISSING_REQUIRED_FIELD", "Missing buCode");
      const res = await mutationFn(variables, buCode);
      if (!res.ok) {
        // อย่าอ่าน body ที่นี่ — `ApiError.from` อ่านเอง (ผ่าน clone) และ clone()
        // จะพังถ้า body ถูก consume ไปแล้ว ทำให้ serverMessage หายเงียบๆ
        throw await ApiError.from(res, errorMessage, cleanServerMessage);
      }
      const data = await res.json();
      if (
        data != null &&
        typeof data === "object" &&
        "success" in data &&
        data.success === false
      ) {
        throw new ApiError(
          "VALIDATION_ERROR",
          cleanServerMessage(data.message, errorMessage),
          data.status,
        );
      }
      return data;
    },

    onMutate:
      optimistic || optimisticList
        ? async (variables) => {
            const context: {
              previous?: unknown;
              previousList?: [readonly unknown[], unknown][];
            } = {};
            if (optimistic) {
              await queryClient.cancelQueries({
                queryKey: optimistic.queryKey,
              });
              context.previous = queryClient.getQueryData(optimistic.queryKey);
              queryClient.setQueryData(optimistic.queryKey, (old: unknown) =>
                optimistic.updater(old, variables),
              );
            }
            if (optimisticList) {
              await queryClient.cancelQueries({
                queryKey: optimisticList.queryKeyPrefix,
              });
              const matches = queryClient.getQueriesData({
                queryKey: optimisticList.queryKeyPrefix,
              });
              context.previousList = matches.map(([key, data]) => [key, data]);
              for (const [key] of matches) {
                queryClient.setQueryData(key, (old: unknown) =>
                  optimisticList.updater(old, variables),
                );
              }
            }
            return context;
          }
        : undefined,

    onError:
      optimistic || optimisticList
        ? (_err, _vars, context) => {
            if (optimistic && context?.previous !== undefined) {
              queryClient.setQueryData(optimistic.queryKey, context.previous);
            }
            if (optimisticList && context?.previousList) {
              for (const [key, data] of context.previousList) {
                queryClient.setQueryData(key, data);
              }
            }
          }
        : undefined,

    onSettled: () => {
      invalidateKeys?.forEach((key) => {
        queryClient.invalidateQueries({
          queryKey: Array.isArray(key) ? key : [key],
          ...(invalidateRefetchType
            ? { refetchType: invalidateRefetchType }
            : {}),
        });
      });
    },
  });
}
