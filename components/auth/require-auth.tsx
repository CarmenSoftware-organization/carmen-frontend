import { useSyncExternalStore } from "react";
import { Navigate, useLocation } from "react-router";
import { authReachabilityStore } from "@/lib/auth/auth-reachability-store";
import { tokenStore } from "@/lib/auth/token-store";
import { ServerUnreachableScreen } from "./server-unreachable-screen";
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
  const isUnreachable = useSyncExternalStore(
    authReachabilityStore.subscribe,
    authReachabilityStore.get,
  );
  const location = useLocation();

  // ไม่มี token เพราะ refresh ติดต่อ server ไม่ได้ ≠ session หมดอายุ — refresh token ยังอยู่
  // แสดงหน้าลองใหม่แทนการพาไป login (หน้านั้นจะ render children เองเมื่อ server กลับมา)
  if (!token && isUnreachable) return <ServerUnreachableScreen />;

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
