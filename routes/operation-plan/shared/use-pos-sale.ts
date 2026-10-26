import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryOptions,
} from "@tanstack/react-query";
import { useBuCode } from "@/hooks/use-bu-code";
import { httpClient } from "@/lib/http-client";
import { buildUrl } from "@/lib/build-query-string";
import { ApiError } from "@/lib/api-error";
import { API_ENDPOINTS } from "@/constant/api-endpoints";
import { QUERY_KEYS } from "@/constant/query-keys";
import { CACHE_DYNAMIC } from "@/lib/cache-config";
import type { TranslationFn } from "@/lib/i18n-schema";
import type { PaginatedResponse, ParamsDto } from "@/types/params";
import type {
  PosBrand,
  PosImportDetail,
  PosImportListItem,
  PosImportSummary,
  PosItem,
  PosItemStatus,
  PosMicros3700CheckResult,
  PosMicros3700ImportResult,
  PosMicros3700OutletResult,
  PosMicros3700Overwrite,
  PosOutlet,
  PosSftpPullRun,
  PosStore,
} from "@/types/pos-sale";

/**
 * GET แล้วคืน body ทั้งก้อน (`{ data, paginate? }`) — โยน `ApiError` เมื่อไม่ ok
 */
async function getJson<T>(url: string, fallback: string): Promise<T> {
  const res = await httpClient.get(url);
  if (!res.ok) throw await ApiError.from(res, fallback);
  return res.json();
}

/**
 * ประวัติการนำเข้ายอดขาย POS ตามแบรนด์ (แบ่งหน้า)
 *
 * @param params - page / perpage / search / sort
 * @param brand - แบรนด์ที่ต้องการ
 * @param options - ตัวเลือก UseQueryOptions เพิ่มเติม
 * @returns query ของ `PaginatedResponse<PosImportListItem>` — `useGridPagination` ใช้ได้
 */
export function usePosImports(
  params: ParamsDto | undefined,
  brand: PosBrand,
  options?: Omit<
    UseQueryOptions<PaginatedResponse<PosImportListItem>>,
    "queryKey" | "queryFn"
  >,
) {
  const buCode = useBuCode();
  return useQuery<PaginatedResponse<PosImportListItem>>({
    queryKey: [QUERY_KEYS.POS_SALE_IMPORTS, buCode, brand, params],
    queryFn: () =>
      getJson(
        buildUrl(API_ENDPOINTS.POS_SALE_IMPORTS(buCode!), { ...params, brand }),
        "Failed to load POS imports",
      ),
    ...CACHE_DYNAMIC,
    ...options,
    enabled: !!buCode && (options?.enabled ?? true),
  });
}

/**
 * การนำเข้าทั้งหมดของชุดเดียวกัน (ไฟล์ Micros 3700 หนึ่งไฟล์ = หนึ่งรายการต่อ Outlet)
 *
 * @param batchId - รหัสชุดจากผลนำเข้า — ไม่มี = ไม่ยิง
 */
export function usePosBatchImports(batchId: string | null | undefined) {
  const buCode = useBuCode();
  return useQuery<PosImportListItem[]>({
    queryKey: [QUERY_KEYS.POS_SALE_IMPORTS, buCode, "batch", batchId],
    queryFn: async () =>
      (
        await getJson<PaginatedResponse<PosImportListItem>>(
          buildUrl(API_ENDPOINTS.POS_SALE_IMPORTS(buCode!), {
            batch_id: batchId ?? undefined,
            perpage: 50,
            brand: "micros3700",
          }),
          "Failed to load POS batch imports",
        )
      ).data,
    ...CACHE_DYNAMIC,
    enabled: !!buCode && !!batchId,
  });
}

/**
 * รอบดึงไฟล์ Simphony ผ่าน SFTP ล่าสุด — `null` = ยังไม่เคยมีรอบ
 *
 * ไม่ retry: 403/404 (license หมด หรือ backend ยังไม่มี endpoint) ให้ผู้เรียกซ่อนส่วนนี้ทันที
 * ระหว่างรอบล่าสุดยัง `running` โหลดซ้ำทุก 15 วิ ให้เห็นผลเมื่อรอบจบโดยไม่ต้องรีเฟรชหน้า
 *
 * @param enabled - ยิงเมื่อ true เท่านั้น (ฟอร์มโหลดแล้วและ license ใช้งานได้)
 */
