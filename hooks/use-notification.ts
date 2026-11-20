import { useEffect, useRef, useState } from "react";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { API_ENDPOINTS } from "@/constant/api-endpoints";
import { QUERY_KEYS } from "@/constant/query-keys";
import { CACHE_DYNAMIC, CACHE_NORMAL } from "@/lib/cache-config";
import { ApiError } from "@/lib/api-error";
import { httpClient } from "@/lib/http-client";
import { getRuntimeConfig } from "@/lib/runtime-config";
import { refreshTokens } from "@/lib/auth/auth-api";
import { tokenStore } from "@/lib/auth/token-store";
import type {
  Notification,
  NotificationListResponse,
  NotificationSource,
} from "@/types/notification";

export type NotificationTab = "all" | "unread";

const PAGE_SIZE = 20;
const POPOVER_SIZE = 10;
const INVALIDATE_DEBOUNCE_MS = 300;
/** gateway ปิดด้วย code นี้เมื่อ token ไม่ผ่าน/หมดอายุ/ไม่ส่ง auth ภายในเวลา — ต้อง refresh ก่อนต่อใหม่ */
const WS_AUTH_CLOSE_CODE = 4401;
/** 4401 ติดกันเกินนี้ทั้งที่ refresh สำเร็จ ⇒ เลิกต่อทันทีแล้วใช้ backoff ปกติ (กัน loop ถี่) */
const MAX_AUTH_REJECTIONS = 3;

/**
 * คีย์ของรายการทุกตัวแตกจาก prefix `all` เดียวกัน WS จึง invalidate ครั้งเดียวสดทั้งหมด
 * แคชฝั่ง "ยังไม่อ่าน" ทั้งสองตัว (popover กับแท็บ) อยู่ใต้ `unreadAll` เพื่อให้
 * optimistic update ของ mark-read เขียนถึงพร้อมกันด้วยคำสั่งเดียว
 *
 * ข้อยกเว้น: `detail` อยู่คนละ prefix (`QUERY_KEYS.NOTIFICATION_DETAIL`) จึงไม่ถูก
 * invalidate ตามรายการ — ตั้งใจ เพราะเนื้อหาของแจ้งเตือนหนึ่งใบไม่เปลี่ยนหลังสร้าง
 * มีแต่ `is_read` ที่เปลี่ยน ซึ่ง dialog ไม่ได้แสดง
 */
export const notificationKeys = {
  all: [QUERY_KEYS.NOTIFICATIONS] as const,
  unreadAll: [QUERY_KEYS.NOTIFICATIONS, "unread"] as const,
  unreadPopover: (perpage: number) =>
    [QUERY_KEYS.NOTIFICATIONS, "unread", "popover", perpage] as const,
  list: (tab: NotificationTab) =>
    tab === "unread"
      ? ([QUERY_KEYS.NOTIFICATIONS, "unread", "list"] as const)
      : ([QUERY_KEYS.NOTIFICATIONS, "all", "list"] as const),
  detail: (id: string) => [QUERY_KEYS.NOTIFICATION_DETAIL, id] as const,
};

const getWsUrl = (): string | undefined => {
  try {
    return getRuntimeConfig().WS_URL;
  } catch {
    return undefined;
  }
};

/**
 * ดึงรายการหนึ่งหน้าจาก endpoint ที่กำหนด แล้วทำซองให้เป็นรูปเดียวเสมอ
 * `paginate` เติมค่าตั้งต้นเมื่อ backend ไม่ส่งมา ส่วน `summary` ปล่อยเป็น undefined
 * ตามสัญญา — การไม่มีแปลว่า "สร้างค่าสรุปไม่ได้" ไม่ใช่ศูนย์
 *
 * @param url - endpoint ฐาน (`NOTIFICATIONS` หรือ `NOTIFICATIONS_UNREAD`)
 * @param page - เลขหน้าเริ่มที่ 1
 * @param perpage - จำนวนต่อหน้า (backend จำกัดไม่เกิน 100)
 * @returns ซองรายการที่ normalize แล้ว
 */
async function fetchNotificationPage(
  url: string,
  page: number,
  perpage: number,
): Promise<NotificationListResponse> {
  const res = await httpClient.get(`${url}?page=${page}&perpage=${perpage}`);
  if (!res.ok) {
    throw await ApiError.from(res, "Failed to load notifications");
  }
  const json = await res.json();
  const data: Notification[] = Array.isArray(json?.data) ? json.data : [];
  return {
    data,
    paginate: json?.paginate ?? {
      total: data.length,
      page,
      perpage,
      pages: 1,
    },
    summary: json?.summary,
  };
}

type InfiniteShape = {
  pages: NotificationListResponse[];
  pageParams: unknown[];
};

