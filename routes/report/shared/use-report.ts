import { useMutation, useQuery } from "@tanstack/react-query";
import { useBuCode } from "@/hooks/use-bu-code";
import { API_ENDPOINTS } from "@/constant/api-endpoints";
import { QUERY_KEYS } from "@/constant/query-keys";
import { CACHE_DYNAMIC, CACHE_STATIC } from "@/lib/cache-config";
import { ApiError } from "@/lib/api-error";
import { httpClient } from "@/lib/http-client";
import { buildQueryString, buildUrl } from "@/lib/build-query-string";
import type {
  ReportListLookupItem,
  ReportListLookupMap,
  ReportPeriodInfo,
  ReportPeriodMap,
  ReportTemplate,
  RunReportPayload,
  RunReportResponse,
} from "@/types/report";
import type { PaginatedResponse, ParamsDto } from "@/types/params";

export function useReportTemplates(params?: ParamsDto) {
  const buCode = useBuCode();
  return useQuery<PaginatedResponse<ReportTemplate>, ApiError>({
    queryKey: [QUERY_KEYS.REPORTS, "templates", buCode, params],
    queryFn: async () => {
      const qs = buildQueryString({
        page: params?.page,
        perpage: params?.perpage,
        search: params?.search,
        filter: params?.filter,
        sort: params?.sort,
      });
      const base = `${API_ENDPOINTS.REPORTS(buCode!)}/templates`;
      const url = qs ? `${base}?${qs}` : base;
      const res = await httpClient.get(url);
      if (!res.ok) {
        throw await ApiError.from(res, "Failed to fetch report templates");
      }
      return res.json();
    },
    enabled: !!buCode,
    ...CACHE_DYNAMIC,
  });
}

/**
 * แถว `{code, name}` จาก micro-report → ตัวเลือกที่แสดงเป็น "code - name"
 *
 * Period (และ source ใดที่ code === name) ส่งค่าเดียวกันทั้งสองช่อง — แสดงครั้งเดียว
 * ไม่ใช่ "2026-01 - 2026-01"
 */
function toLookupItem(item: Record<string, unknown>): ReportListLookupItem {
  const code = String(item.code ?? "");
  const rawName = String(item.name ?? "");
  return {
    code,
    name:
      code && rawName && code !== rawName ? `${code} - ${rawName}` : rawName,
  };
}

/**
 * รายการตัวเลือกของรายงาน (สินค้า/คลัง/ผู้ขาย/งวด) ดึงใหม่ทุกครั้งที่เปิด dialog
 *
 * เดิม cache 30 นาที (`CACHE_STATIC`) — มีคนเพิ่มสินค้าใหม่ คนที่เปิดหน้ารายงาน
 * ค้างไว้จะไม่เห็นตัวนั้นจนกว่า cache หมดอายุ · staleTime 0 = ดึงใหม่ทุกครั้งที่เปิด
 * แต่คง gcTime ไว้ ระหว่างรอจึงโชว์รายการเดิมก่อนแล้วค่อยอัปเดต ไม่ต้องเห็น spinner
 * (ต่างจาก `CACHE_NONE` ที่ทิ้งของเก่าทันที — ตัวเลือกที่ค้างไม่กี่ร้อยมิลลิวินาทีไม่ทำ
 * ให้ใครตัดสินใจผิด ต่างจากยอดคงเหลือ)
 */
export const REPORT_LOOKUP_CACHE = {
  staleTime: 0,
  gcTime: CACHE_STATIC.gcTime,
} as const;

interface ReportListLookupsOptions {
  readonly sources: readonly string[];
  readonly includePeriods?: boolean;
  /** ผูกกับการเปิด dialog — ทุกครั้งที่เปลี่ยนเป็น true จะดึงรายการใหม่ */
  readonly enabled?: boolean;
}

interface ReportListLookupsResult {
  data: ReportListLookupMap;
  periods: ReportPeriodMap;
}

export function useReportListLookups({
  sources,
  includePeriods = false,
  enabled = true,
}: ReportListLookupsOptions) {
  const buCode = useBuCode();
  const lowerSources = [...new Set(sources.map((s) => s.toLowerCase()))].sort();
  const allTypes = [...lowerSources];
  if (includePeriods) allTypes.push("current-period", "previous-period");
  const typesKey = allTypes.join(",");

  return useQuery<ReportListLookupsResult, ApiError>({
    queryKey: [QUERY_KEYS.REPORT_LOOKUPS, buCode, typesKey, "list"],
    queryFn: async () => {
      const url = buildUrl(API_ENDPOINTS.REPORT_LOOKUPS(buCode!), {
        types: typesKey,
      });
      const res = await httpClient.get(url);
      if (!res.ok) {
        throw await ApiError.from(res, "Failed to fetch report lookups");
      }
      const json = await res.json();
      const raw = (json.data ?? json) as Record<string, unknown>;

      const data: ReportListLookupMap = {};
      for (const original of sources) {
        const items = raw[original.toLowerCase()];
        if (!Array.isArray(items)) continue;
        data[original] = (items as Array<Record<string, unknown>>).map(
          toLookupItem,
        );
      }

      const periods: ReportPeriodMap = includePeriods
        ? {
            "current-period": raw["current-period"] as
              ReportPeriodInfo | undefined,
            "previous-period": raw["previous-period"] as
              ReportPeriodInfo | undefined,
          }
        : {};

      return { data, periods };
    },
    enabled: enabled && !!buCode && allTypes.length > 0,
    ...REPORT_LOOKUP_CACHE,
  });
}

