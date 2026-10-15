import { ApiError } from "@/lib/api-error";

/**
 * ตัวรับ error ที่ฟอร์มจองไว้ — คืน `true` เมื่อแสดง error ที่ช่องเองแล้ว
 * toast กลางจะได้ไม่ขึ้นซ้ำ
 */
export type FieldErrorClaim = (error: ApiError) => boolean;

const claims = new Set<FieldErrorClaim>();

/**
 * ให้ฟอร์มที่ mount อยู่จองรหัส catalog ไว้กับช่องของตัวเอง
 *
 * `MutationCache.onError` (ตัวยิง toast กลาง) รันก่อน `onError` ที่ส่งเข้า `mutate()`
 * ฟอร์มจึงห้าม toast จากในนั้นไม่ทัน — ต้องจองไว้ก่อนแบบนี้แทน
 *
 * @returns ฟังก์ชันยกเลิกการจอง (เรียกตอน unmount)
 */
export const registerFieldErrorClaim = (
  claim: FieldErrorClaim,
): (() => void) => {
  claims.add(claim);
  return () => {
    claims.delete(claim);
  };
};

/**
 * ส่ง error ให้ฟอร์มที่จองรหัสนั้นไว้ — ตัวที่ mount ทีหลังได้ก่อน (dialog ที่เปิดทับหน้า)
 *
 * @returns `true` เมื่อมีฟอร์มรับไปแสดงที่ช่องแล้ว
 */
export const claimFieldError = (error: unknown): boolean => {
  if (!(error instanceof ApiError) || !error.appCode) return false;
  for (const claim of [...claims].reverse()) {
    if (claim(error)) return true;
  }
  return false;
};
