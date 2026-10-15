import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useBuCode } from "@/hooks/use-bu-code";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { fetchAllComments } from "@/hooks/use-comment-crud";
import { httpClient } from "@/lib/http-client";
import { buildUrl } from "@/lib/build-query-string";
import { QUERY_KEYS } from "@/constant/query-keys";
import { API_ENDPOINTS } from "@/constant/api-endpoints";
import type {
  PhysicalCount,
  PhysicalCountData,
  CreatePhysicalCountDto,
  PhysicalCountSaveDto,
} from "@/types/physical-count";
import type { ParamsDto, PaginatedResponse } from "@/types/params";
import type { CommentItem } from "@/components/ui/comment-sheet";
import { CACHE_DYNAMIC } from "@/lib/cache-config";

/**
 * Hook ดึงรายการเอกสารตรวจนับสต็อก (paginated)
 * ใช้ CACHE_DYNAMIC (staleTime 1 นาที) เพราะสถานะ physical count เปลี่ยนบ่อย
 * จะไม่ fetch จนกว่า buCode จะพร้อม
 * @param params - พารามิเตอร์ filter/sort/pagination
 * @returns React Query ของรายการตรวจนับสต็อก
 * @example
 * const { data } = usePhysicalCount({ page: 1, filter: "doc_status:draft" });
 */
export function usePhysicalCount(params?: ParamsDto) {
  const buCode = useBuCode();

  return useQuery<PaginatedResponse<PhysicalCount>>({
    queryKey: [QUERY_KEYS.PHYSICAL_COUNTS, buCode, params],
    queryFn: async () => {
      const url = buildUrl(API_ENDPOINTS.PHYSICAL_COUNT(buCode!), params);
      const res = await httpClient.get(url);
      if (!res.ok) throw new Error("Failed to fetch physical counts");
      return res.json();
    },
    enabled: !!buCode,
    ...CACHE_DYNAMIC,
  });
}

/**
 * Hook ดึงข้อมูลเอกสารตรวจนับสต็อกตาม id
 * Unwrap data จาก response และจะไม่ fetch จนกว่า buCode และ id จะพร้อม
 * @param id - รหัสเอกสาร
 * @returns React Query ของข้อมูล PhysicalCountData
 * @example
 * const { data: pc } = usePhysicalCountById(params.id);
 */
export function usePhysicalCountById(id: string | undefined) {
  const buCode = useBuCode();

  return useQuery<PhysicalCountData>({
    queryKey: [QUERY_KEYS.PHYSICAL_COUNTS, buCode, id],
    queryFn: async () => {
      const res = await httpClient.get(
        `${API_ENDPOINTS.PHYSICAL_COUNT(buCode!)}/${id}`,
      );
      if (!res.ok) throw new Error("Failed to fetch physical count");
      const json = await res.json();
      return json.data;
    },
    enabled: !!buCode && !!id,
  });
}

export function useCreatePhysicalCount() {
  return useApiMutation<CreatePhysicalCountDto>({
    mutationFn: (data, buCode) =>
      httpClient.post(API_ENDPOINTS.PHYSICAL_COUNT(buCode), data),
    invalidateKeys: [
      QUERY_KEYS.PHYSICAL_COUNTS,
      QUERY_KEYS.PHYSICAL_COUNT_PERIOD_CURRENT,
    ],
    errorMessage: "Failed to create physical count",
  });
}

export function useUpdatePhysicalCount() {
  return useApiMutation<
    CreatePhysicalCountDto & { id: string; doc_version?: number }
  >({
    mutationFn: ({ id, ...data }, buCode) =>
      httpClient.put(`${API_ENDPOINTS.PHYSICAL_COUNT(buCode)}/${id}`, data),
    invalidateKeys: [
      QUERY_KEYS.PHYSICAL_COUNTS,
      QUERY_KEYS.PHYSICAL_COUNT_PERIOD_CURRENT,
    ],
    errorMessage: "Failed to update physical count",
  });
}

export function useDeletePhysicalCount() {
  return useApiMutation<string>({
    mutationFn: (id, buCode) =>
      httpClient.delete(`${API_ENDPOINTS.PHYSICAL_COUNT(buCode)}/${id}`),
    invalidateKeys: [
      QUERY_KEYS.PHYSICAL_COUNTS,
      QUERY_KEYS.PHYSICAL_COUNT_PERIOD_CURRENT,
    ],
    errorMessage: "Failed to delete physical count",
  });
}

