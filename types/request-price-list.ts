import type { Audit } from "@/types/audit";
import type { EntityRef } from "@/types/entity-ref";

export interface RequestPriceListVendor {
  id: string;
  sequence_no: number;
  vendor: EntityRef | null;
  contact_person: string;
  contact_phone: string;
  contact_email: string;
  url_token: string;
  has_submitted: boolean;
  pricelist: {
    id: string;
    no: string;
    name: string;
    status: string;
  } | null;
  info: Record<string, unknown>;
  doc_version: number;
}

export interface RequestPriceList {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  custom_message: string;
  email_template_id: string | null;
  info: string;
  doc_version: number;
  pricelist_template: {
    id: string;
    name: string;
    status: string;
    currency: EntityRef | null;
  };
  vendor_count: number;
  vendors: RequestPriceListVendor[];
  audit?: Audit;
}

export interface CreateRequestPriceListDto {
  name: string;
  pricelist_template_id?: string;
  start_date: string;
  end_date: string;
  custom_message?: string;
  email_template_id?: string;
  info?: string;
  vendors: {
    add?: {
      vendor_id: string;
      vendor_name: string;
      vendor_code: string;
      contact_person: string;
      contact_phone: string;
      contact_email: string;
      sequence_no: number;
      id: string;
    }[];
    // id ของบรรทัดผู้ขายในคำขอราคา ไม่ใช่ vendor_id — เดิมส่ง { vendor_id } หลังบ้านอ่าน id
    // ได้ undefined แล้วไปลบบรรทัดแรกของตาราง (มักเป็นของคำขอราคาใบอื่น)
    remove?: { id: string }[];
  };
}
