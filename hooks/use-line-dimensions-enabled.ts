import { useGlDimensions } from "@/hooks/use-gl-dimensions";
import { useLicense } from "@/hooks/use-license";
import { getRuntimeConfig } from "@/lib/runtime-config";

/** feature key ของหน้า config dimension — ใช้เป็นตัวแทนว่า BU ซื้อ dimension */
const DIMENSION_LICENSE_FEATURE = "configuration.dimension";

/**
 * สวิตช์ `LINE_DIMENSIONS_ENABLED` ของ runtime config แบบไม่ throw — config ยังไม่โหลด
 * (เทสต์ / render ก่อน boot) ให้ผลเหมือนไม่มีคีย์ = ปิด
 */
function isLineDimensionsSwitchOn(): boolean {
  try {
    return getRuntimeConfig().LINE_DIMENSIONS_ENABLED ?? false;
  } catch {
    return false;
  }
}

/**
 * เปิดช่อง dimension ในบรรทัดเอกสารหรือไม่ — ต้องครบทั้งสามข้อ:
 * สวิตช์ runtime `LINE_DIMENSIONS_ENABLED` เปิด (ยังไม่พร้อมขาย ค่าเริ่มต้นปิด),
 * มี license feature `configuration.dimension` และ BU มี dimension ที่ active อย่างน้อยหนึ่งตัว
 * false = ซ่อนช่องและไม่ส่ง `dimensions` ใน payload เลย
 */
export function useLineDimensionsEnabled(): boolean {
  const { isLicensed } = useLicense();
  const licensed =
    isLineDimensionsSwitchOn() && isLicensed(DIMENSION_LICENSE_FEATURE);
  // ไม่ยิง query ถ้าสวิตช์ปิดหรือไม่มี license
  const dimensions = useGlDimensions(licensed);
  return licensed && (dimensions.data ?? []).some((d) => d.is_active);
}