export function useSavePhysicalCount(physicalCountId: string) {
  return useApiMutation<PhysicalCountSaveDto>({
    mutationFn: (data, buCode) =>
      httpClient.patch(
        API_ENDPOINTS.PHYSICAL_COUNT_SAVE(buCode, physicalCountId),
        data,
      ),
    invalidateKeys: [
      QUERY_KEYS.PHYSICAL_COUNTS,
      QUERY_KEYS.PHYSICAL_COUNT_PERIOD_CURRENT,
    ],
    errorMessage: "Failed to save physical count",
  });
}

export function usePhysicalCountReview(id: string | undefined) {
  const buCode = useBuCode();

  return useQuery<PhysicalCountData>({
    queryKey: [QUERY_KEYS.PHYSICAL_COUNTS, buCode, id, "review"],
    queryFn: async () => {
      const res = await httpClient.get(
        API_ENDPOINTS.PHYSICAL_COUNT_REVIEW(buCode!, id!),
      );
      if (!res.ok) throw new Error("Failed to fetch physical count review");
      const json = await res.json();
      return json.data;
    },
    enabled: !!buCode && !!id,
  });
}

export function useSubmitPhysicalCount(physicalCountId: string) {
  return useApiMutation<{ doc_version?: number }>({
    mutationFn: (data, buCode) =>
      httpClient.patch(
        API_ENDPOINTS.PHYSICAL_COUNT_SUBMIT(buCode, physicalCountId),
        data,
      ),
    invalidateKeys: [
      QUERY_KEYS.PHYSICAL_COUNTS,
      QUERY_KEYS.PHYSICAL_COUNT_PERIOD_CURRENT,
    ],
    errorMessage: "Failed to submit physical count",
  });
}

export function useReviewPhysicalCount(physicalCountId: string) {
  return useApiMutation<PhysicalCountSaveDto>({
    mutationFn: (data, buCode) =>
      httpClient.patch(
        API_ENDPOINTS.PHYSICAL_COUNT_REVIEW(buCode, physicalCountId),
        data,
      ),
    invalidateKeys: [
      QUERY_KEYS.PHYSICAL_COUNTS,
      QUERY_KEYS.PHYSICAL_COUNT_PERIOD_CURRENT,
    ],
    errorMessage: "Failed to submit for review",
  });
}

export function usePhysicalCountDetailComments(detailId: string | undefined) {
  const buCode = useBuCode();

  return useQuery<CommentItem[]>({
    queryKey: [QUERY_KEYS.PHYSICAL_COUNT_DETAIL_COMMENTS, buCode, detailId],
    queryFn: async () => {
      if (!buCode || !detailId)
        throw new Error("Missing buCode or physical count detail id");
      return fetchAllComments(
        API_ENDPOINTS.PHYSICAL_COUNT_DETAIL_COMMENT(buCode, detailId),
      );
    },
    enabled: !!buCode && !!detailId,
  });
}

export function useSavePhysicalCountProductNote(detailId: string) {
  const buCode = useBuCode();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      message: string;
      type: string;
      files: File[];
    }) => {
      if (!buCode) throw new Error("Missing business unit code");
      const formData = new FormData();
      formData.append("message", payload.message);
      formData.append("type", payload.type);
      for (const file of payload.files) {
        formData.append("files", file, file.name);
      }
      const res = await httpClient.post(
        API_ENDPOINTS.PHYSICAL_COUNT_DETAIL_COMMENT(buCode, detailId),
        formData,
      );
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || "Failed to save product note");
      }
      return res.json().catch(() => ({}));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.PHYSICAL_COUNT_DETAIL_COMMENTS, buCode, detailId],
      });
    },
  });
}

export function useRefreshPhysicalCount(physicalCountId: string) {
  return useApiMutation<Record<string, never>>({
    mutationFn: (_data, buCode) =>
      httpClient.patch(
        API_ENDPOINTS.PHYSICAL_COUNT_REFRESH(buCode, physicalCountId),
        {},
      ),
    invalidateKeys: [
      QUERY_KEYS.PHYSICAL_COUNTS,
      QUERY_KEYS.PHYSICAL_COUNT_PERIOD_CURRENT,
    ],
    errorMessage: "Failed to refresh physical count",
  });
}
