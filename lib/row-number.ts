import type { ParamsDto } from "@/types/params";

/**
 * เลขลำดับแถวที่ผู้ใช้เห็น (1-based) — ตารางกับการ์ดต้องใช้ตัวนี้ตัวเดียว
 * เพราะผู้ใช้เอาเลขไปอ้างอิงแถวเวลาคุยกัน รายการเดียวกันต้องได้เลขเดียวกันทุกมุมมอง
 *
 * - ส่ง `params` = หน้าแบบแบ่งหน้า → นับต่อข้ามหน้า `(page − 1) × perpage + index + 1`
 * - ส่ง `undefined` = รายการสะสม (infinite scroll / โหลดเพิ่ม) → `index + 1`
 *
 * `index` ต้องเป็นตำแหน่งที่แสดงจริง (หลังเรียง/กรองฝั่ง client) ไม่ใช่ลำดับในข้อมูลดิบ
 */
export function rowNumber(
  params: Pick<ParamsDto, "page" | "perpage"> | undefined,
  index: number,
): number {
  if (!params) return index + 1;
  const page = Number(params.page) || 1;
  const perpage = Number(params.perpage) || 10;
  return (page - 1) * perpage + index + 1;
}

/** state `pagination` ของ TanStack (0-based) → รูปแบบ `params` ที่ `rowNumber` รับ */
export function pageParamsOf(pagination: {
  pageIndex: number;
  pageSize: number;
}): Pick<ParamsDto, "page" | "perpage"> {
  return { page: pagination.pageIndex + 1, perpage: pagination.pageSize };
}
