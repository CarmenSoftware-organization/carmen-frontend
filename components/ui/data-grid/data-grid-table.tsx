import { CSSProperties, Fragment, ReactNode } from "react";
import { useDataGrid } from "@/components/ui/data-grid/data-grid";
import {
  Cell,
  Column,
  flexRender,
  Header,
  HeaderGroup,
  Row,
} from "@tanstack/react-table";
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { Spinner } from "@/components/ui/spinner";
import EmptyComponent from "@/components/empty-component";

const headerCellSpacingVariants = cva("", {
  variants: {
    size: {
      dense: "px-2 h-8",
      default: "px-3",
    },
  },
  defaultVariants: {
    size: "default",
  },
});

const bodyCellSpacingVariants = cva("", {
  variants: {
    size: {
      dense: "px-2 py-0.5",
      default: "px-3 py-1",
    },
  },
  defaultVariants: {
    size: "default",
  },
});

/**
 * คอลัมน์ที่กว้างคงที่เป็น px เสมอ ไม่ร่วมแบ่งเปอร์เซ็นต์
 *
 * ปกติ size ทุกคอลัมน์ถูกแปลงเป็น % ของผลรวม — ตารางที่มีไม่กี่คอลัมน์จึงให้ `#`
 * (size 60) กินไปถึง ~16% (188px ที่จอ 1440) คอลัมน์ที่เหลือยังเป็น % ที่รวมกันได้
 * 100% แล้ว table-fixed ย่อให้พอดีพื้นที่หลังหัก px (ตรวจใน Chrome แล้ว) — อย่าเปลี่ยน
 * เป็น `calc(% - px)` เพราะ Chrome มองเป็น auto แล้วแบ่งทุกคอลัมน์เท่ากัน
 *
 * ยกเว้นตารางที่กว้างตามเนื้อหา (`w-max` / `min-w-max` / `w-fit` ที่ base เช่น SR list):
 * % รวม 100 + px ทำให้ max-content เป็นอนันต์ (ตารางกว้าง 16,777,216px) — ตารางพวกนี้
 * ใช้แบบเดิม (% ของผลรวมทุกคอลัมน์ รวม `#`) และ `#` ก็ไม่กว้างเกินอยู่แล้วเพราะ
 * ตารางกว้างเท่าผลรวม size
 */
const FIXED_PX_COLUMN_IDS = new Set(["index", "select"]);
const CONTENT_SIZED_TABLE = /(^|\s)(min-)?w-(max|fit)(\s|$)/;

/** ฟังก์ชันคืน % ของหัวคอลัมน์ — `undefined` = ใช้ px จาก size */
function headerWidthPercent<TData>(
  headers: Header<TData, unknown>[],
  tableBaseClassName?: string,
) {
  const isFixed = (h: Header<TData, unknown>) =>
    !CONTENT_SIZED_TABLE.test(tableBaseClassName ?? "") &&
    FIXED_PX_COLUMN_IDS.has(h.column.id);
  const flexTotal = headers.reduce(
    (sum, h) => (isFixed(h) ? sum : sum + h.getSize()),
    0,
  );
  return (header: Header<TData, unknown>) =>
    flexTotal > 0 && !isFixed(header)
      ? (header.getSize() / flexTotal) * 100
      : undefined;
}

function getPinningStyles<TData>(column: Column<TData>): CSSProperties {
  const isPinned = column.getIsPinned();

  return {
    left: isPinned === "left" ? `${column.getStart("left")}px` : undefined,
    right: isPinned === "right" ? `${column.getAfter("right")}px` : undefined,
    position: isPinned ? "sticky" : "relative",
    width: column.getSize(),
    zIndex: isPinned ? 1 : 0,
  };
}

