import { ArrowLeft, SearchX } from "lucide-react";
import { useTranslations } from "use-intl";
import { Link, useLocation, useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { findActiveModule } from "@/constant/module-list";
import { useLandingPath } from "@/hooks/use-landing-path";
import { useVisibleModules } from "@/hooks/use-visible-modules";

/**
 * หน้า "ไม่พบหน้านี้" — render ใน shell (sidebar + navbar ยังอยู่) เป็น catch-all ของ `ProtectedShell`
 *
 * เดิมเป็นหน้าเต็มจอนอก shell: คนที่เปิด bookmark เก่าหรือพิมพ์ URL ผิดหลุดออกจากแอปทั้งตัว เหลือ
 * ทางออกเดียวคือกลับแดชบอร์ด ทั้งที่เขายังล็อกอินอยู่และเมนูของโมดูลนั้นคือสิ่งที่ช่วยหาหน้าที่ถูกได้
 * เร็วที่สุด จึงเก็บ shell ไว้ โชว์ที่อยู่ที่เปิดมา (เห็นตัวสะกดผิดได้ทันที) แล้วพากลับหน้าแรกของ
 * โมดูลเดียวกัน — ไม่ทำรายการลิงก์ซ้ำกับ sidebar
 *
 * ต้องอยู่ใต้ `ProfileGate` (ใช้ `useLandingPath` / `useVisibleModules`)
 */
export function NotFoundComponent() {
  const t = useTranslations("notFound");
  const tm = useTranslations("modules");
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const landingPath = useLandingPath();
  const visibleModules = useVisibleModules();

  // โมดูลของ path นี้ ถ้าผู้ใช้เข้าได้ → ปุ่มหลักพากลับหน้าแรกของโมดูลนั้น (ใกล้ของที่เขาหาที่สุด)
  // เข้าไม่ได้ / ไม่อยู่ในโมดูลไหน → หน้าแรกที่เขาเปิดได้แน่ ๆ (ไม่ hardcode /dashboard ซึ่งถูกล็อกได้)
  const activeModule = findActiveModule(pathname);
  const moduleAccess = activeModule
    ? visibleModules.find((m) => m.path === activeModule.path)
    : undefined;
  const moduleHome =
    moduleAccess &&
    !moduleAccess.denied &&
    !moduleAccess.locked &&
    pathname !== moduleAccess.path
      ? moduleAccess
      : undefined;

  // React Router เก็บลำดับใน history.state.idx — 0 = เปิดลิงก์นี้มาตรง ๆ ไม่มีหน้าก่อนให้ถอย
  const canGoBack =
    ((globalThis.history?.state as { idx?: number } | null)?.idx ?? 0) > 0;

  return (
    <div className="flex min-h-[60vh] flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
      <div className="bg-muted text-muted-foreground flex size-12 items-center justify-center rounded-full">
        <SearchX aria-hidden="true" className="size-6" />
      </div>

      <div className="space-y-1">
        <p className="text-muted-foreground text-micro font-semibold tracking-widest uppercase">
          {t("eyebrow")}
        </p>
        <h1 className="text-foreground text-lg font-semibold tracking-tight">
          {t("title")}
        </h1>
      </div>

      {/* ที่อยู่ที่เปิดมา — break-all เพราะ path ไม่มีช่องว่างให้ตัดบรรทัด ไม่งั้นล้นจอมือถือ */}
      <code
        className="bg-muted text-foreground line-clamp-2 max-w-full rounded-md px-2 py-1 font-mono text-xs break-all sm:max-w-md"
        title={pathname}
      >
        {pathname}
      </code>

      <p className="text-muted-foreground max-w-md text-xs">
        {t("description")}
      </p>

      <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
        {canGoBack && (
          <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft aria-hidden="true" />
            {t("goBack")}
          </Button>
        )}
        <Button asChild size="sm">
          <Link to={moduleHome ? moduleHome.path : landingPath}>
            {moduleHome
              ? t("backToModule", { module: tm(moduleHome.name) })
              : t("backToHome")}
          </Link>
        </Button>
      </div>
    </div>
  );
}
