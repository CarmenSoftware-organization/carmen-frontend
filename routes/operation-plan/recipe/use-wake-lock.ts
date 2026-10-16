import { useEffect } from "react";

/**
 * กันจอดับระหว่างเชฟเปิดสูตรค้างไว้หน้าเตา
 *
 * browser ปล่อย lock เองเมื่อแท็บถูกซ่อน จึงขอใหม่ทุกครั้งที่กลับมา visible
 * ไม่รองรับ / ถูกปฏิเสธ (เช่น แบตต่ำ) = เงียบ ๆ ไม่ใช่ error ของผู้ใช้
 */
export function useWakeLock(enabled: boolean): void {
  useEffect(() => {
    if (!enabled || !("wakeLock" in navigator)) return;
    let sentinel: WakeLockSentinel | null = null;
    let pending = false;
    let cancelled = false;

    const request = async () => {
      // ขอซ้อนกันได้ถ้า visibilitychange มาระหว่างรอ — lock ตัวแรกจะหลุดมือแล้วค้าง
      if (pending || (sentinel && !sentinel.released)) return;
      pending = true;
      try {
        const lock = await navigator.wakeLock.request("screen");
        if (cancelled) {
          void lock.release();
          return;
        }
        sentinel = lock;
      } catch {
        // ไม่ได้ lock ก็ใช้หน้าได้ตามปกติ
      } finally {
        pending = false;
      }
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") void request();
    };

    void request();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      void sentinel?.release().catch(() => {});
    };
  }, [enabled]);
}