function DataGridTableBase({ children }: { children: ReactNode }) {
  "use no memo"; // TanStack table is stable-ref but mutable; opt out of React Compiler
  const { props, table } = useDataGrid();

  return (
    <table
      data-slot="data-grid-table"
      className={cn(
        "text-foreground w-full min-w-full caption-bottom text-left align-middle text-xs font-normal rtl:text-right",
        props.tableLayout?.width === "auto" ? "table-auto" : "table-fixed",
        !props.tableLayout?.columnsResizable && "",
        !props.tableLayout?.columnsDraggable &&
          "border-separate border-spacing-0",
        props.tableClassNames?.base,
      )}
      style={
        props.tableLayout?.columnsResizable
          ? { width: table.getTotalSize() }
          : undefined
      }
    >
      {children}
    </table>
  );
}

function DataGridTableHead({ children }: { children: ReactNode }) {
  const { props } = useDataGrid();

  return (
    <thead
      className={cn(
        props.tableClassNames?.header,
        props.tableLayout?.headerSticky && props.tableClassNames?.headerSticky,
      )}
    >
      {children}
    </thead>
  );
}

function DataGridTableHeadRow<TData>({
  children,
  headerGroup,
}: {
  children: ReactNode;
  headerGroup: HeaderGroup<TData>;
}) {
  const { props } = useDataGrid();

  return (
    <tr
      key={headerGroup.id}
      className={cn(
        "bg-muted/60 text-foreground border-b",
        props.tableLayout?.headerBorder &&
          "[&>th]:border-border/60 [&>th]:border-b",
        props.tableLayout?.cellBorder && "*:last:border-e-0",
        props.tableLayout?.stripped && "bg-transparent",
        props.tableLayout?.headerBackground === false && "bg-transparent",
        props.tableClassNames?.headerRow,
      )}
    >
      {children}
    </tr>
  );
}

function DataGridTableHeadRowCell<TData>({
  children,
  header,
  dndRef,
  dndStyle,
  widthPercent,
}: {
  children: ReactNode;
  header: Header<TData, unknown>;
  dndRef?: React.Ref<HTMLTableCellElement>;
  dndStyle?: CSSProperties;
  widthPercent?: number;
}) {
  const { props } = useDataGrid();

  const { column } = header;
  const isPinned = column.getIsPinned();
  const isLastLeftPinned =
    isPinned === "left" && column.getIsLastColumn("left");
  const isFirstRightPinned =
    isPinned === "right" && column.getIsFirstColumn("right");
  const headerCellSpacing = headerCellSpacingVariants({
    size: props.tableLayout?.dense ? "dense" : "default",
  });

  return (
    <th
      scope="col"
      key={header.id}
      ref={dndRef}
      style={{
        ...((props.tableLayout?.width === "fixed" ||
          props.tableLayout?.columnsResizable) && {
          width: props.tableLayout?.columnsResizable
            ? header.getSize()
            : widthPercent != null
              ? `${widthPercent}%`
              : header.getSize(),
        }),
        ...(props.tableLayout?.columnsPinnable &&
          column.getCanPin() &&
          getPinningStyles(column)),
        ...(dndStyle ? dndStyle : null),
      }}
      data-pinned={isPinned || undefined}
      data-last-col={
        isLastLeftPinned ? "left" : isFirstRightPinned ? "right" : undefined
      }
      className={cn(
        "text-muted-foreground relative h-9 text-left align-middle text-xs font-semibold rtl:text-right",
        headerCellSpacing,
        props.tableLayout?.cellBorder && "border-e",
        props.tableLayout?.columnsResizable &&
          column.getCanResize() &&
          "truncate",
        props.tableLayout?.columnsPinnable &&
          column.getCanPin() &&
          "[&[data-pinned][data-last-col]]:border-border data-pinned:bg-muted/90 data-pinned:backdrop-blur-xs [&:not([data-pinned]):has(+[data-pinned])_div.cursor-col-resize:last-child]:opacity-0 [&[data-last-col=left]_div.cursor-col-resize:last-child]:opacity-0 [&[data-pinned=left][data-last-col=left]]:border-e! [&[data-pinned=right]:last-child_div.cursor-col-resize:last-child]:opacity-0 [&[data-pinned=right][data-last-col=right]]:border-s!",
        header.column.columnDef.meta?.headerClassName,
        column.getIndex() === 0 ||
          column.getIndex() === header.headerGroup.headers.length - 1
          ? props.tableClassNames?.edgeCell
          : "",
      )}
    >
      {children}
    </th>
  );
}

