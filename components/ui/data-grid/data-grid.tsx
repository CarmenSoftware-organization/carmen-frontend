import {
  createContext,
  ReactNode,
  RefObject,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from "react";
import { Row, RowData, Table } from "@tanstack/react-table";

import { cn } from "@/lib/utils";

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    headerTitle?: string;
    headerClassName?: string;
    cellClassName?: string;
    skeleton?: ReactNode;
    expandedContent?: (row: TData) => ReactNode;
    expandedColStart?: number;
    expandedLeading?: (row: Row<TData>) => ReactNode;
    footerContent?: (row: TData) => ReactNode;
    footerColSpan?: number;
  }
}

export interface DataGridContextProps<TData extends object> {
  props: DataGridProps<TData>;
  table: Table<TData>;
  recordCount: number;
  isLoading: boolean;
}

export interface DataGridProps<TData extends object> {
  className?: string;
  table?: Table<TData>;
  recordCount: number;
  children?: ReactNode;
  onRowClick?: (row: TData) => void;
  isLoading?: boolean;
  loadingMode?: "skeleton" | "spinner";
  loadingMessage?: ReactNode | string;
  emptyMessage?: ReactNode | string;
  tableLayout?: {
    dense?: boolean;
    cellBorder?: boolean;
    rowBorder?: boolean;
    rowRounded?: boolean;
    stripped?: boolean;
    headerBackground?: boolean;
    headerBorder?: boolean;
    headerSticky?: boolean;
    width?: "auto" | "fixed";
    columnsVisibility?: boolean;
    columnsResizable?: boolean;
    columnsPinnable?: boolean;
    columnsMovable?: boolean;
    columnsDraggable?: boolean;
    rowsDraggable?: boolean;
    checkbox?: boolean;
    /**
     * บังคับให้ทุกแถวสูงเท่ากับข้อความ 2 บรรทัดเสมอ เนื้อหาที่ยาวกว่านั้นตัดด้วย
     * ellipsis (default `true`) — ตารางอ่านอย่างเดียวจะได้จังหวะแถวสม่ำเสมอ
     * ไม่กระโดดตามความยาวชื่อสินค้า
     *
     * **ปิดในตารางที่เซลล์มี input/select/ปุ่ม** — ตัว clamp ใช้
     * `display: -webkit-box` ซึ่งทำ layout ของ control ข้างในเพี้ยน
     */
    rowClamp?: boolean;
    /**
     * เนื้อหาในเซลล์ชิดบนหรือกึ่งกลางแนวตั้ง (default `"middle"`)
     *
     * **`"top"` สำหรับตารางอ่านอย่างเดียวที่บางเซลล์มีบรรทัดรอง** (รหัสใต้ชื่อ ·
     * เปอร์เซ็นต์ใต้ยอดเงิน) — กึ่งกลางจะทำให้เซลล์บรรทัดเดียวลอยอยู่ระหว่างสอง
     * บรรทัดของเพื่อนบ้าน กวาดตาข้ามแถวแล้วไม่มีเส้นไหนตรงกัน
     *
     * ใช้คู่กับการ**ไม่ตั้งความสูงขั้นต่ำให้เซลล์** ไม่งั้นที่ว่างส่วนเกินไปกองใต้
     * เนื้อหาด้านเดียว ช่องไฟบน/ล่างของแถวจะไม่เท่ากัน
     */
    cellAlign?: "top" | "middle";
  };
  tableClassNames?: {
    base?: string;
    header?: string;
    headerRow?: string;
    headerSticky?: string;
    body?: string;
    bodyRow?: string;
    footer?: string;
    edgeCell?: string;
  };
}

const DataGridContext = createContext<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  DataGridContextProps<any> | undefined
>(undefined);

// Context uses `any` because React's createContext doesn't support generics.
// Type safety is preserved at the component level via DataGridProvider<TData>.
/**
 * Hook เข้าถึง DataGridContext
 *
 * คืนค่า context ปัจจุบันที่มี props ของ DataGrid, table instance, recordCount
 * และ isLoading ใช้ภายในลูก ๆ ของ DataGrid (เช่น DataGridTable, DataGridPagination)
 * Context type ใช้ `any` เพราะ React.createContext ไม่รองรับ generic แต่
 * type safety ถูกบังคับใน component level ผ่าน `DataGridProvider<TData>`
 *
 * @returns DataGridContextProps ของ DataGrid ที่ครอบ component อยู่
 * @throws Error เมื่อเรียกนอก `DataGridProvider`
 * @example
 * ```tsx
 * const { table, isLoading } = useDataGrid();
 * ```
 */
function useDataGrid() {
  const context = useContext(DataGridContext);
  if (!context) {
    throw new Error("useDataGrid must be used within a DataGridProvider");
  }
  return context;
}

function DataGridProvider<TData extends object>({
  children,
  table,
  ...props
}: DataGridProps<TData> & { table: Table<TData> }) {
  const contextValue = useMemo(
    () => ({
      props,
      table,
      recordCount: props.recordCount,
      isLoading: props.isLoading || false,
    }),
    [props, table],
  );

  return (
    <DataGridContext.Provider value={contextValue}>
      {children}
    </DataGridContext.Provider>
  );
}

