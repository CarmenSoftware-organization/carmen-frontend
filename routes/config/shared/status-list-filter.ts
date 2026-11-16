import type { FilterFieldDef } from "@/types/list-filter";

/**
 * ตัวกรองสถานะของหน้า config ที่โหลดข้อมูลมาทั้งหมดแล้วกรองในเบราว์เซอร์
 * (Dimension, JV Prefix) — ค่าเก็บใน URL รูปแบบเดียวกับหน้าที่กรองที่ backend
 * (`filter=is_active|bool:true`) saved view จึงหน้าตาเหมือนกันทุกหน้า
 *
 * module-level — useListFilters ต้องการ fields ที่ reference คงที่ข้าม render
 */
export const STATUS_FILTER_FIELDS: FilterFieldDef[] = [
  {
    key: "filter",
    control: "status",
    labelKey: "common.status",
    options: [
      { labelKey: "status.active", value: "is_active|bool:true" },
      { labelKey: "status.inactive", value: "is_active|bool:false" },
    ],
  },
];

/** แปลงค่า `is_active|bool:true` ของตัวกรองกลับเป็น boolean — ไม่เลือก = undefined */
export function activeFromFilter(
  value: string | undefined,
): boolean | undefined {
  if (value?.endsWith(":true")) return true;
  if (value?.endsWith(":false")) return false;
  return undefined;
}
