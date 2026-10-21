import { useQuery } from "@tanstack/react-query";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { createConfigCrud } from "@/hooks/use-config-crud";
import { useBuCode } from "@/hooks/use-bu-code";
import { useXlsxExport, type XlsxColumn } from "@/hooks/use-xlsx-export";
import { httpClient } from "@/lib/http-client";
import { buildUrl } from "@/lib/build-query-string";
import { ApiError } from "@/lib/api-error";
import { CACHE_DYNAMIC, CACHE_NORMAL } from "@/lib/cache-config";
import { API_ENDPOINTS } from "@/constant/api-endpoints";
import { QUERY_KEYS } from "@/constant/query-keys";
import type {
  CreatePriceListDto,
  PriceList,
  PriceListActiveVendor,
} from "@/types/price-list";
import type { PaginatedResponse } from "@/types/params";
import type { ParamsDto } from "@/types/params";

const crud = createConfigCrud<PriceList, CreatePriceListDto>({
  queryKey: QUERY_KEYS.PRICE_LISTS,
  endpoint: API_ENDPOINTS.PRICE_LISTS,
  label: "price list",
  updateMethod: "PATCH",
  cacheProfile: CACHE_NORMAL,
});

export const usePriceList = crud.useList;

export const usePriceListById = crud.useById;

export const useCreatePriceList = crud.useCreate;

export const useUpdatePriceList = crud.useUpdate;

// DELETE = hard delete (admin only) — ใช้ void/restore สำหรับการยกเลิกปกติ
export const useDeletePriceList = crud.useDelete;

export function useVoidPriceList() {
  return useApiMutation<{ id: string; reason: string }>({
    mutationFn: ({ id, reason }, buCode) =>
      httpClient.post(API_ENDPOINTS.PRICE_LIST_VOID(buCode, id), { reason }),
    invalidateKeys: [QUERY_KEYS.PRICE_LISTS],
    errorMessage: "Failed to void price list",
  });
}

export function useRestorePriceList() {
  return useApiMutation<string>({
    mutationFn: (id, buCode) =>
      httpClient.post(API_ENDPOINTS.PRICE_LIST_RESTORE(buCode, id), {}),
    invalidateKeys: [QUERY_KEYS.PRICE_LISTS],
    errorMessage: "Failed to restore price list",
  });
}

// --- Export ---

interface ExportPriceListArgs {
  params?: ParamsDto;
  columns: XlsxColumn<PriceList>[];
}

export function useExportPriceList() {
  const buCode = useBuCode();
  const { exportToXlsx, isExporting } = useXlsxExport();

  const exportPriceList = async ({ params, columns }: ExportPriceListArgs) => {
    if (!buCode) throw new Error("Missing buCode");
    return exportToXlsx<PriceList>({
      fetch: async () => {
        const url = buildUrl(API_ENDPOINTS.PRICE_LISTS(buCode), params);
        const res = await httpClient.get(url);
        if (!res.ok) throw new Error("Failed to fetch price lists");
        const json = await res.json();
        return json.data ?? [];
      },
      columns,
      sheetName: "Price Lists",
      fileNamePrefix: "price-list",
    });
  };

  return { exportPriceList, isExporting };
}

export function useActivePriceListsByVendor(
  vendorId: string | null | undefined,
  date: string | undefined,
  workflowId: string | null | undefined,
) {
  const buCode = useBuCode();
  return useQuery<PriceList[], ApiError>({
    queryKey: [
      QUERY_KEYS.PRICE_LIST_ACTIVE_BY_VENDOR,
      buCode,
      vendorId,
      date,
      workflowId,
    ],
    queryFn: async () => {
      const url = buildUrl(
        API_ENDPOINTS.PRICE_LIST_ACTIVE_BY_VENDOR(buCode!, vendorId!, date!),
        { workflow_id: workflowId },
      );
      const res = await httpClient.get(url);
      if (!res.ok) {
        throw await ApiError.from(
          res,
          "Failed to load active price lists for vendor",
        );
      }
      const json = (await res.json()) as
        PaginatedResponse<PriceList> | { data?: PriceList[] };
      return json.data ?? [];
    },
    enabled: !!buCode && !!vendorId && !!date && !!workflowId,
    ...CACHE_DYNAMIC,
  });
}

export function usePriceListActiveVendors(date: string | undefined) {
  const buCode = useBuCode();
  return useQuery<PriceListActiveVendor[], ApiError>({
    queryKey: [QUERY_KEYS.PRICE_LIST_ACTIVE_VENDORS, buCode, date],
    queryFn: async () => {
      const res = await httpClient.get(
        API_ENDPOINTS.PRICE_LIST_ACTIVE_VENDORS(buCode!, date!),
      );
      if (!res.ok) {
        throw await ApiError.from(res, "Failed to load active vendors");
      }
      const json = await res.json();
      return json.data ?? [];
    },
    enabled: !!buCode && !!date,
    ...CACHE_DYNAMIC,
  });
}

