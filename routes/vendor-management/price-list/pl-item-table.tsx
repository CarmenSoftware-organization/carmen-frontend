import { useMemo } from "react";
import type { UseFormReturn } from "react-hook-form";
import { useTranslations } from "use-intl";
import {
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import {
  DataGrid,
  DataGridContainer,
} from "@/components/ui/data-grid/data-grid";
import { DataGridTable } from "@/components/ui/data-grid/data-grid-table";
import { DuplicateProductDialog } from "@/components/share/duplicate-product-dialog";
import { useDuplicateProductConfirm } from "@/hooks/use-duplicate-product-confirm";
import type { PriceList } from "@/types/price-list";
import type { PriceListFormValues } from "./pl-form-schema";
import { buildPlItemColumns } from "./pl-item-columns";
import type { DetailField } from "./pl-item-cells";
import { PLItemGroupedView } from "./pl-item-grouped-view";
import { toGroupableDetail } from "./pl-product-grouping";

interface PLItemTableProps {
  readonly form: UseFormReturn<PriceListFormValues>;
  readonly detailFields: DetailField[];
  readonly detailRefs?: PriceList["pricelist_detail"];
  readonly isView: boolean;
  readonly isDisabled: boolean;
  readonly onRequestRemove: (idx: number) => void;
}

/**
 * Dispatcher: view mode → grouped read-only table (product ซ้ำ group เป็นกลุ่ม);
 * edit/add → editable DataGrid เดิม แยกเป็นคนละ component เพื่อให้ hooks ของแต่ละ
 * ฝั่งเรียกแบบ unconditional (ไม่ชน rules-of-hooks) และ edit path ไม่เปลี่ยน
 */
export function PLItemTable(props: PLItemTableProps) {
  if (props.isView)
    return (
      <PLItemGroupedView
        detailRefs={(props.detailRefs ?? []).map(toGroupableDetail)}
        showNote
      />
    );
  return <PLItemEditTable {...props} />;
}

function PLItemEditTable({
  form,
  detailFields,
  detailRefs,
  isView,
  isDisabled,
  onRequestRemove,
}: PLItemTableProps) {
  "use no memo";
  const tfl = useTranslations("field");
  const t = useTranslations("vendorManagement.priceList");
  const tc = useTranslations("common");
  const removeLabel = t("detail.removeItem");
  const incVatLabel = tc("incVat");
  const dupConfirm = useDuplicateProductConfirm();
  const columns = useMemo<ColumnDef<DetailField>[]>(
    () =>
      buildPlItemColumns({
        form,
        detailRefs,
        isView,
        isDisabled,
        onRequestRemove,
        tfl,
        incVatLabel,
        removeLabel,
        confirmDuplicate: dupConfirm.confirm,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dupConfirm.confirm is stable
    [
      form,
      isView,
      isDisabled,
      tfl,
      onRequestRemove,
      removeLabel,
      incVatLabel,
      detailRefs,
    ],
  );

  const table = useReactTable({
    data: detailFields,
    columns,
    // key rows by the stable useFieldArray id (ไม่ใช่ index) — ไม่งั้น prepend
    // ทำให้ cell ที่ index เดิมไม่ remount แล้ว lookup โชว์ค่าเดิมค้าง (stale)
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <>
      <DataGrid
        table={table}
        recordCount={detailFields.length}
        tableLayout={{
          headerSticky: true,
          // โหมดอ่านชิดบน — ชื่อสินค้ามีบรรทัดรอง เซลล์อื่นไม่มี
          cellAlign: isView ? "top" : "middle",
        }}
      >
        <DataGridContainer>
          <DataGridTable />
        </DataGridContainer>
      </DataGrid>
      <DuplicateProductDialog {...dupConfirm.dialogProps} />
    </>
  );
}
