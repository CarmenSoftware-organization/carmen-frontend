import { Link } from "react-router";
import { Lock } from "lucide-react";
import { useTranslations } from "use-intl";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  useVisibleModules,
  type ModuleWithAccess,
} from "@/hooks/use-visible-modules";
import { dispatchPermissionDenied } from "@/components/permission-denied-dialog";
import { cn } from "@/lib/utils";
import { AppTile, SubTile } from "@/components/icons/tiles";
import { AppLauncherIcon } from "@/components/icons/app-launcher-icon";

export default function ModuleApp() {
  const t = useTranslations("modules");
  const tn = useTranslations("navbar");
  const [open, setOpen] = useState(false);

  const visibleModules = useVisibleModules();
  const launcherModules = visibleModules.flatMap(
    (
      mod,
    ): Array<{
      module: ModuleWithAccess;
      tileParentName?: string;
    }> =>
      mod.name === "accounting"
        ? (mod.subModules ?? []).map((section) => ({
            module: section,
            tileParentName: "accounting",
          }))
        : [{ module: mod }],
  );

  // Modifier symbol for the shortcut hint (⌘ on macOS, Ctrl elsewhere).
  // Computed at render — the tooltip is client-only so the SSR fallback never shows.
  const isMac =
    typeof navigator !== "undefined" &&
    /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent);
  const modKey = isMac ? "⌘" : "Ctrl";

  // Global ⌘K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" aria-label={tn("modules")}>
          <AppLauncherIcon className="size-4" />
          <span className="sr-only">{tn("modules")}</span>
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={8}
        collisionPadding={8}
        // กว้างไม่เกินจอ (เหลือขอบ 8px) — เดิม w-80 ล้นจอ 280 จนคอลัมน์ที่ 3 ถูกตัด
        // สูงไม่เกินที่เหลือใต้ปุ่ม: 14 แอปเป็น 5 แถว ~520px ล้นจอเตี้ย ให้ grid เลื่อนเอง
        className="border-border/70 bg-popover @container flex max-h-(--radix-popover-content-available-height) w-[min(20rem,calc(100vw-1rem))] flex-col overflow-hidden rounded-2xl border p-0 shadow-lg"
      >
        {/* Tile grid — 3 cols, no header */}
        <div className="grid min-h-0 grid-cols-3 gap-0 overflow-y-auto overscroll-contain px-1 pt-2 pb-3 @[18rem]:px-1.5">
          {launcherModules.map(({ module: mod, tileParentName }) => (
            <LauncherTile
              key={mod.path}
              name={mod.name}
              tileParentName={tileParentName}
              path={mod.path}
              label={t(mod.name)}
              denied={mod.denied}
              locked={mod.locked}
              permission={mod.permission}
              onNavigate={() => setOpen(false)}
            />
          ))}
        </div>

        {/* Shortcut hint — มีความหมายเฉพาะเครื่องที่มีคีย์บอร์ด/เมาส์ จอสัมผัสซ่อน */}
        <div className="border-border/60 text-muted-foreground text-micro hidden shrink-0 items-center justify-center gap-1.5 border-t py-2 pointer-fine:flex">
          <span>{tn("shortcutOpen")}</span>
          <span className="flex items-center gap-1">
            <HintKey>{modKey}</HintKey>
            <HintKey>K</HintKey>
          </span>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function HintKey({ children }: { readonly children: React.ReactNode }) {
  return (
    <kbd className="bg-muted text-micro-legal inline-flex h-4 min-w-4 items-center justify-center rounded border px-1.5 font-semibold">
      {children}
    </kbd>
  );
}

interface LauncherTileProps {
  readonly name: string;
  /** Render a submodule illustration while retaining the launcher tile shell. */
  readonly tileParentName?: string;
  readonly path: string;
  readonly label: string;
  readonly denied: boolean;
  readonly locked: boolean;
  readonly permission?: import("@/constant/permissions").Permission;
  readonly onNavigate: () => void;
}

const LauncherTile = ({
  name,
  tileParentName,
  path,
  label,
  denied,
  locked,
  permission,
  onNavigate,
}: LauncherTileProps) => {
  const tileClass = cn(
    "group/tile flex min-h-22.5 flex-col items-center justify-start gap-2 rounded-xl px-0.5 pt-3 pb-2 @[18rem]:px-1",
    "hover:bg-muted/60 focus-visible:bg-muted/60 transition-colors",
    "focus-visible:ring-primary/40 focus-visible:ring-2 focus-visible:outline-none",
    (denied || locked) && "opacity-50",
  );

  const content = (
    <>
      <span className="relative transition-transform group-hover/tile:scale-105">
        {tileParentName ? (
          <SubTile name={name} parentName={tileParentName} size={44} />
        ) : (
          <AppTile name={name} size={44} />
        )}
        {/* กุญแจบอกว่าล็อกเพราะยังไม่ได้ซื้อ ไม่ใช่เพราะไม่มีสิทธิ์ — locked ชนะ
            denied เสมอ (บอกเหตุผลที่แก้ได้ด้วยเงินตรงกว่า) */}
        {locked && (
          <Lock
            className="bg-background text-muted-foreground absolute -right-1 -bottom-1 size-3.5 rounded-full p-0.5 opacity-90"
            aria-hidden="true"
          />
        )}
      </span>
      {/* แผงแคบกว่า 18rem (จอ 280) คอลัมน์เหลือ ~84px — 12px ทำ "Administration"
          ขาดกลางคำ จึงลดเป็น 11px ตัวชิด และลด padding ของช่อง จนกว่าแผงจะกว้างพอ */}
      <span className="text-foreground/80 text-micro max-w-full text-center leading-tight font-semibold tracking-tight wrap-break-word @[18rem]:text-xs @[18rem]:tracking-normal">
        {label}
      </span>
    </>
  );

  // locked หรือ denied → button (no anchor → NextTopLoader's anchor click
  // listener doesn't trigger) ต่างกันแค่ reason ที่ dispatch
  if (denied || locked) {
    return (
      <button
        type="button"
        onClick={() =>
          dispatchPermissionDenied(
            permission,
            undefined,
            locked ? "license" : "permission",
          )
        }
        aria-disabled
        className={tileClass}
      >
        {content}
      </button>
    );
  }

  return (
    <Link to={path} onClick={onNavigate} className={tileClass}>
      {content}
    </Link>
  );
};
