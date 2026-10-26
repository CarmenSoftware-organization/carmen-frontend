import { useCan } from "@/hooks/use-can";
import { useInterfaceEntitlement } from "@/hooks/use-interface-entitlement";
import { usePosStatus } from "@/hooks/use-pos-status";

/**
 * แก้ข้อมูล master ของ POS ได้หรือไม่ — ต้องมีสิทธิ์เขียนของสัญญา BU และมีอย่างน้อยหนึ่งแบรนด์ที่ license
 * ยังไม่หมดอายุ (`expired` = ดูได้แต่แก้ไม่ได้ เหมือนหน้าตรวจการนำเข้า)
 *
 * @returns `canWrite` รวมเงื่อนไขทั้งสอง
 */
export function usePosWritable() {
  const { canWrite } = useCan();
  const { entitlementOf } = useInterfaceEntitlement();
  const { enabledBrands } = usePosStatus();
  return {
    canWrite:
      canWrite &&
      enabledBrands.some((b) => entitlementOf("pos", b) !== "expired"),
  };
}
