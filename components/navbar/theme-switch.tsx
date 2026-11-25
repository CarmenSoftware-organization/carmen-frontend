import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { useTranslations } from "use-intl";
import { Check, Monitor, Moon, Sun } from "lucide-react";
import {
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

// useSyncExternalStore avoids hydration mismatch — theme is undefined on SSR
const subscribe = () => () => {};
const getSnapshot = () => true;
const getServerSnapshot = () => false;

type ThemeMode = "light" | "dark" | "system";
const THEME_MODES: readonly ThemeMode[] = ["light", "dark", "system"];

function asThemeMode(value: string | undefined): ThemeMode {
  if (value === "dark" || value === "system") return value;
  return "light";
}

function ThemeIcon({ mode }: { readonly mode: ThemeMode }) {
  if (mode === "dark") return <Moon className="size-4" />;
  if (mode === "system") return <Monitor className="size-4" />;
  return <Sun className="size-4" />;
}

type PreviewPalette = {
  readonly bg: string;
  readonly header: string;
  readonly line: string;
  readonly accent: string;
};

const LIGHT: PreviewPalette = {
  bg: "#ffffff",
  header: "#e4e4e7",
  line: "#a1a1aa",
  accent: "#3b82f6",
};

const DARK: PreviewPalette = {
  bg: "#18181b",
  header: "#3f3f46",
  line: "#52525b",
  accent: "#60a5fa",
};

function FullPreviewContent({ palette }: { readonly palette: PreviewPalette }) {
  return (
    <>
      <rect
        x="2"
        y="2"
        width="16"
        height="2.5"
        rx="0.5"
        fill={palette.header}
      />
      <rect
        x="2"
        y="6.5"
        width="10"
        height="1.2"
        rx="0.3"
        fill={palette.line}
      />
      <rect
        x="2"
        y="9.5"
        width="14"
        height="1.2"
        rx="0.3"
        fill={palette.line}
      />
      <rect
        x="2"
        y="12.5"
        width="8"
        height="1.2"
        rx="0.3"
        fill={palette.line}
      />
      <rect
        x="2"
        y="15.5"
        width="6"
        height="2.5"
        rx="0.5"
        fill={palette.accent}
      />
    </>
  );
}

function HalfPreviewContent({
  palette,
  offset,
}: {
  readonly palette: PreviewPalette;
  readonly offset: number;
}) {
  const x = offset + 1.5;
  return (
    <>
      <rect x={x} y="2" width="7" height="2.5" rx="0.5" fill={palette.header} />
      <rect x={x} y="6.5" width="5" height="1.2" rx="0.3" fill={palette.line} />
      <rect x={x} y="9.5" width="6" height="1.2" rx="0.3" fill={palette.line} />
      <rect
        x={x}
        y="12.5"
        width="4"
        height="1.2"
        rx="0.3"
        fill={palette.line}
      />
      <rect
        x={x}
        y="15.5"
        width="4"
        height="2.5"
        rx="0.5"
        fill={palette.accent}
      />
    </>
  );
}

function ThemePreview({
  mode,
  active = false,
}: {
  readonly mode: ThemeMode;
  readonly active?: boolean;
}) {
  const wrapper = cn(
    "size-8 shrink-0 overflow-hidden rounded-md border transition-colors",
    active ? "border-primary ring-primary/30 ring-1" : "border-border/70",
  );

  if (mode === "light") {
    return (
      <svg viewBox="0 0 20 20" className={wrapper} aria-hidden="true">
        <rect width="20" height="20" fill={LIGHT.bg} />
        <FullPreviewContent palette={LIGHT} />
      </svg>
    );
  }

  if (mode === "dark") {
    return (
      <svg viewBox="0 0 20 20" className={wrapper} aria-hidden="true">
        <rect width="20" height="20" fill={DARK.bg} />
        <FullPreviewContent palette={DARK} />
      </svg>
    );
  }

  // system — vertical split (left=light, right=dark)
  return (
    <svg viewBox="0 0 20 20" className={wrapper} aria-hidden="true">
      <rect x="0" y="0" width="10" height="20" fill={LIGHT.bg} />
      <HalfPreviewContent palette={LIGHT} offset={0} />
      <rect x="10" y="0" width="10" height="20" fill={DARK.bg} />
      <HalfPreviewContent palette={DARK} offset={10} />
      <line x1="10" y1="0" x2="10" y2="20" stroke="#9ca3af" strokeWidth="0.4" />
    </svg>
  );
}

/**
 * Theme switcher submenu — ฝังใน DropdownMenu อื่น
 *
 * Track `theme` (user selection) ไม่ใช่ `resolvedTheme` — preview แสดงตามที่
 * ผู้ใช้เลือก ไม่ใช่ตามที่ resolve จริง (เผื่อเลือก system แต่ OS เป็น dark)
 */
export function ThemeSwitch() {
  const t = useTranslations("common");
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );
  const current = mounted ? asThemeMode(theme) : "light";
  const label: Record<ThemeMode, string> = {
    light: t("themeLight"),
    dark: t("themeDark"),
    system: t("themeSystem"),
  };

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger className="cursor-pointer gap-2 rounded-md px-2 py-2 text-xs">
        <ThemeIcon mode={current} />
        {t("theme")}
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="min-w-48 p-1.5">
        {THEME_MODES.map((mode) => {
          const isActive = current === mode;
          return (
            <DropdownMenuItem
              key={mode}
              onClick={() => setTheme(mode)}
              className="cursor-pointer gap-2 rounded-md px-2 py-2 text-xs"
              // menuitem ไม่รองรับ aria-checked — ตัวเลือกแบบเลือกได้หนึ่งเดียวต้องเป็น menuitemradio
              role="menuitemradio"
              aria-checked={isActive}
            >
              <ThemePreview mode={mode} active={isActive} />
              <span className="flex-1">{label[mode]}</span>
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
