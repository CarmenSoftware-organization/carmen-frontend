import { useState } from "react";
import { Link } from "react-router";
import { HardDrive, TriangleAlert, X } from "lucide-react";
import { useTranslations } from "use-intl";
import { Button } from "@/components/ui/button";
import { PERMISSIONS } from "@/constant/permissions";
import { useCan } from "@/hooks/use-can";
import { useStorageUsage } from "@/hooks/use-storage-usage";
import type { BuStorageUsage, StorageKindUsage } from "@/types/storage-usage";

const DAY_MS = 24 * 60 * 60 * 1000;

/** ขั้นเตือนที่ขึ้นแถบเหลือง เรียงจากหนักสุด (เหลือน้อยสุด) */
const WARN_STEPS = [3, 5, 10, 20] as const;

const dismissKey = (buCode: string, kind: string, step: number) =>
  `storage-banner:${buCode}:${kind}:${step}`;

function isDismissed(buCode: string, kind: string, step: number): boolean {
  try {
    return (
      globalThis.localStorage.getItem(dismissKey(buCode, kind, step)) === "1"
    );
  } catch {
    return false;
  }
}

function rememberDismissed(buCode: string, kind: string, step: number) {
  try {
    globalThis.localStorage.setItem(dismissKey(buCode, kind, step), "1");
  } catch {
    // storage ใช้ไม่ได้ (private window ฯลฯ) — ปิดได้แค่ในหน้านี้
  }
}

interface StorageQuotaBannerProps {
  readonly usage: BuStorageUsage;
  /** ผู้ใช้มี `system_admin.view` — แถบเหลืองขึ้นเฉพาะคนกลุ่มนี้ */
  readonly canManage: boolean;
  /** ผู้ใช้เปิด /system-admin/storage ได้ — ลิงก์ขึ้นเฉพาะคนกลุ่มนี้ */
  readonly canOpenStorage: boolean;
  /** เวลาปัจจุบัน (ms) — ส่งจากผู้เรียกเพื่อให้ render บริสุทธิ์ */
  readonly now: number;
}

/**
 * แถบเตือนพื้นที่เก็บข้อมูลของ BU (database / ไฟล์แนบ) — สองสถานะ ไม่ทับกัน
 *
 * **แดง (เต็มโควตา: อยู่ในช่วงผ่อนผันหรือบล็อกแล้ว)** — ทุกคนเห็น ไม่มีปุ่มปิด เพราะคนที่
 * สร้างเอกสาร/แนบไฟล์ไม่ได้ต้องรู้ว่าทำไม · พื้นแดงทึบเป็นข้อยกเว้นโดยเจตนาเหมือน
 * `SeatQuotaBanner`
 *
 * **เหลือง (เหลือ 20/10/5/3 %)** — เฉพาะผู้มี `system_admin.view` ปิดได้ จำการปิดต่อ
 * BU+ชนิด+ขั้น ใน localStorage (ขั้นแย่ลงแล้วแถบกลับมา)
 *
 * ไม่ render อะไรเมื่อ `enforce` ปิด — ระหว่างวัดอย่างเดียวผู้ใช้ไม่ต้องเห็นอะไร
 */
