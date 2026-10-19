import { useQuery } from "@tanstack/react-query";
import { httpClient } from "@/lib/http-client";
import { QUERY_KEYS } from "@/constant/query-keys";
import { API_ENDPOINTS } from "@/constant/api-endpoints";
import { CACHE_DYNAMIC } from "@/lib/cache-config";

export interface ProductCostLot {
  lot_no: string;
  qty: number;
  cost_per_unit: number;
  line_cost: number;
}

export interface ProductCostByLocationQty {
  product_id?: string;
  product_code?: string;
  product_name?: string;
  inventory_unit_name?: string;
  location_id?: string;
  location_code?: string;
  location_name?: string;
  requested_qty?: number;
  average_cost_per_unit: number;
  total_cost: number;
  lots?: ProductCostLot[];
  currency?: string;
  unit_name?: string;
}

export interface ProductLastReceiving {
  grn_id?: string;
  grn_no?: string;
  received_at?: string;
  vendor_id?: string;
  vendor_name?: string;
  qty?: number;
  unit_name?: string;
  total_cost: number;
  currency?: string;
}

export interface ProductLastReceivingByUnit {
  type?: string;
  no?: string;
  id?: string;
  cost_per_unit: number;
  currency_id?: string;
  currency_code?: string;
  exchange_rate?: number;
  vendor_id?: string;
  vendor_name?: string;
}

export function useProductCostByLocationQty(
  buCode: string | undefined,
  productId: string | undefined,
  locationId: string | undefined,
  qty: number | undefined,
  /** วันที่ของเอกสาร (ใบจ่ายออก) — ราคาจากของที่มีอยู่ในวันนั้นเท่านั้น */
  atDate?: string,
) {
  return useQuery<ProductCostByLocationQty>({
    queryKey: [
      QUERY_KEYS.PRODUCT_COST_BY_LOCATION_QTY,
      buCode,
      productId,
      locationId,
      qty,
      atDate,
    ],
    queryFn: async () => {
      if (!buCode || !productId || !locationId || qty === undefined) {
        throw new Error("Missing required params");
      }
      const res = await httpClient.get(
        API_ENDPOINTS.PRODUCT_COST_BY_LOCATION_QTY(
          buCode,
          productId,
          locationId,
          qty,
          atDate,
        ),
      );
      if (!res.ok) throw new Error("Failed to fetch product cost");
      const json = await res.json();
      return json.data ?? json;
    },
    // qty เป็น 0 ได้ — ยิงตั้งแต่เลือกสินค้าเสร็จเพื่อดึงต้นทุนมาโชว์ ไม่ต้องรอ
    // ให้กรอกจำนวนก่อน
    enabled: !!buCode && !!productId && !!locationId && qty !== undefined,
    // ต้นทุนผูกกับล็อตที่มีอยู่จริง ณ ตอนนั้น — สินค้า/คลัง/จำนวนเปลี่ยนเมื่อไหร่
    // ต้องได้ตัวเลขใหม่ทันที ไม่ใช่ของที่ค้างอยู่ใน cache
    staleTime: 0,
  });
}

export interface StockInDefaultCost {
  product_id: string;
  location_id: string;
  /** วันทำการที่ใช้ตีราคา (YYYY-MM-DD) · null เมื่อไม่ได้ส่งวันที่ */
  at_date: string | null;
  /** วิธีที่ใช้จริง — si.cost-from ของ BU หรือ last_cost เมื่อค่าที่ตั้งใช้กับ BU นี้ไม่ได้ */
  method: "last_cost" | "last_receiving" | "average" | "standard";
  cost_per_unit: number;
}

/**
 * ราคาตั้งต้นของบรรทัดใบรับเข้า (SI) ตามค่า "Default price for added items" (si.cost-from)
 * ที่ตั้งไว้ในหน้า Company Profile — กติกาเดียวกับใบรับเข้าฝั่งนับเกินของใบนับ
 * ไม่ขึ้นกับจำนวน และไม่ต้องมีของที่คลัง (ต่างจาก useProductCostByLocationQty ซึ่งเป็นต้นทุนการจ่าย)
 */
export function useStockInDefaultCost(
  buCode: string | undefined,
  productId: string | undefined,
  locationId: string | undefined,
  /** วันที่ของใบ — ไม่นับใบรับเข้าที่ลงวันที่หลังวันนั้น */
  atDate?: string,
) {
  return useQuery<StockInDefaultCost>({
    queryKey: [
      QUERY_KEYS.STOCK_IN_DEFAULT_COST,
      buCode,
      productId,
      locationId,
      atDate,
    ],
    queryFn: async () => {
      if (!buCode || !productId || !locationId) {
        throw new Error("Missing required params");
      }
      const res = await httpClient.get(
        API_ENDPOINTS.STOCK_IN_DEFAULT_COST(
          buCode,
          productId,
          locationId,
          atDate,
        ),
      );
      if (!res.ok) throw new Error("Failed to fetch stock-in default cost");
      const json = await res.json();
      return json.data ?? json;
    },
    enabled: !!buCode && !!productId && !!locationId,
    // ราคาผูกกับใบรับเข้าล่าสุด/ค่าเฉลี่ย ณ ตอนนั้น — เลือกสินค้า/คลัง/วันที่ใหม่ต้องได้ตัวเลขใหม่
    staleTime: 0,
  });
}

/**
 * Last receiving cost ต่อ inventory unit — ยิงตอน `enabled` เป็น true เท่านั้น
 * (ใช้ hover-to-fetch ข้าง U.Price) → คืน `ProductLastReceivingByUnit` (หรือ null
 * ถ้ายังไม่เคยรับเข้า)
 */
export function useProductLastReceivingByUnit(
  buCode: string | undefined,
  productId: string | undefined,
  unitId: string | undefined,
  enabled = true,
) {
  return useQuery<ProductLastReceivingByUnit | null>({
    queryKey: [
      QUERY_KEYS.PRODUCT_LAST_RECEIVING_BY_UNIT,
      buCode,
      productId,
      unitId,
    ],
    queryFn: async () => {
      if (!buCode || !productId || !unitId) {
        throw new Error("Missing required params");
      }
      const res = await httpClient.get(
        API_ENDPOINTS.PRODUCT_LAST_RECEIVING_BY_UNIT(buCode, productId, unitId),
      );
      if (!res.ok) {
        throw new Error("Failed to fetch product last receiving by unit");
      }
      const json = await res.json();
      return json.data ?? null;
    },
    enabled: enabled && !!buCode && !!productId && !!unitId,
    ...CACHE_DYNAMIC,
  });
}

export function useProductLastReceiving(
  buCode: string | undefined,
  productId: string | undefined,
) {
  return useQuery<ProductLastReceiving | null>({
    queryKey: [QUERY_KEYS.PRODUCT_LAST_RECEIVING, buCode, productId],
    queryFn: async () => {
      if (!buCode || !productId) {
        throw new Error("Missing required params");
      }
      const res = await httpClient.get(
        API_ENDPOINTS.PRODUCT_LAST_RECEIVING(buCode, productId),
      );
      if (!res.ok) throw new Error("Failed to fetch product last receiving");
      const json = await res.json();
      return json.data ?? null;
    },
    enabled: !!buCode && !!productId,
    ...CACHE_DYNAMIC,
  });
}
