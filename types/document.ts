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
