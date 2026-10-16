import type { Audit } from "@/types/audit";
import type { EntityRef } from "@/types/entity-ref";

interface VendorInfoItem {
  label: string;
  value: string;
  data_type: string;
}

interface VendorAddressData {
  address_line1: string;
  address_line2: string;
  city: string;
  district: string;
  sub_district: string;
  province: string;
  postal_code: string;
  country: string;
}

export interface VendorAddress extends VendorAddressData {
  id?: string;
  address_type: string;
  is_active: boolean;
}

export interface VendorContact {
  id?: string;
  name: string;
  email: string;
  phone: string;
  is_primary: boolean;
}

export interface Vendor {
  id: string;
  code: string;
  name: string;
  is_active: boolean;
  business_type: EntityRef[];
  // ยืนยันจาก live list+detail: tax_profile เป็น {id,name} เหมือนกันทั้งคู่
  // (ของเดิมไม่เคยประกาศ tax_profile_id/tax_profile_name แบบ flat ใน type นี้เลย)
  tax_profile: EntityRef | null;
  tax_no?: string | null;
  branch_no?: string | null;
  rating?: number | null;
  // บัญชีเจ้าหนี้ default (uuid ของ tb_chart_of_accounts) — response ไม่มี code ปนมา
  ap_chart_of_accounts_id?: string | null;
  // list ส่งแบบ flat (VendorListItemResponseSchema) — detail ไม่ได้ใช้สองตัวนี้
  credit_term_name?: string | null;
  credit_term_days?: number | null;
  contacts?: VendorContact[];
  tb_vendor_contact?: VendorContact[];
  audit?: Audit;
  doc_version: number;
}

export interface VendorDetail extends Vendor {
  description: string;
  info: VendorInfoItem[];
  vendor_address: VendorAddress[];
  vendor_contact: VendorContact[];
}

interface VendorAddressPayload extends VendorAddressData {
  address_type: string;
}

export interface CreateVendorDto {
  doc_version?: number;
  name: string;
  code: string;
  description: string;
  is_active: boolean;
  tax_no: string | null;
  branch_no: string | null;
  rating: number | null;
  ap_chart_of_accounts_id: string | null;
  business_type: { id: string; name: string }[];
  info: VendorInfoItem[];
  vendor_address: {
    add?: VendorAddressPayload[];
    update?: (VendorAddressPayload & { vendor_address_id: string })[];
    remove?: { vendor_address_id: string }[];
  };
  vendor_contact: {
    add?: Omit<VendorContact, "id">[];
    update?: (Omit<VendorContact, "id"> & { vendor_contact_id: string })[];
    remove?: { vendor_contact_id: string }[];
  };
}
