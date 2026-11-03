import { Outlet } from "react-router";
import { AnalyticsBridge } from "@/components/analytics-bridge";
import { AppStatusBanner } from "@/components/app-status-banner";
import { AppStatusScreen } from "@/components/app-status-screen";
import { BuCurrencyBanner } from "@/components/bu-currency-banner";
import { CommandPalette } from "@/components/command-palette";
import { StatusBar } from "@/components/footer/status-bar";
import { KeyboardShortcutsDialog } from "@/components/keyboard-shortcuts-dialog";
import { LicenseExpiredBanner } from "@/components/license-expired-banner";
import { MissingDepartmentDialog } from "@/components/missing-department-dialog";
import { Navbar } from "@/components/navbar/navbar";
import { RouteGuard } from "@/components/route-guard";
import { SeatQuotaBannerHost } from "@/components/seat-quota-banner";
import { StorageQuotaBannerHost } from "@/components/storage-quota-banner";
import { ActivitySheetHost } from "@/components/share/activity-sheet-host";
import { OfflineBanner } from "@/components/share/offline-banner";
import { ProfileGate } from "@/components/share/profile-gate";
import { AppSidebar } from "@/components/sidebar/app-sidebar";
import { SidebarShell } from "@/components/sidebar/sidebar-shell";
import { SidebarInset } from "@/components/ui/sidebar";
import { useAppStatus } from "@/hooks/use-app-status";
import { useBuSwitchSync } from "@/hooks/use-switch-bu";
import { isAppBlocked } from "@/lib/app-status-store";

export default function RootLayout() {
  // สลับ BU จาก tab อื่น → ล้าง cache ที่นี่ที่เดียว
  useBuSwitchSync();
  // ตัว poll สถานะแอปตัวเดียวของทั้งแอป — ต้องอยู่ก่อน early return (rules of hooks)
  const appStatus = useAppStatus();

  // ปิดปรับปรุง (ไม่ได้รับยกเว้น) / ปิดใช้งาน → แทนทั้ง shell ไม่ mount หน้าไหนเลย
  if (isAppBlocked(appStatus.snapshot)) {
    return (
      <AppStatusScreen
        snapshot={appStatus.snapshot}
        onRetry={appStatus.recheck}
        isChecking={appStatus.isChecking}
      />
    );
  }

  return (
    <SidebarShell>
      <AnalyticsBridge />
      <AppSidebar />
      <SidebarInset className="space-main-gradient relative h-dvh overflow-hidden">
        <Navbar />
        <OfflineBanner />
        {/* อ่านอย่างเดียว / ผู้ได้รับยกเว้น — ดู components/app-status-banner.tsx */}
        <AppStatusBanner snapshot={appStatus.snapshot} />
        {/* mount ครั้งเดียวที่นี่เหมือน ActivitySheetHost — อ่าน useLicense() เอง
            ไม่ต้อง render ซ้ำในหน้าไหน */}
        <LicenseExpiredBanner />
        {/* แดงเห็นทุกคน (ไม่ใช่แค่แอดมิน) เพราะคนที่บันทึกไม่ได้ต้องรู้ว่าทำไม — ดู
            SeatQuotaBannerHost ใน components/seat-quota-banner.tsx */}
        <SeatQuotaBannerHost />
        {/* พื้นที่เก็บข้อมูลเต็ม: แดงทุกคน / เหลืองเฉพาะ system_admin.view — ดู storage-quota-banner.tsx */}
        <StorageQuotaBannerHost />
        {/* ขึ้นทุกคนเมื่อ BU ไม่มี default currency ที่ใช้ได้ (ยอดเงิน fallback เป็น THB) */}
        <BuCurrencyBanner />
        <div
          id="main-content"
          className="m-3 flex min-h-0 flex-1 flex-col gap-4 overflow-auto px-4"
        >
          <ProfileGate>
            <RouteGuard>
              <Outlet />
            </RouteGuard>
          </ProfileGate>
        </div>
        <StatusBar />
      </SidebarInset>
      <KeyboardShortcutsDialog />
      <CommandPalette />
      <MissingDepartmentDialog />
      <ActivitySheetHost />
    </SidebarShell>
  );
}