function DataGridTableHeadRowCellResize<TData>({
  header,
}: {
  header: Header<TData, unknown>;
}) {
  const { column } = header;

  return (
    <div
      {...{
        onDoubleClick: () => column.resetSize(),
        onMouseDown: header.getResizeHandler(),
        onTouchStart: header.getResizeHandler(),
        className:
          "absolute top-0 h-full w-4 cursor-col-resize user-select-none touch-none -end-2 z-10 flex justify-center before:absolute before:w-px before:inset-y-0 before:bg-transparent hover:before:bg-border before:-translate-x-px",
      }}
    />
  );
}

function DataGridTableBody({ children }: { children: ReactNode }) {
  const { props } = useDataGrid();

  return (
    <tbody
      className={cn(
        "[&_tr:last-child]:border-0",
        "[&>tr:has(+[data-slot=footer-row])>td]:border-b-0",
        props.tableLayout?.rowRounded && "[&_td:first-child]:rounded-l-lg",
        props.tableLayout?.rowRounded && "[&_td:last-child]:rounded-r-lg",
        props.tableClassNames?.body,
      )}
    >
      {children}
    </tbody>
  );
}

/**
 * สีสลับแถวคิดจาก **ลำดับของข้อมูล** ไม่ใช่ `:nth-child(odd)` ของ DOM
 *
 * ตารางที่มี footer row (หมายเหตุรายแถว) แทรกระหว่างแถวข้อมูล ทำให้ลำดับใน DOM
 * เป็น data-footer-data-footer… แถวข้อมูลจึงตกอยู่ตำแหน่งคี่หมดทุกแถว = ไม่สลับสี
 * เลยสักแถว · คิดจาก `row.index` แล้ว footer หยิบสีของแถวแม่ไปใช้ได้ด้วย แถวข้อมูล
 * กับแถวย่อยของมันจึงเป็นก้อนสีเดียวกัน
 *
 * ใช้ token `--accent` ไม่ใช่ `--muted` — บนพื้น card ของโหมดมืด สี muted ห่างจาก
 * card แค่ขั้นเดียว มองแทบไม่ออก ส่วน accent เป็น "พื้นผิวที่สว่างที่สุดของโหมดมืด /
 * เข้มที่สุดของโหมดสว่าง" (ดู docs/DESIGN.md) จึงห่างพอในทั้งสองธีม
 *
 * โหมดสว่างลดความทึบเหลือ 65% — พื้น card เป็นขาวล้วน แถบ accent เต็มค่าเลยหนัก
 * เกินไปจนแย่งความสนใจไปจากตัวข้อมูล ส่วนโหมดมืดใช้เต็มค่าเพราะพื้นเข้มกลืนอยู่แล้ว
 */
function stripeClass(index: number, stripped?: boolean) {
  // `DataGrid` เติม default ให้แล้ว (เปิด) — ตารางไหนไม่เอาส่ง `stripped: false`
  if (!stripped) return undefined;
  return index % 2 === 0
    ? "bg-accent/65 hover:bg-accent/65 dark:bg-accent dark:hover:bg-accent"
    : "hover:bg-transparent";
}

function DataGridTableBodyRowSkeleton({ children }: { children: ReactNode }) {
  "use no memo"; // TanStack table is stable-ref but mutable; opt out of React Compiler
  const { table, props } = useDataGrid();

  return (
    <tr
      className={cn(
        "hover:bg-muted/40 data-[state=selected]:bg-primary/5 transition-colors duration-150",
        props.onRowClick && "cursor-pointer",
        !props.tableLayout?.stripped &&
          props.tableLayout?.rowBorder &&
          "[&:not(:last-child)>td]:border-border/50 [&:not(:last-child)>td]:border-b",
        props.tableLayout?.cellBorder && "*:last:border-e-0",
        props.tableLayout?.stripped !== false &&
          "odd:bg-accent/65 dark:odd:bg-accent hover:bg-transparent",
        table.options.enableRowSelection && "*:first:relative",
        props.tableClassNames?.bodyRow,
      )}
    >
      {children}
    </tr>
  );
}