export function usePosSftpLatestPull(enabled: boolean) {
  const buCode = useBuCode();
  return useQuery<PosSftpPullRun | null, ApiError>({
    queryKey: [QUERY_KEYS.POS_SALE_SFTP_PULL_LATEST, buCode],
    queryFn: async () =>
      (
        await getJson<{ data: PosSftpPullRun | null }>(
          API_ENDPOINTS.POS_SALE_SFTP_PULL_LATEST(buCode!),
          "Failed to load latest SFTP pull",
        )
      ).data,
    ...CACHE_DYNAMIC,
    retry: false,
    refetchInterval: (query) =>
      query.state.data?.status === "running" ? 15_000 : false,
    enabled: !!buCode && enabled,
  });
}

/** รายละเอียดเต็มของการนำเข้าหนึ่งรายการ */
export function usePosImport(id: string | undefined) {
  const buCode = useBuCode();
  return useQuery<PosImportDetail>({
    queryKey: [QUERY_KEYS.POS_SALE_IMPORT, buCode, id],
    queryFn: async () =>
      (
        await getJson<{ data: PosImportDetail }>(
          API_ENDPOINTS.POS_SALE_IMPORT(buCode!, id!),
          "Failed to load POS import",
        )
      ).data,
    ...CACHE_DYNAMIC,
    enabled: !!buCode && !!id,
  });
}

/**
 * ร้าน POS ของแบรนด์ที่เลือก — endpoint ไม่มี filter จึงกรองฝั่ง client
 *
 * @param brand - แบรนด์ที่ต้องการ
 */
export function usePosStores(brand: PosBrand) {
  const buCode = useBuCode();
  return useQuery<PosStore[], ApiError, PosStore[]>({
    queryKey: [QUERY_KEYS.POS_SALE_STORES, buCode],
    queryFn: async () =>
      (
        await getJson<{ data: PosStore[] }>(
          API_ENDPOINTS.POS_SALE_STORES(buCode!),
          "Failed to load POS stores",
        )
      ).data,
    select: (stores) => stores.filter((s) => s.brand === brand),
    ...CACHE_DYNAMIC,
    enabled: !!buCode,
  });
}

/**
 * Outlet ของ POS พร้อม Location ที่ผูก
 *
 * @param storeId - กรองเฉพาะร้านนี้ (ไม่ส่ง = ทุกร้าน)
 */
export function usePosOutlets(storeId?: string) {
  const buCode = useBuCode();
  return useQuery<PosOutlet[]>({
    queryKey: [QUERY_KEYS.POS_SALE_OUTLETS, buCode, storeId],
    queryFn: async () =>
      (
        await getJson<{ data: PosOutlet[] }>(
          buildUrl(API_ENDPOINTS.POS_SALE_OUTLETS(buCode!), {
            store_id: storeId,
          }),
          "Failed to load POS outlets",
        )
      ).data,
    ...CACHE_DYNAMIC,
    enabled: !!buCode && !!storeId,
  });
}

/**
 * เมนู POS พร้อมสูตรที่ผูก (แบ่งหน้า)
 *
 * @param params - page / perpage / search / sort
 * @param filters - `storeId` กรองร้าน · `status` = เฉพาะเมนูในสถานะนั้น (unmapped / mapped / ignored)
 * @param options - ตัวเลือก UseQueryOptions เพิ่มเติม
 */
export function usePosItems(
  params: ParamsDto | undefined,
  filters: { storeId?: string; status?: PosItemStatus } = {},
  options?: Omit<
    UseQueryOptions<PaginatedResponse<PosItem>>,
    "queryKey" | "queryFn"
  >,
) {
  const buCode = useBuCode();
  const { storeId, status } = filters;
  return useQuery<PaginatedResponse<PosItem>>({
    queryKey: [QUERY_KEYS.POS_SALE_ITEMS, buCode, storeId, status, params],
    queryFn: () =>
      getJson(
        buildUrl(API_ENDPOINTS.POS_SALE_ITEMS(buCode!), {
          ...params,
          store_id: storeId,
          status,
        }),
        "Failed to load POS items",
      ),
    ...CACHE_DYNAMIC,
    ...options,
    enabled: !!buCode && (options?.enabled ?? true),
  });
}

