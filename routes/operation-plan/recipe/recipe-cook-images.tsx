import { useState } from "react";
import { useTranslations } from "use-intl";
import { Play } from "lucide-react";
import { ImageLightbox } from "@/components/ui/image-lightbox";
import { cn } from "@/lib/utils";
import {
  parseYoutubeVideoId,
  youtubeEmbedUrl,
  youtubeThumbnailUrl,
} from "@/lib/youtube";

/** รูปที่แกลเลอรีแสดงได้ — ทั้งรูปของสูตร (RecipeImage) และรูปของขั้นตอน (RecipeStepImage ที่มี url) */
export interface CookImage {
  readonly id: string;
  readonly url: string;
  readonly alt_text: string | null;
  readonly sort_order: number;
  readonly is_primary: boolean;
}

interface RecipeCookImagesProps {
  /** รูปของสูตรจาก recipe detail หรือรูปของขั้นตอน — ไม่มี/ว่าง = ไม่แสดงอะไรเลย */
  readonly images: readonly CookImage[] | null | undefined;
  /** ชื่อสูตร/ชื่อขั้น — ใช้เป็นชื่อรูปเมื่อรูปไม่มี alt text */
  readonly recipeName: string;
  /** ชื่อของแถบรูปย่อที่ screen reader อ่าน — ไม่ส่ง = "รูปของสูตร" */
  readonly label?: string;
  /** แทนคลาสจัดความกว้างเริ่มต้น (ซึ่งผูกกับ hero ของหน้าสูตร) */
  readonly className?: string;
  /** ลิงก์ YouTube ของสูตร — มี = วิดีโอเป็นช่องแรกของแกลเลอรีแบบหน้าสินค้า Shopee (ไม่ใช่ลิงก์ YouTube = ไม่แสดง) */
  readonly videoUrl?: string | null;
  /** ชื่อของ player ที่ screen reader อ่าน เช่น "วิดีโอ: <ชื่อสูตร>" */
  readonly videoTitle?: string;
}

/** ช่องที่เปิดอยู่ในกรอบใหญ่ — วิดีโอ หรือรูปลำดับที่ n (นับเฉพาะรูป) */
type Selection = "video" | number;

/**
 * รูปของสูตรบนหน้าสูตร (หน้าที่เปิดเมื่อกดการ์ดสูตร) แบบหน้าสินค้า: รูปหลักสี่เหลี่ยมจัตุรัส + แถบรูปย่อ
 * ทั้งหมดอยู่ข้างใต้ เรียงตามลำดับที่จัดไว้ในฟอร์ม (sort_order) เริ่มที่รูปหลัก
 *
 * ความกว้างมาจากคอลัมน์ซ้ายของ hero ใน `RecipeCookView` (ต้องอยู่ใต้ `@container` ของหน้านั้น)
 * จอแคบที่ยังไม่แบ่งคอลัมน์ = จำกัดไว้ 20rem กลางแถว ไม่ขยายเต็มจอ
 *
 * ใช้ซ้ำกับรูปของขั้นตอน (ส่ง `label` + `className`) — กดแล้วได้ popup แบบเดียวกับรูปหลักของสูตร
 *
 * - กดรูปย่อ = เปลี่ยนรูปใหญ่
 * - กดรูปใหญ่ = popup เต็มจอของรูปนั้น (มีแถบรูปทั้งหมดด้านล่าง เลื่อนดูรูปอื่นต่อได้)
 * - มีวิดีโอ (`videoUrl`) = แบบหน้าสินค้า Shopee (ผู้ใช้สั่ง 2026-11-16 "เอา video ไปใส่ใน Menu"):
 *   วิดีโอเป็นช่องหลังรูปสุดท้ายของแถบรูปย่อ (ภาพตัวอย่าง + ไอคอนเล่น — ผู้ใช้สั่งย้ายจากช่องแรก)
 *   เปิดหน้ามาที่รูปหลักเหมือนเดิม กดช่องวิดีโอแล้วเล่นในกรอบใหญ่ · ไม่มีรูป = กรอบใหญ่เป็นวิดีโอเลย
 *   ไม่ autoplay · popup เปิดเฉพาะรูป · ตัวเลข "n / ทั้งหมด" และชื่อปุ่มนับเฉพาะรูป
 */
