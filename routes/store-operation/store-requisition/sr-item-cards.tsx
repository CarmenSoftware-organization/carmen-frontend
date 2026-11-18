"use no memo"; // TanStack table เป็น ref คงที่แต่ mutate ข้างใน — ดู routes/CLAUDE.md

import type { ReactNode } from "react";
import { flexRender, type Cell, type Table } from "@tanstack/react-table";
import { cn } from "@/lib/utils";
import type { SrItemField } from "./use-sr-item-table";

/** คอลัมน์ที่อยู่หัวการ์ด ไม่ใช่ช่องในกริด */
const HEAD_COLUMNS = new Set(["index", "product_id", "action"]);

/** ค่าตัวเลขของ cell จัดชิดขวาไว้สำหรับตาราง — ในการ์ดป้ายอยู่บนค่า ชิดซ้ายทั้งคู่ */
const LEFT_ALIGN =
  "[&_.items-end]:items-start [&_.justify-end]:justify-start [&_.text-right]:text-left";

const GRID =
  "grid grid-cols-2 gap-x-4 gap-y-2 @md:grid-cols-3 @2xl:grid-cols-4";

/**
 * ค่าของช่องในกริด — เรียกฟังก์ชัน cell ตรง ๆ แทน `flexRender` เพราะ flexRender ห่อฟังก์ชัน
 * เป็น element เสมอ ผลจึงไม่เคยเป็น null · ปลอดภัยเพราะ cell ของคอลัมน์ SR คืน JSX ล้วน
 * ไม่เรียก hook เอง (hook อยู่ในคอมโพเนนต์ที่ cell คืนออกมา)
 */
function cellContent(cell: Cell<SrItemField, unknown>): ReactNode {
  const def = cell.column.columnDef.cell;
  return typeof def === "function"
    ? (def(cell.getContext()) as ReactNode)
    : (def ?? null);
}

function renderCell(cell: Cell<SrItemField, unknown> | undefined) {
  return cell
    ? flexRender(cell.column.columnDef.cell, cell.getContext())
    : null;
}

function Field({
  label,
  children,
}: {
  readonly label: ReactNode;
  readonly children: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-muted-foreground text-micro mb-0.5">{label}</dt>
      <dd className={LEFT_ALIGN}>{children}</dd>
    </div>
  );
}

/**
 * รายการของ SR โหมดดูแบบการ์ดแถวละใบ — ใช้เมื่อกล่องแคบ (มือถือ / tablet)
 *
 * วาด cell เดิมของตารางทุกช่อง (ค่าเดียวกับตาราง) · โหมดดูไม่มีคอลัมน์เลือกแถว
 * (select โผล่เฉพาะโหมดแก้) จึงไม่ต้องยกช่อง select-all ขึ้นมาเหนือการ์ด ·
 * ตารางนี้ไม่มีแถวกางออก / แถวท้าย
 */
export function SrItemCards({
  table,
  emptyMessage,
}: {
  readonly table: Table<SrItemField>;
  readonly emptyMessage: ReactNode;
}) {
  const rows = table.getRowModel().rows;

  if (rows.length === 0) {
    return (
      <div className="border-border/60 bg-card rounded-lg border py-6">
        {emptyMessage}
      </div>
    );
  }

  const label = (cell: Cell<SrItemField, unknown>) => {
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
                {renderCell(cells.get("product_id"))}
              </div>
              {cells.has("action") && (
                <div className="shrink-0">
                  {renderCell(cells.get("action"))}
                </div>
              )}
            </div>

            <dl className={cn(GRID, "px-3 pb-3")}>
              {fieldCells.map((cell) => {
                const content = cellContent(cell);
                if (content == null) return null;
                return (
                  <Field key={cell.id} label={label(cell)}>
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
