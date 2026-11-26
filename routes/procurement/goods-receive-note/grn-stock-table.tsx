import { useMemo, type ReactNode } from "react";
import { useTranslations } from "use-intl";
import { BoxIcon } from "lucide-react";
import {
  type ColumnDef,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  DataGrid,
  DataGridContainer,
} from "@/components/ui/data-grid/data-grid";
import { DataGridTable } from "@/components/ui/data-grid/data-grid-table";
import { FieldPlainText } from "@/components/ui/field";
import { NameWithSubtext } from "@/components/share/name-with-sub-text";
import { ErrorState } from "@/components/ui/error-state";
import EmptyComponent from "@/components/empty-component";
import { useGrnStockMovements } from "@/hooks/use-goods-receive-note";
import { useProfile } from "@/hooks/use-profile";
import { formatCurrency } from "@/lib/currency-utils";
import { cn } from "@/lib/utils";
import { useElementWidth } from "@/hooks/use-element-width";
import type { GrnStockMovementItem } from "@/types/goods-receive-note";

const NO_LOT = "-";

/**
 * กล่องแคบกว่านี้ (มือถือ) 8 คอลัมน์บีบเหลือ 29–64px ชื่อสินค้า/ราคาถูกตัดเหลือไม่กี่ตัว
 * → การ์ดแถวละใบ · tablet (กล่อง ~630px) ตารางยังพอ ไม่มีช่องถูกตัด
 */
const CARD_BELOW = 600;
/**
 * กล่องกว้างกว่านี้ให้คอลัมน์สินค้ารับที่เหลือ ที่เหลือกว้างคงที่ — ไม่งั้นทุกคอลัมน์ยืดตาม
 * สัดส่วน ตัวเลขกระจายห่างกันหลายร้อย px (1920) · ต้องเกินผลรวม size (1040) ไม่งั้น grow
 * ล็อกตารางที่ผลรวมแล้วเลื่อนแนวนอน
 */
const GROW_FROM = 1100;

/**
 * ใบนี้ดูการเคลื่อนไหวสต๊อกได้หรือยัง — เกณฑ์คือ "ของเข้าคลังแล้วหรือยัง"
 *
 * FIFO ลงสต๊อกตอน commit จึงเห็นเมื่อ committed เท่านั้น ส่วนต้นทุนเฉลี่ย
 * (`average` / `average_per_location`) ลงสต๊อกตั้งแต่ตอน save ทั้งที่ใบยังเป็น saved
 * ถ้ารอถึง committed ผู้ใช้จะไม่เห็นของที่เข้าคลังไปแล้วจริง · ใบ AVG ที่ลงวันที่งวดหลัง
 * ถูกพักไว้ยังไม่ลงสต๊อก — ตารางยังแสดงได้ เพราะหลังบ้านส่ง `is_posted: false`
 * มากับแถวคาดการณ์ แล้วตารางขึ้นข้อความ `stockNotPosted` กำกับ
 */
export function grnStockVisible(
  docStatus?: string,
  calculationMethod?: string | null,
): boolean {
  if (docStatus === "committed") return true;
  const isAverage =
    calculationMethod === "average" ||
    calculationMethod === "average_per_location";
  return docStatus === "saved" && isAverage;
}

/**
 * ตารางการเคลื่อนไหวสต๊อกของใบรับสินค้า (แท็บ Stock Movement)
 *
 * ไม่มีคอลัมน์ขาออก — ใบรับสินค้าเอาของเข้าทางเดียว ของที่คืนกลับผู้ขายเป็นเรื่อง
 * ของใบลดหนี้ (ดู `CnStockTable` ซึ่งเป็นด้านกลับกันของตารางนี้)
 */
