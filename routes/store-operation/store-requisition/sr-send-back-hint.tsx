import { useState } from "react";
import {
  collectSendBackReasons,
  SendBackHint,
} from "@/components/share/send-back-hint";
import type { LastAction } from "@/types/last-action";
import { useStoreRequisitionById } from "./use-sr";

interface SrSendBackHintProps {
  readonly srId: string;
  readonly lastAction?: LastAction | null;
}

/**
 * ป้ายส่งกลับของ SR — ดึงรายละเอียดใบนั้นเมื่อ tooltip เปิดครั้งแรก
 * (query key เดียวกับหน้าแก้ไข เปิดใบนั้นต่อจะได้จาก cache เลย)
 */
export function SrSendBackHint({ srId, lastAction }: SrSendBackHintProps) {
  // ปิด tooltip แล้วไม่ทิ้ง id — ไม่งั้นข้อมูลหายตอนเปิดซ้ำ
  const [requested, setRequested] = useState(false);
  const { data, isLoading } = useStoreRequisitionById(
    requested ? srId : undefined,
  );
  return (
    <SendBackHint
      lastAction={lastAction}
      reasons={collectSendBackReasons(data?.store_requisition_detail)}
      isLoading={isLoading}
      onFirstOpen={() => setRequested(true)}
    />
  );
}
