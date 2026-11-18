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
import { formatCurrency } from "@/lib/currency-utils";
import { cn } from "@/lib/utils";
import { useElementWidth } from "@/hooks/use-element-width";
import { CN_STATUS, type CnStockMovementItem } from "@/types/credit-note";
import { useCnStockMovements } from "./use-credit-note";

const NO_LOT = "-";

/**
 * กล่องแคบกว่านี้การ์ดแถวละใบ (แนวเดียวกับตารางสต๊อกของ GRN) — มือถือ 9 คอลัมน์บีบเหลือ
 * 26–58px หัว "Returned"/"Out" ทับกัน ตัวเลขเหลือ "0" · tablet แนวตั้ง (กล่อง ~630px)
 * ก็ยังตัดหน่วย "PACK" และหัว "Returned" เกินช่อง จึงสูงกว่าของ GRN (600, 8 คอลัมน์)
 */
const CARD_BELOW = 700;
/**
 * กล่องกว้างกว่านี้ให้คอลัมน์สินค้ารับที่เหลือ ที่เหลือกว้างคงที่ — ต้องเกินผลรวม size
 * (1160) ไม่งั้น grow ล็อกตารางที่ผลรวมแล้วเลื่อนแนวนอน
 */
const GROW_FROM = 1200;

/**
 * ใบนี้ดูการเคลื่อนไหวสต๊อกได้หรือยัง — เกณฑ์เดียวกับ SR: เฉพาะใบที่ปิดจบแล้ว
 * ก่อนถึง completed ของยังไม่ขยับจริง โชว์ตารางไว้มีแต่ทำให้คนเข้าใจว่าตัดสต๊อกแล้ว
 */
export function cnStockVisible(docStatus?: string): boolean {
  return docStatus === CN_STATUS.COMPLETED;
}

/**
 * ตารางการเคลื่อนไหวสต๊อกของใบลดหนี้ (แท็บ Stock Movement)
 *
 * ไม่มีตัวกรองเข้า/ออกแบบ SR — ใบลดหนี้คืนของออกทางเดียว (`quantity_return` หัก
 * จากล็อตของใบรับ ส่วน `amount_discount` ปรับต้นทุนโดยไม่ขยับของเลย) ตัวกรองที่มี
 * ค่าใช้ได้ค่าเดียวคือปุ่มหลอก
 */
export function CnStockTable({
  cnId,
  docStatus,
}: {
  readonly cnId?: string;
  readonly docStatus?: string;
}) {
  "use no memo";
  const t = useTranslations("procurement.creditNote");
  const tc = useTranslations("common");
  const tfl = useTranslations("field");

  const canView = cnStockVisible(docStatus);
  const { data, isLoading, isError, error, refetch } = useCnStockMovements(
    cnId,
    { enabled: canView },
  );

  const rows = useMemo(() => data?.items ?? [], [data]);
  const [setBoxEl, boxWidth] = useElementWidth();
  const asCards = boxWidth !== undefined && boxWidth < CARD_BELOW;
  const growProduct = (boxWidth ?? 0) >= GROW_FROM;

  const columns = useMemo<ColumnDef<CnStockMovementItem>[]>(() => {
    // String(): FieldPlainText แสดง "—" เมื่อ children เป็น falsy — เลข 0 จริงต้องขึ้น 0
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

    const cols: ColumnDef<CnStockMovementItem>[] = [
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
      // ไม่มีคอลัมน์ขาเข้า — ใบลดหนี้ไม่เคยเอาของเข้า มีแต่คืนออกกับปรับเงินเปล่า ๆ
      {
        accessorKey: "return_qty",
        header: t("stockReturnQty"),
        cell: ({ row }) => qtyCell(row.original.return_qty),
        size: 110,
        meta: rightAligned,
      },
      {
        accessorKey: "qty_out",
        header: tfl("out"),
        cell: ({ row }) => qtyCell(row.original.qty_out),
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
    // ดัน py-2 ตาม DESIGN.md เหมือนตารางสต๊อกของใบเบิก
    return cols.map((col) => ({
      ...col,
      meta: {
        ...col.meta,
        cellClassName: cn("py-2 align-middle", col.meta?.cellClassName),
      },
    }));
  }, [t, tfl, growProduct]);

  const table = useReactTable({
    data: rows,
    columns,
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
  });

  if (!canView) {
    return <EmptyComponent icon={BoxIcon} title={t("stockNeedsCompleted")} />;
  }

  if (isError) {
    return <ErrorState error={error} onRetry={() => refetch()} />;
  }

  return (
    <div ref={setBoxEl} className="space-y-3">
      {/* เทียบกับ false ตรง ๆ — ฟิลด์นี้อาจไม่มีใน response ซึ่งแปลว่า "ไม่รู้"
          ไม่ใช่ "ยังไม่ได้ตัด" บอกผิดคือบอกว่าตัวเลขจริงเป็นตัวเลขคาดการณ์ */}
      {data?.is_posted === false && (
        <p className="text-muted-foreground text-xs">{t("stockNotPosted")}</p>
      )}

      {asCards && !isLoading ? (
        <CnStockCards
          rows={rows}
          empty={
            <EmptyComponent
              icon={BoxIcon}
              title={tc("noDataFound")}
              description={t("stockNoItemsDesc")}
            />
          }
        />
      ) : (
        <DataGrid
          table={table}
          recordCount={rows.length}
          isLoading={isLoading}
          emptyMessage={
            <EmptyComponent
              icon={BoxIcon}
              title={tc("noDataFound")}
              description={t("stockNoItemsDesc")}
            />
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
 * แถวสต๊อกของใบลดหนี้แบบการ์ด (กล่องแคบ) — หัวการ์ด = ลำดับ + สินค้า · กริดมีป้าย
 * แบบเดียวกับการ์ดสต๊อกของ GRN · จำนวน + หน่วยในช่องเดียว ("2 PCS")
 */
function CnStockCards({
  rows,
  empty,
}: {
  readonly rows: CnStockMovementItem[];
  readonly empty: ReactNode;
}) {
  const t = useTranslations("procurement.creditNote");
  const tfl = useTranslations("field");

  if (rows.length === 0) {
    return (
      <div className="border-border/60 bg-card rounded-lg border py-6">
        {empty}
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {rows.map((row) => {
        const lot = row.lot_no && row.lot_no !== NO_LOT ? row.lot_no : null;
        const qty = (value: number) => (
          <>
            {value ?? 0}
            {row.inventory_unit_name && (
              <span className="text-muted-foreground ms-1">
                {row.inventory_unit_name}
              </span>
            )}
          </>
        );
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
            key: "return",
            label: t("stockReturnQty"),
            value: qty(row.return_qty),
          },
          { key: "out", label: tfl("out"), value: qty(row.qty_out) },
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
            className="border-border/60 bg-card @container rounded-lg border text-xs"
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
