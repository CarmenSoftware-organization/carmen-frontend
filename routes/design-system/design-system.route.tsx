import { useState } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ColorsSection } from "./sections/colors";
import { TypographySection } from "./sections/typography";
import { FoundationsSection } from "./sections/foundations";
import { ButtonsSection } from "./sections/buttons";
import { BadgesSection } from "./sections/badges";
import { FormsSection } from "./sections/forms";
import { OverlaysSection } from "./sections/overlays";
import { FeedbackSection } from "./sections/feedback";
import { StatusPaletteSection } from "./sections/status-palette";
import { ColorThemesSection } from "./sections/color-themes";

/**
 * /design-system — หน้าอ้างอิงของ design system ที่ **มีอยู่แล้ว**
 *
 * เป็นคู่ที่มองเห็นได้ของ `docs/DESIGN.md`: เอกสารนั้นบอกกฎ หน้านี้แสดงของจริง
 * ที่เรนเดอร์จาก token ใน `styles/globals.css` และ primitive ใน
 * `components/ui/` ตรง ๆ — ไม่มีสี ขนาด หรือคอมโพเนนต์ชุดที่สองในหน้านี้
 * ถ้าเห็นอะไรเพี้ยนที่นี่ แปลว่า design system เพี้ยน ไม่ใช่หน้านี้เพี้ยน
 *
 * หน้านี้ไม่ผ่าน i18n โดยตั้งใจ — เป็นเครื่องมือของทีมพัฒนา ไม่ใช่หน้าใช้งาน
 * ของลูกค้า จึงไม่มี key ใน messages/{en,th}.json ให้ต้องดูแล
 */

const NAV = [
  {
    group: "Foundations",
    items: [
      { id: "colors-core", label: "Colors — core" },
      { id: "colors-semantic", label: "Colors — semantic" },
      { id: "colors-ink", label: "Colors — inks" },
      { id: "colors-surface", label: "Colors — surface" },
      { id: "colors-chart", label: "Colors — charts" },
      { id: "type-ladder", label: "Type — governed" },
      { id: "type-display", label: "Type — display" },
      { id: "type-roles", label: "Type — roles" },
      { id: "type-font", label: "Font stack" },
      { id: "radius", label: "Radius" },
      { id: "elevation", label: "Elevation" },
      { id: "spacing", label: "Spacing" },
      { id: "motion", label: "Motion" },
    ],
  },
  {
    group: "Elements",
    items: [
      { id: "buttons", label: "Button — variants" },
      { id: "button-sizes", label: "Button — sizes" },
      { id: "badges", label: "Badge — solid" },
      { id: "badges-light", label: "Badge — light" },
      { id: "badge-sizes", label: "Badge — sizes" },
      { id: "inputs", label: "Text inputs" },
      { id: "choice", label: "Choice controls" },
      { id: "card", label: "Card" },
      { id: "overlays", label: "Dialog · Menu · Tooltip" },
      { id: "tabs", label: "Tabs" },
      { id: "loading", label: "Loading" },
      { id: "empty-error", label: "Empty & Error" },
      { id: "iconography", label: "Iconography" },
    ],
  },
  {
    group: "Status",
    items: [{ id: "status-palette", label: "Document status" }],
  },
  {
    group: "Themes",
    items: [{ id: "color-themes", label: "Color themes" }],
  },
];

export function Component() {
  /**
   * ธีมถูกจำกัดขอบเขตไว้ในหน้านี้เท่านั้น — คลาส `dark` ไปอยู่ที่ div ครอบ
   * ไม่ใช่ที่ `<html>` เพราะ variant ของ Tailwind ที่รีโปนี้ตั้งไว้คือ
   * `&:is(.dark *)` ซึ่งดูแค่ว่ามี ancestor ที่ติดคลาสไหม การสลับที่นี่จึงไม่
   * รั่วไปทั้งแอปและไม่ค้างเมื่อออกจากหน้า (ทั้งแอปยังไม่มีสวิตช์ธีมจริง —
   * CSS ของ dark mode ครบแต่ยังไม่มีใครตั้งคลาสนั้นให้)
   */
  const [dark, setDark] = useState(false);

  return (
    <div className={cn(dark && "dark")}>
      <div className="bg-background text-foreground">
        <header className="sticky top-0 z-10 -mx-4 mb-6 border-b border-border-subtle bg-background/95 px-4 py-4 backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">
                Design system
              </h1>
              <p className="mt-0.5 text-xs text-muted-foreground">
                ของจริงที่เรนเดอร์จาก{" "}
                <code className="font-mono">styles/globals.css</code> +{" "}
                <code className="font-mono">components/ui/</code> · กฎอยู่ใน{" "}
                <code className="font-mono">docs/DESIGN.md</code>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" size="sm">
                {dark ? "dark" : "light"}
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDark((d) => !d)}
              >
                {dark ? <Sun /> : <Moon />}
                สลับธีม
              </Button>
            </div>
          </div>
        </header>

        <div className="flex gap-8">
          <nav className="sticky top-24 hidden h-fit w-56 shrink-0 lg:block">
            {NAV.map((g) => (
              <div key={g.group} className="mb-5">
                <p className="mb-1.5 text-micro-eyebrow font-semibold uppercase tracking-[0.04em] text-muted-foreground">
                  {g.group}
                </p>
                <ul className="space-y-0.5">
                  {g.items.map((it) => (
                    <li key={it.id}>
                      <a
                        href={`#${it.id}`}
                        className="block rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                      >
                        {it.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>

          <main className="min-w-0 flex-1 space-y-10 pb-16">
            <ColorsSection />
            <TypographySection />
            <FoundationsSection />
            <ButtonsSection />
            <BadgesSection />
            <FormsSection />
            <OverlaysSection />
            <FeedbackSection />
            <StatusPaletteSection />
            <ColorThemesSection />
          </main>
        </div>
      </div>
    </div>
  );
}
