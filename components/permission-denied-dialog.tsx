import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "use-intl";
import { ShieldOff } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DeniedReasonIcon } from "@/components/permission-denied-icon";
import type { Permission } from "@/constant/permissions";
import { profileQueryKey } from "@/hooks/use-profile";
import type { UserProfile } from "@/types/profile";

export const PERMISSION_DENIED_EVENT = "permission-denied";

/**
 * ทำไมถึงเข้าไม่ได้ — สี่เหตุผลนี้ผู้ใช้แก้คนละวิธี จึงต้องบอกให้ตรง
 * - "permission": ไม่มีสิทธิ์ RBAC — ติดต่อผู้ดูแลขอสิทธิ์
 * - "license": feature ไม่อยู่ในสัญญาของ BU — ไม่ใช่เรื่องสิทธิ์ แก้ด้วยการซื้อ/เปิดสัญญา
 * - "expired": สัญญาหมดอายุ/ถูกระงับ — อ่านได้ เขียนไม่ได้ (บล็อกเฉพาะปุ่มเขียน)
 * - "seat": cluster มีผู้ใช้เกินจำนวนที่นั่งที่ซื้อไว้ (SEAT_LIMIT_EXCEEDED, Task 5.3) —
 *   อ่านได้ เขียนไม่ได้เหมือน "expired" แต่ทางแก้มีสองทาง (ปิดผู้ใช้ที่ไม่ใช้งาน หรือซื้อ
 *   ที่นั่งเพิ่ม) ต่างจาก "license"/"expired" ที่มีทางแก้เดียว — คำอธิบายจึงบอกทั้งสองทาง
 */
export type DeniedReason =
  "permission" | "license" | "expired" | "seat" | "storage";

/**
 * รายละเอียดประกอบที่ backend ส่งมากับ 403 ของ license — คีย์ feature ที่ขาดและหน่วยงานที่ถูกบล็อก
 *
 * ข้อความของ backend บอกแค่ "ยังไม่ได้เปิดใช้งานความสามารถนี้" ซึ่งผู้ดูแลเอาไปทำอะไรต่อไม่ได้
 * ถ้าไม่รู้ว่าเป็นความสามารถไหนของ BU ไหน (หนึ่งผู้ใช้มีได้หลาย BU และ dropdown ตัวเดียวก็ทำ
 * ให้เด้งได้) สองค่านี้คือสิ่งที่เอาไปสั่งงานฝ่ายขาย/ผู้ดูแลแพลตฟอร์มได้ตรงจุด
 */
export interface DeniedLicenseContext {
  feature?: string;
  buCodes?: string[];
  /** ชื่อหน่วยงานจาก gateway เรียงตรงดัชนีกับ `buCodes` — ไม่มีเมื่อ gateway ยังเป็นรุ่นก่อน */
  buNames?: string[];
}

interface PermissionDeniedDetail extends DeniedLicenseContext {
  permission?: Permission;
  message?: string;
  reason?: DeniedReason;
}

export function dispatchPermissionDenied(
  permission?: Permission,
  message?: string,
  reason: DeniedReason = "permission",
  context?: DeniedLicenseContext,
) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(PERMISSION_DENIED_EVENT, {
      detail: { permission, message, reason, ...context },
    }),
  );
}

