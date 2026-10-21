import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * เมนูข้าม section แบบ sticky ด้านซ้าย (จอ lg ขึ้นไป) — ไฮไลต์ section ที่กำลังอ่าน
 *
 * หน้านี้ยาวหลายจอ (ที่อยู่สองชุด + รูปแบบวันที่/ตัวเลข) และคนเข้ามามักจะแก้แค่
 * หมวดเดียว ใช้พื้นที่ที่ได้จากความกว้าง `wide` วางเมนูไว้ข้าง ๆ แทนการเลื่อนหา
 *
 * scroll container ของแอปไม่ใช่ window แต่ IntersectionObserver ที่ root = viewport
 * คิดการถูกตัดของ ancestor ที่ scroll ให้อยู่แล้ว จึงใช้ได้โดยไม่ต้องหา container
 */
export function SectionNav({
  sections,
  label,
}: {
  readonly sections: ReadonlyArray<{
    readonly id: string;
    readonly title: string;
  }>;
  readonly label: string;
}) {
  const [active, setActive] = useState(sections[0]?.id);

  useEffect(() => {
    const els = sections
      .map((s) => document.getElementById(s.id))
      .filter((el): el is HTMLElement => el != null);
    const visible = new Set<string>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) visible.add(e.target.id);
          else visible.delete(e.target.id);
        }
        // section แรก (ตามลำดับในหน้า) ที่ยังอยู่ในแถบบนของจอ
        const first = sections.find((s) => visible.has(s.id));
        if (first) setActive(first.id);
      },
      { rootMargin: "-10% 0px -60% 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [sections]);

  const go = (id: string) => {
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const target = document.getElementById(id);
    if (!target) return;
    // เลื่อนเฉพาะ scroll container ที่ใกล้ที่สุด — scrollIntoView เลื่อนทุก ancestor
    // รวม shell ที่ overflow-hidden ด้วย แถบ footer ของแอปเลยถูกดันหลุดจอ
    const container = scrollParent(target);
    const top =
      target.getBoundingClientRect().top -
      (container?.getBoundingClientRect().top ?? 0) +
      (container?.scrollTop ?? window.scrollY) -
      16;
    (container ?? window).scrollTo({
      top,
      behavior: reduce ? "auto" : "smooth",
    });
    setActive(id);
  };

  return (
    <nav aria-label={label} className="hidden lg:block">
      <ul className="sticky top-4 space-y-0.5 border-l">
        {sections.map((s) => (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => go(s.id)}
              aria-current={active === s.id ? "location" : undefined}
              className={cn(
                "-ml-px block w-full border-l-2 py-1.5 pl-3 text-left text-xs transition-colors",
                active === s.id
                  ? "border-primary text-foreground font-semibold"
                  : "text-muted-foreground hover:text-foreground border-transparent",
              )}
            >
              {s.title}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function scrollParent(el: HTMLElement): HTMLElement | null {
  for (let p = el.parentElement; p; p = p.parentElement) {
    const { overflowY } = getComputedStyle(p);
    if (
      (overflowY === "auto" || overflowY === "scroll") &&
      p.scrollHeight > p.clientHeight
    )
      return p;
  }
  return null;
}
