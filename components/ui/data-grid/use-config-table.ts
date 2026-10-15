import { useTranslations } from "use-intl";
import {
  type ColumnDef,
  type InitialTableState,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import type { ParamsDto } from "@/types/params";
import type { useDataGridState } from "@/hooks/use-data-grid-state";
import { useDeleteGate } from "@/hooks/use-delete-gate";
import {
  selectColumn,
  indexColumn,
  statusColumn,
  actionColumn,
  type ActionColumnActivity,
} from "./columns";

interface UseConfigTableOptions<T> {
  data: T[];
  columns: ColumnDef<T>[];
  totalRecords: number;
  params: ParamsDto;
  tableConfig: ReturnType<typeof useDataGridState>["tableConfig"];
  onDelete?: (item: T) => void;
  hideStatus?: boolean;
  permissionPrefix?: string;
  initialState?: InitialTableState;
  /**
   * เปิดเมนู Activity ในแถว — ไม่ส่ง = ไม่มีเมนู
   *
   * เปิดเฉพาะ list ที่ backend บันทึกกิจกรรมให้จริง (ดู `activity-registry.ts`
   * ฝั่ง micro-business) — เปิดให้ตารางที่ไม่มีในทะเบียนจะได้เมนูที่กดแล้วว่าง
   * เช่น certification / eco / equipment / recipe / period
   */
  activity?: ActionColumnActivity<T>;
}

/**
 * Hook factory สร้าง TanStack Table instance สำหรับ config list pages
 *
 * รวม `selectColumn`, `indexColumn`, custom columns, `statusColumn` (ยกเว้น
 * `hideStatus`) และ `actionColumn` (เมื่อมี `onDelete`) จากนั้นส่งเข้า
 * `useReactTable` พร้อม core row model, table config และ pageCount ที่
 * คำนวณจาก `totalRecords / perpage` ใช้ "use no memo" เพื่อข้าม React Compiler
 *
 * @typeParam T - ประเภทข้อมูลแถว
 * @param options - options ของ hook
 * @param options.data - ข้อมูลแถว
 * @param options.columns - custom column definitions
 * @param options.totalRecords - จำนวน records ทั้งหมด
 * @param options.params - ParamsDto จาก URL state
 * @param options.tableConfig - tableConfig จาก `useDataGridState`
 * @param options.onDelete - callback ลบ row (เพิ่ม action column เมื่อมี)
 * @param options.hideStatus - ซ่อน status column
 * @returns TanStack Table instance พร้อม pageCount
 * @example
 * ```ts
 * const table = useConfigTable({
 *   data, columns, totalRecords, params, tableConfig, onDelete,
 * });
 * ```
 */
export function useConfigTable<T>({
  data,
  columns,
  totalRecords,
  params,
  tableConfig,
  onDelete,
  hideStatus,
  permissionPrefix,
  initialState,
  activity,
}: UseConfigTableOptions<T>) {
  // "use no memo" opts out of React Compiler's automatic memoization.
  // TanStack Table creates new column/row objects each render; memoizing them
  // breaks reference-equality checks the library relies on internally.
  "use no memo";

  // ของกลางตัวเดียวกับปุ่มลบบนการ์ด (`ListCard`) และตารางที่ประกอบ column เอง —
  // แถวกับการ์ดของหน้าเดียวกันจะได้ไม่คุมสิทธิ์คนละแบบ
  const deleteGate = useDeleteGate(permissionPrefix);
  const tfl = useTranslations("field");

  const allColumns: ColumnDef<T>[] = [
    selectColumn<T>(),
    indexColumn<T>(params),
    ...columns,
    ...(hideStatus ? [] : [statusColumn<T>(tfl)]),
    ...(onDelete
      ? [actionColumn<T>(onDelete, { ...deleteGate, activity })]
      : []),
  ];

  return useReactTable({
    data,
    columns: allColumns,
    getCoreRowModel: getCoreRowModel(),
    initialState,
    ...tableConfig,
    pageCount: Math.ceil(totalRecords / (params.perpage as number)),
  });
}