function DataGridTableBodyRowSkeletonCell<TData>({
  children,
  column,
}: {
  children: ReactNode;
  column: Column<TData>;
}) {
  "use no memo"; // TanStack table is stable-ref but mutable; opt out of React Compiler
  const { props, table } = useDataGrid();
  const bodyCellSpacing = bodyCellSpacingVariants({
    size: props.tableLayout?.dense ? "dense" : "default",
  });

  return (
    <td
      style={
        props.tableLayout?.columnsResizable
          ? { width: column.getSize() }
          : undefined
      }
      className={cn(
        props.tableLayout?.cellAlign === "top" ? "align-top" : "align-middle",
        bodyCellSpacing,
        props.tableLayout?.cellBorder && "border-e",
        props.tableLayout?.columnsResizable &&
          column.getCanResize() &&
          "truncate",
        column.columnDef.meta?.cellClassName,
        props.tableLayout?.columnsPinnable &&
          column.getCanPin() &&
          '[&[data-pinned][data-last-col]]:border-border data-pinned:bg-background/90 data-pinned:backdrop-blur-xs" [&[data-pinned=left][data-last-col=left]]:border-e! [&[data-pinned=right][data-last-col=right]]:border-s!',
        column.getIndex() === 0 ||
          column.getIndex() === table.getVisibleFlatColumns().length - 1
          ? props.tableClassNames?.edgeCell
          : "",
      )}
    >
      {children}
    </td>
  );
}

function DataGridTableBodyRow<TData>({
  children,
  row,
  dndRef,
  dndStyle,
}: {
  children: ReactNode;
  row: Row<TData>;
  dndRef?: React.Ref<HTMLTableRowElement>;
  dndStyle?: CSSProperties;
}) {
  "use no memo"; // TanStack table is stable-ref but mutable; opt out of React Compiler
  const { props, table } = useDataGrid();

  return (
    <tr
      ref={dndRef}
      style={{ ...(dndStyle ? dndStyle : null) }}
      data-state={
        table.options.enableRowSelection && row.getIsSelected()
          ? "selected"
          : undefined
      }
      tabIndex={props.onRowClick ? 0 : undefined}
      role={props.onRowClick ? "button" : undefined}
      onClick={() => props.onRowClick && props.onRowClick(row.original)}
      onKeyDown={
        props.onRowClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                props.onRowClick!(row.original);
              }
            }
          : undefined
      }
      className={cn(
        "hover:bg-muted/40 data-[state=selected]:bg-primary/5 transition-colors duration-150",
        props.onRowClick &&
          "focus-visible:ring-ring/50 cursor-pointer focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset",
        !props.tableLayout?.stripped &&
          props.tableLayout?.rowBorder &&
          "[&:not(:last-child)>td]:border-border/50 [&:not(:last-child)>td]:border-b",
        props.tableLayout?.cellBorder && "*:last:border-e-0",
        stripeClass(row.index, props.tableLayout?.stripped),
        table.options.enableRowSelection && "*:first:relative",
        props.tableClassNames?.bodyRow,
      )}
    >
      {children}
    </tr>
  );
}

function DataGridTableBodyRowExpandded<TData>({ row }: { row: Row<TData> }) {
  "use no memo"; // TanStack table is stable-ref but mutable; opt out of React Compiler
  const { props, table } = useDataGrid();

  const expandedCol = table
    .getAllColumns()
    .find((column) => column.columnDef.meta?.expandedContent);
  const total = row.getVisibleCells().length;
  // เว้น column ซ้าย (colSpan) ให้ content เริ่มตรงขอบ column ที่ระบุ —
  // table-fixed จัดความกว้างตาม size ของ column จริง ไม่ต้องคำนวณ % เอง
  const start = Math.min(
    expandedCol?.columnDef.meta?.expandedColStart ?? 0,
    Math.max(0, total - 1),
  );

  const leading = expandedCol?.columnDef.meta?.expandedLeading?.(row);

  return (
    <tr
      className={cn(
        props.tableLayout?.rowBorder && "[&:not(:last-child)>td]:border-b",
        // สีเดียวกับแถวแม่ — แถวที่กางออกคือรายละเอียดของรายการเดียวกัน
        stripeClass(row.index, props.tableLayout?.stripped),
      )}
    >
      {start > 0 && (
        <td
          colSpan={start}
          className="px-2 align-top"
          aria-hidden={leading ? undefined : true}
        >
          {leading}
        </td>
      )}
      <td colSpan={total - start}>
        {expandedCol?.columnDef.meta?.expandedContent?.(row.original)}
      </td>
    </tr>
  );
}

