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
import type { PaginatedResponse, ParamsDto } from "@/types/params";
import type {
  PosBrand,
  PosConfirmResult,
  PosImportDetail,
  PosImportListItem,
  PosImportSummary,
  PosItem,
  PosOutlet,
  PosPreview,
  PosShortage,
  PosStore,
} from "./pos-sale-types";

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

/** ตัวอย่างการตัดสต็อกของการนำเข้า (หนึ่งรายการต่อ Outlet) — ยอดคงเหลือเปลี่ยนได้ จึงไม่ cache นาน */
export function usePosImportPreview(id: string | undefined, enabled = true) {
  const buCode = useBuCode();
  return useQuery<PosPreview>({
    queryKey: [QUERY_KEYS.POS_SALE_PREVIEW, buCode, id],
    queryFn: async () =>
      (
        await getJson<{ data: PosPreview }>(
          API_ENDPOINTS.POS_SALE_IMPORT_PREVIEW(buCode!, id!),
          "Failed to load POS preview",
        )
      ).data,
    staleTime: 0,
    // backend ตอบ 400 กับการนำเข้าที่ไม่ใช่ success — รอรู้สถานะก่อนค่อยยิง
    enabled: !!buCode && !!id && enabled,
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
 * @param filters - `storeId` กรองร้าน · `unmapped` true = เฉพาะที่ยังไม่มีสูตร
 * @param options - ตัวเลือก UseQueryOptions เพิ่มเติม
 */
export function usePosItems(
  params: ParamsDto | undefined,
  filters: { storeId?: string; unmapped?: boolean } = {},
  options?: Omit<
    UseQueryOptions<PaginatedResponse<PosItem>>,
    "queryKey" | "queryFn"
  >,
) {
  const buCode = useBuCode();
  const { storeId, unmapped } = filters;
  return useQuery<PaginatedResponse<PosItem>>({
    queryKey: [QUERY_KEYS.POS_SALE_ITEMS, buCode, storeId, unmapped, params],
    queryFn: () =>
      getJson(
        buildUrl(API_ENDPOINTS.POS_SALE_ITEMS(buCode!), {
          ...params,
          store_id: storeId,
          // backend รับ 'true' | 'false' เป็นสตริง — ไม่ส่งเมื่อไม่ได้กรอง
          unmapped: unmapped === undefined ? undefined : String(unmapped),
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

/** ยืนยัน Outlet หนึ่งเป็น Stock Out — refetch ทั้งตอนสำเร็จและ error เพื่อให้ preview สด */
export function useConfirmPosOutlet() {
  return usePosMutation<
    { importId: string; outletId: string },
    PosConfirmResult
  >({
    call: (buCode, { importId, outletId }) =>
      httpClient.post(
        API_ENDPOINTS.POS_SALE_OUTLET_CONFIRM(buCode, importId, outletId),
      ),
    errorMessage: "Failed to confirm POS outlet",
    invalidate: ({ importId }) => [
      [QUERY_KEYS.POS_SALE_IMPORT],
      [QUERY_KEYS.POS_SALE_PREVIEW],
      [QUERY_KEYS.POS_SALE_IMPORTS],
      // กันพลาดเมื่อ key ผูก id ในอนาคต
      [QUERY_KEYS.POS_SALE_IMPORT, importId],
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
      [QUERY_KEYS.POS_SALE_PREVIEW],
      [QUERY_KEYS.POS_SALE_IMPORT],
    ],
  });
}

/** ผูก/ล้างสูตรของเมนู (`recipe_id: null` = ล้าง) */
export function useUpdatePosItem() {
  return usePosMutation<
    { id: string; recipe_id: string | null },
    { id: string }
  >({
    call: (buCode, { id, recipe_id }) =>
      httpClient.patch(API_ENDPOINTS.POS_SALE_ITEM(buCode, id), { recipe_id }),
    errorMessage: "Failed to update POS item",
    invalidate: () => [
      [QUERY_KEYS.POS_SALE_ITEMS],
      [QUERY_KEYS.POS_SALE_STORES],
      [QUERY_KEYS.POS_SALE_PREVIEW],
      [QUERY_KEYS.POS_SALE_IMPORT],
    ],
  });
}

/**
 * รายการสินค้าที่ไม่พอจาก error ของการยืนยัน
 *
 * @param err - error ที่ mutation โยนมา
 * @returns `details.shortages` เมื่อเป็น `POS_SALE_INSUFFICIENT_STOCK` ไม่งั้น `[]`
 */
export function shortagesOf(err: unknown): PosShortage[] {
  if (
    !(err instanceof ApiError) ||
    err.appCode !== "POS_SALE_INSUFFICIENT_STOCK"
  )
    return [];
  const shortages = (err.details as { shortages?: unknown } | undefined)
    ?.shortages;
  return Array.isArray(shortages) ? (shortages as PosShortage[]) : [];
}
