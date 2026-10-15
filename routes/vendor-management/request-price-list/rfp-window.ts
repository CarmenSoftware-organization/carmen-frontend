export type RfpWindowState = "upcoming" | "open" | "closed";

export interface RfpWindow {
  readonly state: RfpWindowState;
  /** วันที่เหลือก่อนปิดรับ (0 = ปิดวันนี้) — มีค่าเฉพาะตอน `open` */
  readonly daysLeft: number | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

// นับเป็นวันปฏิทินตามเวลาเครื่อง ให้ตรงกับวันที่ที่ formatDate แสดงในคอลัมน์เดียวกัน
// (ถ้าเทียบ timestamp ตรง ๆ ใบที่จบ "วันนี้" จะกลายเป็น closed ตั้งแต่เที่ยงคืน UTC)
function localDay(value: string | Date): number | null {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** สถานะรอบรับราคาของใบขอราคา คำนวณจากช่วงวันที่เทียบกับวันนี้ — backend ไม่มี field นี้ */
export function getRfpWindow(
  startDate: string,
  endDate: string,
  now: Date = new Date(),
): RfpWindow | null {
  const today = localDay(now);
  const start = localDay(startDate);
  const end = localDay(endDate);
  if (today === null || start === null || end === null) return null;
  if (today < start) return { state: "upcoming", daysLeft: null };
  if (today > end) return { state: "closed", daysLeft: null };
  return { state: "open", daysLeft: Math.round((end - today) / DAY_MS) };
}

export function countSubmitted(
  vendors: readonly { has_submitted?: boolean }[] | undefined,
): number {
  return vendors?.filter((v) => v.has_submitted).length ?? 0;
}
