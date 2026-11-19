import { type ReactNode, useState } from "react";
import { ChefHat } from "lucide-react";
import { useTranslations } from "use-intl";
import { StatusDotBadge, type DotTone } from "@/components/ui/status-dot-badge";
import { cn } from "@/lib/utils";
import type { RecipePrimaryImage } from "@/types/recipe";

/** สถานะวงจรชีวิตของสูตร → สีจุด (ใช้ร่วมกับหัวฟอร์ม ให้สองที่ขึ้นสีเดียวกัน) */
export const RECIPE_STATUS_TONE: Record<string, DotTone> = {
  DRAFT: "info",
  PUBLISHED: "success",
  ARCHIVED: "warning",
};

/** "DRAFT" → `status.draft` · ค่าแปลกปลอมตกไปที่ draft */
export function recipeStatusKey(
  status: string | null | undefined,
): "draft" | "published" | "archived" {
  const k = status?.toLowerCase();
  return k === "published" || k === "archived" ? k : "draft";
}

export function RecipeStatusBadge({
  status,
  className,
  size = "xs",
}: {
  readonly status: string | null | undefined;
  readonly className?: string;
  /** ในคอลัมน์ของตารางส่ง `"sm"` — ชิปสถานะทุกตารางสูงเท่ากัน */
  readonly size?: "xs" | "sm";
}) {
  const ts = useTranslations("status");
  return (
    <StatusDotBadge
      tone={RECIPE_STATUS_TONE[status ?? ""] ?? "info"}
      size={size}
      className={className}
    >
      {ts(recipeStatusKey(status))}
    </StatusDotBadge>
  );
}

/**
 * รูปย่อของสูตรในแถว/การ์ด — ขนาดคงที่เสมอ ไม่มีรูปก็เว้นช่องเท่าเดิม
 * ให้ชื่อสูตรทุกแถวเริ่มที่คอลัมน์เดียวกัน
 *
 * url เป็น presigned ที่หมดอายุได้ (gateway ใส่ `expires_at`) โหลดไม่ขึ้นเมื่อไร
 * ถอยกลับเป็นช่องว่างแทนรูปแตก
 */
export function RecipeThumb({
  image,
  className,
}: {
  readonly image: RecipePrimaryImage | null | undefined;
  readonly className?: string;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const url = image?.url;
  const showImage = !!url && failedUrl !== url;

  return (
    <span
      className={cn(
        "bg-muted text-muted-foreground/50 flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-md",
        className,
      )}
    >
      {showImage ? (
        <img
          src={url}
          alt={image?.alt_text ?? ""}
          loading="lazy"
          className="size-full object-cover"
          onError={() => setFailedUrl(url)}
        />
      ) : (
        <ChefHat className="size-4" aria-hidden="true" />
      )}
    </span>
  );
}

/**
 * ภาพปกเต็มกว้างของการ์ดสูตร (สัดส่วน 4:3 คงที่ ทุกใบในกริดสูงเท่ากัน) — ไม่มีรูปหรือ
 * presigned url หมดอายุ = พื้นจางกับไอคอนหมวกเชฟ ไม่ใช่รูปแตก · `children` = ป้ายที่วางทับมุมภาพ
 */
export function RecipeCover({
  image,
  children,
}: {
  readonly image: RecipePrimaryImage | null | undefined;
  readonly children?: ReactNode;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const url = image?.url;
  const showImage = !!url && failedUrl !== url;

  return (
    <div className="bg-muted relative aspect-[4/3] w-full overflow-hidden">
      {showImage ? (
        <img
          src={url}
          alt={image?.alt_text ?? ""}
          loading="lazy"
          className="size-full object-cover"
          onError={() => setFailedUrl(url)}
        />
      ) : (
        <span className="text-muted-foreground/40 flex size-full items-center justify-center">
          <ChefHat className="size-12" aria-hidden="true" />
        </span>
      )}
      {children}
    </div>
  );
}

/**
 * Food cost % ของจริงเทียบเป้า — ตัวเลข + แถบสั้นที่มีขีดบอกตำแหน่งเป้า
 *
 * นี่คือตัวเลขที่คนคุมต้นทุนกวาดตาหาในหน้ารายการ: สูตรไหนกินต้นทุนเกินเป้า
 * เกินเป้าเท่านั้นที่ขึ้นสี (destructive ตรงกับข้อความ "Above target" ในหน้าฟอร์ม)
 * ส่วนสูตรที่ยังไม่ตั้งราคาขาย (actual = null) ขึ้น "—" ไม่ใช่ 0% ที่ดูเหมือนดีมาก
 *
 * แถบใช้สเกล 0–100% ตายตัว เพื่อให้ความยาวเทียบกันข้ามแถวได้
 */
export function RecipeFoodCostCell({
  actual,
  target,
  showBar = true,
}: {
  readonly actual: number | null | undefined;
  readonly target: number | null | undefined;
  /** false = ตัวเลขอย่างเดียว (คอลัมน์แคบในกล่องตารางแคบสุด) */
  readonly showBar?: boolean;
}) {
  if (actual == null) {
    return <span className="text-muted-foreground">—</span>;
  }
  const hasTarget = target != null && target > 0;
  const over = hasTarget && actual > target;
  const clamp = (n: number) => Math.min(Math.max(n, 0), 100);

  return (
    <span
      data-slot="recipe-food-cost"
      className="inline-flex items-center justify-end gap-2"
      title={hasTarget ? `${actual.toFixed(1)}% / ${target}%` : undefined}
    >
      {showBar && (
        <span
          className="bg-muted relative h-1.5 w-12 overflow-hidden rounded-full"
          aria-hidden="true"
        >
          <span
            className={cn(
              "absolute inset-y-0 left-0 rounded-full",
              over ? "bg-destructive" : "bg-muted-foreground/50",
            )}
            style={{ width: `${clamp(actual)}%` }}
          />
          {hasTarget && (
            <span
              className="bg-foreground absolute inset-y-0 w-px"
              style={{ left: `${clamp(target)}%` }}
            />
          )}
        </span>
      )}
      <span
        className={cn(
          "w-12 text-right tabular-nums",
          over && "text-destructive font-semibold",
        )}
      >
        {actual.toFixed(1)}%
      </span>
    </span>
  );
}
