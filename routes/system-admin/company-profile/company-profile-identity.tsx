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
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:p-6">
        <div className="flex shrink-0 items-center gap-3">
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
        <div className="min-w-0">
          <h2 className="text-lg font-semibold tracking-tight break-words">
            {name}
          </h2>
          {alias && (
            <p className="text-muted-foreground font-mono text-xs">{alias}</p>
          )}
        </div>
      </div>
      <dl className="bg-muted/40 grid border-t sm:grid-cols-3">
        {facts.map((f, i) => (
          <div
            key={f.label}
            className={cn(
              "min-w-0 px-5 py-3 sm:px-6",
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
            <dd className="mt-1 truncate text-sm font-medium">
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
      <div className="flex items-center gap-4 p-5 sm:p-6">
        <Skeleton className="h-16 w-32 rounded-md" />
        <Skeleton className="size-16 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-3 w-16" />
        </div>
      </div>
      <div className="grid gap-4 border-t px-5 py-3 sm:grid-cols-3 sm:px-6">
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
  const box =
    shape === "landscape" ? "h-16 w-32 rounded-md" : "size-16 rounded-full";
  const fit = shape === "landscape" ? "object-contain" : "object-cover";
  return (
    <div
      className={cn(
        "bg-muted/50 relative flex items-center justify-center overflow-hidden border",
        box,
      )}
      title={label}
    >
      {url ? (
        <img
          src={url}
          alt={label}
          className={cn("absolute inset-0 size-full", fit)}
          loading="lazy"
        />
      ) : (
        <span className="text-muted-foreground/60 text-micro-legal px-1 text-center">
          {t("noImage")}
        </span>
      )}
    </div>
  );
}
