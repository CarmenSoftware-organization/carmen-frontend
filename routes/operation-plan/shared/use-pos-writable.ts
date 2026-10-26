import { useCan } from "@/hooks/use-can";
import { useInterfaceEntitlement } from "@/hooks/use-interface-entitlement";
import type { PosBrand } from "@/types/pos-sale";

/**
 * แก้ข้อมูล POS ของแบรนด์นี้ได้หรือไม่ — ต้องมีสิทธิ์เขียนของสัญญา BU และ license ของ interface
 * ต้องไม่หมดอายุ (`expired` = ดูได้แต่แก้ไม่ได้ เหมือนหน้าตรวจการนำเข้า)
 *
 * @param brand แบรนด์ POS ของหน้านี้
 * @returns `canWrite` รวมเงื่อนไขทั้งสอง
 */
export function usePosWritable(brand: PosBrand) {
  const { canWrite } = useCan();
  const { entitlementOf } = useInterfaceEntitlement();
  return {
    canWrite: canWrite && entitlementOf("pos", brand) !== "expired",
  };
}
