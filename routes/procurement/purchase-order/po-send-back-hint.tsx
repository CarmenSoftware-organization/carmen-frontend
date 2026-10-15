import { useState } from "react";
import {
  collectSendBackReasons,
  SendBackHint,
} from "@/components/share/send-back-hint";
import type { LastAction } from "@/types/last-action";
import { usePurchaseOrderById } from "../shared/use-purchase-order";

interface PoSendBackHintProps {
  readonly poId: string;
  readonly lastAction?: LastAction | null;
}

/**
 * ป้ายส่งกลับของ PO — ดึงรายละเอียดใบนั้นเมื่อ tooltip เปิดครั้งแรก
 * (query key เดียวกับหน้าแก้ไข เปิดใบนั้นต่อจะได้จาก cache เลย)
 */
export function PoSendBackHint({ poId, lastAction }: PoSendBackHintProps) {
  // ปิด tooltip แล้วไม่ทิ้ง id — ไม่งั้นข้อมูลหายตอนเปิดซ้ำ
  const [requested, setRequested] = useState(false);
  const { data, isLoading } = usePurchaseOrderById(
    requested ? poId : undefined,
  );
  return (
    <SendBackHint
      lastAction={lastAction}
      reasons={collectSendBackReasons(data?.purchase_order_detail)}
      isLoading={isLoading}
      onFirstOpen={() => setRequested(true)}
    />
  );
}
