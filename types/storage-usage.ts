/**
 * ขั้นเตือนพื้นที่ที่เหลือ: 20 / 10 / 5 / 3 = เปอร์เซ็นต์ที่เหลือ, 0 = เต็ม, null = ปกติ
 * (ตรงกับ `StorageStep` ของ gateway)
 */
export type StorageStep = 20 | 10 | 5 | 3 | 0 | null;

export type StorageKind = "database" | "attachment";

/** ผลวัดล่าสุดของพื้นที่หนึ่งชนิดของ BU */
export interface StorageKindUsage {
  kind: StorageKind;
  used_bytes: number;
  quota_bytes: number;
  remaining_pct: number;
  step: StorageStep;
  exceeded_at: string | null;
  grace_ends_at: string | null;
  blocking: boolean;
  flag: string | null;
  measured_at: string;
}

export interface StorageReferenceBreakdown {
  reference_type: string | null;
  size: number;
  count: number;
}

/** ผลวัดพื้นที่ของ BU — `by_reference_type` ว่างเมื่อผู้เรียกไม่มี `system_admin.view` */
export interface BuStorageUsage {
  bu_code: string;
  exempt: boolean;
  enforce: boolean;
  kinds: StorageKindUsage[];
  by_reference_type: StorageReferenceBreakdown[];
}
