import { Fragment, type ReactNode } from "react";
import { Link } from "react-router";
import { useLocation } from "react-router";
import { useTranslations } from "use-intl";
import { Lock } from "lucide-react";

import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { findAccountingSection, moduleList } from "@/constant/module-list";
import {
  useVisibleModules,
  type ModuleWithAccess,
} from "@/hooks/use-visible-modules";
import { dispatchPermissionDenied } from "@/components/permission-denied-dialog";
import { AppTile } from "@/components/icons/tiles";
import { cn } from "@/lib/utils";

const ACCENT = "var(--primary)";

/**
 * ตัวห่อของ node หนึ่งตัวในเมนู — `Link` เมื่อเข้าได้ ปุ่มที่เด้ง dialog เมื่อ
 * `locked`/`denied`
 *
 * **ต้องใช้ทั้งชั้นสองและชั้นสาม** — เดิมชั้นสาม (ลูกของ Accounts Payable/Receivable
 * และของ Workflow) render `<Link>` ตรง ๆ เสมอโดยไม่ดู flag เลย พอ leaf พวกนั้นถูกผูก
 * `licenseFeature` มันจึงเป็นรายการเดียวในเมนูที่ยังดูกดได้ทั้งที่ล็อก (RouteGuard
 * บล็อกให้อยู่แล้ว แต่เมนูบอกคนละเรื่องกับที่กดแล้วเจอ)
 *
 * เป็นฟังก์ชันคืน element ไม่ใช่คอมโพเนนต์ — `SidebarMenuButton asChild` ใช้ `Slot`
 * ที่ต้องได้ element จริงไปโคลน ถ้าห่อเป็นคอมโพเนนต์ props จะไปจบที่ตัวมันแทน DOM node
 */
function navAction(
  mod: ModuleWithAccess,
  label: string,
  content: ReactNode,
): ReactNode {
  if (!mod.locked && !mod.denied) return <Link to={mod.path}>{content}</Link>;
  return (
    <button
      type="button"
      onClick={() =>
        dispatchPermissionDenied(
          mod.permission,
          undefined,
          mod.locked ? "license" : "permission",
        )
      }
      title={label}
      className="opacity-50"
    >
      {/* กุญแจบอกว่าล็อกเพราะยังไม่ได้ซื้อ ไม่ใช่เพราะไม่มีสิทธิ์ —
          locked ชนะ denied เสมอ (บอกเหตุผลที่แก้ได้ด้วยเงินตรงกว่า) */}
      {mod.locked ? (
        <span className="flex items-center gap-2">
          {content}
          <Lock className="size-3 shrink-0 opacity-70" aria-hidden />
        </span>
      ) : (
        content
      )}
    </button>
  );
}

