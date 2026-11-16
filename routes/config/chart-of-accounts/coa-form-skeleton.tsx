import { FormPageHeaderSkeleton } from "@/components/loader/form-page-skeleton";
import { CompactSectionSkeleton } from "@/components/share/compact-section";
import { FormPageShell } from "@/components/share/form-page-shell";

/**
 * การ์ดคู่ของหน้านี้จับคู่ตามความกว้างของฟอร์มเอง (≥1024px) ไม่ใช่ `SECTION_PAIR` กลางที่รอจอ
 * 1700px — ผู้ใช้สั่งเฉพาะหน้านี้ (2026-11-16): สี่หมวดล่างมีเนื้อหาบรรทัดเดียว เรียงซ้อนเต็ม
 * ความกว้างที่จอ 1366 แล้วโล่ง · ต้องอยู่ใต้ ancestor ที่เป็น `@container` (ตัว `<form>`)
 */
export const COA_SECTION_PAIR = "@5xl:grid @5xl:grid-cols-2 @5xl:gap-x-5";

/** โครงเดียวกับ `CoaForm`: ข้อมูลบัญชี · กลุ่ม | Cost Center · Dimension | อ้างอิงภายนอก */
export function CoaFormSkeleton() {
  return (
    <FormPageShell width="wide" header={<FormPageHeaderSkeleton />}>
      <div aria-busy="true" className="@container">
        <CompactSectionSkeleton first className="h-28" />
        <div className={COA_SECTION_PAIR}>
          <CompactSectionSkeleton className="h-14" />
          <CompactSectionSkeleton className="h-14" />
        </div>
        <div className={COA_SECTION_PAIR}>
          <CompactSectionSkeleton className="h-14" />
          <CompactSectionSkeleton className="h-14" />
        </div>
      </div>
    </FormPageShell>
  );
}