function DataGridTableBodyRowFooter<TData>({ row }: { row: Row<TData> }) {
  const { props } = useDataGrid();

  const visibleCells = row.getVisibleCells();
  const footerIdx = visibleCells.findIndex(
    (cell) => cell.column.columnDef.meta?.footerContent,
  );

  if (footerIdx === -1) return null;

  const footerCol = visibleCells[footerIdx].column;
  const colSpan = footerCol.columnDef.meta?.footerColSpan ?? 1;
  const remaining = Math.max(0, visibleCells.length - footerIdx - colSpan);

  return (
    <tr
      data-slot="footer-row"
      className={cn(
        // แถวสุดท้ายไม่ต้องมีเส้นปิดท้าย เหมือนแถวข้อมูลปกติ — กล่องตารางมีขอบ
        // ของตัวเองอยู่แล้ว เส้นซ้ำเข้าไปอีกชั้นจะกลายเป็นเส้นคู่ห่างกันเท่ากับ
        // ที่ว่างของแถบเลื่อน ดูเป็นของเสียมากกว่าของตั้งใจ (PR เป็นหน้าเดียวที่
        // ใช้ footerContent จึงเป็นหน้าเดียวที่มีเส้นนี้ ต่างจาก PO/GRN/CN)
        "[&:not(:last-child)>td]:border-border/50 [&:not(:last-child)>td]:border-b",
        // สีเดียวกับแถวแม่ — แถวหมายเหตุเป็นส่วนหนึ่งของรายการเดียวกัน ไม่ใช่แถวใหม่
        stripeClass(row.index, props.tableLayout?.stripped),
        props.tableClassNames?.bodyRow,
      )}
    >
      {footerIdx > 0 && <td colSpan={footerIdx} />}
      <td colSpan={colSpan}>
        {footerCol.columnDef.meta?.footerContent?.(row.original)}
      </td>
      {remaining > 0 && <td colSpan={remaining} />}
    </tr>
  );
}

