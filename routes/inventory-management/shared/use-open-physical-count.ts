import { useState } from "react";
import { useNavigate } from "react-router";
import { listReturnState } from "@/hooks/use-list-return";
import { useTranslations } from "use-intl";
import { toast } from "sonner";
import { useCreatePhysicalCount } from "./use-physical-count";
import type { PhysicalCountLocation } from "@/types/physical-count";

interface UseOpenPhysicalCountResult {
  readonly open: (
    item: PhysicalCountLocation,
    physicalCountPeriodId: string,
  ) => void;
  readonly pendingLocationId: string | null;
}

/**
 * Hook เปิดใบนับสต๊อกของ location หนึ่ง ใช้ร่วมกันระหว่างหน้า Physical Count และหน้า Period End review
 *
 * เดิมสองหน้านี้มี handler คนละตัวและเพี้ยนคนละทาง: หน้า Physical Count ยิงสร้างใบแต่ไม่มี
 * pending state ไม่มี error handler และ cast `res.data.id` แบบไม่เช็ค ส่วนหน้า review
 * `if (physical_count_id)` แล้วไม่มี else เลย — กดปุ่ม Start บนแถวที่ยังไม่มีใบแล้ว
 * **ไม่เกิดอะไรขึ้นทั้งสิ้น** ไม่มี request ไม่มี toast
 *
 * @returns `open` สำหรับผูกกับปุ่ม และ `pendingLocationId` สำหรับ spinner
 * @example
 * ```tsx
 * const { open, pendingLocationId } = useOpenPhysicalCount();
 * <PcLocationRow
 *   item={item}
 *   pending={pendingLocationId === item.id}
 *   onAction={(i) => open(i, period.id)}
 * />
 * ```
 */
export function useOpenPhysicalCount(): UseOpenPhysicalCountResult {
  const navigate = useNavigate();
  const t = useTranslations("inventoryManagement.physicalCount");
  const createPhysicalCount = useCreatePhysicalCount();
  const [pendingLocationId, setPendingLocationId] = useState<string | null>(
    null,
  );

  const open = (item: PhysicalCountLocation, physicalCountPeriodId: string) => {
    if (item.physical_count_id) {
      navigate(
        `/inventory-management/physical-count/${item.physical_count_id}/entry`,
        listReturnState(),
      );
      return;
    }

    setPendingLocationId(item.id);
    createPhysicalCount.mutate(
      {
        physical_count_period_id: physicalCountPeriodId,
        location_id: item.id,
      },
      {
        onSuccess: (res) => {
          const id = (res as { data?: { id?: string } } | undefined)?.data?.id;
          // เช็คก่อน navigate — เดิม cast ตรง ๆ ถ้า envelope เปลี่ยนจะพาไป
          // `/physical-count/undefined/entry` ซึ่ง debug ยากกว่า error ตรง ๆ มาก
          if (!id) {
            toast.error(t("startFailed"));
            return;
          }
          navigate(
            `/inventory-management/physical-count/${id}/entry`,
            listReturnState(),
          );
        },
        onSettled: () => setPendingLocationId(null),
      },
    );
  };

  return { open, pendingLocationId };
}
