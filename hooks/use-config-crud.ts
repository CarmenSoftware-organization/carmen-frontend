import {
  useQuery,
  type UseQueryResult,
  type UseMutationResult,
  type UseQueryOptions,
} from "@tanstack/react-query";
import { useBuCode } from "@/hooks/use-bu-code";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { createConfigApi } from "@/lib/config-crud";
import { fetchAllPages } from "@/lib/fetch-all-pages";
import { CACHE_STATIC, type CacheProfile } from "@/lib/cache-config";
import type { ParamsDto, PaginatedResponse } from "@/types/params";
import type { ApiErrorMeta } from "@/lib/api-error-handler";

interface ConfigCrudOptions {
  queryKey: string;
  endpoint: (buCode: string) => string;
  label: string;
  updateMethod?: "PUT" | "PATCH";
  cacheProfile?: CacheProfile;
  /** ส่งต่อให้ create/update/delete — เช่น `{ preferServerMessage: true }` */
  mutationMeta?: ApiErrorMeta;
  /**
   * key อื่นที่ mutation ต้องล้างด้วย — เช่น `["lookup"]` ของ resource ที่ lookup อ่านค่าเงิน/ภาษี
   * (exchange_rate, tax_rate) จาก Lookup API ซึ่ง cache แยกจาก list ของ crud นี้
   */
  extraInvalidateKeys?: readonly unknown[];
}

/**
 * Factory สร้างชุด hook CRUD มาตรฐานสำหรับ config module (list/byId/create/update/delete)
 *
 * ลดการเขียน boilerplate ของ config hooks ทุก module ให้เหลือเพียงไม่กี่บรรทัด
 * โดยใช้ `createConfigApi` สร้าง API function + `useApiMutation` ห่อ mutation
 * ค่าเริ่มต้น `updateMethod` = `"PUT"`; ใช้ `"PATCH"` ได้เมื่อ backend รองรับ
 * ทุก hook อ่าน buCode ผ่าน `useBuCode()` และ guard ด้วย enabled อัตโนมัติ
 *
 * @param options - ตัวเลือก queryKey, endpoint, label และ updateMethod
 * @returns object ของ hook useList/useListAll/useById/useCreate/useUpdate/useDelete
 * @example
 * ```ts
 * const crud = createConfigCrud<Currency, CreateCurrencyDto>({
 *   queryKey: QUERY_KEYS.CURRENCIES,
 *   endpoint: API_ENDPOINTS.CURRENCIES,
 *   label: "currency",
 * });
 * export const useCurrency = crud.useList;
 * export const useCreateCurrency = crud.useCreate;
 * ```
 */
