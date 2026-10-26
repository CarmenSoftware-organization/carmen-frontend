const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

/** เดือนปัจจุบันของเครื่องผู้ใช้ในรูป `YYYY-MM` */
export function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** วันนี้ของเครื่องผู้ใช้ในรูป `YYYY-MM-DD` */
export function todayIso(): string {
  const d = new Date();
  return `${currentMonth()}-${String(d.getDate()).padStart(2, "0")}`;
}

/** ค่า `?month=` ที่ใช้ได้ ไม่งั้นเดือนปัจจุบัน */
export function parseMonth(raw: string): string {
  return MONTH_RE.test(raw) ? raw : currentMonth();
}

/** เลื่อนเดือน `YYYY-MM` ไป `delta` เดือน */
export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
