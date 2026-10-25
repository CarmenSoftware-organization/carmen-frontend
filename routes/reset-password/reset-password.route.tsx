import { useMutation } from "@tanstack/react-query";
import { useTranslations } from "use-intl";
import { Link, useNavigate, useSearchParams } from "react-router";
import { ApiError, isTransportError } from "@/lib/api-error";
import { resetPasswordWithToken } from "@/lib/auth/auth-api";
import { AuthSplitShell } from "@/components/auth/auth-split-shell";
import { RedirectIfAuthed } from "@/components/auth/redirect-if-authed";
import { Button } from "@/components/ui/button";
import ResetPasswordForm from "./reset-password-form";
import type { ResetPasswordValues } from "./reset-password-schema";

export function Component() {
  return (
    <RedirectIfAuthed>
      <ResetStep />
    </RedirectIfAuthed>
  );
}

/**
 * เนื้อในของขั้นที่สอง — แยกออกมาเพื่อให้ `RedirectIfAuthed` ตัดตั้งแต่ก่อน mount
 *
 * token อ่านจาก query แล้วส่งไปกับ request เท่านั้น ไม่ถูกเก็บลง localStorage หรือ sessionStorage
 * เพราะมันเป็นความลับที่ตั้งรหัสผ่านของบัญชีนั้นได้จริงจนกว่าจะถูกใช้หรือหมดอายุ
 *
 * ไม่มี endpoint สำหรับตรวจ token ล่วงหน้าแบบที่เส้นทางสมัครมี (`signup-token/verify`) หน้านี้
 * จึงแสดงฟอร์มทันทีและรู้ว่าลิงก์ใช้ไม่ได้ก็ต่อเมื่อกดส่ง — ยอมให้ผู้ใช้พิมพ์ทิ้งดีกว่าเดาเอาเองว่า
 * ลิงก์ยังดีอยู่หรือไม่
 */
function ResetStep() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const navigate = useNavigate();
  const t = useTranslations("auth");

  const resetPassword = useMutation({
    mutationFn: (values: ResetPasswordValues) =>
      resetPasswordWithToken(token, values.password),
    // backend ไม่คืน token ล็อกอินกลับมา ผู้ใช้ต้องเข้าสู่ระบบเองด้วยรหัสใหม่ — ส่ง router state
    // ไปให้หน้า login แสดงแถบยืนยัน เป็นกลไกเดียวกับ `justRegistered` ของเส้นทางสมัคร
    onSuccess: () =>
      navigate("/login", { replace: true, state: { passwordReset: true } }),
    // ฟอร์มแสดงความผิดพลาดในตัวเองอยู่แล้ว และ toast กลางแปลจากรหัส HTTP ล้วน ๆ — 400 ของ
    // endpoint นี้แปลว่า "ลิงก์ใช้ไม่ได้แล้ว" แต่ toast จะอ่านว่า "ข้อมูลที่จำเป็นไม่ครบถ้วน"
    // ซึ่งชี้ผู้ใช้ไปผิดทางคนละเรื่อง
    meta: { skipGlobalErrorToast: true },
  });

  const failure =
    resetPassword.error instanceof ApiError ? resetPassword.error : null;
  // 400 คือ token ไม่มีจริง หมดอายุ หรือถูกใช้ไปแล้ว — backend ตอบเหมือนกันทั้งสามกรณีโดยตั้งใจ
  // หน้าจอจึงบอกได้แค่ว่า "ใช้ไม่ได้แล้ว ขอลิงก์ใหม่" และต้องมีทางไปขอให้ด้วย
  const linkDead = failure?.statusCode === 400;
  const errorMessage = failure
    ? linkDead
      ? t("resetPassword.linkDeadDuringForm")
      : isTransportError(failure)
        ? t("errors.networkUnavailable")
        : failure.message
    : resetPassword.error
      ? t("resetPassword.failed")
      : null;

  // ลิงก์ที่ไม่มี `?token=` เลย ไม่ต้องยิงอะไรก็รู้ว่าไปต่อไม่ได้ — เกิดได้จริงเมื่อ
  // `password_reset.base_url` ฝั่ง Backstage config ถูกตั้งผิด หรือผู้ใช้ก็อปลิงก์มาไม่ครบ
  if (!token) {
    return (
      <AuthSplitShell
        title={t("resetPassword.linkDeadTitle")}
        subtitle={t("resetPassword.linkDeadDescription")}
      >
        <Button asChild className="mt-5 h-10 w-full">
          <Link to="/forgot-password">{t("resetPassword.requestNewLink")}</Link>
        </Button>
      </AuthSplitShell>
    );
  }

  return (
    <AuthSplitShell
      title={t("resetPassword.title")}
      subtitle={t("resetPassword.description")}
    >
      <ResetPasswordForm
        onSubmit={(values) => resetPassword.mutate(values)}
        isPending={resetPassword.isPending}
        errorMessage={errorMessage}
      />
      {/* ทางไปขอลิงก์ใหม่ ขึ้นเฉพาะตอนที่ลิงก์ตายจริง ๆ — กรณีเครือข่ายล่มหรือ backend พัง
          รหัสที่กรอกไว้ยังส่งซ้ำได้ การชวนให้ไปขอลิงก์ใหม่ตรงนั้นคือคำแนะนำที่ผิด */}
      {linkDead && (
        <p className="text-muted-foreground mt-4 text-center text-xs">
          <Link
            to="/forgot-password"
            className="text-primary font-semibold underline-offset-4 hover:underline"
          >
            {t("resetPassword.requestNewLink")}
          </Link>
        </p>
      )}
    </AuthSplitShell>
  );
}
