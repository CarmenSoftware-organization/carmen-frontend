import { useState } from "react";
import { useTranslations } from "use-intl";
import { ImageLightbox } from "@/components/ui/image-lightbox";
import { cn } from "@/lib/utils";
import type { RecipeImage } from "@/types/recipe";

interface RecipeCookImagesProps {
  /** รูปของสูตรจาก recipe detail — ไม่มี/ว่าง = ไม่แสดงอะไรเลย */
  readonly images: readonly RecipeImage[] | null | undefined;
  /** ชื่อสูตร — ใช้เป็นชื่อรูปเมื่อรูปไม่มี alt text */
  readonly recipeName: string;
}

/**
 * รูปของสูตรบนหน้าสูตร (หน้าที่เปิดเมื่อกดการ์ดสูตร) แบบหน้าสินค้า: รูปหลักสี่เหลี่ยมจัตุรัส + แถบรูปย่อ
 * ทั้งหมดอยู่ข้างใต้ เรียงตามลำดับที่จัดไว้ในฟอร์ม (sort_order) เริ่มที่รูปหลัก
 *
 * ความกว้างมาจากคอลัมน์ซ้ายของ hero ใน `RecipeCookView` (ต้องอยู่ใต้ `@container` ของหน้านั้น)
 * จอแคบที่ยังไม่แบ่งคอลัมน์ = จำกัดไว้ 20rem กลางแถว ไม่ขยายเต็มจอ
 *
 * - กดรูปย่อ = เปลี่ยนรูปใหญ่
 * - กดรูปใหญ่ = popup เต็มจอของรูปนั้น (มีแถบรูปทั้งหมดด้านล่าง เลื่อนดูรูปอื่นต่อได้)
 */
export function RecipeCookImages({
  images,
  recipeName,
}: RecipeCookImagesProps) {
  const t = useTranslations("operationPlan.recipe");
  const sorted = [...(images ?? [])].sort(
    (a, b) => a.sort_order - b.sort_order,
  );
  const total = sorted.length;
  const [selected, setSelected] = useState(() =>
    Math.max(
      sorted.findIndex((img) => img.is_primary),
      0,
    ),
  );
  const [lightboxOpen, setLightboxOpen] = useState(false);

  if (total === 0) return null;

  // refetch อาจได้รูปน้อยลง — ให้ index อยู่ในช่วงเสมอ
  const active = Math.min(selected, total - 1);
  const names = sorted.map(
    (img, i) => img.alt_text || `${recipeName} (${i + 1}/${total})`,
  );
  const hero = sorted[active];

  return (
    <div className="mx-auto w-full max-w-80 min-w-0 @lg:mx-0 @lg:max-w-none">
      <button
        type="button"
        onClick={() => setLightboxOpen(true)}
        aria-label={t("cookViewImage", { n: active + 1, total })}
        className="bg-muted focus-visible:ring-ring relative flex aspect-square w-full cursor-zoom-in items-center justify-center overflow-hidden rounded-lg border focus-visible:ring-2 focus-visible:outline-none"
      >
        <img
          src={hero.url}
          alt={names[active]}
          className="size-full object-contain"
        />
        {total > 1 && (
          <span className="bg-foreground/70 text-background text-micro-legal absolute top-2 right-2 rounded px-2 py-0.5 tabular-nums">
            {active + 1} / {total}
          </span>
        )}
      </button>

      {total > 1 && (
        <ul
          aria-label={t("cookImages")}
          className="mt-2 flex gap-2 overflow-x-auto p-0.5"
        >
          {sorted.map((img, i) => (
            <li key={img.id} className="shrink-0">
              <button
                type="button"
                onClick={() => setSelected(i)}
                aria-label={t("cookShowImage", { n: i + 1, total })}
                aria-current={i === active}
                className={cn(
                  "bg-muted focus-visible:ring-ring block size-12 overflow-hidden rounded-md border transition-opacity focus-visible:ring-2 focus-visible:outline-none",
                  i === active
                    ? "ring-primary ring-2 ring-offset-1"
                    : "opacity-70 hover:opacity-100",
                )}
              >
                <img
                  src={img.url}
                  alt=""
                  loading="lazy"
                  className="size-full object-cover"
                />
              </button>
            </li>
          ))}
        </ul>
      )}

      <ImageLightbox
        open={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        images={sorted.map((img, i) => ({ src: img.url, fileName: names[i] }))}
        startIndex={active}
      />
    </div>
  );
}
