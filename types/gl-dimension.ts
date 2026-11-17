/**
 * dimension ที่ผูกกับบรรทัดเอกสาร (PR / PO / GRN)
 * request ส่งแค่สอง id — ฟิลด์ code/name มีเฉพาะ response
 */
export interface DimensionRef {
  dimension_id: string;
  dimension_value_id: string;
  dimension_code?: string;
  value_code?: string;
  dimension_name?: string;
  value_name?: string;
}

/** รูปที่ส่งไป backend — ตัดเหลือสอง id */
export interface DimensionPayload {
  dimension_id: string;
  dimension_value_id: string;
}
