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
  now,
}: StorageQuotaBannerProps) {
  const t = useTranslations("storageQuota");
  const [, setTick] = useState(0);

  if (!usage.enforce || usage.exempt) return null;

  const full = usage.kinds.filter((k) => k.blocking || k.step === 0);
  if (full.length > 0) {
    return (
      <>
        {full.map((k) => (
          <FullBar key={k.kind} usage={k} now={now} />
        ))}
      </>
    );
  }

  if (!canManage) return null;

  const warn = usage.kinds
    .filter(
      (k) =>
        k.step !== null &&
        k.step !== 0 &&
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
        <KindAction kind={warn.kind} />
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

function KindAction({ kind }: { readonly kind: StorageKindUsage["kind"] }) {
  const t = useTranslations("storageQuota");
  if (kind === "database") return <span>{t("actionDatabase")}</span>;
  return (
    <span>
      {t("actionAttachment")}{" "}
      <Link to="/system-admin/storage" className="font-semibold underline">
        {t("openStoragePage")}
      </Link>
    </span>
  );
}

function FullBar({
  usage,
  now,
}: {
  readonly usage: StorageKindUsage;
  readonly now: number;
}) {
  const t = useTranslations("storageQuota");
  const kind = t(`kind.${usage.kind}`);

  let message: string;
  if (usage.blocking || !usage.grace_ends_at) {
    message = t("blocked", { kind });
  } else {
    const end = new Date(usage.grace_ends_at);
    const days = Math.max(0, Math.ceil((end.getTime() - now) / DAY_MS));
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
        <KindAction kind={usage.kind} />
      </p>
    </div>
  );
}

/**
 * ตัวเชื่อม `useStorageUsage()` กับ `StorageQuotaBanner` — mount ครั้งเดียวใน root-layout
 * ต่อจาก `SeatQuotaBannerHost` · โหลดไม่สำเร็จ = ไม่แสดงอะไร
 */
export function StorageQuotaBannerHost() {
  const { data } = useStorageUsage();
  const { can } = useCan();
  const [now] = useState(() => Date.now());

  if (!data) return null;
  return (
    <StorageQuotaBanner
      usage={data}
      canManage={can(PERMISSIONS.system_admin.view)}
      now={now}
    />
  );
}
