import { useListReturn } from "@/hooks/use-list-return";
import { useTranslations } from "use-intl";
import { summarizeVariance } from "../shared/variance-summary";
import { toast } from "sonner";
import { useSubmitSpotCheck } from "./use-sc";
import { useUnit } from "@/hooks/use-unit";
import { useEntitiesByIds } from "@/hooks/use-entities-by-ids";
import type { Unit } from "@/types/unit";
import type {
  SpotCheckReviewData,
  SpotCheckReviewItem,
} from "@/types/spot-check";
import { ReviewComponent } from "../shared/review-component";
import { SC_LIST_PATHS } from "./sc-paths";

interface ScReviewComponentProps {
  readonly review: SpotCheckReviewData;
  readonly locationCode?: string;
  readonly locationName?: string;
  readonly onBack?: () => void;
}

/**
 * Spot Check Review screen — ใช้ data จาก PATCH response (ไม่ GET ซ้ำ)
 * แสดง KPI tiles (Matches/Variances/Overages/Shortages) + variance grid + final submit
 */
export function ScReviewComponent({
  review,
  locationCode,
  locationName,
  onBack,
}: ScReviewComponentProps) {
  const t = useTranslations("inventoryManagement.spotCheck");
  const { toList } = useListReturn(SC_LIST_PATHS);
  const submitSc = useSubmitSpotCheck(review.id);

  // ชื่อหน่วยเฉพาะที่แถว review อ้างถึง (ดึงตาม id)
  const { items: units } = useEntitiesByIds<Unit>({
    useListHook: useUnit,
    ids: review.items.map((it) => it.inventory_unit_id),
  });
  const unitNameById = new Map(units.map((u) => [u.id, u.name]));

  // matches/variances ใช้ตัวเลขจาก API ตามเดิม (backend นับจากชุดเต็ม ไม่ใช่แค่
  // แถวที่ส่งมาแสดง) ส่วนเกิน/ขาดแยกจากแถวที่มีอยู่ตรงนี้
  const { overages, shortages, varianceItems } = summarizeVariance(
    review.items,
    { getDiff: (it) => it.diff_qty },
  );

  const handleBack = () => {
    if (onBack) onBack();
    else toList();
  };

  const handleSubmit = () => {
    submitSc.mutate(
      { doc_version: review.doc_version },
      {
        onSuccess: () => {
          toast.success(t("submitSuccess"));
          toList();
        },
      },
    );
  };

  return (
    <ReviewComponent<SpotCheckReviewItem>
      translationNamespace="inventoryManagement.spotCheck"
      locationCode={locationCode}
      locationName={locationName}
      matches={review.matched}
      variances={review.variant}
      overages={overages}
      shortages={shortages}
      varianceItems={varianceItems}
      getSystemQty={(d) => d.inventory_qty}
      getActualQty={(d) => d.actual_qty}
      getVariance={(d) => d.diff_qty}
      getUnitName={(d) => unitNameById.get(d.inventory_unit_id) ?? ""}
      onBack={handleBack}
      onSubmit={handleSubmit}
      isSubmitting={submitSc.isPending}
      submitLabel={t("submitSpotCheck")}
      submittingLabel={t("submitting")}
    />
  );
}