export function SideMain() {
  const pathname = useLocation().pathname;
  const t = useTranslations("modules");

  const activeModule = moduleList.find((mod) => pathname.startsWith(mod.path));
  const sidebarModule =
    activeModule?.name === "accounting"
      ? findAccountingSection(pathname)
      : activeModule;
  const visibleSubs = useVisibleModules(sidebarModule?.subModules ?? []);
  const activeSub = visibleSubs
    .filter(
      (sub) => pathname === sub.path || pathname.startsWith(sub.path + "/"),
    )
    .reduce<ModuleWithAccess | undefined>(
      (best, sub) =>
        !best || sub.path.length > best.path.length ? sub : best,
      undefined,
    );

  if (!sidebarModule) {
    return null;
  }

  return (
    <>
      {/* Module header — links to the module landing */}
      <Link
        to={sidebarModule.path}
        aria-label={t(sidebarModule.name)}
        // shrink-0: SidebarContent เป็น flex-col + overflow-auto — เมนูยาวเกินจอ
        // (เช่น Config) หัวโมดูลจะถูกบีบเหลือ ~12px แล้ว overflow-hidden ตัดไอคอน/ชื่อ
        className={cn(
          "relative mx-2 mt-2 mb-1 flex shrink-0 cursor-pointer items-center gap-2 overflow-hidden rounded-lg px-2 py-1.5",
          "focus-visible:ring-primary/40 transition-colors outline-none focus-visible:ring-2",
          "group-data-[collapsible=icon]:mx-0 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0",
        )}
        style={{
          backgroundImage: `linear-gradient(135deg, color-mix(in oklch, ${ACCENT} 10%, transparent) 0%, transparent 70%)`,
        }}
      >
        {/* Left accent bar (hidden in collapsed mode) */}
        <span
          aria-hidden="true"
          className="absolute inset-y-1 left-0 w-0.5 rounded-full group-data-[collapsible=icon]:hidden"
          style={{ backgroundColor: ACCENT }}
        />

        {/* Module icon — illustrated AppTile (module signature) */}
        <div className="shrink-0">
          <AppTile
            name={
              activeModule?.name === "accounting"
                ? "accounting"
                : sidebarModule.name
            }
            size={34}
          />
        </div>

        {/* Title (hidden when collapsed) */}
        <p
          className="min-w-0 flex-1 truncate text-sm leading-tight font-semibold group-data-[collapsible=icon]:hidden"
          style={{ color: ACCENT }}
        >
          {t(sidebarModule.name)}
        </p>
      </Link>

      {/* Sub-modules */}
      {visibleSubs.length > 0 && (
        <SidebarGroup className="pt-0 group-data-[collapsible=icon]:px-2">
          <SidebarMenu>
            {visibleSubs.map((sub) => {
              // อยู่หน้าของลูกตัวไหนอยู่ไหม — ลูกมี path ของตัวเองซึ่งซ้อนอยู่ใต้
              // path ของแม่ ตัวแม่จึง `startsWith` ตรงไปด้วยเสมอ ถ้าไม่หักออก
              // จะสว่างพร้อมกันสองอัน
              const activeChild = sub.subModules?.find(
                (c) => pathname === c.path || pathname.startsWith(c.path + "/"),
              );
              const isActive = activeSub === sub && !activeChild;
              // ไอคอน + ป้าย เหมือนกันทั้งสองสาขา ต่างแค่ตัวห่อ (Link หรือปุ่มที่กด
              // แล้วบอกว่าไม่มีสิทธิ์) — แยกไว้จะได้ไม่ต้องแก้สองที่ทุกครั้ง
              const content = (
                <>
                  <sub.icon
                    aria-hidden="true"
                    className={cn(
                      "shrink-0",
                      isActive ? "text-primary" : "text-muted-foreground",
                    )}
                  />
                  <span
                    className={cn(
                      "text-xs group-data-[collapsible=icon]:hidden",
                      isActive && "text-primary",
                    )}
                  >
                    {t(sub.name)}
                  </span>
                </>
              );
              return (
                <Fragment key={sub.path}>
                  {sub.separatorBefore && (
                    <div
                      role="presentation"
                      className="bg-border mx-2 my-1.5 h-px group-data-[collapsible=icon]:hidden"
                    />
                  )}
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      tooltip={t(sub.name)}
                      isActive={isActive}
                      className={cn(
                        // rounded-md ไม่ใช่ lg — เมนูคือ control ตาม grammar ของ
                        // docs/DESIGN.md (md = control · lg/xl = container)
                        "group/sub relative overflow-hidden rounded-md transition-all",
                        // active = แถบซ้ายนี้ + พื้นกับน้ำหนักจาก
                        // sidebarMenuButtonVariants + ไอคอนและตัวหนังสือเป็น
                        // `text-primary` (ดูที่ `content`) รวมเป็นสีน้ำเงินสามที่บน
                        // ปุ่มเดียว ซึ่งแรงกว่ากติกา single-accent ใน docs/DESIGN.md
                        // เคยลองตัดเหลือแค่แถบแล้ว แต่ทีมเลือกแบบนี้ — ตั้งใจ ไม่ใช่หลุด
                        "before:bg-primary before:absolute before:inset-y-1.5 before:left-0 before:w-0.5 before:rounded-full before:opacity-0 before:transition-opacity before:content-[''] group-data-[collapsible=icon]:before:hidden data-[active=true]:before:opacity-100",
                        "group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0",
                      )}
                    >
                      {navAction(sub, t(sub.name), content)}
                    </SidebarMenuButton>
                  </SidebarMenuItem>

                  {/* เมนูย่อยอีกชั้น — เยื้องเข้าไปและซ่อนตอนย่อ sidebar เป็นไอคอน
                      (ไอคอนเรียงกันสามตัวที่ชี้หน้าเดียวกันแยกไม่ออกอยู่ดี) */}
                  {sub.subModules?.map((child) => {
                    const childActive =
                      pathname === child.path ||
                      pathname.startsWith(child.path + "/");
                    return (
                      <SidebarMenuItem
                        key={child.path}
                        className="group-data-[collapsible=icon]:hidden"
                      >
                        <SidebarMenuButton
                          asChild
                          size="sm"
                          isActive={childActive}
                          className="ms-4 w-auto rounded-md"
                        >
                          {navAction(
                            child,
                            t(child.name),
                            <>
                              <child.icon
                                aria-hidden="true"
                                className={cn(
                                  "shrink-0",
                                  childActive
                                    ? "text-primary"
                                    : "text-muted-foreground",
                                )}
                              />
                              <span
                                className={cn(
                                  "text-xs",
                                  childActive && "text-primary",
                                )}
                              >
                                {t(child.name)}
                              </span>
                            </>,
                          )}
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </Fragment>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>
      )}
    </>
  );
}
