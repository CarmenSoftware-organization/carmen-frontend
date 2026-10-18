import type { Audit } from "./audit";

export interface EquipmentCategory {
  id: string;
  doc_version: number;
  name: string;
  description: string | null;
  is_active: boolean;
  // มีเฉพาะ list — จำนวนอุปกรณ์ที่ยังไม่ถูกลบในหมวด (ไม่มี = backend ยังไม่ deploy)
  equipment_count?: number;
  // list/detail response omit raw created/updated fields — gateway enrich เป็น audit object
  audit?: Audit;
}

export interface CreateEquipmentCategoryDto {
  doc_version?: number;
  name: string;
  description: string | null;
  is_active: boolean;
}
