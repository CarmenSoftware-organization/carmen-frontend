import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

/** ความกว้างขอบจาง (px) — พอให้เห็นว่ามีแท็บต่อ แต่ไม่จางจนอ่านแท็บสุดท้ายที่โผล่ไม่ออก */
const FADE = 24;

/**
 * แถบแท็บที่เลื่อนแนวนอนได้เมื่อแท็บกว้างเกินกล่อง (มือถือ: 4 แท็บ ~424px ในกล่อง 304–334px)
 *
 * - เลื่อนในแถบเอง ทั้งหน้าไม่เลื่อนซ้าย-ขวา
 * - ขอบจางเฉพาะด้านที่ยังมีแท็บซ่อนอยู่ — ที่ 360 แท็บที่ 4 หายพ้นขอบพอดี ไม่มีอะไรบอกว่ายังมีแท็บต่อ
 * - แท็บที่เลือกถูกเลื่อนเข้ามาในจอเสมอ (กดแท็บที่โผล่ครึ่งเดียว หรือ onInvalid สลับแท็บให้เอง)
 *   คำนวณ scrollLeft เอง ไม่ใช้ scrollIntoView เพราะมันเลื่อนหน้าแนวตั้งตามไปด้วย
 *
 * pb-1.5 / -mb-1.5 เผื่อเส้นใต้แท็บที่เลือก (after:bottom-[-5px]) ไม่ให้ overflow ตัดทิ้ง (ทรงเดียวกับ GRN)
 * `relative` ทำให้ offsetLeft ของแท็บนับจากกล่องนี้
 */
export function PdTabScroller({
  active,
  children,
}: {
  /** ค่าแท็บที่เลือกอยู่ — เปลี่ยนเมื่อไรเลื่อนแท็บนั้นเข้ามาในจอ */
  readonly active: string;
  readonly children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ start: false, end: false });

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const start = el.scrollLeft > 1;
    const end = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
    setEdge((prev) =>
      prev.start === start && prev.end === end ? prev : { start, end },
    );
  }, []);

  // กล่องกว้างขึ้น/แคบลง หรือตัวเลขในแท็บโหลดมา (ความกว้างแท็บเปลี่ยน) → คำนวณขอบใหม่
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => ro.disconnect();
  }, [update]);

  useEffect(() => {
    const el = ref.current;
    const tab = el?.querySelector<HTMLElement>(
      '[role="tab"][data-state="active"]',
    );
    if (!el || !tab) return;
    const left = tab.offsetLeft;
    const right = left + tab.offsetWidth;
    if (left - FADE < el.scrollLeft) {
      el.scrollTo({ left: Math.max(0, left - FADE), behavior: "smooth" });
    } else if (right + FADE > el.scrollLeft + el.clientWidth) {
      el.scrollTo({
        left: right + FADE - el.clientWidth,
        behavior: "smooth",
      });
    }
  }, [active]);

  const mask =
    edge.start || edge.end
      ? `linear-gradient(to right, ${edge.start ? "transparent" : "black"}, black ${FADE}px, black calc(100% - ${FADE}px), ${edge.end ? "transparent" : "black"})`
      : undefined;

  return (
    <div
      ref={ref}
      onScroll={update}
      className="relative -mb-1.5 overflow-x-auto overflow-y-hidden pb-1.5"
      style={mask ? { maskImage: mask, WebkitMaskImage: mask } : undefined}
    >
      {children}
    </div>
  );
}
