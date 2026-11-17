import type { DimensionDataType } from "./accounting-master";

/**
 * dimension ที่ผูกกับบรรทัดเอกสาร (PR / PO / GRN / AP / AR / JV …)
 *
 * - request: lookup ส่ง `dimension_value_id`, ชนิดอื่นส่ง `value`
 * - response: `value_text/number/date/boolean` ตามคอลัมน์ที่เก็บจริง + `value_code`
 *   (ข้อความกลาง ๆ ของค่า) + `data_type` ของคอลัมน์ที่เก็บ — ตัวเลือก editor ให้ดูชนิดจาก
 *   master ของ dimension ไม่ใช่ `data_type` ตรงนี้
 */
export interface DimensionRef {
  dimension_id: string;
  dimension_value_id?: string | null;
  value?: string | number | boolean | null;
  value_text?: string | null;
  value_number?: string | number | null;
  value_date?: string | null;
  value_boolean?: boolean | null;
  dimension_code?: string;
  value_code?: string;
  dimension_name?: string;
  value_name?: string;
  data_type?: DimensionDataType;
}

/** รูปที่ส่งไป backend — ต่อ dimension หนึ่งแถว */
export interface DimensionPayload {
  dimension_id: string;
  dimension_value_id?: string | null;
  value?: string | number | boolean | null;
}
