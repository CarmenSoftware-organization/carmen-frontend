import { Link } from "react-router";
import { ArrowRight, Lock } from "lucide-react";
import { dispatchPermissionDenied } from "@/components/permission-denied-dialog";
import type { ModuleWithAccess } from "@/hooks/use-visible-modules";
import { cn } from "@/lib/utils";
import { type ModuleDef, type TFn } from "./landing-types";
import { ModuleVisual } from "./landing-visuals";

const CARD =
  "bg-card border-border group focus-visible:ring-ring flex flex-col overflow-hidden rounded-xl border text-left shadow-sm outline-none transition-colors focus-visible:ring-2";

/**
 * การ์ดของเครื่องมือหนึ่งตัว — กดได้ทั้งใบ
 *
 * เดิมมีแถบท้ายการ์ด (ตัวเลขสถิติ + ปุ่ม Open) ตัวเลขเป็นข้อความตายตัวจากไฟล์แปลที่ดูเหมือนข้อมูล
 * จริง ("14 roles · 87 permissions") จึงตัดออก — จะใส่ตัวเลขกลับต้องดึงจาก API เท่านั้น เหลือปุ่ม
 * Open ตัวเดียวก็ไม่คุ้มที่ทั้งแถบ การ์ดทั้งใบจึงเป็นลิงก์แทน (แบบเดียวกับ landing ของ Workflow)
 * คำอธิบายใช้ข้อความเดียวกับคำอธิบายบนหัวของหน้านั้นเอง ไม่ใช่ข้อความโฆษณาที่เขียนแยก
 *
 * @param access - สถานะสิทธิ์จาก `useVisibleModules` (ตัวเดียวกับเมนูซ้าย) · `locked`/`denied`
 *   → การ์ดจางเป็นปุ่มที่เด้ง dialog บอกเหตุผล locked ชนะ denied เหมือนเมนู · undefined =
 *   หน้านี้ไม่อยู่ในเมนู ถือว่าเข้าได้
 */
export function LandingModuleCard({
  mod,
  access,
  t,
}: {
  readonly mod: ModuleDef;
  readonly access?: ModuleWithAccess;
  readonly t: TFn;
}) {
  const Icon = mod.icon;
  const blocked = Boolean(access && (access.locked || access.denied));

  const body = (
    <>
      {/* chrome ของการ์ดเป็นกลาง — การ์ดแยกกันด้วยไอคอน ชื่อ และตัวภาพ ไม่ใช่สี
          (accent เหลือแค่ในภาพจำลอง ดู ACCENT ใน landing-visuals) */}
      <div className="bg-muted/40 border-border-subtle relative h-28 overflow-hidden border-b">
        <ModuleVisual visualKey={mod.visualKey} />
        <div className="bg-card border-border absolute top-2 left-2 flex size-7 items-center justify-center rounded-md border">
          <Icon aria-hidden className="text-muted-foreground size-3.5" />
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-0.5 p-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-foreground min-w-0 text-sm leading-tight font-semibold tracking-tight">
            {t(`modules.${mod.key}.name`)}
          </h3>
          {access?.locked ? (
            <Lock
              aria-hidden
              className="text-muted-foreground size-3.5 shrink-0"
            />
          ) : (
            <ArrowRight
              aria-hidden
              className={cn(
                "text-muted-foreground size-3.5 shrink-0 transition-colors",
                !blocked && "group-hover:text-primary",
              )}
            />
          )}
        </div>
        <p className="text-muted-foreground text-xs leading-snug">
          {t(`modules.${mod.key}.one`)}
        </p>
      </div>
    </>
  );

  if (blocked && access) {
    return (
      <button
        type="button"
        className={cn(CARD, "opacity-50")}
        onClick={() =>
          dispatchPermissionDenied(
            access.permission,
            undefined,
            access.locked ? "license" : "permission",
          )
        }
      >
        {body}
      </button>
    );
  }

  return (
    <Link to={mod.href} className={cn(CARD, "hover:border-primary")}>
      {body}
    </Link>
  );
}
