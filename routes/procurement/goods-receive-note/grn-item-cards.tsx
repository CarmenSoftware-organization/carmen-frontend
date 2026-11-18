"use no memo"; // TanStack table เป็น ref คงที่แต่ mutate ข้างใน — ดู routes/CLAUDE.md

import type { ReactNode } from "react";
import { flexRender, type Cell, type Table } from "@tanstack/react-table";
import { useTranslations } from "use-intl";
import { cn } from "@/lib/utils";
import type { GrnItemField } from "./use-grn-item-table";

/** คอลัมน์ที่อยู่หัวการ์ด ไม่ใช่ช่องในกริด */
const HEAD_COLUMNS = new Set(["index", "product", "action"]);

/**
 * ค่าตัวเลขของ cell จัดชิดขวาไว้สำหรับตาราง — ในการ์ดป้ายอยู่บนค่า ชิดซ้ายทั้งคู่ ·
 * min-h-8 ของวันที่โหมดอ่าน (date-picker) มีไว้ให้แถวตารางสูงเท่าช่องกรอก ในการ์ดมันดัน
 * "—" ลงต่ำกว่าค่าของช่องข้าง ๆ จึงปิดทิ้ง
 */
const LEFT_ALIGN =
  "[&_.items-end]:items-start [&_.justify-end]:justify-start [&_.text-right]:text-left [&_.min-h-8]:min-h-0";

const GRID =
  "grid grid-cols-2 gap-x-4 gap-y-2 @md:grid-cols-3 @2xl:grid-cols-4";

/**
 * ค่าของช่องในกริด — เรียกฟังก์ชัน cell ตรง ๆ แทน `flexRender` เพราะ flexRender ห่อฟังก์ชัน
 * เป็น element เสมอ ผลจึงไม่เคยเป็น null แม้ cell คืน null
 * ปลอดภัยเพราะ cell ของคอลัมน์ข้อมูล GRN คืน JSX ล้วน ไม่เรียก hook เอง
 */
function cellContent(cell: Cell<GrnItemField, unknown>): ReactNode {
  const def = cell.column.columnDef.cell;
  return typeof def === "function"
    ? (def(cell.getContext()) as ReactNode)
    : (def ?? null);
}

function renderCell(cell: Cell<GrnItemField, unknown> | undefined) {
  return cell
    ? flexRender(cell.column.columnDef.cell, cell.getContext())
    : null;
}

function Field({
  label,
  children,
  wide = false,
}: {
  readonly label: ReactNode;
  readonly children: ReactNode;
  readonly wide?: boolean;
}) {
  return (
    <div className={cn("min-w-0", wide && "col-span-2 @md:col-span-1")}>
      <dt className="text-muted-foreground text-micro mb-0.5">{label}</dt>
      <dd className={LEFT_ALIGN}>{children}</dd>
    </div>
  );
}

/**
 * รายการของ GRN โหมดดูแบบการ์ดแถวละใบ — ใช้เมื่อกล่องแคบ (มือถือ / tablet)
 *
 * วาด cell เดิมของตารางด้วย cell function ตัวเดิม (ค่าเดียวกับตารางทุกช่อง) · หัวการ์ด =
 * ลำดับ + สินค้า + ปุ่มเอกสารอ้างอิง · ที่เหลือเป็นกริดมีป้าย · GRN ไม่มีแถวกางออก
 */
export function GrnItemCards({
  table,
  emptyMessage,
}: {
  readonly table: Table<GrnItemField>;
  readonly emptyMessage: ReactNode;
}) {
  const tfl = useTranslations("field");
  const rows = table.getRowModel().rows;

  if (rows.length === 0) {
    return (
      <div className="border-border/60 bg-card rounded-lg border py-6">
        {emptyMessage}
      </div>
    );
  }

  // หัวคอลัมน์ที่เป็นฟังก์ชัน (sortable) ใช้ key เดียวกับที่หัวตารางใช้
  const label = (cell: Cell<GrnItemField, unknown>): ReactNode => {
    const header = cell.column.columnDef.header;
    if (typeof header === "string") return header;
    return cell.column.id === "location" ? tfl("location") : null;
  };

  return (
    <ul className="flex flex-col gap-2">
      {rows.map((row) => {
        const cells = new Map(
          row.getVisibleCells().map((cell) => [cell.column.id, cell]),
        );
        const fieldCells = row
          .getVisibleCells()
          .filter((cell) => !HEAD_COLUMNS.has(cell.column.id));

        return (
          <li
            key={row.id}
            className="border-border/60 bg-card @container rounded-lg border text-xs"
          >
            <div className="flex items-start gap-2 p-3 pb-2">
              <span className="text-muted-foreground shrink-0 pt-0.5 tabular-nums">
                {renderCell(cells.get("index"))}
              </span>
              <div className="min-w-0 flex-1">
                {renderCell(cells.get("product"))}
              </div>
              <div className="-my-0.5 -me-1 shrink-0">
                {renderCell(cells.get("action"))}
              </div>
            </div>

            <dl className={cn(GRID, "px-3 pb-3")}>
              {fieldCells.map((cell) => {
                // cell ที่ไม่มีอะไรให้แสดงไม่ต้องมีป้ายลอยเปล่า ๆ
                const content = cellContent(cell);
                if (content == null) return null;
                return (
                  <Field
                    key={cell.id}
                    label={label(cell)}
                    wide={cell.column.id === "location"}
                  >
                    {content}
                  </Field>
                );
              })}
            </dl>
          </li>
        );
      })}
    </ul>
  );
}
