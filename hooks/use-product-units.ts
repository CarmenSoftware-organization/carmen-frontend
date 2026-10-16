import { useQuery } from "@tanstack/react-query";
import { useBuCode } from "@/hooks/use-bu-code";
import { httpClient } from "@/lib/http-client";
import { QUERY_KEYS } from "@/constant/query-keys";
import { API_ENDPOINTS } from "@/constant/api-endpoints";
import { CACHE_STATIC } from "@/lib/cache-config";
import {
  DEFAULT_QTY_DECIMALS,
  QTY_MAX_DECIMALS,
} from "@/components/ui/input/qty-decimals";

export interface ProductUnit {
  id: string;
  name: string;
  conversion: number;
  decimal_place?: number;
}

/**
 * Hook ดึงหน่วยของสินค้าที่ใช้สำหรับการสั่งซื้อ (order units)
 * ใช้ CACHE_STATIC (staleTime 30 นาที) เพราะหน่วยเป็น master data
 * จะไม่ fetch จนกว่า buCode และ productId จะพร้อม
 * @param productId - รหัสสินค้า
 * @returns React Query ของรายการ ProductUnit พร้อมค่า conversion
 * @example
 * const { data: units = [] } = useProductUnits(productId);
 */
export function useProductUnits(productId: string | undefined) {
  const buCode = useBuCode();

  return useQuery<ProductUnit[]>({
    queryKey: [QUERY_KEYS.PRODUCT_UNITS, buCode, productId],
    queryFn: async () => {
      const res = await httpClient.get(
        API_ENDPOINTS.PRODUCT_UNITS_FOR_ORDER(buCode!, productId!),
      );
      if (!res.ok) throw new Error("Failed to fetch product units");
      const json = await res.json();
      return json.data ?? [];
    },
    enabled: !!buCode && !!productId,
    ...CACHE_STATIC,
  });
}

export function useProductAvailableUnits(productId: string | undefined) {
  const buCode = useBuCode();

  return useQuery<ProductUnit[]>({
    queryKey: [QUERY_KEYS.PRODUCT_UNITS, buCode, productId, "available"],
    queryFn: async () => {
      const res = await httpClient.get(
        API_ENDPOINTS.PRODUCT_UNITS_AVAILABLE(buCode!, productId!),
      );
      if (!res.ok) throw new Error("Failed to fetch available units");
      const json = await res.json();
      return json.data ?? [];
    },
    enabled: !!buCode && !!productId,
    ...CACHE_STATIC,
  });
}

/**
 * Hook ดึงหน่วยสูตร (ingredient units) ของสินค้า — ใช้เลือกหน่วยของวัตถุดิบในสูตรอาหาร
 * แถวแรกคือหน่วย inventory (`conversion` 1) ที่เหลือมาจาก unit conversion ประเภท ingredient
 * `conversion` = จำนวนหน่วยสูตรต่อ 1 หน่วย inventory
 * @param productId - รหัสสินค้า
 * @returns React Query ของรายการ ProductUnit
 * @example
 * const { data: units = [] } = useProductIngredientUnits(productId);
 */
export function useProductIngredientUnits(productId: string | undefined) {
  const buCode = useBuCode();

  return useQuery<ProductUnit[]>({
    queryKey: [QUERY_KEYS.PRODUCT_UNITS, buCode, productId, "ingredient"],
    queryFn: async () => {
      const res = await httpClient.get(
        API_ENDPOINTS.PRODUCT_INGREDIENT_UNITS(buCode!, productId!),
      );
      if (!res.ok) throw new Error("Failed to fetch ingredient units");
      const json = await res.json();
      return json.data ?? [];
    },
    enabled: !!buCode && !!productId,
    ...CACHE_STATIC,
  });
}

/**
 * Hook อ่านจำนวนทศนิยมที่หน่วยหนึ่งของสินค้ารับได้ — ใช้คุมช่องกรอกจำนวน
 *
 * ค่าจริงมาจาก master data ที่ `/api/{bu}/units/order/product/{id}` ตอบมาให้เอง
 * (`decimal_place` ต่อหน่วย) จึงไม่ต้องเดา: kg ให้ทศนิยม, EA เป็น 0 = กรอกเศษไม่ได้
 * ใช้ query ตัวเดียวกับ `LookupProductUnit` ในเซลล์เดียวกัน React Query แคชให้
 * ไม่ยิงซ้ำ · ยังไม่รู้ค่า (กำลังโหลด/ไม่มีหน่วย) → `DEFAULT_QTY_DECIMALS`
 *
 * @param productId - รหัสสินค้าของแถวนั้น
 * @param unitId - หน่วยที่เลือกอยู่ในช่องนั้น
 * @returns จำนวนทศนิยมสูงสุด clamp ไว้ที่ `QTY_MAX_DECIMALS` (เพดานคอลัมน์ใน DB)
 * @example
 * ```tsx
 * const decimals = useUnitDecimals(productId, receivedUnitId);
 * <InputSuffixQty decimals={decimals} {...register(...)} />
 * ```
 */
export function useUnitDecimals(
  productId: string | undefined,
  unitId: string | undefined,
): number {
  const { data: units = [] } = useProductUnits(productId || undefined);
  const dp = units.find((u) => u.id === unitId)?.decimal_place;
  if (dp == null || !Number.isFinite(dp)) return DEFAULT_QTY_DECIMALS;
  return Math.min(Math.max(Math.trunc(dp), 0), QTY_MAX_DECIMALS);
}