function isInfinite(value: unknown): value is InfiniteShape {
  return (
    !!value &&
    typeof value === "object" &&
    Array.isArray((value as InfiniteShape).pages)
  );
}

function dropRows(
  page: NotificationListResponse,
  ids: Set<string> | "all",
): NotificationListResponse {
  const kept = ids === "all" ? [] : page.data.filter((n) => !ids.has(n.id));
  const removed = page.data.length - kept.length;
  return {
    ...page,
    data: kept,
    paginate: {
      ...page.paginate,
      total: ids === "all" ? 0 : Math.max(0, page.paginate.total - removed),
    },
  };
}

/**
 * เขียน optimistic ลงทุกแคชฝั่ง "ยังไม่อ่าน" — ครอบทั้งแคชหน้าเดียวของ popover
 * และแคช infinite ของแท็บยังไม่อ่าน แคชฝั่ง "ทั้งหมด" ไม่แตะ เพราะแถวยังอยู่ที่นั่น
 * (แค่เปลี่ยนเป็นอ่านแล้ว) และจะถูก invalidate ตามหลังอยู่แล้ว
 *
 * @param queryClient - client ปัจจุบัน
 * @param ids - เซตของ id ที่จะตัด หรือ "all" เพื่อล้างทั้งหมด
 */
function dropFromUnreadCaches(
  queryClient: QueryClient,
  ids: Set<string> | "all",
): void {
  queryClient.setQueriesData<unknown>(
    { queryKey: notificationKeys.unreadAll },
    (old: unknown) => {
      if (!old) return old;
      if (isInfinite(old)) {
        return { ...old, pages: old.pages.map((p) => dropRows(p, ids)) };
      }
      return dropRows(old as NotificationListResponse, ids);
    },
  );
}

/**
 * เชื่อม WebSocket เพื่อรับสัญญาณว่ามีการแจ้งเตือนใหม่ แล้ว invalidate ทั้งกลุ่ม
 * **hook นี้ไม่ถือรายการเอง** — payload บน WS มีไม่ครบ (ไม่มี created_at/is_read/source)
 * REST เป็นแหล่งความจริงเดียว ดึงใหม่แล้วได้ครบทุกฟิลด์และตัวเลขที่ตรงกันเสมอ
 * reconnect แบบ exponential backoff เพดาน 30 วินาที
 *
 * สัญญาณถูกหน่วงรวบเป็นชุด (`INVALIDATE_DEBOUNCE_MS`) เพราะตอน register ฝั่ง
 * micro-notification จะ replay ของที่ยังไม่อ่านกลับมา **ทีละใบ** — invalidate ทุก frame
 * แปลว่า refresh หนึ่งครั้งได้ refetch เท่าจำนวนใบที่ค้างอยู่ (แถม `invalidateQueries`
 * default `cancelRefetch: true` เลยยกเลิกตัวที่ยิงค้างแล้วยิงใหม่ทุกรอบ)
 *
 * @param userId - id ผู้ใช้ (undefined = ไม่เชื่อมต่อ) — ตัวตนจริงที่ gateway ใช้มาจาก access token
 *   ใน `tokenStore` ซึ่งส่งเป็นข้อความ `auth` แรก ไม่ใช่จากค่านี้
 * @returns สถานะการเชื่อมต่อ
 * @example
 * useNotificationRealtime(userId);
 */