function DataGrid<TData extends object>({
  children,
  table,
  ...props
}: DataGridProps<TData>) {
  const defaultProps: Partial<DataGridProps<TData>> = {
    loadingMode: "skeleton",
    tableLayout: {
      dense: false,
      cellBorder: false,
      rowBorder: true,
      rowRounded: false,
      // สลับสีแถวเป็นค่าเริ่มต้นของทุกตาราง — ตารางไหนไม่เอาส่ง `stripped: false`
      stripped: true,
      headerSticky: false,
      headerBackground: true,
      headerBorder: true,
      width: "fixed",
      columnsVisibility: false,
      columnsResizable: false,
      columnsPinnable: false,
      columnsMovable: false,
      columnsDraggable: false,
      rowsDraggable: false,
      checkbox: false,
      rowClamp: true,
    },
    tableClassNames: {
      base: "",
      header: "",
      headerRow: "",
      headerSticky: "sticky top-0 z-10 bg-background/90 backdrop-blur-xs",
      body: "",
      bodyRow: "",
      footer: "",
      edgeCell: "",
    },
  };

  const mergedProps: DataGridProps<TData> = {
    ...defaultProps,
    ...props,
    tableLayout: {
      ...defaultProps.tableLayout,
      ...(props.tableLayout || {}),
    },
    tableClassNames: {
      ...defaultProps.tableClassNames,
      ...(props.tableClassNames || {}),
    },
  };

  // Ensure table is provided
  if (!table) {
    throw new Error('DataGrid requires a "table" prop');
  }

  return (
    <DataGridProvider table={table} {...mergedProps}>
      {children}
    </DataGridProvider>
  );
}

/**
 * ตั้ง `data-overflow-x` บนกล่องเลื่อนเมื่อเนื้อหากว้างเกินกล่อง (มีแถบเลื่อนแนวนอน)
 *
 * เขียน attribute ลง DOM ตรง ๆ ไม่ผ่าน state — สถานะนี้ใช้แค่เลือก padding ใน CSS
 * ถ้าเป็น state ทุกครั้งที่สลับจะพาทั้งตารางข้างใน re-render ไปด้วยโดยไม่จำเป็น
 *
 * ต้อง observe ลูกด้วย ไม่ใช่แค่ตัวกล่อง: ตอนข้อมูลโหลดเสร็จหรือคอลัมน์เปลี่ยน
 * ตารางกว้างขึ้นโดยที่กล่องขนาดเท่าเดิม ResizeObserver บนกล่องจะไม่ยิง
 * MutationObserver คอย observe ลูกตัวใหม่เมื่อ skeleton ถูกแทนด้วยตารางจริง
 *
 * @param ref - ref ของกล่องที่ `overflow-auto`
 */
function useOverflowXAttribute(ref: RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;

    const update = () =>
      el.toggleAttribute("data-overflow-x", el.scrollWidth > el.clientWidth);

    const resize = new ResizeObserver(update);
    const observeAll = () => {
      resize.disconnect();
      resize.observe(el);
      for (const child of el.children) resize.observe(child);
    };
    const mutation = new MutationObserver(() => {
      observeAll();
      update();
    });

    observeAll();
    mutation.observe(el, { childList: true });
    update();

    return () => {
      resize.disconnect();
      mutation.disconnect();
    };
  }, [ref]);
}

function DataGridContainer({
  children,
  className,
  border = true,
  scroll = false,
}: {
  readonly children: ReactNode;
  readonly className?: string;
  readonly border?: boolean;
  readonly scroll?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useOverflowXAttribute(ref);
  return (
    <div
      ref={ref}
      data-slot="data-grid"
      className={cn(
        "w-full overflow-auto",
        border && "border-border/60 bg-card rounded-lg border",
        scroll && SCROLLER,
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * สไตล์ของกล่องที่เลื่อนเองได้ในตาราง
 *
 * - แถบบางและจาง — แถบเลื่อนเป็นของประกอบ ไม่ใช่ของที่ต้องมอง
 * - `pb-3` เว้นที่ใต้แถวสุดท้าย ไม่ให้แถบเลื่อนแนวนอนทับแถวนั้น — **เฉพาะตอนที่
 *   ตารางล้นแนวนอนจริง** (`data-overflow-x` จาก `useOverflowXAttribute`) เดิมใส่
 *   ตลอด ตารางที่ไม่มีแถบเลื่อนเลยจึงมีช่องว่าง 12px ค้างอยู่ระหว่างแถวสุดท้ายกับ footer
 *
 * เดิมสตริงนี้ถูกก็อปไว้ 5 ที่และหลุดอีก 33 ที่ ทำให้หน้า list ส่วนใหญ่แถวสุดท้าย
 * โดนแถบทับ แต่มีอยู่หน้าเดียวที่ไม่โดน โดยไม่มีเหตุผลอะไรรองรับ
 */
const SCROLLER =
  "[scrollbar-width:thin] [scrollbar-color:var(--scrollbar-thumb)_transparent] data-[overflow-x]:pb-3";

/**
 * กล่องเลื่อนของตารางในหน้า list — ตัวที่เลื่อนจริง ส่วน `DataGridContainer`
 * เป็นกรอบที่ตรึง `DataGridPagination` ไว้ท้ายกล่อง
 *
 * แยกเป็นคอมโพเนนต์เพราะ 33 หน้า list เขียน `<div className="flex-1
 * overflow-auto">` เหมือนกันเป๊ะ และไม่มีหน้าไหนจำได้ว่าต้องใส่สไตล์แถบเลื่อนด้วย
 *
 * @param props.children - ปกติคือ `<DataGridTable />`
 * @param props.className - className เพิ่มเติม
 * @returns JSX element ของกล่องเลื่อน
 */
function DataGridScrollArea({
  children,
  className,
}: {
  readonly children: ReactNode;
  readonly className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useOverflowXAttribute(ref);
  return (
    <div ref={ref} className={cn("flex-1 overflow-auto", SCROLLER, className)}>
      {children}
    </div>
  );
}

export {
  useDataGrid,
  DataGridProvider,
  DataGrid,
  DataGridContainer,
  DataGridScrollArea,
};
