import { MoreVertical } from "lucide-react";
import { Link } from "react-router";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
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
export function Navbar({ hasSidebar = true }: { readonly hasSidebar?: boolean }) {
  // โหลดโปรไฟล์ไม่ผ่าน (500/503) — ทุกอย่างบนแถบนี้อ่านค่าจากโปรไฟล์: สลับกิจการ
  // ต้องมีรายการ BU, ตัวเปิดโมดูลต้องรู้สิทธิ์, แจ้งเตือนต้องมี userId, เบรดครัมบ์
  // ชี้ไปหน้าที่เข้าไม่ได้อยู่ดี ปล่อยไว้ก็เป็นปุ่มที่กดแล้วว่างเปล่า · ซ่อนหมด
  // เหลือเมนูโปรไฟล์ที่เดียว เพราะเป็นทางเดียวที่จะออกจากระบบไปล้าง session ได้
  const { isError } = useProfile();

  return (
    <header
      data-slot="navbar"
      className="bg-background space-navbar-gradient sticky top-0 z-50 flex h-16 shrink-0 items-center gap-1.5 border-b pt-[env(safe-area-inset-top)] transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12 sm:h-14"
    >
      <div className="flex w-full items-center gap-1.5 px-2">
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
        <div className="min-w-0 flex-1 truncate">
          {!isError && <PathBreadcrumb />}
        </div>
        <div className="ml-auto flex items-center gap-1">
          {!isError && (
            <>
              <div className="hidden items-center gap-1 sm:flex">
                <BuSwitcher />
                <ModuleApp />
              </div>

              <div className="flex items-center sm:hidden">
                <Sheet>
                  <SheetTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-foreground h-8 w-8"
                    >
                      <MoreVertical className="h-4 w-4" />
                      <span className="sr-only">Open menu</span>
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="top" className="rounded-b-2xl p-4 pt-12">
                    <SheetHeader>
                      <SheetTitle className="sr-only">Mobile Menu</SheetTitle>
                    </SheetHeader>
                    <div className="flex flex-col gap-4">
                      <div className="flex items-center justify-between px-2">
                        <span className="text-muted-foreground text-sm font-medium">
                          Business Unit
                        </span>
                        <BuSwitcher />
                      </div>
                      <div className="flex items-center justify-between px-2">
                        <span className="text-muted-foreground text-sm font-medium">
                          Applications
                        </span>
                        <ModuleApp />
                      </div>
                    </div>
                  </SheetContent>
                </Sheet>
              </div>

              <Notification />
            </>
          )}
          <UserProfile />
        </div>
      </div>
    </header>
  );
}