export function useNotificationRealtime(userId: string | undefined) {
  const [isConnected, setIsConnected] = useState(false);
  const queryClient = useQueryClient();
  const reconnectAttempt = useRef(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const invalidateTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    const maybeWsUrl = getWsUrl();
    if (!userId || !maybeWsUrl) return;
    const wsUrl: string = maybeWsUrl;

    let unmounted = false;
    let isStopped = false;
    let authRejections = 0;
    let sentToken: string | null = null;
    let unsubscribeToken: (() => void) | null = null;
    let activeWs: WebSocket | null = null;
    reconnectAttempt.current = 0;

    function scheduleInvalidate() {
      clearTimeout(invalidateTimer.current);
      invalidateTimer.current = setTimeout(() => {
        void queryClient.invalidateQueries({ queryKey: notificationKeys.all });
      }, INVALIDATE_DEBOUNCE_MS);
    }

    function scheduleReconnect() {
      const delay = Math.min(1000 * 2 ** reconnectAttempt.current, 30000);
      reconnectAttempt.current += 1;
      reconnectTimer.current = setTimeout(connect, delay);
    }

    // ไม่มี token (เช่นกำลัง refresh ตอน boot หรือ session ถูกล้าง) ⇒ หยุดไว้ แล้วต่อใหม่เองเมื่อ tokenStore มี token
    function waitForToken() {
      isStopped = true;
      if (unsubscribeToken) return;
      unsubscribeToken = tokenStore.subscribe(() => {
        if (unmounted || !tokenStore.get()) return;
        unsubscribeToken?.();
        unsubscribeToken = null;
        isStopped = false;
        reconnectAttempt.current = 0;
        connect();
      });
    }

    // gateway ปิด 4401 = token ใช้ไม่ได้ ⇒ refresh ก่อนแล้วค่อยต่อใหม่
    // - token ใน store ใหม่กว่าที่ส่งไปแล้ว (http-client refresh ให้แล้ว) ⇒ ต่อใหม่เลย ไม่ refresh ซ้ำ
    //   (refresh token อยู่ใน localStorage ร่วมกันทุกแท็บ refresh เกินจำเป็นเพิ่มโอกาสชนกันตอน rotate)
    // - โดน 4401 ติดกันครบ MAX_AUTH_REJECTIONS ⇒ เลิก refresh ใช้ backoff อย่างเดียว (กัน refresh วนตลอดไป)
    // - refresh ไม่สำเร็จและ session ถูกล้าง ⇒ รอ token ใหม่; ไม่สำเร็จแต่ token ยังอยู่ (network) ⇒ backoff
    async function handleAuthRejected() {
      authRejections += 1;
      if (authRejections >= MAX_AUTH_REJECTIONS) {
        scheduleReconnect();
        return;
      }
      const current = tokenStore.get();
      const isRefreshed =
        (current !== null && current !== sentToken) ||
        (await refreshTokens()) === "ok";
      if (unmounted) return;
      if (isRefreshed) {
        reconnectAttempt.current = 0;
        connect();
        return;
      }
      if (!tokenStore.get()) {
        waitForToken();
        return;
      }
      scheduleReconnect();
    }

    function connect() {
      const ws = new WebSocket(wsUrl);
      activeWs = ws;

      ws.onopen = () => {
        if (unmounted) {
          ws.close();
          return;
        }
        const token = tokenStore.get();
        if (!token) {
          waitForToken();
          ws.close();
          return;
        }
        sentToken = token;
        ws.send(JSON.stringify({ type: "auth", token }));
        // ชั่วคราวระหว่าง rollout: gateway เก่าไม่รู้จัก `auth` และใช้ `register` แทน
        // gateway ใหม่เพิกเฉย `register` — ลบบรรทัดนี้หลัง gateway ใหม่ขึ้น production
        ws.send(JSON.stringify({ type: "register", user_id: userId }));
      };

      ws.onmessage = (event) => {
        let message: unknown;
        try {
          message = JSON.parse(event.data);
        } catch {
          return; // ignore malformed messages
        }
        if (message === null || typeof message !== "object") return;
        const type = (message as { type?: unknown }).type;
        // `registered` คือคำตอบของ gateway เก่า — ลบออกพร้อมบรรทัด register ข้างบน
        if (type === "authenticated" || type === "registered") {
          reconnectAttempt.current = 0;
          authRejections = 0;
          setIsConnected(true);
          return;
        }
        if (type === "notification") scheduleInvalidate();
      };

      ws.onclose = (event?: CloseEvent) => {
        setIsConnected(false);
        if (unmounted || isStopped) return;
        if (event?.code === WS_AUTH_CLOSE_CODE) {
          void handleAuthRejected();
          return;
        }
        scheduleReconnect();
      };

      ws.onerror = () => {
        // Connection will be retried via the onclose handler.
      };
    }

    connect();

    return () => {
      unmounted = true;
      clearTimeout(reconnectTimer.current);
      clearTimeout(invalidateTimer.current);
      unsubscribeToken?.();
      activeWs?.close();
    };
  }, [userId, queryClient]);

  return { isConnected };
}

/**
 * รายการที่ยังไม่ได้อ่านสำหรับ popover บน navbar — คำขอเดียวได้ทั้งแถวที่จะแสดง
 * และเลข badge จาก `paginate.total` (จำนวนยังไม่อ่านทั้งหมด ไม่ใช่แค่หน้านี้)
 *
 * @param perpage - จำนวนแถวที่ popover แสดง
 * @returns แถว จำนวนรวม สถานะโหลด และ error
 * @example
 * const { notifications, unreadCount } = useUnreadNotifications();
 */
export function useUnreadNotifications(perpage: number = POPOVER_SIZE) {
  const query = useQuery<NotificationListResponse, ApiError>({
    queryKey: notificationKeys.unreadPopover(perpage),
    queryFn: () =>
      fetchNotificationPage(API_ENDPOINTS.NOTIFICATIONS_UNREAD, 1, perpage),
    ...CACHE_DYNAMIC,
  });
  return {
    notifications: query.data?.data ?? [],
    unreadCount: query.data?.paginate.total ?? 0,
    isLoading: query.isLoading,
    error: query.error,
  };
}

