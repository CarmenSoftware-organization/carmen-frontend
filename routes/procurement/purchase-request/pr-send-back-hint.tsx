import { useState } from "react";
import {
  collectSendBackReasons,
  SendBackHint,
} from "@/components/share/send-back-hint";
import type { LastAction } from "@/types/last-action";
import { usePurchaseRequestById } from "./use-purchase-request";

interface PrSendBackHintProps {
  readonly prId: string;
  readonly lastAction?: LastAction | null;
}

/**
 * ป้ายส่งกลับของ PR — ดึงรายละเอียดใบนั้นเมื่อ tooltip เปิดครั้งแรก
 * (query key เดียวกับหน้าแก้ไข เปิดใบนั้นต่อจะได้จาก cache เลย)
 */
export function PrSendBackHint({ prId, lastAction }: PrSendBackHintProps) {
  // ปิด tooltip แล้วไม่ทิ้ง id — ไม่งั้นข้อมูลหายตอนเปิดซ้ำ
  const [requested, setRequested] = useState(false);
  const { data, isLoading } = usePurchaseRequestById(
    requested ? prId : undefined,
  );
  return (
    <SendBackHint
      lastAction={lastAction}
      reasons={collectSendBackReasons(data?.purchase_request_detail)}
      isLoading={isLoading}
      onFirstOpen={() => setRequested(true)}
    />
  );
}
