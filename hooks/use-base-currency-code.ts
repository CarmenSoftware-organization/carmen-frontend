import { useCallback, useContext, useSyncExternalStore } from "react";
import { QueryClientContext } from "@tanstack/react-query";
import { profileQueryKey } from "@/hooks/use-profile";
import type { UserProfile } from "@/types/profile";

/**
 * รหัสสกุลเงินหลักของ BU ปัจจุบัน (เช่น "THB") — อ่านจาก cache ของ profile ที่ shell โหลดไว้แล้ว
 * ไม่ยิง query เอง และ **ไม่ต้องมี QueryClientProvider** (คืน "" แทน) เพราะผู้เรียกคือการ์ด
 * widget ซึ่งเป็น component แสดงผลล้วนที่ถูกเรนเดอร์เดี่ยว ๆ ได้ (preview / รูปตัวอย่าง / เทสต์)
 * กติกา BU ปัจจุบัน = ตัวเดียวกับ `useProfile` (is_default ก่อน ไม่มีใช้ตัวแรก)
 * ไม่มี fallback เป็น THB: ไม่รู้สกุล = ไม่พิมพ์สกุล ดีกว่าพิมพ์บาทให้ BU ที่ไม่ใช่บาท
 */
export function useBaseCurrencyCode(): string {
  const client = useContext(QueryClientContext);
  const read = useCallback(() => {
    const profile = client?.getQueryData<UserProfile>(profileQueryKey);
    const bu =
      profile?.business_unit?.find((b) => b.is_default) ??
      profile?.business_unit?.[0];
    return bu?.config?.default_currency?.code ?? "";
  }, [client]);
  const subscribe = useCallback(
    (onChange: () => void) =>
      client ? client.getQueryCache().subscribe(onChange) : () => {},
    [client],
  );
  return useSyncExternalStore(subscribe, read, read);
}
