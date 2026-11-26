"use no memo"; // TanStack table เป็น ref คงที่แต่ mutate ข้างใน — ดู routes/CLAUDE.md

import type { ReactNode } from "react";
import { flexRender, type Cell, type Table } from "@tanstack/react-table";
import { cn } from "@/lib/utils";
import type { PoItemField } from "./use-po-item-table";

/** คอลัมน์ที่อยู่หัวการ์ด ไม่ใช่ช่องในกริด */
const HEAD_COLUMNS = new Set(["select", "index", "product_id", "action"]);

/** ค่าตัวเลขของ cell จัดชิดขวาไว้สำหรับตาราง — ในการ์ดป้ายอยู่บนค่า ชิดซ้ายทั้งคู่ */
const LEFT_ALIGN =
  "[&_.items-end]:items-start [&_.justify-end]:justify-start [&_.text-right]:text-left";

const GRID =
  "grid grid-cols-2 gap-x-4 gap-y-2 @md:grid-cols-3 @2xl:grid-cols-4";

/**
 * ค่าของช่องในกริด — เรียกฟังก์ชัน cell ตรง ๆ แทน `flexRender` เพราะ flexRender ห่อฟังก์ชัน
 * เป็น element เสมอ ผลจึงไม่เคยเป็น null แม้ cell คืน null · ปลอดภัยเพราะ cell ของคอลัมน์
 * ข้อมูล PO คืน JSX ล้วน ไม่เรียก hook เอง (hook อยู่ใน component ที่ cell render ต่อ)
 */
function cellContent(cell: Cell<PoItemField, unknown>): ReactNode {
  const def = cell.column.columnDef.cell;
  return typeof def === "function"
    ? (def(cell.getContext()) as ReactNode)
    : (def ?? null);
}

function renderCell(cell: Cell<PoItemField, unknown> | undefined) {
  return cell
    ? flexRender(cell.column.columnDef.cell, cell.getContext())
    : null;
}

/**
 * รายการของ PO โหมดดูแบบการ์ดแถวละใบ — ใช้เมื่อกล่องแคบ (มือถือ / tablet)
 *
 * วาด cell เดิมของตารางทุกช่อง (ค่าเดียวกัน) · หัวการ์ด = # + สินค้า · ช่องที่เหลือเป็นกริดมีป้าย
 * (ป้ายมาจาก header ของคอลัมน์ ซึ่งเป็นข้อความล้วน) · แถวหมายเหตุของตาราง (`footerContent`
 * ของคอลัมน์ #: หมายเหตุ + ปุ่มประวัติ/คลัง/ที่มา PR-GRN) ย้ายมาไว้ท้ายการ์ดใต้เส้นคั่น
 * ตาราง PO ไม่มีแถวกางออก (`expandedContent`) จึงไม่ต้องรองรับ
 */
export function PoItemCards({
  table,
  emptyMessage,
}: {
  readonly table: Table<PoItemField>;
  readonly emptyMessage: ReactNode;
}) {
  const rows = table.getRowModel().rows;

  if (rows.length === 0) {
    return (
      <div className="border-border/60 bg-card rounded-xl border py-6">
        {emptyMessage}
      </div>
    );
  }

  const label = (cell: Cell<PoItemField, unknown>) => {
    const header = cell.column.columnDef.header;
    return typeof header === "string" ? header : null;
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
        const footerCol = row
          .getVisibleCells()
          .find((cell) => cell.column.columnDef.meta?.footerContent)?.column;

        return (
          <li
            key={row.id}
            className="border-border/60 bg-card @container rounded-xl border text-xs"
          >
            <div className="flex items-start gap-2 p-3 pb-2">
              {cells.has("select") && (
                <div className="-my-1 -ms-2 shrink-0">
                  {renderCell(cells.get("select"))}
                </div>
              )}
              <span className="text-muted-foreground shrink-0 pt-0.5 tabular-nums">
                {renderCell(cells.get("index"))}
              </span>
              <div className="min-w-0 flex-1">
                {renderCell(cells.get("product_id"))}
              </div>
            </div>

            <dl className={cn(GRID, "px-3 pb-3")}>
              {fieldCells.map((cell) => {
                const content = cellContent(cell);
                if (content == null) return null;
                return (
                  <div
                    key={cell.id}
                    className={cn(
                      "min-w-0",
                      // Location ถือป้ายสถานะ + ชื่อคลังยาว ให้กินเต็มแถวบนจอแคบ
                      cell.column.id === "location_id" &&
                        "col-span-2 @md:col-span-1",
                    )}
                  >
                    <dt className="text-muted-foreground text-micro mb-0.5">
                      {label(cell)}
                    </dt>
                    <dd className={LEFT_ALIGN}>{content}</dd>
                  </div>
                );
              })}
            </dl>

            {footerCol && (
              <div className="border-border/60 border-t px-3 pt-2">
                {footerCol.columnDef.meta?.footerContent?.(row.original)}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
