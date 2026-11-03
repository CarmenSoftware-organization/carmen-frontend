export type FileUsageKind =
  | "attachment"
  | "product_image"
  | "recipe_image"
  | "recipe_step_image"
  | "recipe_category_image"
  | "recipe_cuisine_image"
  | "recipe_equipment_image"
  | "recipe_equipment_category_image"
  | "grn_signature"
  | "user_avatar"
  | "user_signature"
  | "bu_logo"
  | "bu_avatar"
  | "cluster_logo"
  | "cluster_avatar"
  | "news_image"
  | "platform_note";

export interface FileUsage {
  kind: FileUsageKind;
  owner_type: string;
  owner_id: string | null;
  label: string | null;
  /** true = ไฟล์ของ platform ลบไม่ได้จากหน้านี้ */
  platform: boolean;
}

export const FILE_USAGE_KINDS: readonly FileUsageKind[] = [
  "attachment",
  "product_image",
  "recipe_image",
  "recipe_step_image",
  "recipe_category_image",
  "recipe_cuisine_image",
  "recipe_equipment_image",
  "recipe_equipment_category_image",
  "grn_signature",
  "user_avatar",
  "user_signature",
  "bu_logo",
  "bu_avatar",
  "cluster_logo",
  "cluster_avatar",
  "news_image",
  "platform_note",
];

export interface DocumentFile {
  fileToken: string;
  objectName: string;
  originalName: string;
  size: number;
  contentType: string;
  lastModified: string;
  presignedUrl?: string;
  /** ที่มาของไฟล์ — null = อัปโหลดโดยตรงจากหน้า Document (ชื่อ field เป็น snake_case ตามที่ API ส่ง) */
  reference_type?: string | null;
  reference_id?: string | null;
  /** เลขเอกสารต้นทาง (display_no) — null ถ้าไม่ทราบ */
  reference_no?: string | null;
  /** id หัวเอกสาร เมื่อ reference เป็นแถว *_detail — ใช้สร้างลิงก์ */
  reference_parent_id?: string | null;
  /** false = เอกสารต้นทางถูกลบแล้ว · null = ไม่มี reference หรือ lookup ล้มเหลว */
  reference_exists?: boolean | null;
  /** ที่ที่ไฟล์นี้ถูกใช้อยู่ — null = lookup ล้มเหลว · undefined = backend เก่า */
  usages?: FileUsage[] | null;
  /**
   * true = ลบจากหน้านี้ไม่ได้ เพราะมี usage ที่ platform: true (ไฟล์ของ platform: avatar/ลายเซ็นผู้ใช้
   * โลโก้ BU/cluster ข่าว) — ตัวลบตอบ 422 DOCUMENT_DELETE_UNSUPPORTED · ไฟล์ของ BU ลบได้แม้ยังถูกใช้
   * null/undefined = ตรวจไม่สำเร็จหรือ backend เก่า → ปล่อยให้กดได้
   */
  delete_blocked?: boolean | null;
  description?: string | null;
  /** ผู้อัปโหลด/วันที่อัปโหลดอยู่ที่ audit.created ไม่มี created_at แบน ๆ */
  audit?: {
    created?: { at?: string; id?: string; name?: string; avatar?: string };
  };
}

/** query param ของ GET /documents ที่เกินจาก ParamsDto (ค่าหลายตัวคั่นด้วย ,) */
export interface DocumentListParams {
  search?: string;
  page?: number | string;
  perpage?: number | string;
  sort?: string;
  reference_types?: string;
  content_kinds?: string;
  include_unreferenced?: "true";
  /** YYYY-MM-DD (exclusive) */
  created_before?: string;
}

export interface DocumentListResponse {
  data: DocumentFile[];
  paginate: {
    total: number;
    page: number;
    perpage: number;
    pages: number;
    /** ขนาดรวม (byte) ของทุกแถวที่ตรงตัวกรอง */
    total_size?: number;
  };
}

/** ตัวกรองของ POST /documents/bulk-delete (ค่าหลายตัวเป็น array ไม่ใช่ csv เหมือน query ของ GET) */
export interface DocumentBulkDeleteFilter {
  search?: string;
  reference_types?: string[];
  include_unreferenced?: boolean;
  content_kinds?: string[];
  created_before?: string;
}

/** รหัสเหตุผลคงที่ของไฟล์ที่ลบไม่ได้ (failed[].reason) */
export type DocumentBulkDeleteReason =
  | "FILE_NOT_FOUND"
  | "UNSUPPORTED_REFERENCE_TYPE"
  | "TOMBSTONE_FAILED"
  | "DELETE_FAILED";

export interface BulkDeleteResult {
  deleted: number;
  failed: { fileToken: string; fileName: string; reason: string }[];
  freed_size: number;
}

/** ผล dry_run ของ POST /documents/bulk-delete — ไม่ลบอะไร · null = lookup ล้มเหลว (freed_size ประมาณ) */
export interface BulkDeleteDryRunResult {
  matched: number;
  in_use: number | null;
  platform_blocked: number | null;
  freed_size: number;
}

export type BulkDeleteVariables =
  | { file_tokens: string[] }
  | { filter: DocumentBulkDeleteFilter; expected_count: number };

interface DocumentSummaryRow {
  reference_type: string | null;
  size: number;
  count: number;
}

export interface DocumentSummary {
  total_size: number;
  total_count: number;
  by_reference_type: DocumentSummaryRow[];
}
