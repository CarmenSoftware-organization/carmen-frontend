import { createConfigCrud } from "@/hooks/use-config-crud";
import { useBuCode } from "@/hooks/use-bu-code";
import { useXlsxExport, type XlsxColumn } from "@/hooks/use-xlsx-export";
import { httpClient } from "@/lib/http-client";
import { buildUrl } from "@/lib/build-query-string";
import { API_ENDPOINTS } from "@/constant/api-endpoints";
import { QUERY_KEYS } from "@/constant/query-keys";
import { CACHE_NORMAL } from "@/lib/cache-config";
import type { Product, ProductDetail, CreateProductDto } from "@/types/product";
import type { ParamsDto } from "@/types/params";

const crud = createConfigCrud<ProductDetail, CreateProductDto>({
  queryKey: QUERY_KEYS.PRODUCTS,
  endpoint: API_ENDPOINTS.PRODUCTS,
  label: "product",
  updateMethod: "PATCH",
  cacheProfile: CACHE_NORMAL,
  // item group list มี product_count — สร้าง/ลบ/ย้ายกลุ่มสินค้าแล้วต้นไม้หน้า Category ต้องนับใหม่
  extraInvalidateKeys: [QUERY_KEYS.PRODUCT_ITEM_GROUPS],
});

export const useProduct = crud.useList;
export const useProductAll = crud.useListAll;

export const useProductById = crud.useById;

export const useCreateProduct = crud.useCreate;

export const useUpdateProduct = crud.useUpdate;

export const useDeleteProduct = crud.useDelete;

// --- Export ---

interface ExportProductArgs {
  params?: ParamsDto;
  columns: XlsxColumn<Product>[];
}

export function useExportProduct() {
  const buCode = useBuCode();
  const { exportToXlsx, isExporting } = useXlsxExport();

  const exportProduct = async ({ params, columns }: ExportProductArgs) => {
    if (!buCode) throw new Error("Missing buCode");
    return exportToXlsx<Product>({
      fetch: async () => {
        const url = buildUrl(API_ENDPOINTS.PRODUCTS(buCode), params);
        const res = await httpClient.get(url);
        if (!res.ok) throw new Error("Failed to fetch products");
        const json = await res.json();
        return json.data ?? [];
      },
      columns,
      sheetName: "Products",
      fileNamePrefix: "product",
    });
  };

  return { exportProduct, isExporting };
}
