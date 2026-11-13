import { useState } from "react";
import { useTranslations } from "use-intl";
import { ImageLightbox } from "@/components/ui/image-lightbox";
import type { RecipeImage } from "@/types/recipe";

interface RecipeCookImagesProps {
  /** รูปของสูตรจาก recipe detail — ไม่มี/ว่าง = ไม่แสดงอะไรเลย */
  readonly images: readonly RecipeImage[] | null | undefined;
  /** ชื่อสูตร — ใช้เป็นชื่อรูปใน popup เมื่อรูปไม่มี alt text */
  readonly recipeName: string;
}

/**
 * รูปของสูตรบนหน้าสูตร (หน้าที่เปิดเมื่อกดการ์ดสูตร) — แถบรูปย่ออยู่บนสุดของคอลัมน์ขั้นตอน
 * เรียงตามลำดับที่จัดไว้ในฟอร์ม (sort_order) กดรูปไหน popup เปิดรูปนั้นขนาดใหญ่ เลื่อนดูรูปอื่นต่อได้
 */
export function RecipeCookImages({
  images,
  recipeName,
}: RecipeCookImagesProps) {
  const t = useTranslations("operationPlan.recipe");
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const sorted = [...(images ?? [])].sort(
    (a, b) => a.sort_order - b.sort_order,
  );
  if (sorted.length === 0) return null;

  const total = sorted.length;
  const lightboxImages = sorted.map((img, i) => ({
    src: img.url,
    fileName: img.alt_text || `${recipeName} (${i + 1}/${total})`,
  }));

  return (
    <>
      <ul
        aria-label={t("cookImages")}
        className="mb-4 flex gap-2 overflow-x-auto pb-1"
      >
        {sorted.map((img, i) => (
          <li key={img.id} className="shrink-0">
            <button
              type="button"
              onClick={() => setOpenIndex(i)}
              aria-label={t("cookViewImage", { n: i + 1, total })}
              className="bg-muted focus-visible:ring-ring block size-24 cursor-zoom-in overflow-hidden rounded-lg border transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:outline-none md:size-28"
            >
              <img
                src={img.url}
                alt={img.alt_text ?? ""}
                loading="lazy"
                className="size-full object-cover"
              />
            </button>
          </li>
        ))}
      </ul>
      <ImageLightbox
        open={openIndex !== null}
        onClose={() => setOpenIndex(null)}
        images={lightboxImages}
        startIndex={openIndex ?? 0}
      />
    </>
  );
}
