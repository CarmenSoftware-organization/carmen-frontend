"use no memo"; // TanStack table เป็น ref คงที่แต่ mutate ข้างใน — ดู routes/CLAUDE.md

import type { ReactNode } from "react";
import { flexRender, type Cell, type Table } from "@tanstack/react-table";
import { useTranslations } from "use-intl";
import { cn } from "@/lib/utils";
import type { ItemField } from "./use-pr-item-table";

/**
 * ป้ายของแต่ละช่องในการ์ด — header ของตารางเป็นปุ่มเรียง (ฟังก์ชัน) ใช้ตรง ๆ ไม่ได้
 * คีย์ = column id (accessorKey ของคอลัมน์ที่มี accessor)
 */
const FIELD_LABEL_KEY: Record<string, string> = {
  location_id: "location",
  requested: "requested",
  approved: "approved",
  foc: "foc",
  amount: "amountCur",
  delivery_point_id: "deliveryPoint",
  delivery_date: "deliveryDate",
};

/** คอลัมน์ที่อยู่หัวการ์ด ไม่ใช่ช่องในกริด */
const HEAD_COLUMNS = new Set(["select", "index", "product_id", "action"]);

function renderCell(cell: Cell<ItemField, unknown> | undefined) {
  return cell
    ? flexRender(cell.column.columnDef.cell, cell.getContext())
    : null;
}

/**
 * รายการของ PR แบบการ์ดแถวละใบ — ใช้เมื่อกล่องแคบกว่าตารางเต็ม (มือถือ / tablet)
 *
 * ไม่ได้เขียน cell ใหม่: วาด cell ของคอลัมน์เดิมด้วย `flexRender` จาก table ตัวเดียวกัน
 * ช่องกรอก การติ๊กเลือก การกางแถว และช่องหมายเหตุจึงทำงานเหมือนในตารางทุกอย่าง
 * แถวมาจาก `getRowModel()` (ผ่านตัวกรอง + การเรียงแล้ว) และ `row.index` ยังเป็น index
 * ใน form array ตามที่ทุก cell ผูก `items.${index}` ไว้
 */
export function PrItemCards({
  table,
  emptyMessage,
}: {
  readonly table: Table<ItemField>;
  readonly emptyMessage: ReactNode;
}) {
  const tfl = useTranslations("field");
  const rows = table.getRowModel().rows;

  // header ของคอลัมน์ select คือ checkbox "เลือกทั้งหมด" — ตารางมีให้ที่หัวคอลัมน์
  // โหมดการ์ดไม่มีหัวตาราง ต้องยกมาไว้เหนือการ์ด ไม่งั้นผู้อนุมัติต้องไล่ติ๊กทีละใบ
  const selectHeader = table
    .getHeaderGroups()[0]
    ?.headers.find((h) => h.column.id === "select");
  // เรียกฟังก์ชัน header ตรง ๆ ไม่ผ่าน flexRender — flexRender ห่อฟังก์ชันเป็น element
  // เสมอ ผลจึงไม่เคยเป็น null ทั้งที่ header คืน null ในโหมดดู ป้าย "เลือกทั้งหมด" เลยลอย
  // อยู่โดยไม่มี checkbox · header นี้อ่าน state ของ table เท่านั้น ไม่เรียก hook
  const selectHeaderDef = selectHeader?.column.columnDef.header;
  const selectAll: ReactNode = selectHeader
    ? typeof selectHeaderDef === "function"
      ? (selectHeaderDef(selectHeader.getContext()) as ReactNode)
      : (selectHeaderDef ?? null)
    : null;

  const expandedCol = table
    .getAllColumns()
    .find((c) => c.columnDef.meta?.expandedContent);

  if (rows.length === 0) {
    return (
      <div className="border-border/60 bg-card rounded-lg border py-6">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {selectAll && (
        <label className="text-muted-foreground flex w-fit items-center gap-2 px-3 text-xs">
          {selectAll}
          {tfl("selectAll")}
        </label>
      )}
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
          const leading = row.getIsExpanded()
            ? expandedCol?.columnDef.meta?.expandedLeading?.(row)
            : null;

          return (
            <li
              key={row.id}
              data-pr-item-card=""
              data-state={row.getIsSelected() ? "selected" : undefined}
              className="border-border/60 bg-card data-[state=selected]:bg-muted/50 @container rounded-lg border text-xs"
            >
              <div className="flex items-start gap-2 p-3 pb-2">
                {cells.has("select") && (
                  <div className="-my-1 -ms-2 shrink-0">
                    {renderCell(cells.get("select"))}
                  </div>
                )}
                <span className="text-muted-foreground shrink-0 pt-1.5 tabular-nums">
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

              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 px-3 pb-3 @md:grid-cols-3 @2xl:grid-cols-4">
                {fieldCells.map((cell) => {
                  const labelKey = FIELD_LABEL_KEY[cell.column.id];
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
                      {labelKey && (
                        <dt className="text-muted-foreground text-micro mb-0.5">
                          {tfl(labelKey)}
                        </dt>
                      )}
                      {/* cell ตัวเลขจัดชิดขวาไว้สำหรับคอลัมน์ตาราง — ในการ์ดป้ายอยู่บนค่า
                          ชิดซ้ายทั้งคู่ถึงจะอ่านเป็นคู่เดียวกัน ป้ายกระจายคนละฝั่งไม่ได้ */}
                      <dd className="[&_.items-end]:items-start [&_.justify-end]:justify-start [&_.text-right]:text-left">
                        {renderCell(cell)}
                      </dd>
                    </div>
                  );
                })}
              </dl>

              {row.getIsExpanded() && expandedCol && (
                <div className="border-border/60 flex gap-2 border-t p-3">
                  {leading && <div className="shrink-0">{leading}</div>}
                  {/* overflow-x-auto: PrItemExpand (ราคาจาก price list ฯลฯ) เป็นกริดแนวนอน
                      ที่ออกแบบตามความกว้างตาราง ในการ์ดมือถือ/tablet คอลัมน์ท้าย ๆ จะเกินขอบ
                      ให้เลื่อนดูในกล่องตัวเองแทนการโดนตัดทิ้ง */}
                  <div className="min-w-0 flex-1 overflow-x-auto">
                    {expandedCol.columnDef.meta?.expandedContent?.(
                      row.original,
                    )}
                  </div>
                </div>
              )}

              {footerCol?.columnDef.meta?.footerContent?.(row.original)}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