export function GrnStockTable({
  grnId,
  docStatus,
}: {
  readonly grnId?: string;
  readonly docStatus?: string;
}) {
  "use no memo";
  const t = useTranslations("procurement.goodsReceiveNote");
  const tc = useTranslations("common");
  const tfl = useTranslations("field");

  const { defaultBu } = useProfile();
  const canView = grnStockVisible(
    docStatus,
    defaultBu?.config?.calculation_method,
  );
  const { data, isLoading, isError, error, refetch } = useGrnStockMovements(
    grnId,
    { enabled: canView },
  );

  const rows = useMemo(() => data?.items ?? [], [data]);
  const [setBoxEl, boxWidth] = useElementWidth();
  const asCards = boxWidth !== undefined && boxWidth < CARD_BELOW;
  const growProduct = (boxWidth ?? 0) >= GROW_FROM;

  const columns = useMemo<ColumnDef<GrnStockMovementItem>[]>(() => {
    // String(): FieldPlainText แสดง "—" เมื่อ children เป็น falsy — เลข 0 จริง (ใบที่ยังไม่
    // ลงสต๊อก ข้อความเหนือตารางบอกว่า "เป็นศูนย์") ต้องขึ้น 0 ไม่ใช่ขีด
    const qtyCell = (value: number) => (
      <FieldPlainText className="justify-end tabular-nums">
        {String(value ?? 0)}
      </FieldPlainText>
    );
    const moneyCell = (value: number) => (
      <FieldPlainText className="justify-end tabular-nums">
        {formatCurrency(value)}
      </FieldPlainText>
    );
    const rightAligned = {
      headerClassName: "text-right",
      cellClassName: "text-right",
    };

    const cols: ColumnDef<GrnStockMovementItem>[] = [
      {
        id: "index",
        header: "#",
        cell: ({ row }) => row.original.sequence_no,
        size: 40,
        meta: {
          headerClassName: "text-center",
          cellClassName: "text-center text-muted-foreground",
        },
      },
      {
        accessorKey: "location_name",
        header: tfl("location"),
        cell: ({ row }) => (
          <FieldPlainText>{row.original.location_name}</FieldPlainText>
        ),
        size: 200,
      },
      {
        accessorKey: "product_name",
        header: tfl("product"),
        cell: ({ row }) => (
          <NameWithSubtext
            primary={row.original.product_name}
            secondary={row.original.product_local_name ?? undefined}
          />
        ),
        size: 220,
        meta: growProduct ? { grow: true } : undefined,
      },
      {
        accessorKey: "inventory_unit_name",
        header: tfl("unit"),
        cell: ({ row }) => (
          <FieldPlainText>{row.original.inventory_unit_name}</FieldPlainText>
        ),
        size: 100,
      },
      {
        accessorKey: "lot_no",
        header: tfl("lotNo"),
        cell: ({ row }) => {
          const lot = row.original.lot_no;
          return lot && lot !== NO_LOT ? (
            <FieldPlainText>{lot}</FieldPlainText>
          ) : (
            <span className="text-muted-foreground">—</span>
          );
        },
        size: 120,
      },
      {
        accessorKey: "qty_in",
        header: tfl("in"),
        cell: ({ row }) => qtyCell(row.original.qty_in),
        size: 110,
        meta: rightAligned,
      },
      {
        accessorKey: "cost_per_unit",
        header: tfl("unitPrice"),
        cell: ({ row }) => moneyCell(row.original.cost_per_unit),
        size: 120,
        meta: rightAligned,
      },
      {
        accessorKey: "total_cost",
        header: tfl("totalAmount"),
        cell: ({ row }) => moneyCell(row.original.total_cost),
        size: 130,
        meta: rightAligned,
      },
    ];

    // DataGrid ให้ cell มาแค่ py-1 — แถวข้อมูลล้วนแบบนี้เลยดูอัดกัน
    // ดัน py-2 ตาม DESIGN.md เหมือนตารางสต๊อกของใบลดหนี้
    return cols.map((col) => ({
      ...col,
      meta: {
        ...col.meta,
        cellClassName: cn("py-2 align-middle", col.meta?.cellClassName),
      },
    }));
  }, [tfl, growProduct]);

  const table = useReactTable({
    data: rows,
    columns,
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
  });

  if (!canView) {
    return <EmptyComponent icon={BoxIcon} title={t("stockNeedsCommitted")} />;
  }

  if (isError) {
    return <ErrorState error={error} onRetry={() => refetch()} />;
  }

  return (
    <div ref={setBoxEl} className="space-y-3">
      {/* เทียบกับ false ตรง ๆ — ฟิลด์นี้อาจไม่มีใน response ซึ่งแปลว่า "ไม่รู้"
          ไม่ใช่ "ยังไม่ได้เข้าสต๊อก" บอกผิดคือบอกว่าเลขจริงเป็นเลขคาดการณ์ */}
      {data?.is_posted === false && (
        <p className="text-muted-foreground text-xs">{t("stockNotPosted")}</p>
      )}

      {asCards && !isLoading ? (
        <GrnStockCards
          rows={rows}
          empty={<EmptyComponent icon={BoxIcon} title={tc("noDataFound")} />}
        />
      ) : (
        <DataGrid
          table={table}
          recordCount={rows.length}
          isLoading={isLoading}
          emptyMessage={
            <EmptyComponent icon={BoxIcon} title={tc("noDataFound")} />
          }
        >
          <DataGridContainer>
            <DataGridTable />
          </DataGridContainer>
        </DataGrid>
      )}
    </div>
  );
}