export function RecipeCookImages({
  images,
  recipeName,
  label,
  className,
  videoUrl,
  videoTitle,
}: RecipeCookImagesProps) {
  const t = useTranslations("operationPlan.recipe");
  const sorted = [...(images ?? [])].sort(
    (a, b) => a.sort_order - b.sort_order,
  );
  const total = sorted.length;
  const videoId = parseYoutubeVideoId(videoUrl);
  const [selected, setSelected] = useState<Selection>(() =>
    Math.max(
      sorted.findIndex((img) => img.is_primary),
      0,
    ),
  );
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const mediaTotal = total + (videoId ? 1 : 0);
  if (mediaTotal === 0) return null;

  // วิดีโอถูกลบ/รูปน้อยลงหลัง refetch — ให้ช่องที่เปิดอยู่มีอยู่จริงเสมอ
  const showVideo = !!videoId && (selected === "video" || total === 0);
  const active =
    selected === "video" ? 0 : Math.min(selected, Math.max(total - 1, 0));
  const names = sorted.map(
    (img, i) => img.alt_text || `${recipeName} (${i + 1}/${total})`,
  );
  const hero = sorted[active];

  return (
    <div
      className={
        className ?? "mx-auto w-full max-w-80 min-w-0 @lg:mx-0 @lg:max-w-none"
      }
    >
      {showVideo && videoId ? (
        // กรอบเดียวกับรูปใหญ่ (จัตุรัส) — player 16:9 มีแถบดำบนล่าง กดเต็มจอได้จากปุ่มของ YouTube
        // youtube-nocookie ตรงกับ frame-src ใน CSP · referrerPolicy ต้องส่ง origin ไม่งั้น YouTube ตอบ Error 153
        <div className="relative aspect-square w-full overflow-hidden rounded-lg border bg-black">
          <iframe
            src={youtubeEmbedUrl(videoId)}
            title={videoTitle ?? recipeName}
            className="size-full"
            loading="lazy"
            allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
      ) : (
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
      )}

      {mediaTotal > 1 && (
        <ul
          aria-label={label ?? t("cookImages")}
          // ขึ้นบรรทัดใหม่แทนเลื่อนแนวนอน — คอลัมน์รูปของขั้น (14rem) ใส่รูปย่อได้ 4 รูป รูปที่ 5 เคยหลบอยู่นอกกรอบ
          className="mt-2 flex flex-wrap gap-2 p-0.5"
        >
          {sorted.map((img, i) => (
            <li key={img.id} className="shrink-0">
              <button
                type="button"
                onClick={() => setSelected(i)}
                aria-label={t("cookShowImage", { n: i + 1, total })}
                aria-current={!showVideo && i === active}
                className={cn(
                  "bg-muted focus-visible:ring-ring block size-12 overflow-hidden rounded-md border transition-opacity focus-visible:ring-2 focus-visible:outline-none",
                  !showVideo && i === active
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
          {videoId && (
            <li className="shrink-0">
              <button
                type="button"
                onClick={() => setSelected("video")}
                aria-label={t("cookShowVideo")}
                aria-current={showVideo}
                className={cn(
                  "focus-visible:ring-ring relative block size-12 overflow-hidden rounded-md border bg-black transition-opacity focus-visible:ring-2 focus-visible:outline-none",
                  showVideo
                    ? "ring-primary ring-2 ring-offset-1"
                    : "opacity-70 hover:opacity-100",
                )}
              >
                <img
                  src={youtubeThumbnailUrl(videoId)}
                  alt=""
                  loading="lazy"
                  className="size-full object-cover"
                />
                {/* ไอคอนเล่นแบบหน้าสินค้า — บอกว่าช่องนี้เป็นวิดีโอ ไม่ใช่รูป */}
                <span className="absolute inset-0 flex items-center justify-center">
                  <span className="flex size-6 items-center justify-center rounded-full bg-black/60 text-white">
                    <Play className="size-3 fill-current" aria-hidden />
                  </span>
                </span>
              </button>
            </li>
          )}
        </ul>
      )}

      {total > 0 && (
        <ImageLightbox
          open={lightboxOpen}
          onClose={() => setLightboxOpen(false)}
          images={sorted.map((img, i) => ({
            src: img.url,
            fileName: names[i],
          }))}
          startIndex={active}
        />
      )}
    </div>
  );
}
