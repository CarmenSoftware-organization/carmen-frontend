import type { Audit } from "./audit";

export interface Certification {
  id: string;
  doc_version: number;
  code: string;
  name: string;
  description: string;
  is_active: boolean;
  audit?: Audit;
  /**
   * มีเฉพาะ list — ผู้ขายที่ถือใบนี้ (นับต่อผู้ขาย ยึดใบที่หมดอายุช้าสุด)
   * ใกล้หมดอายุ = ภายใน 30 วัน (backend กำหนด) · ไม่มีค่า = backend ยังไม่ส่ง
   */
  vendor_count?: number;
  expiring_count?: number;
  expired_count?: number;
}

export interface CreateCertificationDto {
  doc_version?: number;
  code: string;
  name: string;
  description: string;
  is_active: boolean;
}
