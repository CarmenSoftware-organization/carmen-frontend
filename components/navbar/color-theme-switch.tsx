import { useState } from "react";
import { useTranslations } from "use-intl";
import { Check, Palette } from "lucide-react";
import {
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import {
  COLOR_THEMES,
  applyColorTheme,
  readActiveColorTheme,
  type ColorTheme,
} from "@/lib/color-theme";
import { cn } from "@/lib/utils";

const LABEL_KEY = {
  classic: "colorThemeClassic",
  "blue-glass": "colorThemeBlueGlass",
  emerald: "colorThemeEmerald",
  teal: "colorThemeTeal",
  violet: "colorThemeViolet",
  graphite: "colorThemeGraphite",
  skylearn: "colorThemeSkylearn",
  "octo-code": "colorThemeOctoCode",
  createspace: "colorThemeCreateSpace",
} as const satisfies Record<ColorTheme, string>;

/**
 * สีของจุดตัวอย่าง = --primary โหมดสว่างของแต่ละธีม (styles/color-themes.css)
 *
 * ต้องเป็นค่าคงที่ อ่านจาก token ไม่ได้ เพราะ token ของธีมที่ยังไม่ได้เลือกไม่ได้อยู่บน
 * <html> — pattern เดียวกับ LIGHT/DARK ใน theme-switch.tsx
 */
const SWATCH: Record<ColorTheme, string> = {
  classic: "oklch(0.4714 0.1794 258.7)",
  "blue-glass":
    "linear-gradient(135deg, oklch(0.4714 0.1794 258.7), oklch(0.7064 0.118 236.33))",
  emerald: "oklch(0.5 0.12 162)",
  teal: "oklch(0.5 0.09 200)",
  violet: "oklch(0.5 0.2 295)",
  graphite: "oklch(0.38 0.02 260)",
  skylearn:
    "linear-gradient(135deg, oklch(0.623 0.188 259.8), oklch(0.837 0.164 84.4))",
  "octo-code":
    "linear-gradient(135deg, oklch(0.176 0.014 258.4) 50%, oklch(0.618 0.193 258.3) 50%)",
  createspace:
    "linear-gradient(135deg, oklch(0.586 0.222 17.6), oklch(0.546 0.215 262.9) 60%, oklch(0.861 0.173 91.9))",
};

/**
 * Color theme submenu — ฝังใน DropdownMenu อื่น แยกแกนจาก ThemeSwitch (light/dark)
 *
 * ถือ state เอง ไม่มี provider เหมือน FontScaleSwitch: ค่าจริงอยู่บน <html> และ
 * mount ครั้งหน้าอ่าน class บน <html> ใหม่ จึงตรงกับ tab นี้เสมอแม้อีก tab เปลี่ยน
 * localStorage ไปแล้ว
 */
export function ColorThemeSwitch() {
  const t = useTranslations("common");
  const [current, setCurrent] = useState<ColorTheme>(readActiveColorTheme);

  const select = (next: ColorTheme) => {
    applyColorTheme(next);
    setCurrent(next);
  };

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger className="cursor-pointer gap-2 rounded-md px-2 py-2 text-xs">
        <Palette className="size-4" />
        {t("colorTheme")}
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="min-w-48 p-1.5">
        {COLOR_THEMES.map((theme) => {
          const isActive = current === theme;
          return (
            <DropdownMenuItem
              key={theme}
              onClick={() => select(theme)}
              className="cursor-pointer gap-2 rounded-md px-2 py-2 text-xs"
              role="menuitemradio"
              aria-checked={isActive}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "size-4 shrink-0 rounded-full border",
                  isActive
                    ? "border-primary ring-primary/30 ring-1"
                    : "border-border/70",
                )}
                style={{ background: SWATCH[theme] }}
              />
              <span className="flex-1">{t(LABEL_KEY[theme])}</span>
              {isActive && (
                <Check className="text-primary size-4" aria-hidden="true" />
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}