export function createConfigCrud<T, TCreate>({
  queryKey,
  endpoint,
  label,
  updateMethod = "PUT",
  cacheProfile = CACHE_STATIC,
  mutationMeta,
  extraInvalidateKeys = [],
}: ConfigCrudOptions): {
  useList: (
    params?: ParamsDto,
    options?: Omit<
      UseQueryOptions<PaginatedResponse<T>>,
      "queryKey" | "queryFn"
    >,
  ) => UseQueryResult<PaginatedResponse<T>>;
  useListAll: (
    params?: Omit<ParamsDto, "page" | "perpage">,
    options?: Omit<UseQueryOptions<T[]>, "queryKey" | "queryFn">,
  ) => UseQueryResult<T[]>;
  useById: (
    id: string | undefined,
    options?: Pick<UseQueryOptions<T>, "staleTime" | "refetchOnMount">,
  ) => UseQueryResult<T>;
  useCreate: () => UseMutationResult<unknown, Error, TCreate>;
  useUpdate: () => UseMutationResult<
    unknown,
    Error,
    TCreate & { id: string; doc_version?: number }
  >;
  useDelete: () => UseMutationResult<unknown, Error, string>;
} {
  const api = createConfigApi<T, TCreate>({ endpoint, label, updateMethod });

  /**
   * Hook ดึงรายการ config entity แบบแบ่งหน้า
   *
   * ใช้ cache profile จาก `cacheProfile` (default `CACHE_STATIC` 30 นาที)
   * queryKey ประกอบด้วย [queryKey, buCode, params] เพื่อแยก cache ต่อ BU/param
   * enabled จะเป็น false จนกว่า buCode จะพร้อม
   *
   * @param params - พารามิเตอร์ pagination/search/filter
   * @param options - ตัวเลือก UseQueryOptions เพิ่มเติม
   * @returns UseQueryResult ของ PaginatedResponse
   * @example
   * ```ts
   * const { data, isLoading } = useCurrency({ page: 1, perpage: 20 });
   * ```
   */
  function useList(
    params?: ParamsDto,
    options?: Omit<
      UseQueryOptions<PaginatedResponse<T>>,
      "queryKey" | "queryFn"
    >,
  ) {
    const buCode = useBuCode();

    return useQuery<PaginatedResponse<T>>({
      queryKey: [queryKey, buCode, params],
      queryFn: () => api.getList(buCode!, params),
      ...cacheProfile,
      ...options,
      enabled: (options?.enabled ?? true) && !!buCode,
    });
  }

  /**
   * Hook ดึงทุกแถวของ entity (วนหน้าละ `MAX_PERPAGE` ผ่าน `fetchAllPages`) แทนการขอทั้งทะเบียนในครั้งเดียว
   *
   * ใช้กับทะเบียนที่ต้องได้ครบจริง (จัดกลุ่ม / ติ๊กทั้งกลุ่ม / พิมพ์) เท่านั้น
   * queryKey ขึ้นต้นด้วย `queryKey` เดียวกับ `useList` — mutation ของ crud นี้ invalidate ไปด้วย
   *
   * @example
   * ```ts
   * const { data: permissions = [] } = usePermissionAll();
   * ```
   */
  function useListAll(
    params?: Omit<ParamsDto, "page" | "perpage">,
    options?: Omit<UseQueryOptions<T[]>, "queryKey" | "queryFn">,
  ) {
    const buCode = useBuCode();

    return useQuery<T[]>({
      queryKey: [queryKey, buCode, "all", params],
      queryFn: () =>
        fetchAllPages((page, perpage) =>
          api.getList(buCode!, { ...params, page, perpage }),
        ),
      ...cacheProfile,
      ...options,
      enabled: (options?.enabled ?? true) && !!buCode,
    });
  }

  /**
   * Hook ดึง config entity ตาม id
   *
   * ใช้สำหรับหน้า edit page แบบ page-based ที่ต้องโหลดข้อมูลเดิมก่อนแก้ไข
   * enabled เป็น false เมื่อ id หรือ buCode ยังไม่พร้อม
   *
   * @param id - id ของ entity
   * @param options - ทับ cache profile เฉพาะจุดเรียก (เช่น staleTime: 0 เมื่อต้องการค่าสดทุกครั้งที่เปิด)
   * @returns UseQueryResult ของ entity
   * @example
   * ```ts
   * const { data } = useCurrencyById(params.id);
   * ```
   */
  function useById(
    id: string | undefined,
    options?: Pick<UseQueryOptions<T>, "staleTime" | "refetchOnMount">,
  ) {
    const buCode = useBuCode();

    return useQuery<T>({
      queryKey: [queryKey, buCode, id],
      queryFn: () => api.getById(buCode!, id!),
      enabled: !!buCode && !!id,
      ...cacheProfile,
      ...options,
    });
  }

  function useCreate() {
    return useApiMutation<TCreate>({
      mutationFn: (data, buCode) => api.create(buCode, data),
      invalidateKeys: [queryKey, ...extraInvalidateKeys],
      errorMessage: `Failed to create ${label}`,
      meta: mutationMeta,
    });
  }

  function useUpdate() {
    return useApiMutation<TCreate & { id: string; doc_version?: number }>({
      mutationFn: ({ id, ...data }, buCode) =>
        api.update(buCode, id, data as TCreate),
      invalidateKeys: [queryKey, ...extraInvalidateKeys],
      errorMessage: `Failed to update ${label}`,
      meta: mutationMeta,
    });
  }

  function useDelete() {
    return useApiMutation<string>({
      mutationFn: (id, buCode) => api.remove(buCode, id),
      invalidateKeys: [queryKey, ...extraInvalidateKeys],
      errorMessage: `Failed to delete ${label}`,
      meta: mutationMeta,
    });
  }

  return { useList, useListAll, useById, useCreate, useUpdate, useDelete };
}
