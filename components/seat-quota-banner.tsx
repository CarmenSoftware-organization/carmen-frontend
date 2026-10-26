import { TriangleAlert, Users } from "lucide-react";
import { useTranslations } from "use-intl";
import { useLicense } from "@/hooks/use-license";
import type { SeatExpiringSoon } from "@/hooks/use-license";
import type { BusinessUnitSeat } from "@/types/license";

interface SeatQuotaBannerProps {
  readonly seat: BusinessUnitSeat;
  readonly expiringSoon?: SeatExpiringSoon | null;
}

/**
 * แถบเตือนโควตาที่นั่งของ cluster ที่ BU ปัจจุบันสังกัด — สองสถานะ ไม่ทับกัน
 *
 * **แดง (เกินโควตาแล้ว)** — แสดงให้ **ทุกคน** เห็น ไม่ใช่แค่แอดมิน: ผู้ใช้ทั่วไปที่กด
 * บันทึกไม่ได้ต้องรู้ว่าทำไม เจอ 403 เฉย ๆ โดยไม่มีคำอธิบายคือเวอร์ชันที่แย่ที่สุด — ค้างอยู่
 * เสมอ ไม่มีปุ่มปิด (เหมือน `LicenseExpiredBanner`)
 *
 * **เหลือง (ใกล้หมดอายุ)** — ขึ้นเฉพาะตอนที่การหมดอายุนั้น**จะทำให้เจ็บจริง**เท่านั้น คือ
 * `used > cap - expiringSoon.seats` — ลูกค้าที่ซื้อเผื่อไว้เยอะ (เหลือ headroom พอหลังใบหมด)
 * ต้องไม่เห็นอะไรเลย ไม่งั้นแถบเหลืองที่ขึ้นพร่ำเพรื่อจะทำให้คนเมินแถบแดงตัวจริงไปด้วย
 *
 * แดงชนะเหลืองเสมอเมื่อเข้าเงื่อนไขทั้งคู่ — สถานการณ์เกิดขึ้นแล้วจริง ไม่ใช่แค่คาดการณ์
 *
 * เป็น component บริสุทธิ์ (props เข้า, JSX ออก) ไม่เรียก `useLicense()` เอง — เทียบเท่า
 * `resolveLicense` ที่แยกออกจาก `useLicense` เพื่อเทสต์ตรง ๆ ได้โดยไม่ต้อง mock hook/provider
 * ใด ๆ ผู้เรียกจริง (root-layout) ใช้ `SeatQuotaBannerHost` ด้านล่างซึ่งอ่าน `useLicense()`
 * และเช็ค `enforced` ให้ก่อนส่งต่อ props มาที่นี่
 *
 * สี: แถบเหลืองใช้ neutral bg + สีที่ไอคอนจุดเดียว (docs/DESIGN.md "avoid neon" — ตัวเดียวกับ
 * `LicenseExpiredBanner` และ `Toaster`) แต่ **แถบแดงเป็นข้อยกเว้นโดยเจตนา: พื้นแดงทึบทั้งแถบ**
 * (ตัดสิน 2026-10-26) — แบบเทาเดิมเงียบจนผู้ใช้มองข้าม ทั้งที่บันทึกอะไรไม่ได้ทั้ง cluster และคนที่
 * แก้ได้คือ admin ของ BU / cluster ไม่ใช่ตัวผู้ใช้ แถบจึงต้องดังพอให้ผู้ใช้ไปกดดัน admin และบอกชื่อ
 * คนที่ต้องไปหา สียังเป็นสัญญาณเดียว (พื้นแถบ) ตัวอักษร/ไอคอนใช้ `destructive-foreground`
 */
export function SeatQuotaBanner({ seat, expiringSoon }: SeatQuotaBannerProps) {
  const t = useTranslations("license");
  const overQuota = seat.used > seat.cap;

  if (overQuota) {
    return (
      <div
        role="alert"
        className="bg-destructive text-destructive-foreground flex items-start justify-center gap-2.5 px-4 py-2.5 text-sm sm:items-center"
      >
        <Users className="mt-0.5 size-4 shrink-0 sm:mt-0" aria-hidden />
        <p className="min-w-0">
          <span className="font-semibold">
            {t("seatOverQuota", { used: seat.used, cap: seat.cap })}
          </span>{" "}
          <span>{t("seatOverQuotaAction")}</span>
        </p>
      </div>
    );
  }

  // เตือนเฉพาะตอนที่การหมดอายุจะทำให้ pool ที่เหลือต่ำกว่าคนที่ใช้อยู่จริง
  if (expiringSoon && seat.used > seat.cap - expiringSoon.seats) {
    const formatted = new Date(expiringSoon.date).toLocaleDateString(
      undefined,
      { year: "numeric", month: "short", day: "numeric" },
    );
    return (
      <div
        role="alert"
        className="bg-muted flex items-center justify-center gap-2 border-b px-4 py-2 text-xs"
      >
        <TriangleAlert
          className="text-warning-ink size-4 shrink-0"
          aria-hidden
        />
        <span className="text-muted-foreground">
          {t("seatExpiringSoon", {
            seats: expiringSoon.seats,
            date: formatted,
            used: seat.used,
            remaining: seat.cap - expiringSoon.seats,
          })}
        </span>
      </div>
    );
  }

  return null;
}

/**
 * ตัวเชื่อม `useLicense()` เข้ากับ `SeatQuotaBanner` — mount ครั้งเดียวใน root-layout เหมือน
 * `LicenseExpiredBanner`
 *
 * เช็ค `enforced` เอง (ไม่ใช่หน้าที่ของ `overQuota`/`expiringSoon` ที่เป็นสัญญาณดิบ ดู doc
 * ใน `hooks/use-license.ts`) — ไม่งั้นแถบแดง "บันทึกไม่ได้" จะโผล่ตอน shadow mode ทั้งที่
 * backend ยังไม่บล็อกอะไรจริง เหมือนเหตุผลเดียวกับที่ `LicenseExpiredBanner` เช็ค `enforced`
 */
export function SeatQuotaBannerHost() {
  const { enforced, seat, expiringSoon } = useLicense();

  if (!enforced || !seat) return null;

  return <SeatQuotaBanner seat={seat} expiringSoon={expiringSoon} />;
}
