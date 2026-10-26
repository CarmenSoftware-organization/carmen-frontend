import { Navigate, useLocation, useNavigate } from "react-router";
import { useTranslations } from "use-intl";
import { ArrowLeft, Home, ShieldOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EyeBrow } from "@/components/ui/eye-brow";
import { findRouteLeaf } from "@/constant/module-list";
import { useCan } from "@/hooks/use-can";
import { useLandingPath } from "@/hooks/use-landing-path";
import {
  isModuleLocked,
  licenseFeatureOf,
  useLicense,
} from "@/hooks/use-license";
import { usePosStatus } from "@/hooks/use-pos-status";
import { PosNotEnabled } from "@/components/pos-not-enabled";
import { ErrorState } from "@/components/ui/error-state";
import type { DeniedReason } from "@/components/permission-denied-dialog";

interface RouteGuardProps {
  readonly children: React.ReactNode;
}

/**
 * บล็อก direct URL ของหน้าที่ผู้ใช้ไม่มีสิทธิ์ หรือ BU ไม่ได้ซื้อ feature นี้
 *
 * - หา leaf ใน moduleList ที่ตรงกับ pathname (รวม nested เช่น /[id])
 * - เช็ค **license ก่อน permission เสมอ** — ถ้า feature ไม่อยู่ในสัญญาของ BU
 *   การมีสิทธิ์ RBAC ก็ไม่ช่วยอะไร และต่างจาก permission ตรงที่ **ไม่มี admin
 *   bypass** เลย (admin ของ BU ที่ไม่ได้ซื้อโมดูลก็ยังเข้าไม่ได้ — ดู
 *   hooks/use-license.ts และ phase-c-backend-contract.md ข้อ 7.1)
 * - **หน้าที่ถูกปลดระวาง (`hidden`) มาก่อนทุกอย่าง** — เด้งไป landing แบบเงียบ ไม่มีกล่อง
 *   ต่างจาก `locked` ที่ขึ้น AccessDeniedBlock เพราะกล่อง "ยังไม่ได้ซื้อ" บนของที่เลิกขาย
 *   ไปแล้วคือคำโกหก และกล่องใด ๆ ก็เป็นการยืนยันว่าหน้านี้มีอยู่ · `isHidden` ไม่ผูกกับ
 *   สวิตช์ `LICENSE_ENFORCEMENT` ต่างจาก `isLicensed` (ดู hooks/use-license.ts)
 * - `useLicense().isLicensed()` จัดการสวิตช์ `LICENSE_ENFORCEMENT` (shadow mode)
 *   กับ state `"unresolved"` ให้แล้วภายใน — ทั้งสองกรณีไม่ล็อกหน้า ไม่ต้องเช็คซ้ำที่นี่
 * - feature ที่ **หมดอายุ** (อยู่ใน `expired_features`) ล็อกด้วยข้อความ "หมดอายุ" ไม่ใช่
 *   "ไม่ได้ซื้อ" · leaf ที่ตั้ง `viewableWhenExpired` ผ่านไปได้เลย (หน้าอธิบายเอง)
 * - สัญญาหมดอายุ/ถูกระงับ (`expired`/`inactive`) **ไม่บล็อกที่นี่** — ยังอ่านได้
 *   ตามสเปก §3.2 การบล็อกอยู่ที่ปุ่มเขียนกับที่ backend เท่านั้น
 * - ถ้า license ผ่านแต่ไม่มี permission (และไม่ใช่ admin) → แสดง AccessDeniedBlock
 * - Admin (เมื่อ license ผ่าน) หรือ leaf ที่ไม่ระบุ permission → render ปกติ
 *
 * วางใน `(root)/layout.tsx` ภายใต้ `ProfileGate` (รอ profile โหลดเสร็จก่อน)
 */
export function RouteGuard({ children }: RouteGuardProps) {
  const pathname = useLocation().pathname;
  const { can, isAdmin } = useCan();
  const { isLicensed, isHidden, isExpired } = useLicense();
  const t = useTranslations("permissionDenied");
  // ต้องเรียกก่อน early return ทุกอัน — hook เรียกแบบมีเงื่อนไขไม่ได้
  const landing = useLandingPath();
  const pos = usePosStatus();

  const leaf = findRouteLeaf(pathname);

  const feature = leaf ? licenseFeatureOf(leaf) : undefined;
  // ซ่อนมาก่อนล็อกเสมอ — กล่อง "BU ยังไม่ได้ซื้อ feature นี้" บนของที่แพลตฟอร์มเลิกขาย
  // ไปแล้วคือคำโกหก และการเด้งแบบ **เงียบ** คือสิ่งเดียวที่สอดคล้องกับคำว่า "หาย"
  // (กล่องแจ้งเตือนใด ๆ ก็ตามเป็นการยืนยันกับผู้ใช้ว่าหน้านี้มีอยู่จริง)
  //
  // วนไม่ได้: useLandingPath() คำนวณจาก tree ที่ useVisibleModules ตัด node ที่ซ่อน
  // ออกไปแล้ว จึงคืน path ที่ถูกซ่อนไม่ได้ และ fallback `/profile` ไม่อยู่ใน moduleList
  // เลย (findRouteLeaf คืน undefined → ไม่มีอะไรให้บล็อก)
  if (feature && isHidden(feature)) {
    return <Navigate to={landing} replace />;
  }

  const locked = !!leaf && isModuleLocked(leaf, isLicensed, isExpired);
  if (locked) {
    const expired = !!feature && isExpired(feature);
    return (
      <AccessDeniedBlock
        reason={expired ? "expired" : "license"}
        description={
          expired ? t("licenseExpiredDescription") : t("licenseDescription")
        }
        fallbackTo={landing}
      />
    );
  }

  // หน้าที่ต้องมี POS interface — รอผลก่อน (ไม่ render อะไร) กันหน้า "ยังไม่เปิด POS" วาบ
  // ตอนที่แค่ยังโหลดไม่เสร็จ · ตรวจหลัง license เพื่อให้ข้อความ license มาก่อนเหมือนเดิม
  if (leaf?.requiresPosInterface) {
    if (pos.isLoading) return null;
    // โหลดสถานะพลาด ≠ ยังไม่เปิด POS — แสดง error ปกติ ไม่งั้นค้างหน้า "ยังไม่เปิด" จน cache หมด
    if (pos.error) return <ErrorState error={pos.error} onRetry={pos.refetch} />;
    if (!pos.isEnabled) return <PosNotEnabled />;
  }

  const denied = !!leaf?.permission && !isAdmin && !can(leaf.permission);
  if (denied) return <AccessDeniedBlock fallbackTo={landing} />;

  return <>{children}</>;
}

