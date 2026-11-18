import type { ReactNode } from "react";
import { Columns3 } from "lucide-react";
import { DisplayModeToggle } from "@/components/share/display-mode-toggle";
import { useTranslations } from "use-intl";
import { Button } from "@/components/ui/button";
import { DataGridColumnVisibility } from "@/components/ui/data-grid/data-grid-column-visibility";
import { DataGridSortMenu } from "@/components/ui/data-grid/data-grid-sort-menu";
import { ActiveFilterBar } from "@/components/ui/active-filter-bar";
import SearchInput from "@/components/search-input";
import { ViewSelector } from "@/components/list-filter/view-selector";
import { ListFilter } from "@/components/list-filter/list-filter";
import type { useListFilters } from "@/hooks/use-list-filters";
import type { FilterFieldDef } from "@/types/list-filter";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyTable = any;

interface ListToolbarProps {
  readonly search: string;
  readonly onSearch: (value: string) => void;
  readonly lf: ReturnType<typeof useListFilters>;
  readonly fields: readonly FilterFieldDef[];
  readonly onSaveViewClick: () => void;
  readonly table?: AnyTable;
  readonly displayMode?: "list" | "grid";
  readonly onDisplayModeChange?: (mode: "list" | "grid") => void;
  /**
   * ปุ่มเลือกขอบเขตข้อมูล (My pending / All Documents) — แถบกว้างพอ (≥56rem ของแถบ
   * ไม่ใช่จอ) อยู่ระหว่างช่องค้นกับ View แถวเดียว · แถบแคบกว่านั้นขึ้นเป็นบรรทัดแรก
   * ของแถบ ให้ช่องค้น + View + Filter ยังติดกันในบรรทัดที่สอง (กฎข้อ 12) และปุ่มตาราง
   * ชิดขวาบรรทัดเดียวกัน แทนที่ View/Filter จะตกบรรทัดใหม่ห่างจากช่องค้น
   * ใช้ได้กับ `variant="wrap"` เท่านั้น
   */
  readonly scope?: ReactNode;
  /**
   * ปุ่มชิดขวาของแถบ (เช่นสลับมุมมองของหน้าที่ไม่มี `table`) — ไม่แทรกระหว่างช่องค้น
   * กับตัวกรอง ตัวกรองจึงอยู่ติดช่องค้นเสมอ
   */
  readonly trailing?: ReactNode;
  /**
   * ทรงของแถบซ้าย — `"wrap"` (ค่าตั้งต้น) ให้ช่องค้นกว้างเต็มบนจอแคบแล้วขึ้น
   * บรรทัดใหม่ ใช้กับหน้าที่มีปุ่มฝั่งขวาเยอะ · `"row"` บีบทุกอย่างไว้แถวเดียว
   * ช่องค้นยืดตามที่เหลือบนจอแคบ ตั้งแต่ md ปุ่ม View/Filter อยู่ติดช่องค้น
   * ใช้กับหน้าที่ไม่มีปุ่มฝั่งขวา
   */
  readonly variant?: "wrap" | "row";
}

/**
 * แถบเครื่องมือของหน้ารายการ — ช่องค้น · saved view · ตัวกรอง · เรียง · เลือกคอลัมน์ ·
 * สลับ list/grid และแถบ chip ของตัวกรองที่เปิดอยู่
 *
 * **เคยถูกก๊อปเหมือนกัน 20 หน้า ~1,000 บรรทัด** ต่างกันแค่ชื่อตัวแปร field —
 * เทียบ po-component กับ grn-component แล้วต่างกันบรรทัดเดียว จะเพิ่มปุ่มในแถบนี้
 * ต้องไปแก้ 20 ที่ ลืมใบเดียวไม่มีใครรู้จนกว่าจะมีคนทัก
 *
 * หน้าที่ไม่มีตาราง (ไม่ส่ง `table`) จะไม่ render ฝั่งขวาเลย — 8 หน้าใน
 * system-admin/report ใช้ layout คนละแบบและไม่ได้ใช้ component นี้
 *
 * @example
 * <ListToolbar
 *   search={search} onSearch={setSearch}
 *   lf={lf} fields={grnFilterFields}
 *   onSaveViewClick={() => setSaveViewDialogOpen(true)}
 *   table={table}
 *   displayMode={displayMode} onDisplayModeChange={setDisplayMode}
 * />
 */
