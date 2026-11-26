import type { ReactNode } from "react";
import { flexRender, type Table } from "@tanstack/react-table";
import { Trash2 } from "lucide-react";
import { useTranslations } from "use-intl";
import { Button } from "@/components/ui/button";

/** คอลัมน์ที่การ์ดวางเอง ไม่ใช่ช่องในกริดป้าย+ค่า */
const OWN_SLOTS = new Set(["index", "product_id", "action"]);

/**
 * รายการของใบปรับปรุงในกล่องแคบ (< 560px วัดจากกล่อง ไม่ใช่จอ) — การ์ดแถวละใบแทนตารางที่ถูกบีบ
 * (กฎ "table on a detail page" ของ carmen-blue-ui-design)
 *
 * เรนเดอร์ cell ของ `table` ตัวเดียวกับตาราง (ProductCell · ช่องกรอก Qty/ต้นทุน · ยอดรวม · Dim)
 * logic ของช่องจึงอยู่ที่เดียว · คอลัมน์ที่ตารางซ่อน (เช่นต้นทุนของใบจ่ายออกตอนแก้) การ์ดก็ไม่มี
 * ตัวเลขในการ์ดชิดซ้ายตามป้าย (ในตารางชิดขวาตามคอลัมน์) · แถบชิป dimension ท้ายการ์ดมาจาก
 * `footerContent` ของตาราง (มีเฉพาะเมื่อเปิดใช้)
 */
export function IaItemCards<T>({
  table,
  disabled,
  onDelete,
  empty,
}: {
  readonly table: Table<T>;
  readonly disabled: boolean;
  readonly onDelete: (index: number) => void;
  readonly empty: ReactNode;
}) {
  const tc = useTranslations("common");
  const rows = table.getRowModel().rows;
  if (rows.length === 0)
    return <div className="rounded-lg border">{empty}</div>;

  return (
    <ul className="flex flex-col gap-2">
      {rows.map((row) => {
        const cells = row.getVisibleCells();
        const product = cells.find((c) => c.column.id === "product_id");
        const rest = cells.filter((c) => !OWN_SLOTS.has(c.column.id));
        const footer = cells.find((c) => c.column.columnDef.meta?.footerContent)
          ?.column.columnDef.meta?.footerContent;
        return (
          <li
            key={row.id}
            className="border-border/60 bg-card rounded-xl border p-3 text-xs"
          >
            <div className="flex items-start gap-2">
              <span className="text-muted-foreground w-5 shrink-0 pt-1 tabular-nums">
                {row.index + 1}
              </span>
              <div className="min-w-0 flex-1">
                {product &&
                  flexRender(
                    product.column.columnDef.cell,
                    product.getContext(),
                  )}
              </div>
              {!disabled && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={tc("delete")}
                  title={tc("delete")}
                  className="shrink-0"
                  onClick={() => onDelete(row.index)}
                >
                  <Trash2 />
                </Button>
              )}
            </div>
            <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 ps-7">
              {rest.map((cell) => {
                const header = cell.column.columnDef.header;
                return (
                  <div key={cell.id} className="min-w-0">
                    <dt className="text-muted-foreground mb-0.5">
                      {typeof header === "string" ? header : null}
                    </dt>
                    <dd className="min-w-0 tabular-nums [&_.justify-center]:justify-start [&_.justify-end]:justify-start [&_.text-center]:text-left [&_.text-right]:text-left">
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </dd>
                  </div>
                );
              })}
            </dl>
            {footer && (
              <div className="empty:hidden">{footer(row.original)}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
