import { useBusinessUnit } from "@/hooks/use-business-unit";
import { useGlDimensions } from "@/hooks/use-gl-dimensions";
import { useLicense } from "@/hooks/use-license";
import { useProfile } from "@/hooks/use-profile";
import {
  lineDimensionScope,
  type LineDimensionDocType,
} from "@/lib/line-dimension-scope";

/** feature key ของหน้า config dimension — ใช้เป็นตัวแทนว่า BU ซื้อ dimension */
const DIMENSION_LICENSE_FEATURE = "configuration.dimension";

/**
 * เปิดช่อง dimension ในบรรทัดเอกสารชนิดนี้หรือไม่ — ต้องครบทั้งสามข้อ:
 * config ของ BU เปิดให้เอกสารชนิดนี้ (`dimension.start-from` / `dimension.sr|ia.enabled`),
 * มี license feature `configuration.dimension` และ BU มี dimension ที่ active อย่างน้อยหนึ่งตัว
 * false = ซ่อนช่องและไม่ส่ง `dimensions` ใน payload เลย
 *
 * @param docType - ชนิดเอกสาร
 */
export function useLineDimensionsEnabled(
  docType: LineDimensionDocType,
): boolean {
  const { isLicensed } = useLicense();
  const { defaultBu } = useProfile();
  const { data: businessUnit } = useBusinessUnit(defaultBu?.id);
  const inScope = lineDimensionScope(businessUnit?.config)[docType];
  const licensed = inScope && isLicensed(DIMENSION_LICENSE_FEATURE);
  // ไม่ยิง query ถ้าเอกสารนี้ปิดหรือไม่มี license
  const dimensions = useGlDimensions(licensed);
  return licensed && (dimensions.data ?? []).some((d) => d.is_active);
}