/**
 * แถวสต๊อกแบบการ์ด (กล่องแคบ) — หัวการ์ด = ลำดับ + สินค้า · กริดมีป้ายแบบเดียวกับ
 * การ์ดรายการสินค้าของ GRN (ป้ายจางบน ค่าล่าง ชิดซ้ายทั้งคู่)
 */
function GrnStockCards({
  rows,
  empty,
}: {
  readonly rows: GrnStockMovementItem[];
  readonly empty: ReactNode;
}) {
  const tfl = useTranslations("field");

  if (rows.length === 0) {
    return (
      <div className="border-border/60 bg-card rounded-xl border py-6">
        {empty}
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {rows.map((row) => {
        const lot = row.lot_no && row.lot_no !== NO_LOT ? row.lot_no : null;
        const fields: {
          key: string;
          label: string;
          value: ReactNode;
          wide?: boolean;
        }[] = [
          {
            key: "location",
            label: tfl("location"),
            value: row.location_name,
            wide: true,
          },
          { key: "lot", label: tfl("lotNo"), value: lot },
          {
            // จำนวน + หน่วยในช่องเดียว ("10 BTL") แบบการ์ดรายการสินค้า — การ์ดสั้นลงหนึ่งแถว
            key: "in",
            label: tfl("in"),
            value: (
              <>
                {row.qty_in ?? 0}
                {row.inventory_unit_name && (
                  <span className="text-muted-foreground ms-1">
                    {row.inventory_unit_name}
                  </span>
                )}
              </>
            ),
          },
          {
            key: "price",
            label: tfl("unitPrice"),
            value: formatCurrency(row.cost_per_unit),
          },
          {
            key: "total",
            label: tfl("totalAmount"),
            value: formatCurrency(row.total_cost),
          },
        ];
        return (
          <li
            key={row.id}
            className="border-border/60 bg-card @container rounded-xl border text-xs"
          >
            <div className="flex items-start gap-2 p-3 pb-2">
              <span className="text-muted-foreground shrink-0 pt-0.5 tabular-nums">
                {row.sequence_no}
              </span>
              <div className="min-w-0 flex-1">
                <NameWithSubtext
                  primary={row.product_name}
                  secondary={row.product_local_name ?? undefined}
                  wrap
                />
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 px-3 pb-3 @md:grid-cols-3">
              {fields.map((f) => (
                <div
                  key={f.key}
                  className={cn(
                    "min-w-0",
                    f.wide && "col-span-2 @md:col-span-1",
                  )}
                >
                  <dt className="text-muted-foreground text-micro mb-0.5">
                    {f.label}
                  </dt>
                  <dd className="break-words tabular-nums">
                    {f.value === null ||
                    f.value === undefined ||
                    f.value === "" ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      f.value
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </li>
        );
      })}
    </ul>
  );
}
