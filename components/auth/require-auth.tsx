import { useSyncExternalStore } from "react";
import { Navigate, useLocation } from "react-router";
import { tokenStore } from "@/lib/auth/token-store";
import { loginPathFor } from "@/lib/auth/resolve-next-path";

/**
 * Route guard ระดับ auth — token ใน store หาย (เช่น refresh ล้มเหลวกลางคัน
 * จาก http-client) → redirect ไป /login ทันทีผ่าน useSyncExternalStore
 * พร้อม `?next=` ของหน้าปัจจุบัน — login-form / ปุ่ม Google / RedirectIfAuthed อ่านค่านี้
 * แล้วพากลับมาหน้าเดิม (เดิมส่ง `state.from` ซึ่งไม่มีใครอ่าน จึงไปลง /dashboard ทุกครั้ง)
 * (การเช็ค permission รายหน้าเป็นหน้าที่ของ RouteGuard เดิม)
 */
export function RequireAuth({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  const token = useSyncExternalStore(tokenStore.subscribe, tokenStore.get);
  const location = useLocation();

  if (!token) {
    return (
      <Navigate
        to={loginPathFor(`${location.pathname}${location.search}${location.hash}`)}
        replace
      />
    );
  }
  return <>{children}</>;
}