export function PermissionDeniedDialog() {
  const [detail, setDetail] = useState<PermissionDeniedDetail | null>(null);
  const t = useTranslations("permissionDenied");
  const queryClient = useQueryClient();

  // ชื่อหน่วยงานมาจาก gateway โดยตรง (`bu_names`) เป็นทางหลัก — มันรู้จัก BU ทุกตัวของคำขอ
  // รวมตัวที่ไม่ได้อยู่ในโปรไฟล์ผู้ใช้ ส่วนการแปลงจาก profile เป็นทางสำรองสำหรับ gateway
  // รุ่นก่อนหน้าที่ยังไม่ส่งฟิลด์นี้ (FE ขึ้นก่อน BE ได้โดยไม่มีช่องว่างเปล่าให้ผู้ใช้เห็น)
  //
  // อ่าน profile ผ่าน `getQueryData` ไม่ใช่ `useProfile()` เพราะ dialog ตัวนี้ mount อยู่ใน
  // `Providers` ของทั้งแอป รวมหน้า login ที่ยังไม่มี session — การ subscribe query จะยิง
  // `/api/user/profile` ตั้งแต่หน้า login ซึ่งไม่ควรเกิด
  //
  // code ที่หาชื่อไม่เจอทั้งสองทางคืน code เดิม — ข้อมูลดิบยังดีกว่าไม่มีอะไรให้ผู้ใช้อ้างอิง
  const buNames =
    detail?.buNames ??
    detail?.buCodes?.map((code) => {
      const profile = queryClient.getQueryData<UserProfile>(profileQueryKey);
      return (
        profile?.business_unit.find((bu) => bu.code === code)?.name ?? code
      );
    });

  useEffect(() => {
    const handler = (e: CustomEvent<PermissionDeniedDetail>) => {
      setDetail(e.detail ?? {});
    };
    globalThis.window.addEventListener(
      PERMISSION_DENIED_EVENT,
      handler as EventListener,
    );
    return () => {
      globalThis.window.removeEventListener(
        PERMISSION_DENIED_EVENT,
        handler as EventListener,
      );
    };
  }, []);

  const reason = detail?.reason ?? "permission";
  const title =
    reason === "license"
      ? t("licenseTitle")
      : reason === "expired"
        ? t("expiredTitle")
        : reason === "seat"
          ? t("seatTitle")
          : reason === "storage"
            ? t("storageTitle")
            : t("title");
  const description =
    detail?.message ??
    (reason === "license"
      ? t("licenseDescription")
      : reason === "expired"
        ? t("expiredDescription")
        : reason === "seat"
          ? t("seatDescription")
          : reason === "storage"
            ? t("storageDescription")
            : t("description"));

  return (
    <AlertDialog
      open={!!detail}
      onOpenChange={(open) => !open && setDetail(null)}
    >
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogMedia>
            {reason === "permission" ? (
              <ShieldOff className="text-destructive" aria-hidden />
            ) : (
              <DeniedReasonIcon reason={reason} />
            )}
          </AlertDialogMedia>

          <AlertDialogTitle>{title}</AlertDialogTitle>

          <AlertDialogDescription>{description}</AlertDialogDescription>

          {/* คีย์ feature + หน่วยงานที่ถูกบล็อก: ข้อความด้านบนบอกแค่ "ความสามารถนี้" ซึ่งพอ
              เด้งจาก dropdown เสริมกลางหน้าแล้วไม่มีใครเดาถูกว่าเป็นตัวไหน บรรทัดนี้คือสิ่ง
              เดียวที่ทำให้ screenshot ใบเดียวพอสั่งงานต่อได้ — คีย์เป็นค่าดิบของระบบ จึงคง
              รูปเดิมใน <code> ไม่แปลและไม่ตัดทอน */}
          {(detail?.feature || detail?.buCodes) && (
            <div className="bg-muted/40 text-muted-foreground mt-1 space-y-0.5 rounded-md px-3 py-2 text-left text-xs">
              {detail.feature && (
                <p className="flex flex-wrap items-baseline gap-x-1.5">
                  <span>{t("featureLabel")}</span>
                  <code className="text-foreground font-mono break-all">
                    {detail.feature}
                  </code>
                </p>
              )}
              {buNames && (
                <p className="flex flex-wrap items-baseline gap-x-1.5">
                  <span>{t("buLabel")}</span>
                  <span className="text-foreground">{buNames.join(", ")}</span>
                </p>
              )}
            </div>
          )}

          {/* "ติดต่อผู้ดูแลระบบเพื่อขอสิทธิ์" เป็นทางแก้ของ reason "permission" เท่านั้น —
              "license" บอกให้ติดต่อฝ่ายขาย "expired" บอกให้ต่ออายุสัญญา และ "seat" บอกทั้ง
              สองทาง (ปิดผู้ใช้ที่ไม่ใช้งาน/ซื้อที่นั่งเพิ่ม) อยู่ในคำอธิบายด้านบนแล้วทุกกรณี
              การแปะบรรทัดนี้ทุก reason จึงขัดกันเอง */}
          {reason === "permission" && (
            <p className="text-muted-foreground/80 text-xs leading-relaxed">
              {t("contactAdmin")}
            </p>
          )}
        </AlertDialogHeader>

        {/* footer ของ size=sm เป็น grid-cols-2 — ปุ่มเดียวต้องบังคับให้อยู่กลาง */}
        <AlertDialogFooter className="flex! justify-center">
          <AlertDialogAction
            size="sm"
            variant="outline"
            onClick={() => setDetail(null)}
          >
            {t("close")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
