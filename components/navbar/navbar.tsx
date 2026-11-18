import { Link } from "react-router";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { CarmenLogo } from "@/components/icons/carmen-logo";
import { useProfile } from "@/hooks/use-profile";
import { UserProfile } from "./user-profile";
import PathBreadcrumb from "./path-breadcrumb";
import BuSwitcher from "./bu-switcher";
import ModuleApp from "./module-app";
import Notification from "./notification";

/**
 * @param hasSidebar - false = หน้านี้ไม่มีเมนูซ้าย (shell ไม่วาด sidebar) ปุ่มพับ sidebar
 *   จึงไม่มีอะไรให้พับ — แทนด้วยโลโก้ที่พากลับหน้าแรก ซึ่งปกติอยู่บนหัว sidebar
 */
export function Navbar({
  hasSidebar = true,
}: {
  readonly hasSidebar?: boolean;
}) {
  // โหลดโปรไฟล์ไม่ผ่าน (500/503) — ทุกอย่างบนแถบนี้อ่านค่าจากโปรไฟล์: สลับกิจการ
  // ต้องมีรายการ BU, ตัวเปิดโมดูลต้องรู้สิทธิ์, แจ้งเตือนต้องมี userId, เบรดครัมบ์
  // ชี้ไปหน้าที่เข้าไม่ได้อยู่ดี ปล่อยไว้ก็เป็นปุ่มที่กดแล้วว่างเปล่า · ซ่อนหมด
  // เหลือเมนูโปรไฟล์ที่เดียว เพราะเป็นทางเดียวที่จะออกจากระบบไปล้าง session ได้
  const { isError } = useProfile();

  // ตัดสินจากความกว้างของแถบเอง (`@container/navbar`) ไม่ใช่จอ — แถบกว้างเท่าจอลบ
  // sidebar ที่พับ/กางได้ · บรรทัดเดียวทุกขนาด ทุกปุ่มอยู่บนแถบตลอด (ไม่ซ่อนหลัง ⋮)
  // ของรองค่อย ๆ โผล่เมื่อแถบกว้างขึ้น: แคบ = ชื่อหน้า + รหัส BU + ไอคอน ·
  // @lg (512) = crumb แม่ · @2xl (672) = ชื่อ BU เต็ม + ชื่อผู้ใช้ · @4xl (896) = crumb ทั้งหมด
  return (
    <header
      data-slot="navbar"
      className="bg-background space-navbar-gradient @container/navbar sticky top-0 z-50 flex h-[calc(3rem+env(safe-area-inset-top))] shrink-0 items-center border-b pt-[env(safe-area-inset-top)] transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12 sm:h-14"
    >
      <div className="flex w-full min-w-0 items-center gap-1 px-2 @lg/navbar:gap-1.5">
        {hasSidebar ? (
          <SidebarTrigger />
        ) : (
          <Link
            to="/"
            aria-label="Carmen Blue"
            className="focus-visible:ring-ring/50 flex size-8 shrink-0 items-center justify-center rounded-md outline-none focus-visible:ring-2"
          >
            <CarmenLogo size={24} />
          </Link>
        )}
        <div className="min-w-0 flex-1 overflow-hidden">
          {!isError && <PathBreadcrumb />}
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-0.5 @lg/navbar:gap-1">
          {!isError && (
            <>
              <BuSwitcher />
              <ModuleApp />
              <Notification />
            </>
          )}
          <UserProfile />
        </div>
      </div>
    </header>
  );
}