/** แถวต่อการค้นหาหนึ่งครั้ง — ผู้ใช้กำลังพิมพ์หาตัวเดียว ไม่ต้องลากมาเป็นร้อย */
export const REPORT_LOOKUP_SEARCH_LIMIT = 50;

interface ReportLookupSearchOptions {
  /** lookup type ตัวเดียว เช่น `product` / `location-inventory` */
  readonly source: string;
  readonly search: string;
  readonly enabled?: boolean;
}

/**
 * ค้นตัวเลือกของรายงานฝั่ง server ตามที่ผู้ใช้พิมพ์
 *
 * รายการตอนเปิดช่องเป็น snapshot และ micro-report ตัดไว้ 500 แถวแรกตาม code — ค้นในเครื่อง
 * จึงไม่เจอสินค้าที่คนอื่นเพิ่งเพิ่มหลังกดเปิดช่อง และไม่เจอตัวที่ code เรียงเกิน 500
 * (BU ใหญ่มีสินค้า ~2,600) ตัวนี้ส่งคำค้นไปค้นทั้งตารางทุกครั้งที่พิมพ์ (combobox หน่วงให้ 150ms)
 * คำค้นว่าง = ไม่ยิง
 */
export function useReportLookupSearch({
  source,
  search,
  enabled = true,
}: ReportLookupSearchOptions) {
  const buCode = useBuCode();
  const term = search.trim();

  return useQuery<ReportListLookupItem[], ApiError>({
    queryKey: [QUERY_KEYS.REPORT_LOOKUPS, buCode, source, "search", term],
    queryFn: async () => {
      const url = buildUrl(API_ENDPOINTS.REPORT_LOOKUPS(buCode!), {
        types: source,
        search: term,
        limit: REPORT_LOOKUP_SEARCH_LIMIT,
      });
      const res = await httpClient.get(url);
      if (!res.ok) {
        throw await ApiError.from(res, "Failed to search report lookups");
      }
      const json = await res.json();
      const raw = (json.data ?? json) as Record<string, unknown>;
      const items = raw[source.toLowerCase()];
      return Array.isArray(items)
        ? (items as Array<Record<string, unknown>>).map(toLookupItem)
        : [];
    },
    enabled: enabled && !!buCode && !!source && term.length > 0,
    ...REPORT_LOOKUP_CACHE,
  });
}

export interface ExportReportResult {
  blob: Blob;
  fileName: string | null;
  rowCount: number | null;
}

export function useExportReportMutation() {
  const buCode = useBuCode();
  return useMutation<ExportReportResult, ApiError, RunReportPayload>({
    mutationFn: async (payload) => {
      const res = await httpClient.post(
        `${API_ENDPOINTS.REPORTS(buCode!)}/export`,
        payload,
      );
      if (!res.ok) {
        throw await ApiError.from(res, "Failed to export report");
      }
      const blob = await res.blob();
      // header อาจอ่านไม่ได้ถ้า deployment ไม่ expose (CORS) — ตกเป็น null แล้วให้ผู้เรียกใช้ค่าสำรอง
      const disposition = res.headers.get("content-disposition");
      const fileName = disposition?.match(/filename="([^"]+)"/)?.[1] ?? null;
      const rawCount = res.headers.get("x-row-count");
      const parsedCount = rawCount === null ? Number.NaN : Number(rawCount);
      return {
        blob,
        fileName,
        rowCount: Number.isFinite(parsedCount) ? parsedCount : null,
      };
    },
  });
}

export function useRunReportMutation() {
  const buCode = useBuCode();
  return useMutation<RunReportResponse, ApiError, RunReportPayload>({
    mutationFn: async (payload) => {
      const url = `${API_ENDPOINTS.REPORTS(buCode!)}/viewer`;
      const res = await httpClient.post(url, payload);
      if (!res.ok) {
        throw await ApiError.from(res, "Failed to generate report viewer");
      }
      const json = await res.json();
      const viewerUrl: string | undefined = json.data?.url ?? json.url;
      if (!viewerUrl) {
        throw new ApiError(
          "INTERNAL_ERROR",
          "Empty viewer URL from backend",
          res.status,
        );
      }
      return { url: viewerUrl };
    },
  });
}