export function ListToolbar({
  search,
  onSearch,
  lf,
  fields,
  onSaveViewClick,
  table,
  displayMode,
  onDisplayModeChange,
  scope,
  trailing,
  variant = "wrap",
}: ListToolbarProps) {
  // `table` เป็น TanStack instance ที่ ref คงที่แต่ state ข้างในเปลี่ยนเอง —
  // คอมไพเลอร์เห็น props ไม่เปลี่ยนเลยแช่ JSX ของ DataGridSortMenu /
  // DataGridColumnVisibility ไว้ ลูกจึงไม่ re-render: ติ๊ก Toggle Columns แล้ว
  // คอลัมน์หายจริงแต่เครื่องหมายถูกในเมนูค้างอยู่ที่เดิม (directive เป็นระดับ
  // ฟังก์ชัน ใส่ที่ลูกไม่ช่วยเพราะลูกไม่ถูกเรียกเลย)
  "use no memo";
  const tc = useTranslations("common");
  const showRight = !!table || !!trailing;
  const isRow = variant === "row";

  const viewAndFilter = (
    <>
      <ViewSelector
        view={lf.view}
        snapshot={{ filters: lf.values, sort: lf.sortParam || undefined }}
      />
      <ListFilter
        fields={fields}
        values={lf.values}
        setValue={lf.setValue}
        onClearAll={lf.clearAll}
        onSaveClick={onSaveViewClick}
        activeCount={lf.activeFilters.length}
      />
    </>
  );

  const right = showRight && (
    <div className="ml-auto hidden shrink-0 items-center gap-2 sm:flex">
      {table && (
        <>
          <DataGridSortMenu table={table} />
          <DataGridColumnVisibility
            table={table}
            trigger={
              <Button
                size="icon-sm"
                variant="outline"
                aria-label={tc("aria.toggleColumns")}
              >
                <Columns3 className="size-4" />
              </Button>
            }
          />
        </>
      )}
      {displayMode && onDisplayModeChange && (
        <DisplayModeToggle value={displayMode} onChange={onDisplayModeChange} />
      )}
      {trailing}
    </div>
  );

  if (scope && !isRow) {
    // ลูกทุกตัวอยู่ใน flex-wrap ชั้นเดียว จะได้ย้าย scope ขึ้นบรรทัดแรกด้วย order ได้
    // (ถ้าอยู่ในกลุ่มซ้ายซ้อนอีกชั้น order ข้ามกลุ่มไม่ได้ และปุ่มตาราง
    // จะลอยกลางระหว่างสองบรรทัด)
    return (
      <>
        <div className="@container/list-toolbar">
          <div className="flex flex-wrap items-center gap-2">
            <div className="w-full sm:w-auto">
              <SearchInput defaultValue={search} onSearch={onSearch} />
            </div>
            <span className="bg-border hidden h-4 w-px sm:block" />
            <div className="order-first w-full @4xl/list-toolbar:order-none @4xl/list-toolbar:w-auto">
              {scope}
            </div>
            {viewAndFilter}
            {right}
          </div>
        </div>
        <ActiveFilterBar filters={lf.activeFilters} onClearAll={lf.clearAll} />
      </>
    );
  }

  return (
    <>
      <div
        className={
          isRow
            ? "flex w-full items-center gap-2"
            : "flex flex-wrap items-center justify-between gap-2"
        }
      >
        {/* wrap: ไม่ใส่ nowrap — กลุ่มซ้ายตัดสินจากความกว้างของตัวเอง ไม่ใช่จอ ที่ไม่พอ
            ปุ่ม View/Filter ขึ้นบรรทัดใหม่แทนการล้นขอบ */}
        <div
          className={
            isRow
              ? "contents"
              : "flex w-full flex-1 flex-wrap items-center gap-2 sm:w-auto"
          }
        >
          {/* row: ช่องค้นยืดเฉพาะจอแคบ (ต่ำกว่า md ที่ SearchInput เป็น w-full) — ตั้งแต่ md
              SearchInput กว้างคงที่ ถ้ากล่องนี้ยังยืด ปุ่ม View/Filter จะถูกดันไปขวาสุดของแถว
              ห่างจากช่องค้นทั้งจอ */}
          <div
            className={
              isRow
                ? "flex-1 md:flex-initial"
                : "w-full sm:w-auto sm:flex-initial"
            }
          >
            <SearchInput defaultValue={search} onSearch={onSearch} />
          </div>
          <span className="bg-border hidden h-4 w-px sm:block" />
          {viewAndFilter}
        </div>
        {right}
      </div>

      <ActiveFilterBar filters={lf.activeFilters} onClearAll={lf.clearAll} />
    </>
  );
}
