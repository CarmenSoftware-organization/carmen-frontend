/**
 * ครั้งล่าสุดที่ refresh token ติดต่อ server ไม่ได้ (network/timeout/5xx) หรือไม่ — แยกจาก
 * "token ถูกปฏิเสธ" เพื่อให้ RequireAuth แสดงหน้า "ติดต่อเซิร์ฟเวอร์ไม่ได้" แทนการพาไป login
 * ตอน server ล่ม (session ยังอยู่ แค่รอ server กลับมา)
 * รูปเดียวกับ token-store — subscribe ได้ผ่าน useSyncExternalStore
 */
type Listener = () => void;

let unreachable = false;
const listeners = new Set<Listener>();

export const authReachabilityStore = {
  get: (): boolean => unreachable,
  set: (next: boolean): void => {
    if (next === unreachable) return;
    unreachable = next;
    listeners.forEach((listener) => listener());
  },
  subscribe: (listener: Listener): (() => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};
