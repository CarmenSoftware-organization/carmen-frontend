import { useEffect, useRef, type RefObject } from "react";
import type { Virtualizer } from "@tanstack/react-virtual";

/**
 * Enter ในช่องนับ → โฟกัสช่องของรายการถัดไป (นับต่อเนื่องด้วยคีย์บอร์ดล้วน)
 *
 * ตามด้วย id ไม่ใช่ index: ตอนกรอง "ยังไม่นับ" แถวที่เพิ่งกรอกจะหลุดออกจากรายการ
 * index ถัดไปจึงเลื่อน — หา id เป้าหมายตอนกด แล้วค่อยหา index ใหม่หลังรายการขยับ
 */
export function useEntryAdvance<T extends { id: string }>(
  items: readonly T[],
  virtualizer: Virtualizer<HTMLDivElement, Element>,
  scrollRef: RefObject<HTMLDivElement | null>,
) {
  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  return (fromId: string) => {
    const list = itemsRef.current;
    const at = list.findIndex((d) => d.id === fromId);
    const nextId = at >= 0 ? list[at + 1]?.id : undefined;
    if (!nextId) {
      (document.activeElement as HTMLElement | null)?.blur();
      return;
    }
    const findInput = () =>
      scrollRef.current?.querySelector<HTMLInputElement>(
        `input[data-entry-id="${nextId}"]`,
      );
    // แถวถัดไปอยู่ใน DOM แล้ว (กรณีปกติ) → โฟกัสทันทีในจังหวะเดียวกับ Enter
    // ไม่งั้นคนพิมพ์เร็ว/เครื่องสแกนจะส่งตัวเลขถัดไปเข้าช่องเดิมก่อนโฟกัสย้าย
    const ready = findInput();
    if (ready) {
      ready.focus();
      return;
    }
    const focusNext = (triesLeft: number) => {
      const idx = itemsRef.current.findIndex((d) => d.id === nextId);
      if (idx < 0) return;
      virtualizer.scrollToIndex(idx, { align: "auto" });
      requestAnimationFrame(() => {
        const input = findInput();
        if (input) input.focus();
        else if (triesLeft > 0) focusNext(triesLeft - 1);
      });
    };
    focusNext(3);
  };
}
