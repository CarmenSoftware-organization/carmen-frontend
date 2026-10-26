import { setURLParams, useURL } from "@/hooks/use-url";
import { usePosStores } from "./use-pos-sale";

/**
 * ร้านที่เลือกอยู่ของแท็บผูก Outlet / เมนู — เก็บใน query `?store=` (แชร์ระหว่างสองแท็บ) ผ่าน `hooks/use-url.ts` เหมือน page / search
 *
 * ตัวเลือกคือทุกร้านของ BU (ไม่แยกแบรนด์) · ค่าใน URL ที่ไม่ตรงกับร้านใด (หรือยังไม่มี) ใช้ร้านแรกแทน
 * ร้านเดียวจึงถูกเลือกให้เอง · เปลี่ยนร้านแล้วล้าง `page` ทิ้ง กันค้างหน้าที่เกินช่วง
 *
 * @returns ทุกร้าน + ร้านที่ใช้อยู่ (`storeId` เป็น undefined เมื่อไม่มีร้าน) + ตัวเปลี่ยนร้าน
 */
export function usePosStoreFilter() {
  const { data: stores = [], isLoading } = usePosStores();
  const [raw] = useURL("store");
  const storeId =
    stores.find((s) => s.id === raw)?.id ?? stores.at(0)?.id ?? undefined;

  const setStoreId = (next: string) => {
    setURLParams({ store: next, page: "" });
  };

  return { stores, storeId, isLoading, setStoreId };
}
