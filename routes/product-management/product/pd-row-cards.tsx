import { flexRender, type Table } from "@tanstack/react-table";
import { cn } from "@/lib/utils";

/**
 * แถวของตารางในฟอร์มสินค้าเมื่อกล่องแคบ (< 560px วัดจากกล่องเอง) — การ์ดทีละใบแทนตารางที่ถูกบีบ
 * (skill `carmen-blue-ui-design` §Tables: table on a detail page) หน้าตาเดียวกับ `CertificateCards`
 * ของ vendor · การ์ดต้องพกทุกช่องของตาราง ไม่ใช่แค่ช่องหลัก
 */
export const ROW_CARDS_BELOW = 560;

export function RowCards({ children }: { readonly children: React.ReactNode }) {
  return <ul className="flex flex-col gap-2">{children}</ul>;
}

export function RowCard({
  title,
  subtitle,
  badge,
  actions,
  children,
}: {
  readonly title: React.ReactNode;
  readonly subtitle?: React.ReactNode;
  /** มุมขวาบน — สถานะของแถว */
  readonly badge?: React.ReactNode;
  /** มุมขวาล่าง — ปุ่มของแถว (สูง 32px: `size="icon-sm"`) */
  readonly actions?: React.ReactNode;
  /** `RowCardField` ของช่องที่เหลือ */
  readonly children?: React.ReactNode;
}) {
  return (
    <li className="border-border/60 bg-card rounded-lg border p-3 text-xs">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xs font-medium break-words">{title}</div>
          {subtitle && (
            <div className="text-muted-foreground break-words">{subtitle}</div>
          )}
        </div>
        {badge && <div className="shrink-0">{badge}</div>}
      </div>
      {(children || actions) && (
        <div className="mt-2 flex items-end justify-between gap-2">
          <dl className="flex flex-wrap gap-x-5 gap-y-1 tabular-nums">
            {children}
          </dl>
          {actions && (
            <div className="flex shrink-0 items-center gap-1">{actions}</div>
          )}
        </div>
      )}
    </li>
  );
}

export function RowCardField({
  label,
  children,
}: {
  readonly label: string;
  readonly children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

/**
 * โหมดแก้ของตารางกรอกในแถวเมื่อกล่องแคบกว่าความกว้างขั้นต่ำของตาราง — การ์ดทีละแถว ช่องกรอก
 * เรียงเป็นกริด (มือถือ 2 ช่องต่อแถว กว้างขึ้นได้มากขึ้น) ไม่มีการเลื่อนแนวนอน (เดิมตาราง 852–904px เลื่อนในกล่อง 304–334px ของมือถือ)
 *
 * render `cell` ของแต่ละคอลัมน์ตัวเดิมผ่าน `flexRender` — ช่องกรอก / lookup / radio / checkbox /
 * ปุ่มลบผูกกับฟอร์มที่ column def ที่เดียว ไม่มีชุดที่สองให้หลุดกัน · ป้ายมาจาก `header` (string)
 * · `*:justify-start` ล้าง justify-end / justify-center ที่ cell ใส่ไว้ให้ตรงกับหัวคอลัมน์ของตาราง
 */
export function RowEditCards<T>({
  table,
  wide = [],
  titleColumnId = "index",
  actionColumnId = "action",
  empty,
}: {
  readonly table: Table<T>;
  /** คอลัมน์ที่กินเต็มแถวของการ์ด (lookup ชื่อยาว · ค่าที่แสดงยาว) */
  readonly wide?: readonly string[];
  /** คอลัมน์ลำดับ — ไม่เป็นช่อง แต่เป็น "#n" หัวการ์ด */
  readonly titleColumnId?: string;
  /** คอลัมน์ปุ่มของแถว — อยู่มุมขวาบนของการ์ด */
  readonly actionColumnId?: string;
  readonly empty?: React.ReactNode;
}) {
  "use no memo"; // table instance mutate ข้างในตัวเอง — ห้ามคอมไพเลอร์แช่ผลลัพธ์ (routes/CLAUDE.md)
  const rows = table.getRowModel().rows;
  if (rows.length === 0) return <>{empty}</>;
  return (
    <ul className="flex flex-col gap-2">
      {rows.map((row) => {
        const cells = row.getVisibleCells();
        const action = cells.find((c) => c.column.id === actionColumnId);
        const fields = cells.filter(
          (c) =>
            c.column.id !== titleColumnId && c.column.id !== actionColumnId,
        );
        return (
          <li
            key={row.id}
            className="border-border/60 bg-card rounded-lg border p-3 text-xs"
          >
            <div className="mb-2 flex min-h-6 items-center justify-between gap-2">
              <span className="text-muted-foreground tabular-nums">
                #{row.index + 1}
              </span>
              {action &&
                flexRender(action.column.columnDef.cell, action.getContext())}
            </div>
            {/* auto-fill 8rem: การ์ดกว้างขึ้น = ช่องต่อแถวมากขึ้น ไม่ใช่ช่องยืด (กฎข้อ 2) · มือถือ 360 การ์ดใน
                กว้าง ~278px ยังได้ 2 ช่อง (2×128 + 12) · tablet 768 ได้ 4 */}
            <div className="grid grid-cols-[repeat(auto-fill,minmax(8rem,1fr))] gap-x-3 gap-y-3">
              {fields.map((cell) => {
                const header = cell.column.columnDef.header;
                return (
                  <div
                    key={cell.id}
                    className={cn(
                      "min-w-0",
                      wide.includes(cell.column.id) && "col-span-2",
                    )}
                  >
                    <div className="text-muted-foreground mb-1">
                      {typeof header === "string" ? header : cell.column.id}
                    </div>
                    <div className="flex min-h-8 items-center">
                      <div className="w-full min-w-0 *:justify-start">
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
