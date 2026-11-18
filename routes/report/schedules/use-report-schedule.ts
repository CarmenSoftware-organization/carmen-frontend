import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useBuCode } from "@/hooks/use-bu-code";
import { API_ENDPOINTS } from "@/constant/api-endpoints";
import { QUERY_KEYS } from "@/constant/query-keys";
import { CACHE_DYNAMIC } from "@/lib/cache-config";
import { ApiError } from "@/lib/api-error";
import { httpClient } from "@/lib/http-client";
import { buildUrl } from "@/lib/build-query-string";
import { REPORT_LOOKUP_CACHE } from "../shared/use-report";
import type {
  CreateReportScheduleDto,
  ReportLookupMap,
  ReportSchedule,
} from "@/types/report-schedule";

export function useReportSchedules(options?: { enabled?: boolean }) {
  const buCode = useBuCode();
  return useQuery<ReportSchedule[], ApiError>({
    queryKey: [QUERY_KEYS.REPORT_SCHEDULES, buCode],
    queryFn: async () => {
      const res = await httpClient.get(API_ENDPOINTS.REPORT_SCHEDULES(buCode!));
      if (!res.ok) {
        throw await ApiError.from(res, "Failed to fetch report schedules");
      }
      const json = await res.json();
      return json.data ?? [];
    },
    enabled: !!buCode && (options?.enabled ?? true),
    ...CACHE_DYNAMIC,
  });
}

/**
 * Mutation สำหรับสร้าง report schedule ใหม่
 * Invalidate `REPORT_SCHEDULES` ของ BU เดียวกันหลังสำเร็จ
 *
 * @returns UseMutationResult — ส่ง `CreateReportScheduleDto` คืน `ReportSchedule`
 * @example
 * const create = useCreateReportSchedule();
 * await create.mutateAsync(dto);
 */
export function useCreateReportSchedule() {
  const buCode = useBuCode();
  const queryClient = useQueryClient();
  return useMutation<ReportSchedule, ApiError, CreateReportScheduleDto>({
    mutationFn: async (dto) => {
      const res = await httpClient.post(
        API_ENDPOINTS.REPORT_SCHEDULES(buCode!),
        dto,
      );
      if (!res.ok) {
        throw await ApiError.from(res, "Failed to create report schedule");
      }
      const json = await res.json();
      return json.data ?? json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.REPORT_SCHEDULES, buCode],
      });
    },
  });
}

export function useDeleteReportSchedule() {
  const buCode = useBuCode();
  const queryClient = useQueryClient();
  return useMutation<void, ApiError, string>({
    mutationFn: async (id) => {
      const res = await httpClient.delete(
        API_ENDPOINTS.REPORT_SCHEDULE_BY_ID(buCode!, id),
      );
      if (!res.ok) {
        throw await ApiError.from(res, "Failed to delete report schedule");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.REPORT_SCHEDULES, buCode],
      });
    },
  });
}

export function useReportLookups(sources: readonly string[]) {
  const buCode = useBuCode();
  const types = [...new Set(sources)].sort().join(",");
  return useQuery<ReportLookupMap, ApiError>({
    queryKey: [QUERY_KEYS.REPORT_LOOKUPS, buCode, types],
    queryFn: async () => {
      const url = buildUrl(API_ENDPOINTS.REPORT_LOOKUPS(buCode!), { types });
      const res = await httpClient.get(url);
      if (!res.ok) {
        throw await ApiError.from(res, "Failed to fetch report lookups");
      }
      const json = await res.json();
      const data = (json.data ?? json) as Record<string, unknown>;
      const mapped: ReportLookupMap = {};
      for (const [key, items] of Object.entries(data)) {
        if (!Array.isArray(items)) continue;
        mapped[key] = (items as Array<Record<string, unknown>>).map((item) => ({
          label: String(item.name ?? item.label ?? item.code ?? ""),
          value: String(item.code ?? item.id ?? item.value ?? ""),
        }));
      }
      return mapped;
    },
    enabled: !!buCode && types.length > 0,
    // ดึงใหม่ทุกครั้งที่เปิดฟอร์ม schedule (ฟอร์ม mount ใหม่ทุกครั้งที่เปิด dialog)
    ...REPORT_LOOKUP_CACHE,
  });
}
