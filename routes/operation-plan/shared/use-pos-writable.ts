import { useCan } from "@/hooks/use-can";
import { useInterfaceEntitlement } from "@/hooks/use-interface-entitlement";
import { usePosStatus } from "@/hooks/use-pos-status";
import { PERMISSIONS } from "@/constant/permissions";

/**
 * แก้ master mapping ของ POS (Outlet → Location, เมนู → สูตร / Ignore) ได้หรือไม่ — ต้องครบทั้งสามข้อ:
 * สัญญา BU เขียนได้ · มีสิทธิ์ `stock_out.create` (backend บังคับที่ PATCH outlets/items) ·
 * มีอย่างน้อยหนึ่งแบรนด์ที่เปิดใช้และ license ยังไม่หมดอายุ (`expired` = ดูได้แต่แก้ไม่ได้)
 *
 * ระหว่างโหลดสถานะ POS ถือว่าแก้ไม่ได้ (กันปุ่มเปิดแล้วดับ) · ไม่มีแบรนด์เปิดใช้เลย = อ่านอย่างเดียว
 *
 * @returns `canWrite` รวมเงื่อนไขทั้งหมด
 */
export function usePosWritable() {
  const { canWrite, can } = useCan();
  const { entitlementOf } = useInterfaceEntitlement();
  const { enabledBrands, isLoading } = usePosStatus();
  return {
    canWrite:
      !isLoading &&
      canWrite &&
      can(PERMISSIONS.inventory_management.stock_out.create) &&
      enabledBrands.some((b) => entitlementOf("pos", b) !== "expired"),
  };
}
