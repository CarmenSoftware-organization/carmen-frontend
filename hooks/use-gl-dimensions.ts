import { useQuery } from "@tanstack/react-query";
import { useBuCode } from "@/hooks/use-bu-code";
import { API_ENDPOINTS } from "@/constant/api-endpoints";
import { createConfigApi } from "@/lib/config-crud";
import { fetchAllPages } from "@/lib/fetch-all-pages";
import type { DimensionMaster, DimensionValueMaster } from "@/types/accounting-master";

const dimensionsApi = createConfigApi<DimensionMaster, never>({ endpoint: API_ENDPOINTS.GL_DIMENSIONS, label: "dimensions" });
const valuesApi = createConfigApi<DimensionValueMaster & { gl_dimension_id: string }, never>({ endpoint: API_ENDPOINTS.GL_DIMENSION_VALUES, label: "dimension values" });

export function useGlDimensions(enabled = true) {
  const buCode = useBuCode();
  return useQuery({
    queryKey: ["accounting-master", "dimensions", buCode],
    enabled: enabled && !!buCode,
    queryFn: () => fetchAllPages((page, perpage) => dimensionsApi.getList(buCode!, { page, perpage })),
  });
}

export function useGlDimensionValues(enabled = true) {
  const buCode = useBuCode();
  return useQuery({
    queryKey: ["accounting-master", "dimension-values", buCode],
    enabled: enabled && !!buCode,
    queryFn: async () => (await fetchAllPages((page, perpage) => valuesApi.getList(buCode!, { page, perpage })))
      .map((value) => ({ ...value, dimension_id: value.gl_dimension_id })),
  });
}
