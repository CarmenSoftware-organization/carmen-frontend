import { useCallback, useRef, useState, type PointerEvent } from "react";

/** ความกว้าง popup (px) และความสูงสูงสุดของรายการ (px) — ไม่รวมช่องค้นหา */
export interface LookupSize {
  readonly width: number;
  readonly height: number;
}

const STORAGE_PREFIX = "carmen.lookup-size.";
const MIN_LIST_HEIGHT = 160;

function readSize(key: string | undefined): LookupSize | null {
  if (!key) return null;
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === "object" &&
      "width" in parsed &&
      "height" in parsed &&
      Number.isFinite(parsed.width) &&
      Number.isFinite(parsed.height)
    ) {
      return parsed as LookupSize;
    }
  } catch {
    // storage ถูกบล็อก / ค่าเสีย — ใช้ขนาดเดิม
  }
  return null;
}

function writeSize(key: string | undefined, size: LookupSize | null) {
  if (!key) return;
  try {
    if (size) localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(size));
    else localStorage.removeItem(STORAGE_PREFIX + key);
  } catch {
    // จำไม่ได้ก็แค่เปิดครั้งหน้าเป็นขนาดเดิม
  }
}

function cssPx(el: HTMLElement, name: string): number {
  const v = parseFloat(getComputedStyle(el).getPropertyValue(name));
  return Number.isFinite(v) ? v : Infinity;
}

/**
 * ลากมุม popup ของ lookup เพื่อปรับกว้าง/สูง — จำต่อ `resizeKey` ใน localStorage
 * (ไม่มีคีย์ = ปรับได้แต่ปิดแล้วกลับขนาดเดิม)
 *
 * ทิศการลากอ่านจาก `data-side` / `data-align` ที่ Radix ติดไว้บน content:
 * เปิดด้านบนปุ่ม → ที่จับอยู่มุมบนและลากขึ้นคือขยาย, align end → ที่จับอยู่ซ้าย,
 * align center → กล่องขยายสองข้างเท่ากัน จึงคูณระยะลากสองเท่าให้มุมตามเมาส์
 *
 * `autoAlign` ให้ caller ใช้เมื่อไม่ได้กำหนด align เอง: ปุ่มอยู่ครึ่งขวาของจอ
 * (เช่นใน Sheet ด้านขวา) → ยึดขอบขวา ที่จับไปอยู่ซ้ายซึ่งมีที่ให้ลาก — ถ้าจัดกลาง
 * popup ชิดขอบจอแล้วลากขยายไปทางขวาไม่ได้เลย
 */
export function useLookupResize(
  resizeKey: string | undefined,
  defaultListHeight: number,
) {
  const [size, setSize] = useState<LookupSize | null>(() =>
    readSize(resizeKey),
  );
  const contentRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [autoAlign, setAutoAlign] = useState<"start" | "end">("start");
  // ค่าล่าสุดสำหรับ handler ที่ผูกไว้ตอนเริ่มลาก — อัปเดตคู่กับ setSize เสมอ
  const sizeRef = useRef(size);
  const apply = useCallback((next: LookupSize | null) => {
    sizeRef.current = next;
    setSize(next);
  }, []);

  const onPointerDown = useCallback(
    (e: PointerEvent<HTMLElement>) => {
      const content = contentRef.current;
      if (!content || e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();

      const handle = e.currentTarget;
      handle.setPointerCapture(e.pointerId);

      const rect = content.getBoundingClientRect();
      const list = content.querySelector<HTMLElement>(
        '[data-slot="command-list"]',
      );
      const listHeight = list?.getBoundingClientRect().height ?? 0;
      const startHeight = sizeRef.current?.height ?? defaultListHeight;
      // ส่วนที่ไม่ใช่รายการ (ช่องค้นหา, prependItems) — ใช้หักออกจากพื้นที่ว่างบนจอ
      const chrome = rect.height - listHeight;

      const side = content.dataset.side;
      const align = content.dataset.align;
      const dirY = side === "top" ? -1 : 1;
      const dirX = (align === "end" ? -1 : 1) * (align === "center" ? 2 : 1);

      const minWidth = cssPx(content, "--radix-popover-trigger-width");
      // เผื่อขอบจอ 8px — วัดจากปุ่มเพราะ available-width ของ Radix ไม่สนว่ายึดขอบไหน
      const trig = triggerRef.current?.getBoundingClientRect();
      const roomByAlign = !trig
        ? Infinity
        : align === "start"
          ? window.innerWidth - trig.left - 8
          : align === "end"
            ? trig.right - 8
            : Infinity;
      const maxWidth = Math.min(
        roomByAlign,
        cssPx(content, "--radix-popover-content-available-width"),
      );
      const maxHeight =
        cssPx(content, "--radix-popover-content-available-height") - chrome;

      const startX = e.clientX;
      const startY = e.clientY;

      const move = (ev: globalThis.PointerEvent) => {
        const width = Math.min(
          maxWidth,
          Math.max(
            Number.isFinite(minWidth) ? minWidth : 0,
            rect.width + (ev.clientX - startX) * dirX,
          ),
        );
        const height = Math.min(
          Math.max(maxHeight, MIN_LIST_HEIGHT),
          Math.max(MIN_LIST_HEIGHT, startHeight + (ev.clientY - startY) * dirY),
        );
        apply({ width: Math.round(width), height: Math.round(height) });
      };
      const up = (ev: globalThis.PointerEvent) => {
        handle.releasePointerCapture(ev.pointerId);
        handle.removeEventListener("pointermove", move);
        handle.removeEventListener("pointerup", up);
        handle.removeEventListener("pointercancel", up);
        writeSize(resizeKey, sizeRef.current);
      };
      handle.addEventListener("pointermove", move);
      handle.addEventListener("pointerup", up);
      handle.addEventListener("pointercancel", up);
    },
    [resizeKey, defaultListHeight, apply],
  );

  const reset = useCallback(() => {
    apply(null);
    writeSize(resizeKey, null);
  }, [resizeKey, apply]);

  /** เรียกตอน popup เปิด — เลือกขอบที่ยึดตามตำแหน่งปุ่มบนจอ */
  const onOpened = useCallback(() => {
    const trig = triggerRef.current?.getBoundingClientRect();
    if (!trig) return;
    setAutoAlign(
      trig.left + trig.width / 2 > window.innerWidth / 2 ? "end" : "start",
    );
  }, []);

  /** ไม่มีคีย์ = ไม่จำ — ล้างขนาดตอนปิด popup */
  const onClose = useCallback(() => {
    if (!resizeKey) apply(null);
  }, [resizeKey, apply]);

  return {
    size,
    contentRef,
    triggerRef,
    autoAlign,
    onOpened,
    onPointerDown,
    reset,
    onClose,
  };
}