/**
 * รายการของหน้า `/notifications` แบบโหลดเพิ่มทีละหน้า
 * `tab="all"` → `GET /api/notifications` (มี `summary`)
 * `tab="unread"` → `GET /api/notifications/unread` (ไม่มี `summary` โดยตั้งใจ
 * เพราะจำนวนยังไม่อ่านเท่ากับ `paginate.total` ของ endpoint นั้นพอดี)
 *
 * @param tab - แท็บที่กำลังแสดง
 * @returns แถวที่ต่อกันทุกหน้า ตัวเลขรวม ค่าสรุป และตัวควบคุมการโหลดเพิ่ม
 * @example
 * const { items, total, summary, fetchNextPage, hasNextPage } = useNotificationsList("all");
 */
export function useNotificationsList(tab: NotificationTab) {
  const url =
    tab === "unread"
      ? API_ENDPOINTS.NOTIFICATIONS_UNREAD
      : API_ENDPOINTS.NOTIFICATIONS;
  const query = useInfiniteQuery<NotificationListResponse, ApiError>({
    queryKey: notificationKeys.list(tab),
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      fetchNotificationPage(url, pageParam as number, PAGE_SIZE),
    getNextPageParam: (last) =>
      last.paginate.page < last.paginate.pages
        ? last.paginate.page + 1
        : undefined,
    ...CACHE_DYNAMIC,
  });
  const pages = query.data?.pages ?? [];
  return {
    items: pages.flatMap((p) => p.data),
    total: pages[0]?.paginate.total ?? 0,
    summary: pages[0]?.summary,
    isLoading: query.isLoading,
    error: query.error,
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    fetchNextPage: () => void query.fetchNextPage(),
  };
}

/**
 * ทำเครื่องหมายว่าอ่านแล้วหนึ่งใบ — ต้องส่ง `source` ของแถวนั้นกลับไป
 * เพื่อให้ backend เขียนลงตารางที่ถูก (`broadcast` → tb_user_broadcast_action)
 * ไม่ส่ง = backend ถือว่า personal ซึ่งจะทำให้ประกาศกดอ่านไม่ติด
 *
 * @returns mutation ที่รับ `{ id, source }`
 * @example
 * const markRead = useMarkNotificationRead();
 * markRead.mutate({ id: n.id, source: n.source });
 */
export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation<
    void,
    ApiError,
    { id: string; source?: NotificationSource },
    { previous: [readonly unknown[], unknown][] }
  >({
    mutationFn: async ({ id, source }) => {
      const res = await httpClient.put(
        API_ENDPOINTS.NOTIFICATION_MARK_READ(id),
        source ? { source } : undefined,
      );
      if (!res.ok) {
        throw await ApiError.from(res, "Failed to mark notification as read");
      }
    },
    onMutate: async ({ id }) => {
      await queryClient.cancelQueries({ queryKey: notificationKeys.unreadAll });
      const previous = queryClient.getQueriesData({
        queryKey: notificationKeys.unreadAll,
      });
      dropFromUnreadCaches(queryClient, new Set([id]));
      return { previous };
    },
    onError: (_err, _vars, context) => {
      context?.previous.forEach(([key, data]) =>
        queryClient.setQueryData(key, data),
      );
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation<
    void,
    ApiError,
    void,
    { previous: [readonly unknown[], unknown][] }
  >({
    mutationFn: async () => {
      const res = await httpClient.put(
        API_ENDPOINTS.NOTIFICATIONS_MARK_ALL_READ,
      );
      if (!res.ok) {
        throw await ApiError.from(
          res,
          "Failed to mark all notifications as read",
        );
      }
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: notificationKeys.unreadAll });
      const previous = queryClient.getQueriesData({
        queryKey: notificationKeys.unreadAll,
      });
      dropFromUnreadCaches(queryClient, "all");
      return { previous };
    },
    onError: (_err, _vars, context) => {
      context?.previous.forEach(([key, data]) =>
        queryClient.setQueryData(key, data),
      );
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}

export function useNotificationDetail(id: string | null | undefined) {
  return useQuery<Notification, ApiError>({
    queryKey: notificationKeys.detail(id ?? ""),
    queryFn: async () => {
      const res = await httpClient.get(API_ENDPOINTS.NOTIFICATION_BY_ID(id!));
      if (!res.ok) {
        throw await ApiError.from(res, "Failed to load notification detail");
      }
      const json = await res.json();
      return json.data ?? json;
    },
    enabled: !!id,
    ...CACHE_NORMAL,
  });
}
