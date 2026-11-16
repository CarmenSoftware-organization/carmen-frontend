import { useGlDimensions } from "@/hooks/use-gl-dimensions";
import { useLicense } from "@/hooks/use-license";

/** feature key ของหน้า config dimension — ใช้เป็นตัวแทนว่า BU ซื้อ dimension */
const DIMENSION_LICENSE_FEATURE = "configuration.dimension";

/**
 * เปิดช่อง dimension ในบรรทัดเอกสารหรือไม่ — ต้องมี license feature
 * `configuration.dimension` **และ** BU มี dimension ที่ active อย่างน้อยหนึ่งตัว
 * false = ซ่อนช่องและไม่ส่ง `dimensions` ใน payload เลย
 */
export function useLineDimensionsEnabled(): boolean {
  const { isLicensed } = useLicense();
  const licensed = isLicensed(DIMENSION_LICENSE_FEATURE);
  // ไม่ยิง query ถ้าไม่มี license
  const dimensions = useGlDimensions(licensed);
  return licensed && (dimensions.data ?? []).some((d) => d.is_active);
}
