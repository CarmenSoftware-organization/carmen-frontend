import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { COLOR_THEMES, type ColorTheme } from "@/lib/color-theme";
import { DsSection } from "../ds-kit";

const LABEL: Record<ColorTheme, string> = {
  classic: "Classic",
  "blue-glass": "Blue Glass",
  emerald: "Emerald",
  teal: "Teal",
  violet: "Violet",
  graphite: "Graphite",
  skylearn: "Skylearn",
  "octo-code": "Octo Code",
};

/**
 * การ์ดหนึ่งใบต่อธีม ห่อด้วย class `theme-<id>` ให้ token cascade เฉพาะในใบ
 * (selector `.theme-x` เปล่าใน styles/color-themes.css มีไว้เพื่อหน้านี้)
 *
 * กระจกของ Blue Glass ไม่ได้จำลองในใบ เพราะมันผูกกับ body + โครงหน้าจอ
 * ดูของจริงได้จากเมนูโปรไฟล์ → ธีมสี
 */
function ThemeCard({ theme }: Readonly<{ theme: ColorTheme }>) {
  return (
    <div className={theme === "classic" ? undefined : `theme-${theme}`}>
      <div className="bg-background text-foreground flex flex-col gap-3 rounded-lg border p-4">
        <div className="flex items-center gap-2">
          <span className="bg-primary size-3 rounded-full" />
          <span className="font-semibold">{LABEL[theme]}</span>
          <code className="text-muted-foreground ml-auto">
            {theme === "classic" ? "(no class)" : `theme-${theme}`}
          </code>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm">Primary</Button>
          <Button size="sm" variant="outline">
            Outline
          </Button>
        </div>
        <Input
          placeholder="Focus ring"
          className="ring-ring/50 ring-[3px]"
          aria-label={`${LABEL[theme]} focus ring`}
        />
        <div className="bg-sidebar flex flex-col gap-1 rounded-md p-1.5">
          <span className="bg-sidebar-accent text-sidebar-accent-foreground rounded-md px-2 py-1.5 font-semibold">
            Sidebar — active
          </span>
          <span className="text-sidebar-foreground px-2 py-1.5">
            Sidebar — item
          </span>
        </div>
      </div>
    </div>
  );
}

export function ColorThemesSection() {
  return (
    <DsSection
      id="color-themes"
      title="Color themes"
      description={
        <>
          ธีมสีที่ผู้ใช้เลือกจากเมนูโปรไฟล์ — แยกแกนจาก light/dark ค่าอยู่ใน{" "}
          <code>styles/color-themes.css</code> รายชื่ออยู่ใน{" "}
          <code>lib/color-theme.ts</code> (และซ้ำใน inline script ของ{" "}
          <code>index.html</code>)
        </>
      }
      usage={
        <>
          <b>ธีมเปลี่ยนเฉพาะสีหลัก</b> (<code>--primary</code>{" "}
          <code>--ring</code> <code>--sidebar-primary</code>{" "}
          <code>--chart-1</code> และ chart-2/3 ตัวที่ชนกับสีธีม) ห้ามแตะสีสถานะ · Blue Glass มีกระจกเฉพาะ
          sidebar/navbar — card ตาราง ฟอร์ม dialog ทึบเสมอ · เพิ่มธีมต้องแก้{" "}
          <code>index.html</code> แล้วอัปเดต CSP hash ทั้ง 4 ไฟล์
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {COLOR_THEMES.map((theme) => (
          <ThemeCard key={theme} theme={theme} />
        ))}
      </div>
    </DsSection>
  );
}
