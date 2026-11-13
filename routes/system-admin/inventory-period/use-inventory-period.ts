import { createConfigCrud } from "@/hooks/use-config-crud";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { useBuCode } from "@/hooks/use-bu-code";
import { useXlsxExport, type XlsxColumn } from "@/hooks/use-xlsx-export";
import { httpClient } from "@/lib/http-client";
import { buildUrl } from "@/lib/build-query-string";
import { API_ENDPOINTS } from "@/constant/api-endpoints";
import { QUERY_KEYS } from "@/constant/query-keys";
import type {
  InventoryPeriod,
  GenerateNextInventoryPeriodDto,
} from "@/types/inventory-period";
import type { ParamsDto } from "@/types/params";

// อ่านอย่างเดียว — รอบสร้าง/แก้/ลบด้วยมือจากหน้านี้ไม่ได้ วันที่กำหนดโดยระบบ และรอบใหม่
// เกิดจากการปิดงวด (backend เติมรอบที่เปิดอยู่ให้ครบ 12) จึงไม่ export hook create/update/delete
const crud = createConfigCrud<InventoryPeriod, never>({
  queryKey: QUERY_KEYS.INVENTORY_PERIODS,
  endpoint: API_ENDPOINTS.INVENTORY_PERIODS,
  label: "inventory period",
});

export const useInventoryPeriod = crud.useList;
export const useInventoryPeriodAll = crud.useListAll;

/**
 * Hook สำหรับ generate InventoryPeriod ถัดไปแบบ batch ตามการตั้งค่าที่ระบุ
 *
 * ยิง POST ไป `/api/{bu}/inventory-periods/next` พร้อม payload ตั้งค่า
 * เช่นจำนวนรอบที่ต้องการสร้าง + รูปแบบรหัสรอบ invalidate list หลังสำเร็จ
 *
 * @returns UseMutationResult รับ `GenerateNextInventoryPeriodDto` เป็น variable
 * @example
 * ```ts
 * const gen = useGenerateNextInventoryPeriod();
 * gen.mutate({ count: 12, period_type: "monthly" });
 * ```
 */
export function useGenerateNextInventoryPeriod() {
  return useApiMutation<GenerateNextInventoryPeriodDto>({
    mutationFn: (data, buCode) =>
      httpClient.post(API_ENDPOINTS.INVENTORY_PERIOD_NEXT(buCode), data),
    invalidateKeys: [QUERY_KEYS.INVENTORY_PERIODS],
    errorMessage: "Failed to generate next inventory periods",
    meta: { preferServerMessage: true },
  });
}

// --- Export ---

interface ExportInventoryPeriodArgs {
  params?: ParamsDto;
  columns: XlsxColumn<InventoryPeriod>[];
}

export function useExportInventoryPeriod() {
  const buCode = useBuCode();
  const { exportToXlsx, isExporting } = useXlsxExport();

  const exportInventoryPeriod = async ({ params, columns }: ExportInventoryPeriodArgs) => {
    if (!buCode) throw new Error("Missing buCode");
    return exportToXlsx<InventoryPeriod>({
      fetch: async () => {
        const url = buildUrl(API_ENDPOINTS.INVENTORY_PERIODS(buCode), params);
        const res = await httpClient.get(url);
        if (!res.ok) throw new Error("Failed to fetch inventory periods");
        const json = await res.json();
        return json.data ?? [];
      },
      columns,
      sheetName: "Inventory Periods",
      fileNamePrefix: "inventory-period",
    });
  };

  return { exportInventoryPeriod, isExporting };
}
