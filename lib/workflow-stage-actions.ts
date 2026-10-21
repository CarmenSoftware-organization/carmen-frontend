/**
 * สิ่งที่ stage ปัจจุบันของ workflow อนุญาตให้ทำกับเอกสาร — backend ส่งมาเป็น
 * `stage_actions` บน detail ของ PR/PO/SR (null/ไม่มี = backend เก่าหรือไม่มี workflow)
 */
export interface StageActionFlags {
  approve: boolean;
  reject: boolean;
  sendback: boolean;
}

// null/undefined ต้องเปิดทุกปุ่ม (fail-open) — ไม่งั้นเจอ backend เก่าแล้วปุ่มหายหมด
// ส่วนการบังคับจริงอยู่ที่ backend (WORKFLOW_STAGE_ACTION_DISABLED)
export function getStageActionFlags(
  raw: StageActionFlags | null | undefined,
): StageActionFlags {
  return raw ?? { approve: true, reject: true, sendback: true };
}

/**
 * true เมื่อหลังตั้งแถว `rejectIndices` เป็น reject แล้ว ทุกแถวเป็น reject
 * (แถวที่ reject อยู่แล้วนับด้วย) และมีอย่างน้อย 1 แถว — ใช้กันการปัดตกทั้งใบ
 * ตอน stage ไม่เปิดให้ reject ทั้งเอกสาร
 */
export function wouldRejectAll(
  statuses: readonly string[],
  rejectIndices: readonly number[],
  isReject: (s: string) => boolean,
): boolean {
  if (statuses.length === 0) return false;
  const picked = new Set(rejectIndices);
  return statuses.every((s, i) => picked.has(i) || isReject(s));
}
