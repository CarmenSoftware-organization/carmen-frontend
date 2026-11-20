import { useEffect, useRef, useSyncExternalStore } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { API_ENDPOINTS } from "@/constant/api-endpoints";
import { QUERY_KEYS } from "@/constant/query-keys";
import {
  APP_STATUS_RUNNING,
  appStatusStore,
  isAppBlocked,
  parseAppStatus,
  type AppStatusSnapshot,
} from "@/lib/app-status-store";
import { refreshTokens } from "@/lib/auth/auth-api";
import { httpClient } from "@/lib/http-client";

// ตรงกับรอบรีเฟรช allowlist ของ gateway (APP_ALLOWLIST_TTL_MS = 60 s) — ถี่กว่านี้ก็ไม่ได้ค่าใหม่กว่า
const POLL_MS = 60_000;

// backend ห่อด้วย `{ data }` เป็นปกติ แต่รับรูปเปล่าด้วยเผื่อ endpoint ตอบตรง
const unwrap = (json: unknown): unknown =>
  typeof json === "object" && json !== null && "data" in json
    ? (json as { data: unknown }).data
    : json;

async function probe(): Promise<AppStatusSnapshot> {
  // silentForbidden: 403 ที่ไม่ใช่สถานะแอปต้องไม่เด้ง PermissionDeniedDialog ทุก 60 วินาที
  // (APP_DISABLED 403 ยังเข้า store เพราะ http-client รายงานก่อนเช็ค flag นี้)
  const res = await httpClient.get(API_ENDPOINTS.APP_STATUS, {
    rawUnauthorized: true,
    silentForbidden: true,
  });
  if (res.status === 404 || res.status === 401) return APP_STATUS_RUNNING;
  if (res.ok) return parseAppStatus(unwrap(await res.json().catch(() => null)));
  throw new Error(`Failed to fetch app status (${res.status})`);
}

/**
 * Hook สถานะการให้บริการของแอป — **mount ครั้งเดียวใน root-layout** (เป็นตัว poll ตัวเดียว)
 *
 * ยิง `GET /api/app-status` ตอนเข้าแอป, ทุก 60 วินาที และตอนกลับมาที่แท็บ แล้วเขียนผลลง
 * `appStatusStore` ส่วนค่าที่คืนอ่านจาก store ซึ่ง `http-client` ก็เขียนได้ทันทีที่เจอ 503/403
 * ของสถานะแอประหว่างทาง (probe ที่ออกก่อนรายงานนั้นจะถูกทิ้ง ไม่เขียนทับกลับ)
 *
 * **fail-open**: gateway รุ่นก่อนไม่มี endpoint นี้ (404) = running · 401 (app id ไม่รู้จัก)
 * = running และไม่เตะ session · error อื่นไม่แตะ store (คงค่าเดิมไว้) — เหมือน `useBackendVersion`
 *
 * เมื่อหลุดจากสถานะที่บล็อก (หน้าเต็มจอ) กลับมาใช้งานได้ จะ invalidate query ทั้งหมด
 * ให้หน้าที่ล้มไประหว่างปิดปรับปรุงโหลดใหม่เองโดยไม่ต้อง reload
 *
 * @returns snapshot ปัจจุบัน, `recheck` สำหรับปุ่ม "ตรวจสอบอีกครั้ง", `isChecking`
 */
export function useAppStatus(): {
  snapshot: AppStatusSnapshot;
  recheck: () => void;
  isChecking: boolean;
} {
  const queryClient = useQueryClient();
  const retriedFor = useRef<string | null>(null);

  const query = useQuery<AppStatusSnapshot>({
    queryKey: [QUERY_KEYS.APP_STATUS],
    queryFn: async () => {
      const token = appStatusStore.probeToken();
      let snapshot = await probe();
      // ผู้ใช้ที่ได้รับยกเว้นแต่ access token หมดอายุ: backend มองเป็น "ไม่มีผู้ใช้" (200, bypass:false)
      // และหน้าบล็อกเต็มจอจะไม่ยิงคำขออื่นให้เกิด 401→refresh เลย จึงต้อง refresh เองหนึ่งครั้ง
      // แล้ว probe ซ้ำก่อนตัดสิน — ทำครั้งเดียวต่อสถานะบล็อกหนึ่งชุด ไม่ refresh ทุก 60 วินาที
      // disabled ไม่มีข้อยกเว้น (bypass ใช้ไม่ได้) — refresh ไปก็ไม่ได้อะไร จึงจำกัดที่ maintenance/read_only
      if (
        (snapshot.status === "maintenance" ||
          snapshot.status === "read_only") &&
        !snapshot.bypass
      ) {
        const key = `${snapshot.status}|${snapshot.until ?? ""}`;
        if (retriedFor.current !== key) {
          retriedFor.current = key;
          if ((await refreshTokens()) === "ok") snapshot = await probe();
        }
      } else {
        retriedFor.current = null;
      }
      // ผลถูกทิ้งเพราะมี 503/403 ของสถานะแอปเข้ามาระหว่าง probe (เช่นตอนเปิดหน้าแรก query ของหน้า
      // ล้มพร้อมกัน) — probe ซ้ำทันทีหนึ่งครั้ง ไม่งั้นข้อความแอดมินหายไปจนรอบ poll ถัดไป (≤ 60 วินาที)
      // และปุ่ม "ตรวจสอบอีกครั้ง" ดูเหมือนไม่ทำอะไร · ครั้งเดียวพอ: หน้าบล็อกไม่ยิงคำขออื่นต่อแล้ว
      if (!appStatusStore.setFromProbe(snapshot, token)) {
        const retryToken = appStatusStore.probeToken();
        snapshot = await probe();
        appStatusStore.setFromProbe(snapshot, retryToken);
      }
      return snapshot;
    },
    refetchInterval: POLL_MS,
    refetchOnWindowFocus: true,
    staleTime: 0,
    retry: false,
  });

  const snapshot = useSyncExternalStore(
    appStatusStore.subscribe,
    appStatusStore.get,
    appStatusStore.get,
  );

  const blocked = isAppBlocked(snapshot);
  const wasBlocked = useRef(blocked);
  useEffect(() => {
    if (wasBlocked.current && !blocked) {
      void queryClient.invalidateQueries(
        {
          predicate: (q) => q.queryKey[0] !== QUERY_KEYS.APP_STATUS,
        },
        { cancelRefetch: false },
      );
    }
    wasBlocked.current = blocked;
  }, [blocked, queryClient]);

  return {
    snapshot,
    recheck: () => void query.refetch(),
    isChecking: query.isFetching,
  };
}
