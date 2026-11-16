/**
 * dimension ที่ผูกกับบรรทัดเอกสาร (PR / PO / GRN)
 * request ส่งแค่สอง id — ฟิลด์ code/name มีเฉพาะ response
 */
export interface DimensionRef {
  gl_dimension_id: string;
  gl_dimension_value_id: string;
  dimension_code?: string;
  value_code?: string;
  dimension_name?: string;
  value_name?: string;
}

/** รูปที่ส่งไป backend — ตัดเหลือสอง id */
export interface DimensionPayload {
  gl_dimension_id: string;
  gl_dimension_value_id: string;
}
