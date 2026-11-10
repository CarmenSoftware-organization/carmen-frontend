import { useTranslations } from "use-intl";
import { parseYoutubeVideoId, youtubeEmbedUrl } from "@/lib/youtube";

interface RecipeVideoPlayerProps {
  /** `recipe.video_url` — ไม่มี/ไม่ใช่ลิงก์ YouTube = ไม่แสดงอะไรเลย */
  readonly url: string | null | undefined;
  readonly recipeName: string;
}

/**
 * player YouTube บนสุดของหน้าสูตร (หน้าที่เปิดเมื่อกดการ์ดสูตร)
 *
 * - ไม่ autoplay — เบราว์เซอร์บล็อกเสียงอยู่แล้ว และครัวต้องการกดเล่นเองตอนพร้อม
 * - โดเมน youtube-nocookie.com ตรงกับ `frame-src` ใน CSP ของทุกปลายทาง deploy
 *   (lib/__tests__/security-headers.test.ts) เปลี่ยนโดเมนต้องแก้ CSP คู่กัน
 * - `referrerPolicy` ต้องส่ง origin ไป ไม่งั้น YouTube ตอบ "Error 153" (player ต้องรู้ว่าฝังจากเว็บไหน)
 */
export function RecipeVideoPlayer({ url, recipeName }: RecipeVideoPlayerProps) {
  const t = useTranslations("operationPlan.recipe");
  const id = parseYoutubeVideoId(url);
  if (!id) return null;
  return (
    <div className="bg-muted mb-4 aspect-video w-full overflow-hidden rounded-lg border">
      <iframe
        src={youtubeEmbedUrl(id)}
        title={t("videoTitle", { name: recipeName })}
        className="size-full"
        loading="lazy"
        allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
      />
    </div>
  );
}