function DataGridTableBodyRowCell<TData>({
  children,
  cell,
  dndRef,
  dndStyle,
}: {
  children: ReactNode;
  cell: Cell<TData, unknown>;
  dndRef?: React.Ref<HTMLTableCellElement>;
  dndStyle?: CSSProperties;
}) {
  const { props } = useDataGrid();

  const { column, row } = cell;
  const isPinned = column.getIsPinned();
  const isLastLeftPinned =
    isPinned === "left" && column.getIsLastColumn("left");
  const isFirstRightPinned =
    isPinned === "right" && column.getIsFirstColumn("right");
  const bodyCellSpacing = bodyCellSpacingVariants({
    size: props.tableLayout?.dense ? "dense" : "default",
  });

  return (
    <td
      key={cell.id}
      ref={dndRef}
      {...(props.tableLayout?.columnsDraggable && !isPinned ? { cell } : {})}
      style={{
        ...(props.tableLayout?.columnsResizable && {
          width: column.getSize(),
        }),
        ...(props.tableLayout?.columnsPinnable &&
          column.getCanPin() &&
          getPinningStyles(column)),
        ...(dndStyle ? dndStyle : null),
      }}
      data-pinned={isPinned || undefined}
      data-last-col={
        isLastLeftPinned ? "left" : isFirstRightPinned ? "right" : undefined
      }
      className={cn(
        props.tableLayout?.cellAlign === "top" ? "align-top" : "align-middle",
        // ทุกแถวสูงเท่ากับข้อความ 2 บรรทัดเสมอ แม้เนื้อหามีบรรทัดเดียว — `h` บน
        // table-cell ทำตัวเป็นความสูงขั้นต่ำ (`2lh` อิง line-height จริงของเซลล์
        // ไม่ผูกกับ font size ที่แต่ละหน้าตั้งไว้) จังหวะแถวจะได้ไม่กระโดดตามความยาวชื่อ
        //
        // ต้องบวก padding แนวตั้งเข้าไปเอง เพราะ box-sizing เป็น border-box ทั้งโปรเจกต์
        // `h-[2lh]` เปล่า ๆ จึงเหลือที่ให้ข้อความแค่ 2lh ลบ padding = ไม่ถึงสองบรรทัด
        //
        // เผื่อไว้เกิน 2lh อีกนิด (+0.25rem) เพราะ `lh` คิดจาก line-height ของ **เซลล์**
        // แต่บรรทัดจริงในเซลล์ไม่ได้ใช้ค่านั้นเสมอ — บรรทัดรองเป็นฟอนต์เล็กกว่า และ
        // ข้อความไทยต้องการกล่องสูงกว่าเพราะซ้อนได้ถึงสามชั้น (สระบน + วรรณยุกต์)
        // พอรวมกันเกิน 2lh เมื่อไร `overflow:hidden` ของ line-clamp จะเฉือนทั้งหัว
        // และท้าย (align-middle ดันเนื้อหาล้นออกสองด้านเท่า ๆ กัน) — เจอจริงที่ชื่อ
        // สินค้าไทยอย่าง "ลูกชิ้นหมู" วรรณยุกต์หายทั้งคอลัมน์
        props.tableLayout?.rowClamp &&
          (props.tableLayout?.dense
            ? "h-[calc(2lh+0.5rem)]"
            : "h-[calc(2lh+0.75rem)]"),
        bodyCellSpacing,
        props.tableLayout?.cellBorder && "border-e",
        props.tableLayout?.columnsResizable &&
          column.getCanResize() &&
          "truncate",
        cell.column.columnDef.meta?.cellClassName,
        props.tableLayout?.columnsPinnable &&
          column.getCanPin() &&
          '[&[data-pinned][data-last-col]]:border-border data-pinned:bg-background/90 data-pinned:backdrop-blur-xs" [&[data-pinned=left][data-last-col=left]]:border-e! [&[data-pinned=right][data-last-col=right]]:border-s!',
        column.getIndex() === 0 ||
          column.getIndex() === row.getVisibleCells().length - 1
          ? props.tableClassNames?.edgeCell
          : "",
      )}
    >
      {props.tableLayout?.rowClamp ? (
        // ตัดที่ 2 บรรทัดพร้อม ellipsis — ความสูงคงที่มาจาก `h-[2lh]` ที่ตัว `<td>`
        // **ห้ามใส่ min-h ที่ div ตัวนี้**: -webkit-box เรียงลูกจากบนลงล่าง พอ div
        // สูงเท่าเซลล์ เนื้อหาทุกคอลัมน์จะไปกองชิดขอบบนแทนที่จะอยู่กลาง (เจอมาแล้ว)
        // ปล่อยให้ div สูงตามเนื้อหาจริง แล้วให้ `align-middle` ของ td จัดกลางให้
        //
        // ต้องเป็น div ครอบ ไม่ใช่ใส่ที่ td ตรง ๆ เพราะ line-clamp ตั้ง
        // `display: -webkit-box` ซึ่งจะทำลาย `display: table-cell` ของ td
        // (ด้วยเหตุผลเดียวกัน ตารางที่เซลล์มี input/select ต้องปิด `rowClamp`)
        //
        // ต้อง clamp ตัวลูกด้วย ไม่ใช่แค่ตัวครอบ: -webkit-box นับ "บรรทัด" จาก
        // inline content ของตัวเอง เซลล์ที่เนื้อหาห่อด้วย element (เช่น `CellAction`
        // ของคอลัมน์เลขที่เอกสาร) จึงนับเป็นกล่องเดียว = 1 บรรทัดเสมอ แล้วไม่ตัดอะไร
        // เลย — ข้อความยาวยืดแถวเป็นสามสี่บรรทัดตามใจ ส่วน `max-w-full` กันลูกที่
        // กว้างตาม max-content (ปุ่ม) ไม่ให้ล้นไปทับคอลัมน์ถัดไป
        //
        // ยกเว้นลูกที่เป็น component ของ design system (`data-slot`) — badge/checkbox
        // พวกนี้เป็น inline-flex การเปลี่ยนเป็น -webkit-box ทำให้ของข้างในหาย
        // (จุดสีของ StatusDotBadge หายไปทั้งคอลัมน์มาแล้ว) และมันสั้นอยู่แล้วไม่ต้องตัด
        // ps-px + -ms-px ขยายกล่อง clip ไปทางซ้าย 1px โดยตำแหน่งข้อความไม่ขยับ
        // (margin ลบหักล้าง padding พอดี) — `line-clamp` คือ overflow:hidden ที่
        // ขอบกล่องตรงกับจุดเริ่มข้อความพอดี ส่วนสระหน้าไทย (ไ โ ใ) มี left side
        // bearing ยื่นซ้ายเกิน advance width หัวสระเลยโดนเฉือนทุกเซลล์ที่ขึ้นต้น
        // ด้วยสระพวกนี้ · padding ของ `<td>` ช่วยไม่ได้ เพราะ clip เกิดที่ div นี้
        <div className="-ms-px line-clamp-2 ps-px [&>*]:max-w-full [&>*:not([data-slot])]:-ms-px [&>*:not([data-slot])]:line-clamp-2 [&>*:not([data-slot])]:ps-px">
          {children}
        </div>
      ) : (
        children
      )}
    </td>
  );
}