interface AccessDeniedBlockProps {
  readonly description?: string;
  /**
   * ทำไมถึงเข้าไม่ได้ — ใช้เลือกว่าจะแสดงบรรทัด "ติดต่อผู้ดูแลระบบเพื่อขอสิทธิ์"
   * ต่อท้ายไหม default `"permission"` (พฤติกรรมเดิมเมื่อไม่ส่งมา)
   */
  readonly reason?: DeniedReason;
  /**
   * ปลายทางของปุ่มทางออก เมื่อ "ย้อนกลับ" ไม่ใช่คำตอบ
   *
   * ไม่ส่ง (default) → ปุ่มคือ `navigate(-1)` เหมือนเดิม ถูกต้องสำหรับกล่องที่เด้ง
   * ขึ้นกลางเส้นทางที่ผู้ใช้เดินมาเอง เช่น `CreateWorkflowGate` ที่บล็อกหน้า *สร้าง*
   * เพราะไม่มี workflow ให้เริ่ม — คนนั้นมาจากหน้า list จริง ๆ การกลับคือสิ่งที่ต้องการ
   *
   * ส่งมา → ปุ่มพาไป path นั้นแทน (`replace`) ใช้กับเคส direct URL/bookmark ที่
   * **ไม่มี history ให้ถอย** — `navigate(-1)` ตรงนั้นอาจเด้งออกนอกแอปหรือกลับไป
   * `/login` ทำให้กล่องกลายเป็นทางตัน ดู `useLandingPath()`
   */
  readonly fallbackTo?: string;
}

export function AccessDeniedBlock({
  description,
  reason = "permission",
  fallbackTo,
}: AccessDeniedBlockProps) {
  const t = useTranslations("permissionDenied");
  const navigate = useNavigate();

  return (
    <div
      role="alert"
      className="flex flex-1 items-center justify-center px-6 py-16"
    >
      <div className="bg-card flex w-full max-w-sm flex-col items-center rounded-xl border p-6 text-center">
        <div className="bg-muted text-destructive mb-4 flex size-12 items-center justify-center rounded-xl">
          <ShieldOff className="size-5" aria-hidden />
        </div>

        <EyeBrow>{t("eyebrow")}</EyeBrow>

        <h2 className="text-foreground mt-3 text-base font-semibold tracking-tight">
          {t("title")}
        </h2>
        {/* คำอธิบายกับ "ติดต่อผู้ดูแล" เป็นเรื่องเดียวกัน — ชิดกัน (mt-1) ให้อ่านเป็น
            ก้อนเดียว ไม่ต้องมีเส้นคั่นมาแบ่งของที่ไม่ได้แยกกันจริง */}
        <p className="text-muted-foreground mt-2 text-xs leading-relaxed">
          {description ?? t("pageDescription")}
        </p>
        {/* "ติดต่อผู้ดูแลระบบเพื่อขอสิทธิ์" ใช้ได้เฉพาะเรื่องสิทธิ์ — เหตุผล license/
            expired มีทางแก้คนละทาง (ต่อสัญญา/ติดต่อฝ่ายขาย) และคำอธิบายด้านบนบอก
            ไปแล้ว การแปะบรรทัดนี้ต่อท้ายจึงขัดกันเอง */}
        {reason === "permission" && (
          <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
            {t("contactAdmin")}
          </p>
        )}

        {/* ปลายทางเดียวที่การันตีว่าเปิดได้ ดีกว่าการถอย history ที่อาจไม่มีอะไรให้ถอย */}
        <Button
          type="button"
          size="sm"
          onClick={() =>
            fallbackTo ? navigate(fallbackTo, { replace: true }) : navigate(-1)
          }
          className="mt-5"
        >
          {fallbackTo ? <Home /> : <ArrowLeft />}
          {fallbackTo ? t("goToAccessiblePage") : t("goBack")}
        </Button>
      </div>
    </div>
  );
}
