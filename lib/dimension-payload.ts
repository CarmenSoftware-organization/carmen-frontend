import { storedTypedValue } from "@/lib/dimension-value";
import type { DimensionPayload, DimensionRef } from "@/types/gl-dimension";

/** แถว dimension หนึ่งแถวเป็นรูปที่ backend รับ — null = ไม่มีค่า (ไม่ส่ง) */
export function toDimensionPayloadRow(
  ref: DimensionRef,
): DimensionPayload | null {
  // value ที่ผู้ใช้เพิ่งกรอก (ชนิดไม่ใช่ lookup) มาก่อนเสมอ
  if (!isBlank(ref.value))
    return { dimension_id: ref.dimension_id, value: ref.value };
  // lookup (หรือแถวเก่าที่ยังไม่ถูกแก้) ส่ง value id เดิมกลับ — backend รับเป็นค่าเดิมของบรรทัด
  if (ref.dimension_value_id)
    return {
      dimension_id: ref.dimension_id,
      dimension_value_id: ref.dimension_value_id,
    };
  const stored = storedTypedValue(ref);
  if (stored === null) return null;
  return { dimension_id: ref.dimension_id, value: stored };
}

function isBlank(v: unknown): boolean {
  return v === undefined || v === null || v === "";
}

/** ตัด dimension จาก response ให้เหลือเฉพาะฟิลด์ที่ backend รับ (ข้ามแถวที่ไม่มีค่า) */
export function toDimensionPayload(
  dimensions: readonly DimensionRef[] | undefined,
): DimensionPayload[] {
  return (dimensions ?? []).flatMap((d) => {
    const row = toDimensionPayloadRow(d);
    return row ? [row] : [];
  });
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
  // บรรทัดใหม่ที่ไม่มีฟิลด์ dimensions เลย (เช่น session wizard เก่า) = ไม่ส่ง
  // ให้ backend copy จากต้นทาง ไม่ใช่ส่ง [] ไปทับเป็นว่าง
  if (item.dimensions === undefined) return {};
  return { dimensions: toDimensionPayload(item.dimensions) };
}

/**
 * ล้างธง `dimensions_dirty` ทุกบรรทัด — เรียกก่อน `form.reset(values)` หลังบันทึกสำเร็จ
 * เพื่อให้ baseline ใหม่ไม่ถือว่ายังมี dimension ที่แก้ค้าง (ไม่งั้นการบันทึกครั้งถัดไป
 * ส่ง dimensions ของบรรทัดนั้นซ้ำทั้งที่ไม่ได้แก้)
 */
export function clearDimensionsDirty<
  T extends { items: { dimensions_dirty?: boolean }[] },
>(values: T): T {
  return {
    ...values,
    items: values.items.map((item) => ({ ...item, dimensions_dirty: false })),
  };
}