/**
 * mutation ที่คืน `body.data` — ใช้ `useMutation` ตรง ๆ เพราะ `useApiMutation` คืน body
 * ทั้งก้อน และต้อง invalidate ตอน error ด้วย (confirm: ยอดคงเหลือ/สถานะอาจเปลี่ยนไปแล้ว)
 */
function usePosMutation<TVariables, TData>(opts: {
  call: (buCode: string, variables: TVariables) => Promise<Response>;
  errorMessage: string;
  invalidate: (variables: TVariables) => readonly unknown[][];
}) {
  const buCode = useBuCode();
  const queryClient = useQueryClient();
  return useMutation<TData, ApiError, TVariables>({
    mutationFn: async (variables) => {
      if (!buCode)
        throw new ApiError("MISSING_REQUIRED_FIELD", "Missing buCode");
      const res = await opts.call(buCode, variables);
      if (!res.ok) throw await ApiError.from(res, opts.errorMessage);
      const json = await res.json();
      return json?.data as TData;
    },
    onSettled: (_data, _err, variables) => {
      for (const queryKey of opts.invalidate(variables)) {
        void queryClient.invalidateQueries({ queryKey });
      }
    },
  });
}

/** อัปโหลดไฟล์ Simphony (multipart field `file`) — ไฟล์ที่ถูกปฏิเสธคืน 201 พร้อม status ≠ success */
export function useUploadSimphony() {
  return usePosMutation<File, PosImportSummary>({
    call: (buCode, file) => {
      const form = new FormData();
      form.append("file", file, file.name);
      return httpClient.post(
        API_ENDPOINTS.POS_SALE_IMPORT_SIMPHONY(buCode),
        form,
      );
    },
    errorMessage: "Failed to upload POS file",
    invalidate: () => [
      [QUERY_KEYS.POS_SALE_IMPORTS],
      [QUERY_KEYS.POS_SALE_STORES],
      // ไฟล์ใหม่เพิ่ม Outlet / เมนูของร้านได้
      [QUERY_KEYS.POS_SALE_OUTLETS],
      [QUERY_KEYS.POS_SALE_ITEMS],
    ],
  });
}

/** บรรทัดข้อความที่อ่านจาก PDF ในเบราว์เซอร์ — PDF ไม่ถูกส่งขึ้นเซิร์ฟเวอร์ */
interface Micros3700CheckVariables {
  file_name: string;
  lines: string[][];
  /** เวลาที่ใช้อ่าน PDF (ms) */
  extract_ms: number;
}

/** ตรวจไฟล์ Micros 3700 — ไฟล์ที่ถูกปฏิเสธถูกบันทึกเป็นประวัติตั้งแต่ขั้นนี้ ส่วน `ready` ไม่เขียนอะไร */
export function useCheckMicros3700() {
  return usePosMutation<Micros3700CheckVariables, PosMicros3700CheckResult>({
    call: (buCode, variables) =>
      httpClient.post(
        API_ENDPOINTS.POS_SALE_IMPORT_MICROS3700_CHECK(buCode),
        variables,
      ),
    errorMessage: "Failed to check Micros 3700 report",
    invalidate: () => [[QUERY_KEYS.POS_SALE_IMPORTS]],
  });
}

/**
 * นำเข้ารายงาน Micros 3700 ต่อ Outlet — Outlet ที่มีอยู่แล้วต้องระบุข้าม หรือเขียนทับพร้อมชุดที่เห็นตอนตรวจ
 * ไม่งั้น (หรือชุดเปลี่ยนไปแล้ว) ได้ `needs_resolution` · เขียนทับ void Stock Out เดิมได้ จึง invalidate
 * รายการ/รายละเอียด Stock Out ด้วย
 */
