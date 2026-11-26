"use no memo"; // TanStack table เป็น ref คงที่แต่ mutate ข้างใน — ดู routes/CLAUDE.md

import type { ReactNode } from "react";
import type { UseFormReturn } from "react-hook-form";
import { flexRender, type Cell, type Table } from "@tanstack/react-table";
import { useTranslations } from "use-intl";
import { cn } from "@/lib/utils";
import type { CnFormValues } from "./cn-form-schema";
import type { CnItemField } from "./use-cn-item-table";
import { ReceivedCell } from "./cn-item-cells/received-cell";
import { GrnAmountCell, GrnTaxCell } from "./cn-item-cells/grn-amount-cell";

/** คอลัมน์ที่อยู่หัวการ์ด ไม่ใช่ช่องในกริด */
const HEAD_COLUMNS = new Set(["expand", "index", "item_id", "action"]);

/** ค่าตัวเลขของ cell จัดชิดขวาไว้สำหรับตาราง — ในการ์ดป้ายอยู่บนค่า ชิดซ้ายทั้งคู่ */
const LEFT_ALIGN =
  "[&_.items-end]:items-start [&_.justify-end]:justify-start [&_.text-right]:text-left";

const GRID =
  "grid grid-cols-2 gap-x-4 gap-y-2 @md:grid-cols-3 @2xl:grid-cols-4";

/**
 * ค่าของช่องในกริด — เรียกฟังก์ชัน cell ตรง ๆ แทน `flexRender` เพราะ flexRender ห่อฟังก์ชัน
 * เป็น element เสมอ ผลจึงไม่เคยเป็น null แม้ cell คืน null (Received ของใบ amount_discount)
 * ปลอดภัยเพราะ cell ของคอลัมน์ข้อมูล CN คืน JSX ล้วน ไม่เรียก hook เอง
 */
function cellContent(cell: Cell<CnItemField, unknown>): ReactNode {
  const def = cell.column.columnDef.cell;
  return typeof def === "function"
    ? (def(cell.getContext()) as ReactNode)
    : (def ?? null);
}

function renderCell(cell: Cell<CnItemField, unknown> | undefined) {
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
 * รายการของ CN โหมดดูแบบการ์ดแถวละใบ — ใช้เมื่อกล่องแคบ (มือถือ / tablet)
 *
 * วาด cell เดิมของตารางด้วย `flexRender` (ค่าเดียวกับตารางทุกช่อง) · ส่วน "GRN Reference"
 * แทนแถวที่กางออกของตาราง: ตารางซ้อน `CnGrnRow` คิดความกว้างเป็น % ของคอลัมน์ตารางหลัก
 * ใส่ในการ์ดไม่ได้ จึงวาด cell ฝั่ง GRN ตัวเดียวกันเป็นกริดมีป้ายแทน · กาง/ยุบตาม expand
 * state เดิม ปุ่ม Expand all / Collapse all เหนือตารางจึงยังใช้ได้
 */
export function CnItemCards({
  table,
  form,
  emptyMessage,
}: {
  readonly table: Table<CnItemField>;
  readonly form: UseFormReturn<CnFormValues>;
  readonly emptyMessage: ReactNode;
}) {
  const t = useTranslations("procurement.creditNote");
  const tfl = useTranslations("field");
  const rows = table.getRowModel().rows;

  if (rows.length === 0) {
    return (
      <div className="border-border/60 bg-card rounded-xl border py-6">
        {emptyMessage}
      </div>
    );
  }

  const label = (cell: Cell<CnItemField, unknown>) => {
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
        const control = form.control;
        const index = row.index;

        return (
          <li
            key={row.id}
            className="border-border/60 bg-card @container rounded-xl border text-xs"
          >
            <div className="flex items-start gap-2 p-3 pb-2">
              {cells.has("expand") && (
                <div className="-my-0.5 -ms-1 shrink-0">
                  {renderCell(cells.get("expand"))}
                </div>
              )}
              <span className="text-muted-foreground shrink-0 pt-0.5 tabular-nums">
                {renderCell(cells.get("index"))}
              </span>
              <div className="min-w-0 flex-1">
                {renderCell(cells.get("item_id"))}
              </div>
            </div>

            <dl className={cn(GRID, "px-3 pb-3")}>
              {fieldCells.map((cell) => {
                // cell ที่ไม่มีอะไรให้แสดง (Received ของใบ amount_discount) ไม่ต้องมีป้าย
                // ลอยเปล่า ๆ — ในตารางเป็นช่องว่างใต้หัวคอลัมน์ แต่ในการ์ดดูเหมือนข้อมูลหาย
                const content = cellContent(cell);
                if (content == null) return null;
                return (
                  <Field
                    key={cell.id}
                    label={label(cell)}
                    wide={cell.column.id === "location_id"}
                  >
                    {content}
                  </Field>
                );
              })}
            </dl>

            {row.getIsExpanded() && (
              <div className="border-border/60 border-t p-3">
                <div className="text-muted-foreground mb-2 text-xs font-medium">
                  {t("groupGrnRef")}
                </div>
                <dl className={GRID}>
                  <Field label={tfl("received")}>
                    <ReceivedCell control={control} index={index} />
                  </Field>
                  <Field label={tfl("price")}>
                    <GrnAmountCell
                      control={control}
                      index={index}
                      field="_grn_price"
                    />
                  </Field>
                  <Field label={tfl("subtotal")}>
                    <GrnAmountCell
                      control={control}
                      index={index}
                      field="_grn_sub_total"
                    />
                  </Field>
                  <Field label={tfl("discount")}>
                    <GrnAmountCell
                      control={control}
                      index={index}
                      field="_grn_discount_amount"
                    />
                  </Field>
                  <Field label={t("netOrCnAmount")}>
                    <GrnAmountCell
                      control={control}
                      index={index}
                      field="_grn_net_amount"
                    />
                  </Field>
                  <Field label={tfl("tax")}>
                    <GrnTaxCell control={control} index={index} />
                  </Field>
                  <Field label={tfl("total")}>
                    <GrnAmountCell
                      control={control}
                      index={index}
                      field="_grn_total_amount"
                    />
                  </Field>
                </dl>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
