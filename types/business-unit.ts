/**
 * รายละเอียด Business Unit จาก `GET api/business-units`
 *
 * ใช้ในหน้า Business Setting (system-admin) — สะท้อน response ทั้งหมด
 * ยกเว้น `users[]` ที่หน้านี้ไม่ได้ใช้จึงไม่ระบุไว้
 */

interface BusinessUnitDbConnection {
  host: string;
  port: number;
  schema: string;
  database: string;
  password: string;
  provider: string;
  username: string;
}

export interface BusinessUnitNumberFormat {
  locales: string;
  minimumIntegerDigits: number;
}

interface BusinessUnitImage {
  url: string;
  expires_at: string;
}

export interface BusinessUnitConfigItem {
  key: string;
  label: string;
  datatype: string;
  value: string;
}

interface BusinessUnitAuditEntry {
  at: string;
  id: string;
  name: string;
}

interface BusinessUnitAudit {
  created?: BusinessUnitAuditEntry;
  updated?: BusinessUnitAuditEntry;
}

export interface BusinessUnitDetail {
  id: string;
  cluster_id: string;
  code: string;
  name: string;
  alias_name: string | null;
  description: string | null;
  info: string | null;
  is_hq: boolean;
  is_active: boolean;
  db_connection: BusinessUnitDbConnection | null;
  config: BusinessUnitConfigItem[] | Record<string, unknown>;
  default_currency_id: string | null;
  calculation_method: string | null;
  branch_no: string | null;

  company_name: string | null;
  company_address_line1: string | null;
  company_address_line2: string | null;
  company_sub_district: string | null;
  company_district: string | null;
  company_city: string | null;
  company_province: string | null;
  company_postal_code: string | null;
  company_country: string | null;
  company_latitude: string | null;
  company_longitude: string | null;
  company_email: string | null;
  company_tel: string | null;
  tax_no: string | null;

  hotel_name: string | null;
  hotel_address_line1: string | null;
  hotel_address_line2: string | null;
  hotel_sub_district: string | null;
  hotel_district: string | null;
  hotel_city: string | null;
  hotel_province: string | null;
  hotel_postal_code: string | null;
  hotel_country: string | null;
  hotel_latitude: string | null;
  hotel_longitude: string | null;
  hotel_email: string | null;
  hotel_tel: string | null;

  date_format: string | null;
  date_time_format: string | null;
  time_format: string | null;
  short_time_format: string | null;
  long_time_format: string | null;
  timezone: string | null;

  amount_format: BusinessUnitNumberFormat | null;
  quantity_format: BusinessUnitNumberFormat | null;
  recipe_format: BusinessUnitNumberFormat | null;

  doc_version: number;
  cluster_name: string | null;

  logo: BusinessUnitImage | null;
  avatar: BusinessUnitImage | null;
  audit: BusinessUnitAudit | null;
}

interface BusinessUnitEditable {
  code: string;
  name: string;
  alias_name: string | null;
  description: string | null;
  info: string | null;
  is_active: boolean;
  default_currency_id: string | null;

  company_name: string | null;
  company_address_line1: string | null;
  company_address_line2: string | null;
  company_sub_district: string | null;
  company_district: string | null;
  company_city: string | null;
  company_province: string | null;
  company_postal_code: string | null;
  company_country: string | null;
  company_latitude: string | null;
  company_longitude: string | null;
  company_email: string | null;
  company_tel: string | null;
  tax_no: string | null;
  branch_no: string | null;

  hotel_name: string | null;
  hotel_address_line1: string | null;
  hotel_address_line2: string | null;
  hotel_sub_district: string | null;
  hotel_district: string | null;
  hotel_city: string | null;
  hotel_province: string | null;
  hotel_postal_code: string | null;
  hotel_country: string | null;
  hotel_latitude: string | null;
  hotel_longitude: string | null;
  hotel_email: string | null;
  hotel_tel: string | null;

  timezone: string | null;
  date_format: string | null;
  date_time_format: string | null;
  time_format: string | null;
  short_time_format: string | null;
  long_time_format: string | null;

  amount_format: BusinessUnitNumberFormat | null;
  quantity_format: BusinessUnitNumberFormat | null;
  recipe_format: BusinessUnitNumberFormat | null;

  config: BusinessUnitConfigItem[];
}

export type BusinessUnitPatch = Partial<BusinessUnitEditable> & {
  doc_version?: number;
  /**
   * BU ที่หน้าโหลดข้อมูลมา — backend เขียนลง BU default ของผู้ใช้เสมอ ถ้าไม่ตรงกัน (สลับ BU จากแท็บ/เครื่องอื่น)
   * จะตอบ 409 `BUSINESS_UNIT_NOT_CURRENT` แทนการเขียนฟอร์มของ BU หนึ่งลงอีก BU
   */
  id?: string;
};
