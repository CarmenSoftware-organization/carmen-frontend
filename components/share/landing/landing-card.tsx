import type { ComponentType, ReactNode, SVGProps } from "react";
import { Link } from "react-router";
import { ArrowRight, Lock } from "lucide-react";
import { dispatchPermissionDenied } from "@/components/permission-denied-dialog";
import type { ModuleWithAccess } from "@/hooks/use-visible-modules";
import { cn } from "@/lib/utils";

export type LucideIcon = ComponentType<
  SVGProps<SVGSVGElement> & { size?: number | string }
>;

const CARD =
  "bg-card border-border group focus-visible:ring-ring flex flex-col overflow-hidden rounded-xl border text-left shadow-sm outline-none transition-colors focus-visible:ring-2";

/**
 * การ์ดของหน้าหนึ่งหน้าบน landing ของโมดูล — กดได้ทั้งใบ (skill `carmen-blue-ui-design`
 * §Landing pages): ชื่อ = ชื่อเมนูซ้าย · คำอธิบาย = คำอธิบายบนหัวของหน้านั้นเอง ·
 * `stat` ต้องมาจาก API เท่านั้น (ส่ง `null` ระหว่างโหลด/error ไม่ใช่ 0)
 *
 * @param access - สถานะสิทธิ์จาก `useVisibleModules` (ตัวเดียวกับเมนูซ้าย) · `locked`/`denied`
 *   → การ์ดจางเป็นปุ่มที่เด้ง dialog บอกเหตุผล locked ชนะ denied เหมือนเมนู · undefined =
 *   หน้านี้ไม่อยู่ในเมนู ถือว่าเข้าได้
 */
export function LandingCard({
  href,
  title,
  description,
  icon: Icon,
  visual,
  stat,
  access,
}: {
  readonly href: string;
  readonly title: string;
  readonly description: string;
  readonly icon: LucideIcon;
  readonly visual: ReactNode;
  readonly stat?: ReactNode;
  readonly access?: ModuleWithAccess;
}) {
  const blocked = Boolean(access && (access.locked || access.denied));

  const body = (
    <>
      {/* chrome ของการ์ดเป็นกลาง — การ์ดแยกกันด้วยไอคอน ชื่อ และตัวภาพ ไม่ใช่สี */}
      <div className="bg-muted/40 border-border-subtle relative h-28 overflow-hidden border-b">
        {visual}
        <div className="bg-card border-border absolute top-2 left-2 flex size-7 items-center justify-center rounded-md border">
          <Icon aria-hidden className="text-muted-foreground size-3.5" />
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-0.5 p-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-foreground min-w-0 text-sm leading-tight font-semibold tracking-tight">
            {title}
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
          {description}
        </p>
        {stat != null && (
          <p className="text-foreground mt-1 text-xs font-medium tabular-nums">
            {stat}
          </p>
        )}
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
    <Link to={href} className={cn(CARD, "hover:border-primary")}>
      {body}
    </Link>
  );
}
