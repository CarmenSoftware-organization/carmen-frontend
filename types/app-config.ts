import type { Audit } from "@/types/audit";

export interface AppConfig {
  id: string;
  key: string;
  value: Record<string, unknown>;
  /** มีมากับ GET รายคีย์ — แถวที่ยังไม่เคยบันทึกไม่มี */
  audit?: Audit;
}
