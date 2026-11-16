import type { DimensionPayload, DimensionRef } from "@/types/gl-dimension";

/** ตัด dimension จาก response ให้เหลือสอง id ที่ backend รับ */
export function toDimensionPayload(
  dimensions: readonly DimensionRef[] | undefined,
): DimensionPayload[] {
  return (dimensions ?? []).map((d) => ({
    gl_dimension_id: d.gl_dimension_id,
    gl_dimension_value_id: d.gl_dimension_value_id,
  }));
}

/**
 * ส่วน `dimensions` ของ payload ต่อบรรทัด (spread เข้า payload)
 *
 * - `enabled` เป็น false (ไม่มี license / ไม่มี dimension active) = ไม่ส่งเลย
 * - บรรทัดใหม่ (ยังไม่มี id) = ส่งเสมอ แม้เป็น `[]`
 * - บรรทัดเดิม = ส่งเฉพาะที่ผู้ใช้แก้ช่อง dimension (`dimensions_dirty`) —
 *   backend ถือว่า "ไม่ส่ง" = ไม่แตะ ส่งแล้ว = แทนที่ทั้งชุด
 */
export function lineDimensionsPayload(
  item: {
    id?: string | null;
    dimensions?: readonly DimensionRef[];
    dimensions_dirty?: boolean;
  },
  enabled: boolean,
): { dimensions?: DimensionPayload[] } {
  if (!enabled) return {};
  if (item.id && !item.dimensions_dirty) return {};
  return { dimensions: toDimensionPayload(item.dimensions) };
}
