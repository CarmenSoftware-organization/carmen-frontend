import { Lock } from "lucide-react";
import { useTranslations } from "use-intl";
import { EyeBrow } from "@/components/ui/eye-brow";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * การ์ดหัวหน้า Company Profile — ตัวตนของ BU (โลโก้ · avatar · ชื่อ · alias) กับแถบ
 * "ค่าที่ล็อก" (Business Group · Costing Method · Default Currency)
 *
 * ค่าที่ล็อกถูกยกออกจาก grid ของฟอร์มมาไว้ที่นี่ทั้งหมด เดิมมันปนอยู่กับช่องที่แก้ได้
 * หน้าตาแทบเหมือนกัน กด Edit แล้วผู้ใช้ต้องลองคลิกถึงจะรู้ว่าช่องไหนแก้ไม่ได้
 * การ์ดนี้ read-only ทั้งใบ จึงโชว์เหมือนกันทั้งโหมดดูและโหมดแก้
 *
 * Branding (logo/avatar) เคยเป็น section แยกที่มีแค่สองรูปและแก้ไม่ได้ ย้ายมารวมที่นี่
 */
export function IdentityCard({
  name,
  alias,
  logoUrl,
  avatarUrl,
  facts,
}: {
  readonly name: string;
  readonly alias: string | null;
  readonly logoUrl: string | undefined;
  readonly avatarUrl: string | undefined;
  readonly facts: ReadonlyArray<{
    readonly label: string;
    readonly value: React.ReactNode;
  }>;
}) {
  const t = useTranslations("companyProfile");
  return (
    <section className="bg-card overflow-hidden rounded-xl border shadow-sm">
      {/* ชื่อนำ รูปตาม — BU ส่วนใหญ่ยังไม่มีโลโก้ ถ้ารูปอยู่หน้า ช่องว่าง "No image"
          สองช่องจะเป็นสิ่งที่เด่นที่สุดของหน้า แทนชื่อของ BU */}
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold tracking-tight break-words">
            {name}
          </h2>
          {alias && (
            <p className="text-muted-foreground mt-0.5 font-mono text-xs">
              {alias}
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-3">
          <BrandImage
            url={logoUrl}
            shape="landscape"
            label={t("fields.logo")}
          />
          <BrandImage
            url={avatarUrl}
            shape="round"
            label={t("fields.avatar")}
          />
        </div>
      </div>
      <dl className="bg-muted/40 grid border-t sm:grid-cols-3">
        {facts.map((f, i) => (
          <div
            key={f.label}
            className={cn(
              "min-w-0 px-4 py-2",
              i > 0 && "border-t sm:border-t-0 sm:border-l",
            )}
          >
            <dt className="flex items-center gap-1.5">
              <EyeBrow>{f.label}</EyeBrow>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label={t("identity.lockedHint")}
                    className="text-muted-foreground/70 hover:text-foreground -m-1 rounded p-1"
                  >
                    <Lock className="size-3" aria-hidden />
                  </button>
                </TooltipTrigger>
                <TooltipContent>{t("identity.lockedHint")}</TooltipContent>
              </Tooltip>
            </dt>
            <dd className="mt-0.5 truncate text-sm font-medium">
              {f.value ?? <span className="text-muted-foreground">—</span>}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function IdentityCardSkeleton() {
  return (
    <div className="bg-card overflow-hidden rounded-xl border shadow-sm">
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-3 w-16" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-12 w-48 rounded-md" />
          <Skeleton className="size-12 rounded-full" />
        </div>
      </div>
      <div className="grid gap-4 border-t px-4 py-2 sm:grid-cols-3">
        <Skeleton className="h-9" />
        <Skeleton className="h-9" />
        <Skeleton className="h-9" />
      </div>
    </div>
  );
}

function BrandImage({
  url,
  shape,
  label,
}: {
  readonly url: string | undefined;
  readonly shape: "landscape" | "round";
  readonly label: string;
}) {
  const t = useTranslations("companyProfile");
  // โลโก้ช่องว่างเป็น 4:1 (h-12 w-48) — มีรูปแล้วสูงเท่าเดิม กว้างตามสัดส่วนรูป ไม่เกิน 4:1
  const box =
    shape === "landscape"
      ? cn(url ? "h-12 w-auto max-w-48 min-w-12" : "h-12 w-48", "rounded-md")
      : "size-12 rounded-full";
  const imageClass =
    shape === "landscape"
      ? "h-full w-auto max-w-full object-contain"
      : "absolute inset-0 size-full object-cover";
  return (
    <div
      className={cn(
        "relative flex items-center justify-center overflow-hidden border",
        // ช่องว่าง = เส้นประ ไม่ถมสี ให้อ่านเป็น "ที่ว่างรอรูป" ไม่ใช่รูปสีเทา
        url ? "bg-muted/50" : "border-dashed",
        box,
      )}
      title={label}
    >
      {url ? (
        <img src={url} alt={label} className={imageClass} loading="lazy" />
      ) : shape === "round" ? null : (
        // วงกลม 48px ใส่ "No image" แล้วตัดสองบรรทัด — เส้นประกับ title บอกพอแล้ว
        <span className="text-muted-foreground/60 text-micro-legal px-1 text-center">
          {t("noImage")}
        </span>
      )}
    </div>
  );
}
