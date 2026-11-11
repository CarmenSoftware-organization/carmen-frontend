interface ActivityAudit {
  created: { at: string; id: string | null; name: string | null };
  updated: { at: string };
}

export interface ActivityLog {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  actor_id: string | null;
  // รูปโปรไฟล์ผู้กระทำ — ไม่มีฟิลด์ = ไม่มีรูป
  actor_avatar?: string;
  actor_username: string | null;
  actor_firstname: string | null;
  actor_middlename: string | null;
  actor_lastname: string | null;
  description: string;
  ip_address: string;
  user_agent: string | null;
  meta_data: Record<string, unknown> | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  audit: ActivityAudit;
}

export interface ActivityFieldChange {
  field: string;
  old: unknown;
  new: unknown;
}

export interface ActivityChildChange {
  relation: string;
  added: Record<string, unknown>[];
  removed: Record<string, unknown>[];
  updated: { id: string; fields: ActivityFieldChange[] }[];
}

/**
 * ผลเทียบ old_data/new_data ที่ backend คำนวณมาให้ (`changes` ของ endpoint
 * `/activity-logs/:id/detail`) — `has_changes` ตัด housekeeping field
 * (updated_at/updated_by_id/doc_version) ออกแล้ว
 */
interface ActivityDiff {
  fields: ActivityFieldChange[];
  children: ActivityChildChange[];
  has_changes: boolean;
}

export interface ActivityLogDetail extends ActivityLog {
  changes: ActivityDiff;
}

/**
 * ดึงเวลาที่สร้าง log จาก field `audit.created.at` ของ activity log
 *
 * API ของ activity-logs ไม่ได้ส่ง `created_at` ที่ระดับบนสุด แต่ห่อ timestamp
 * ไว้ในออบเจกต์ `audit` แทน ฟังก์ชันนี้คืน ISO string ของเวลาที่สร้าง log
 * หรือ empty string หาก `audit` ไม่มีค่า (เพื่อให้ formatDate แสดงเป็นค่าว่าง)
 *
 * @param log - ออบเจกต์ activity log ที่ต้องการอ่านเวลา
 * @returns ISO date string ของเวลาที่สร้าง log หรือ empty string หากไม่มี
 * @example
 * ```ts
 * getLogCreatedAt(log); // "2026-05-27T12:46:56.727Z"
 * formatDate(getLogCreatedAt(log), dateFormat); // "27/05/2026"
 * ```
 */
export function getLogCreatedAt(log: ActivityLog): string {
  return log.audit?.created?.at ?? "";
}
