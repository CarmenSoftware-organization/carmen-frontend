import { useSearchParams } from "react-router";
import type { PosBrand } from "./pos-sale-types";
import { usePosStores } from "./use-pos-sale";

/**
 * ร้านที่เลือกอยู่ของแท็บผูก Outlet / เมนู — เก็บใน query `?store=` (แชร์ระหว่างสองแท็บ)
 *
 * ค่าใน URL ที่ไม่ตรงกับร้านของแบรนด์ (หรือยังไม่มี) ใช้ร้านแรกแทน — ร้านเดียวจึงถูกเลือกให้เอง
 * เปลี่ยนร้านแล้วล้าง `page` ทิ้ง กันค้างหน้าที่เกินช่วง
 *
 * @param brand แบรนด์ POS ของหน้านี้
 * @returns ร้านของแบรนด์ + ร้านที่ใช้อยู่ (`storeId` เป็น undefined เมื่อไม่มีร้าน) + ตัวเปลี่ยนร้าน
 */
export function usePosStoreFilter(brand: PosBrand) {
  const { data: stores = [], isLoading } = usePosStores(brand);
  const [params, setParams] = useSearchParams();
  const raw = params.get("store");
  const storeId =
    stores.find((s) => s.id === raw)?.id ?? stores.at(0)?.id ?? undefined;

  const setStoreId = (next: string) => {
    setParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        p.set("store", next);
        p.delete("page");
        return p;
      },
      { replace: true },
    );
  };

  return { stores, storeId, isLoading, setStoreId };
}