export function useImportMicros3700() {
  return usePosMutation<
    Micros3700CheckVariables & {
      overwrite: PosMicros3700Overwrite[];
      skip_outlet_codes: string[];
    },
    PosMicros3700ImportResult
  >({
    call: (buCode, variables) =>
      httpClient.post(
        API_ENDPOINTS.POS_SALE_IMPORT_MICROS3700(buCode),
        variables,
      ),
    errorMessage: "Failed to import Micros 3700 report",
    invalidate: () => [
      [QUERY_KEYS.POS_SALE_IMPORTS],
      [QUERY_KEYS.POS_SALE_IMPORT],
      [QUERY_KEYS.POS_SALE_STORES],
      [QUERY_KEYS.POS_SALE_OUTLETS],
      [QUERY_KEYS.POS_SALE_ITEMS],
      [QUERY_KEYS.INVENTORY_ADJUSTMENTS],
    ],
  });
}

/**
 * ข้อความของ Outlet ที่นำเข้าไม่สำเร็จ
 *
 * @param error - `error` ของ `PosMicros3700OutletResult`
 * @param t - แปลจาก namespace `errors`
 * @returns ข้อความแปลตาม `byCode.<app_code>` พร้อม params ไม่งั้นใช้ `message` จาก backend
 */
export function outletErrorMessage(
  error: PosMicros3700OutletResult["error"],
  t: TranslationFn,
): string {
  if (!error) return "";
  const key = `byCode.${error.app_code}`;
  if (error.app_code && t.has?.(key)) return t(key, error.params);
  return error.message;
}

/** ยกเลิกการนำเข้า (ไม่ได้ถ้ามีบรรทัดที่ยืนยันแล้ว) */
export function useCancelPosImport() {
  return usePosMutation<string, { id: string }>({
    call: (buCode, id) =>
      httpClient.post(API_ENDPOINTS.POS_SALE_IMPORT_CANCEL(buCode, id)),
    errorMessage: "Failed to cancel POS import",
    invalidate: () => [
      [QUERY_KEYS.POS_SALE_IMPORTS],
      [QUERY_KEYS.POS_SALE_IMPORT],
      [QUERY_KEYS.POS_SALE_STORES],
    ],
  });
}

/** ผูก/ล้าง Location ของ Outlet (`location_id: null` = ล้าง) */
export function useUpdatePosOutlet() {
  return usePosMutation<
    { id: string; location_id: string | null },
    { id: string }
  >({
    call: (buCode, { id, location_id }) =>
      httpClient.patch(API_ENDPOINTS.POS_SALE_OUTLET(buCode, id), {
        location_id,
      }),
    errorMessage: "Failed to update POS outlet",
    invalidate: () => [
      [QUERY_KEYS.POS_SALE_OUTLETS],
      [QUERY_KEYS.POS_SALE_IMPORT],
    ],
  });
}

/**
 * ผูก/ล้างสูตรของเมนู (`recipe_id: null` = ล้าง) หรือสั่งไม่นับเมนู (`is_ignored`)
 * — ต้องส่งอย่างน้อยหนึ่งฟิลด์ · สูตรกับ `is_ignored: true` ส่งพร้อมกันไม่ได้
 */
export function useUpdatePosItem() {
  return usePosMutation<
    { id: string; recipe_id?: string | null; is_ignored?: boolean },
    { id: string }
  >({
    call: (buCode, { id, ...body }) =>
      httpClient.patch(API_ENDPOINTS.POS_SALE_ITEM(buCode, id), body),
    errorMessage: "Failed to update POS item",
    invalidate: () => [
      [QUERY_KEYS.POS_SALE_ITEMS],
      [QUERY_KEYS.POS_SALE_STORES],
      [QUERY_KEYS.POS_SALE_IMPORT],
      // ค่าตั้งต้นของเมนูเปลี่ยน = บรรทัดใน Sales Consumption ที่ยังเป็น pending เปลี่ยนตาม
      [QUERY_KEYS.SALES_CONSUMPTION],
    ],
  });
}
