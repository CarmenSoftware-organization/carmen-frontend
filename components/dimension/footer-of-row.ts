import type { Row } from "@tanstack/react-table";

/** footerContent ของ cell แรกในแถวที่มี (แถบชิป dimension ท้ายการ์ด) */
export const footerOf = <T,>(row: Row<T>) =>
  row
    .getVisibleCells()
    .find((cell) => cell.column.columnDef.meta?.footerContent)?.column.columnDef
    .meta?.footerContent;
