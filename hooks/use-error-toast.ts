import { useCallback } from "react";
import { useTranslations } from "use-intl";
import { toast } from "sonner";
import {
  getDisplayableServerMessage,
  getErrorId,
  getUserErrorMessage,
} from "@/lib/error-message";
import type { ReportApiErrorOptions } from "@/lib/api-error-handler";

/**
 * ตัวเต็มที่รับ `options` ต่อครั้ง — สำหรับ `<ApiErrorToaster />` ที่ได้ `meta` ของ
 * mutation มาด้วย · หน้าทั่วไปใช้ `useErrorToast()` ซึ่งรับอาร์กิวเมนต์เดียว
 */
export function useErrorToastWithOptions() {
  const t = useTranslations("errors");
  // ชื่อช่องมาจาก namespace `field` — ตัวเดียวกับป้ายบนฟอร์ม จะได้เรียกตรงกัน
  const tField = useTranslations("field");

  // useCallback: `<ApiErrorToaster />` ใส่ตัวนี้ใน dependency ของ useEffect —
  // ถ้าสร้างใหม่ทุก render จะถอด/ติดตั้ง handler ซ้ำทุกครั้งที่ re-render
  return useCallback(
    (err: unknown, options?: ReportApiErrorOptions) => {
      // Log ให้ dev เห็นเสมอ (console เป็น sentry แบบลูกทุ่ง) — รายละเอียดทาง
      // เทคนิคทั้งหมดอยู่ตรงนี้ที่เดียว ไม่ขึ้นไปอยู่บน toast
      if (import.meta.env.DEV) {
        console.error("[error-toast]", getErrorId(err), err);
      }

      // บรรทัดเดียวจบ ไม่มี description — เคยใส่รหัส error + รายละเอียดไว้ข้างล่าง
      // แล้ว backend ส่ง stack trace มาเป็นสิบบรรทัด toast กินครึ่งจอและไม่มีใคร
      // อ่าน · ค้าง 8 วินาที (นานกว่า success 4 วินาทีของ sonner) เพราะ error ต้องอ่านให้ทัน
      // และยังมีปุ่มปิดถ้าอยากไล่ก่อน
      const message =
        (options?.preferServerMessage && getDisplayableServerMessage(err)) ||
        getUserErrorMessage(err, t, tField);
      toast.error(message, { duration: 8000 });
    },
    [t, tField],
  );
}

/**
 * toast error แบบอาร์กิวเมนต์เดียว — **ต้องคงไว้เป็น 1 อาร์กิวเมนต์** เพราะมีหน้าที่
 * ส่งตัวนี้เป็น `onError` ของ mutation ตรง ๆ (ia-form) ซึ่ง react-query จะยัด
 * `variables` เข้ามาเป็นอาร์กิวเมนต์ที่สอง ถ้ารับ options ตรงนั้นจะอ่านผิดตัว
 */
export function useErrorToast() {
  const toastWithOptions = useErrorToastWithOptions();
  return useCallback(
    (err: unknown) => toastWithOptions(err),
    [toastWithOptions],
  );
}
