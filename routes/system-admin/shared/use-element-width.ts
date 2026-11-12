import { useEffect, useState } from "react";

/**
 * ความกว้างของ element (px) ตามจริง อัปเดตเมื่อกล่องเปลี่ยนขนาด — ใช้ตัดสิน layout จาก
 * ความกว้างของกล่องตัวเองในจุดที่ container query ของ CSS ทำไม่ได้ (เช่น เลือกคอลัมน์ของตาราง)
 *
 * @returns `[setElement, width]` — ผูก `setElement` เป็น `ref` ของกล่อง · `width` เป็น
 *   `undefined` จนกว่าจะวัดครั้งแรก
 */
export function useElementWidth<T extends HTMLElement = HTMLDivElement>() {
  const [element, setElement] = useState<T | null>(null);
  const [width, setWidth] = useState<number | undefined>();

  useEffect(() => {
    if (!element) return;
    // ResizeObserver ยิงครั้งแรกทันทีที่ observe จึงไม่ต้องวัดเองในเอฟเฟกต์
    const observer = new ResizeObserver(([entry]) => {
      setWidth(Math.round(entry.contentRect.width));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [element]);

  return [setElement, width] as const;
}