function DataGridTableEmpty() {
  "use no memo"; // TanStack table is stable-ref but mutable; opt out of React Compiler
  const { table, props } = useDataGrid();
  const totalColumns = table.getAllColumns().length;

  return (
    <tr>
      <td
        colSpan={totalColumns}
        className="text-muted-foreground h-32 text-center text-sm"
      >
        {props.emptyMessage || <EmptyComponent />}
      </td>
    </tr>
  );
}

function DataGridTableLoader() {
  const { props } = useDataGrid();

  return (
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
      <div className="text-muted-foreground bg-card flex items-center gap-2 rounded-lg border px-4 py-2 text-sm leading-none font-semibold">
        <Spinner className="-ml-1" />
        {props.loadingMessage || "Loading..."}
      </div>
    </div>
  );
}

function DataGridTableRowSelect<TData>({
  row,
  disabled,
}: {
  row: Row<TData>;
  disabled?: boolean;
}) {
  "use no memo"; // reads row.getIsSelected() (mutable TanStack state); opt out of React Compiler
  const isSelected = row.getIsSelected();
  return (
    <>
      {isSelected && (
        <div className="bg-primary absolute start-0 top-0 bottom-0 w-0.5 rounded-full" />
      )}
      <Checkbox
        checked={isSelected}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        disabled={disabled}
        aria-label="Select row"
        className="align-[inherit]"
      />
    </>
  );
}

function DataGridTableRowSelectAll() {
  "use no memo"; // TanStack table is stable-ref but mutable; opt out of React Compiler
  const { table, recordCount, isLoading } = useDataGrid();

  const isAllSelected = table.getIsAllPageRowsSelected();
  const isSomeSelected = table.getIsSomePageRowsSelected();

  return (
    <Checkbox
      checked={
        isSomeSelected && !isAllSelected ? "indeterminate" : isAllSelected
      }
      disabled={isLoading || recordCount === 0}
      onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
      aria-label="Select all"
      className="align-[inherit]"
    />
  );
}

