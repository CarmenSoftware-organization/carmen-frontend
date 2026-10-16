/**
 * แถวของผังการผูกบัญชี (GL/AP account mapping) — หนึ่งแถวต่อ
 * location × item group × movement (× adjustment type ฝั่ง GL)
 *
 * แถวเก็บเฉพาะค่าที่ผู้ใช้แก้ทับ ส่วน `account` / `cost_center` ที่ส่งมาคือค่าที่
 * backend resolve แล้ว (ค่าแก้ทับ → item group → sub-category → category, และ
 * cost center ของ location) พร้อมบอก `source` และ `issue` เมื่อหาไม่เจอ
 *
 * endpoint: `GET /api/:bu_code/account-mapping`
 */
export type MappingType = "AP" | "GL";
export type MappingMovement = "grn" | "cn" | "adjustment" | "sr_in" | "sr_out";
export type MappingStatus =
  | "incomplete"
  | "overridden"
  | "default"
  | "unreviewed";
export type Ref = { id: string; code: string; name: string };

export type AccountSource =
  | "override"
  | "item_group"
  | "sub_category"
  | "category"
  | "vendor"
  | "bu_default"
  | "adjustment_type";
export type CostCenterSource = "override" | "location";
export type AccountIssue =
  | "missing_inventory_account"
  | "missing_direct_account"
  | "account_not_in_coa"
  | "missing_ap_account"
  | "missing_adjustment_account";
export type CostCenterIssue = "missing_cost_center";

export interface AccountMappingRow {
  id: string;
  doc_version: number;
  mapping_type: MappingType;
  movement: MappingMovement;
  origin: "generated_all" | "generated_used" | "auto_posting";
  is_reviewed: boolean;
  location: Ref & { location_type: "inventory" | "direct" | "consignment" };
  category: Ref;
  sub_category: Ref;
  item_group: Ref;
  adjustment_type: (Ref & { type: string }) | null;
  account: {
    code: string | null;
    name: string | null;
    source: AccountSource | null;
    issue: AccountIssue | null;
  };
  cost_center: {
    id: string | null;
    code: string | null;
    name: string | null;
    source: CostCenterSource | null;
    issue: CostCenterIssue | null;
  };
}

export type MappingCounts = Record<MappingStatus, number>;

export interface AccountMappingListResponse {
  data: AccountMappingRow[];
  paginate: { total: number; page: number; perpage: number; pages: number };
  /** มาจาก `summary.counts` ของ response — นับตาม mapping_type ของแท็บ */
  counts: MappingCounts;
}