export function StorageQuotaBanner({
  usage,
  canManage,
  canOpenStorage,
  now,
}: StorageQuotaBannerProps) {
  const t = useTranslations("storageQuota");
  const [, setTick] = useState(0);

  if (!usage.enforce) return null;

  // แดงเฉพาะ BU ที่ไม่ถูกยกเว้น และ kind ที่ไม่มี flag (BU แบบ shared/null schema backend ไม่เคยบล็อก)
  // exempt/flagged ที่เต็มยังได้เหลืองให้แอดมิน
  const redKinds = usage.exempt
    ? []
    : usage.kinds.filter(
        (k) => k.flag === null && (k.blocking || k.step === 0),
      );
  const full = redKinds;
  if (full.length > 0) {
    return (
      <>
        {full.map((k) => (
          <FullBar
            key={k.kind}
            usage={k}
            now={now}
            canOpenStorage={canOpenStorage}
          />
        ))}
      </>
    );
  }

  if (!canManage) return null;

  const warn = usage.kinds
    .filter(
      (k) =>
        k.step !== null &&
        !redKinds.includes(k) &&
        !isDismissed(usage.bu_code, k.kind, k.step),
    )
    .sort(
      (a, b) =>
        WARN_STEPS.indexOf(a.step as (typeof WARN_STEPS)[number]) -
        WARN_STEPS.indexOf(b.step as (typeof WARN_STEPS)[number]),
    )[0];
  if (!warn || warn.step === null) return null;
  const step = warn.step;

  return (
    <div
      role="alert"
      className="bg-muted flex items-center justify-center gap-2 border-b px-4 py-2 text-xs"
    >
      <TriangleAlert className="text-warning-ink size-4 shrink-0" aria-hidden />
      <span className="text-muted-foreground">
        {t("warn", { kind: t(`kind.${warn.kind}`), pct: step })}{" "}
        <KindAction kind={warn.kind} canOpenStorage={canOpenStorage} />
      </span>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={t("dismiss")}
        onClick={() => {
          rememberDismissed(usage.bu_code, warn.kind, step);
          setTick((n) => n + 1);
        }}
      >
        <X className="size-3.5" aria-hidden />
      </Button>
    </div>
  );
}

function KindAction({
  kind,
  canOpenStorage,
}: {
  readonly kind: StorageKindUsage["kind"];
  readonly canOpenStorage: boolean;
}) {
  const t = useTranslations("storageQuota");
  if (kind === "database") return <span>{t("actionDatabase")}</span>;
  return (
    <span>
      {t("actionAttachment")}
      {canOpenStorage && (
        <>
          {" "}
          <Link to="/system-admin/storage" className="font-semibold underline">
            {t("openStoragePage")}
          </Link>
        </>
      )}
    </span>
  );
}

function FullBar({
  usage,
  now,
  canOpenStorage,
}: {
  readonly usage: StorageKindUsage;
  readonly now: number;
  readonly canOpenStorage: boolean;
}) {
  const t = useTranslations("storageQuota");
  const kind = t(`kind.${usage.kind}`);

  let message: string;
  if (usage.blocking) {
    message = t("blocked", { kind });
  } else if (!usage.grace_ends_at) {
    // เต็มแต่ยังไม่เริ่มนับผ่อนผัน (วัดตอนสวิตช์ enforce ปิด) — ห้ามบอกว่าหยุดแล้ว
    message = t("overQuota", { kind });
  } else {
    const end = new Date(usage.grace_ends_at);
    // ยังไม่บล็อก = อย่างน้อย 1 วัน ไม่โชว์ "0 วัน"
    const days = Math.max(1, Math.ceil((end.getTime() - now) / DAY_MS));
    message = t("grace", {
      kind,
      days,
      date: end.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      }),
    });
  }

  return (
    <div
      role="alert"
      className="bg-destructive text-destructive-foreground flex items-start justify-center gap-2.5 px-4 py-2.5 text-sm sm:items-center"
    >
      <HardDrive className="mt-0.5 size-4 shrink-0 sm:mt-0" aria-hidden />
      <p className="min-w-0">
        <span className="font-semibold">{message}</span>{" "}
        <KindAction kind={usage.kind} canOpenStorage={canOpenStorage} />
      </p>
    </div>
  );
}

/**
 * ตัวเชื่อม `useStorageUsage()` กับ `StorageQuotaBanner` — mount ครั้งเดียวใน root-layout
 * ต่อจาก `SeatQuotaBannerHost` · โหลดไม่สำเร็จ = ไม่แสดงอะไร
 */
export function StorageQuotaBannerHost() {
  const { data, dataUpdatedAt } = useStorageUsage();
  const { can } = useCan();

  if (!data) return null;
  return (
    <StorageQuotaBanner
      usage={data}
      canManage={can(PERMISSIONS.system_admin.view)}
      canOpenStorage={can(PERMISSIONS.system_admin.document.view)}
      now={dataUpdatedAt}
    />
  );
}