function DataGridTable<TData>() {
  "use no memo"; // TanStack table is stable-ref but mutable; opt out of React Compiler
  const { table, isLoading, props } = useDataGrid();
  const pagination = table.getState().pagination;
  const showCheckbox = !!props.tableLayout?.checkbox;

  const isColumnVisible = (columnId: string) =>
    showCheckbox || columnId !== "select";

  return (
    <DataGridTableBase>
      <DataGridTableHead>
        {table.getHeaderGroups().map((headerGroup: HeaderGroup<TData>) => {
          const visibleHeaders = headerGroup.headers.filter((header) =>
            isColumnVisible(header.column.id),
          );
          const widthPercentOf = headerWidthPercent(
            visibleHeaders,
            props.tableClassNames?.base,
          );

          return (
            <DataGridTableHeadRow
              headerGroup={headerGroup}
              key={headerGroup.id}
            >
              {visibleHeaders.map((header) => {
                const { column } = header;

                return (
                  <DataGridTableHeadRowCell
                    header={header}
                    key={header.id}
                    widthPercent={widthPercentOf(header)}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                    {props.tableLayout?.columnsResizable &&
                      column.getCanResize() && (
                        <DataGridTableHeadRowCellResize header={header} />
                      )}
                  </DataGridTableHeadRowCell>
                );
              })}
            </DataGridTableHeadRow>
          );
        })}
      </DataGridTableHead>

      <DataGridTableBody>
        {isLoading &&
        props.loadingMode === "skeleton" &&
        pagination?.pageSize ? (
          // Show skeleton loading immediately
          Array.from({ length: pagination.pageSize }).map((_, rowIndex) => (
            <DataGridTableBodyRowSkeleton key={rowIndex}>
              {table
                .getVisibleFlatColumns()
                .filter((column) => isColumnVisible(column.id))
                .map((column, colIndex) => {
                  return (
                    <DataGridTableBodyRowSkeletonCell
                      column={column}
                      key={colIndex}
                    >
                      {column.columnDef.meta?.skeleton}
                    </DataGridTableBodyRowSkeletonCell>
                  );
                })}
            </DataGridTableBodyRowSkeleton>
          ))
        ) : isLoading && props.loadingMode === "spinner" ? (
          // Show spinner loading immediately
          <tr>
            <td colSpan={table.getVisibleFlatColumns().length} className="p-8">
              <div className="flex items-center justify-center">
                <Spinner className="mr-3 -ml-1" />
                {props.loadingMessage || "Loading..."}
              </div>
            </td>
          </tr>
        ) : table.getRowModel().rows.length ? (
          // Show actual data when not loading
          table.getRowModel().rows.map((row: Row<TData>) => {
            return (
              <Fragment key={row.id}>
                <DataGridTableBodyRow row={row}>
                  {row
                    .getVisibleCells()
                    .filter((cell) => isColumnVisible(cell.column.id))
                    .map((cell: Cell<TData, unknown>) => {
                      return (
                        <DataGridTableBodyRowCell cell={cell} key={cell.id}>
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext(),
                          )}
                        </DataGridTableBodyRowCell>
                      );
                    })}
                </DataGridTableBodyRow>
                <DataGridTableBodyRowFooter row={row} />
                {row.getIsExpanded() && (
                  <DataGridTableBodyRowExpandded row={row} />
                )}
              </Fragment>
            );
          })
        ) : (
          <DataGridTableEmpty />
        )}
      </DataGridTableBody>
    </DataGridTableBase>
  );
}

export {
  DataGridTable,
  DataGridTableBase,
  DataGridTableBody,
  DataGridTableBodyRow,
  DataGridTableBodyRowCell,
  DataGridTableBodyRowExpandded,
  DataGridTableBodyRowFooter,
  DataGridTableBodyRowSkeleton,
  DataGridTableBodyRowSkeletonCell,
  DataGridTableEmpty,
  DataGridTableHead,
  DataGridTableHeadRow,
  DataGridTableHeadRowCell,
  DataGridTableHeadRowCellResize,
  DataGridTableLoader,
  DataGridTableRowSelect,
  DataGridTableRowSelectAll,
  headerWidthPercent,
};
