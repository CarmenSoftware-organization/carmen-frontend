/**
 * ผลต่อใบของ swipe-approve / swipe-reject
 *
 * backend ตอบ 200 เสมอแล้วใส่ผลรายใบใน `data` — ใบที่ถูกบล็อก (เช่น stage ปิด action นี้ไว้)
 * คือ `{ id, success: false, message, app_code? }` ไม่ใช่ HTTP error `useApiMutation` จึงเห็นเป็น
 * "สำเร็จ" ทุกครั้ง · ต้องอ่านผลรายใบเองก่อนขึ้น toast ว่าสำเร็จ
 */
export interface SwipeResultItem {
  id: string;
  success: boolean;
  message?: string;
  app_code?: string;
}

/** app_code ที่ FE มีข้อความเฉพาะของตัวเอง (errors.byCode.<CODE>) */
export const STAGE_ACTION_DISABLED_CODE = "WORKFLOW_STAGE_ACTION_DISABLED";

function isSwipeResultItem(value: unknown): value is SwipeResultItem {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as SwipeResultItem).id === "string" &&
    typeof (value as SwipeResultItem).success === "boolean"
  );
}

/**
 * คืนเฉพาะใบที่ไม่สำเร็จจาก response ของ swipe
 * response ที่ไม่มี `data` เป็น array (รูปแบบเพี้ยน) ถือว่าไม่มีใบล้มเหลวให้บอก เหมือนพฤติกรรมเดิม
 */
export function getSwipeFailures(response: unknown): SwipeResultItem[] {
  const data = (response as { data?: unknown } | null)?.data;
  if (!Array.isArray(data)) return [];
  return data.filter(isSwipeResultItem).filter((item) => !item.success);
}
