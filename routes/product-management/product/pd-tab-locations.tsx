import { memo, useMemo, useState } from "react";
import { useTranslations } from "use-intl";
import {
  Controller,
  useFieldArray,
  useFormState,
  useWatch,
} from "react-hook-form";
import {
  type ColumnDef,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import SearchInput from "@/components/search-input";
import { StatusDotBadge } from "@/components/ui/status-dot-badge";
import { INVENTORY_TYPE } from "@/constant/location";
import { LocationTypeLabel } from "@/components/share/location-type-label";
import {
  DataGrid,
  DataGridContainer,
} from "@/components/ui/data-grid/data-grid";
import { DataGridTable } from "@/components/ui/data-grid/data-grid-table";
import { DeleteDialog } from "@/components/ui/delete-dialog";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { CompactSection } from "@/components/share/compact-section";
import { useElementWidth } from "@/hooks/use-element-width";
import { RowCard, RowCardField, RowCards } from "./pd-row-cards";
import { LookupLocation } from "@/components/lookup/lookup-location";
import { LookupShelf } from "@/components/lookup/lookup-shelf";
import EmptyComponent from "@/components/empty-component";
import type { ProductFormInstance, ProductFormValues } from "@/types/product";

interface LocationRow {
  fieldId: string;
  fieldIndex: number;
  location_id: string;
  location_code: string;
  location_name: string;
  location_type: string;
  is_active: boolean | null | undefined;
  delivery_point: string;
  min_qty: number | null;
  max_qty: number | null;
  re_order_qty: number | null;
  par_qty: number | null;
}

const EMPTY_LOCATIONS: ProductFormValues["locations"] = [];

interface PdTabLocationsProps {
  readonly form: ProductFormInstance;
  readonly isDisabled: boolean;
}

function PdTabLocations({ form, isDisabled }: PdTabLocationsProps) {
  "use no memo";
  // อ่าน error ผ่าน useFormState ไม่ใช่ form.formState — component นี้ห่อ memo()
  // และ props (form/isDisabled) เป็น ref นิ่ง กด save แล้ว validation fail ตัว
  // parent re-render แต่ตัวนี้ถูก memo กั้นไว้ กรอบแดงเลยไม่ขึ้นจนกว่าจะสลับแท็บ
  // ไปกลับ (remount แล้วอ่านใหม่) · useFormState subscribe ที่ component นี้เอง
  const { errors } = useFormState({ control: form.control });
  const t = useTranslations("productManagement.product");
  const tfl = useTranslations("field");
  const ts = useTranslations("status");

  const { fields, prepend, remove } = useFieldArray({
    control: form.control,
    name: "locations",
    keyName: "_fieldKey",
  });

  const rawWatched = useWatch({ control: form.control, name: "locations" });
  const watchedLocations = rawWatched ?? EMPTY_LOCATIONS;

  const [search, setSearch] = useState("");
  const [deleteIdx, setDeleteIdx] = useState<number | null>(null);

  // Stable string-key so `assignedIds` (and the memoized `columns` that reads
  // it) keep their reference when only qty fields change. Rebuilding `columns`
  // every render remounts the lookup cells, which in the browser triggers a
  // ResizeObserver render loop that freezes the tab. Mirrors the pattern in
  // pd-tab-unit-conversion.
  const assignedIdsKey = watchedLocations
    .map((l) => l.location_id ?? "")
    .join("|");
  const assignedIds = useMemo(
    () => assignedIdsKey.split("|"),
    [assignedIdsKey],
  );

  const allRows = useMemo<LocationRow[]>(
    () =>
      fields
        .map((field, index) => {
          const watched = watchedLocations[index];
          return {
            fieldId: field._fieldKey,
            fieldIndex: index,
            location_id: watched?.location_id ?? "",
            location_code: watched?.location_code ?? "",
            location_name: watched?.location_name ?? "",
            location_type: watched?.location_type ?? "",
            is_active: watched?.is_active,
            delivery_point: watched?.delivery_point ?? "",
            min_qty: watched?.min_qty ?? null,
            max_qty: watched?.max_qty ?? null,
            re_order_qty: watched?.re_order_qty ?? null,
            par_qty: watched?.par_qty ?? null,
          };
        })
        .sort(
          (a, b) =>
            a.location_code.localeCompare(b.location_code) ||
            a.location_name.localeCompare(b.location_name),
        ),
    [fields, watchedLocations],
  );

  const tableData = useMemo(() => {
    if (!search) return allRows;
    const q = search.toLowerCase();
    return allRows.filter((row) => {
      if (!row.location_id) return true;
      return (
        row.location_name.toLowerCase().includes(q) ||
        row.location_type.toLowerCase().includes(q) ||
        row.delivery_point.toLowerCase().includes(q)
      );
    });
  }, [allRows, search]);

  const handleAdd = () => {
    prepend({
      location_id: "",
      shelf_id: null,
      location_code: "",
      location_name: "",
      min_qty: null,
      max_qty: null,
      re_order_qty: null,
      par_qty: null,
    });
  };

  const confirmDelete = () => {
    if (deleteIdx !== null) {
      remove(deleteIdx);
      setDeleteIdx(null);
    }
  };

  // กล่องกว้างพอ → คอลัมน์กว้างคงที่ คอลัมน์สถานะ (สุดท้าย) รับที่เหลือ · ผลรวมคอลัมน์:
  // # 32 · location 300 · type 130 · shelf 180 · qty 110×3 · status 100 = 1072, โหมดแก้ + ปุ่มลบ
  // 40 = 1112 · กล่องแคบกว่านั้น (รวมจอ 1366 ที่กล่อง ~1054) แบ่งตามสัดส่วนเหมือนเดิม
  const [setGridBox, gridBoxWidth] = useElementWidth();
  const fixedColumns =
    (gridBoxWidth ?? Number.POSITIVE_INFINITY) >= (isDisabled ? 1090 : 1130);
  // กล่องแคบ + โหมดดู → การ์ดทีละใบ · โหมดแก้ยังเป็นตาราง (lookup/ช่องกรอกผูกกับ column cell)
  // จุดเปลี่ยน 760 ไม่ใช่ 560 ของตารางอื่น: ตารางนี้ 8 คอลัมน์ ที่กล่อง 632px (tablet) คอลัมน์ Type
  // เหลือ 75px ป้ายประเภทล้นช่อง
  const asCards =
    isDisabled && gridBoxWidth !== undefined && gridBoxWidth < 760;

  const columns = useMemo<ColumnDef<LocationRow>[]>(() => {
    const indexCol: ColumnDef<LocationRow> = {
      id: "index",
      header: "#",
      // row.index = position in current (sorted/filtered) row model → sequential
      // even after the data is re-ordered. fieldIndex is the form-array index
      // used for setValue/remove and must NOT be shown as the row number.
      cell: ({ row }) => row.index + 1,
      enableSorting: false,
      size: 32,
      meta: {
        headerClassName: "text-center",
        cellClassName: "text-center text-muted-foreground",
      },
    };

    const dataCols: ColumnDef<LocationRow>[] = [
      {
        id: "location",
        header: tfl("location"),
        cell: ({ row }) => {
          const { location_code, location_name, fieldIndex } = row.original;

          if (isDisabled) {
            return (
              <span className="flex items-center gap-1.5 text-xs">
                {location_code && (
                  <span className="text-muted-foreground">{location_code}</span>
                )}
                {location_name}
              </span>
            );
          }

          const errorMessage =
            errors.locations?.[fieldIndex]?.location_id?.message;
          return (
            <Controller
              control={form.control}
              name={`locations.${fieldIndex}.location_id`}
              render={({ field }) => (
                <LookupLocation
                  value={field.value}
                  onValueChange={field.onChange}
                  onItemChange={(loc) => {
                    // เปลี่ยนคลัง = ชั้นวางเดิมใช้ไม่ได้ (shelf ผูกกับ location)
                    form.setValue(`locations.${fieldIndex}.shelf_id`, null);
                    form.setValue(
                      `locations.${fieldIndex}.location_code`,
                      loc.code ?? "",
                    );
                    form.setValue(
                      `locations.${fieldIndex}.location_name`,
                      loc.name ?? "",
                    );
                    form.setValue(
                      `locations.${fieldIndex}.location_type`,
                      loc.location_type,
                    );
                    form.setValue(
                      `locations.${fieldIndex}.is_active`,
                      loc.status === "active",
                    );
                    form.setValue(
                      `locations.${fieldIndex}.delivery_point`,
                      loc.delivery_point?.name ?? "",
                    );
                    form.setValue(
                      `locations.${fieldIndex}.delivery_point_id`,
                      loc.delivery_point?.id ?? "",
                    );
                  }}
                  excludeIds={assignedIds.filter((id) => id !== field.value)}
                  defaultLabel={location_name}
                  error={errorMessage}
                />
              )}
            />
          );
        },
        size: 300,
      },
      {
        id: "type",
        header: tfl("type"),
        // ทรงเดียวกับคอลัมน์ประเภทในหน้ารายการคลัง — ไอคอน + ป้าย ไม่มีสี
        // ประเภทคลังเป็นคุณสมบัติ ไม่ใช่ความคืบหน้า สีสงวนไว้ให้สถานะ
        cell: ({ row }) => {
          const type = row.original.location_type;
          if (!type) return "";
          return <LocationTypeLabel type={type as INVENTORY_TYPE} />;
        },
        enableSorting: false,
        size: 130,
        meta: {
          headerClassName: "text-center",
          cellClassName: "text-center",
        },
      },
      {
        id: "shelf",
        header: tfl("shelf"),
        cell: ({ row }) => {
          const { fieldIndex, location_id } = row.original;
          return (
            <Controller
              control={form.control}
              name={`locations.${fieldIndex}.shelf_id`}
              render={({ field }) => (
                <LookupShelf
                  value={field.value ?? ""}
                  onValueChange={field.onChange}
                  disabled={!location_id}
                  readOnly={isDisabled}
                />
              )}
            />
          );
        },
        enableSorting: false,
        size: 180,
      },
      {
        id: "min_qty",
        header: t("minQty"),
        cell: ({ row }) =>
          isDisabled ? (
            <span className="text-xs tabular-nums">
              {row.original.min_qty ?? ""}
            </span>
          ) : (
            <Input
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              placeholder=""
              className="text-right text-xs tabular-nums"
              {...form.register(
                `locations.${row.original.fieldIndex}.min_qty`,
                { valueAsNumber: true },
              )}
            />
          ),
        size: 110,
        meta: { headerClassName: "text-right", cellClassName: "text-right" },
      },
      {
        id: "max_qty",
        header: t("maxQty"),
        cell: ({ row }) =>
          isDisabled ? (
            <span className="text-xs tabular-nums">
              {row.original.max_qty ?? ""}
            </span>
          ) : (
            <Input
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              placeholder=""
              className="text-right text-xs tabular-nums"
              {...form.register(
                `locations.${row.original.fieldIndex}.max_qty`,
                { valueAsNumber: true },
              )}
            />
          ),
        size: 110,
        meta: { headerClassName: "text-right", cellClassName: "text-right" },
      },
      {
        id: "par_qty",
        header: t("parQty"),
        cell: ({ row }) =>
          isDisabled ? (
            <span className="text-xs tabular-nums">
              {row.original.par_qty ?? ""}
            </span>
          ) : (
            <Input
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              placeholder=""
              className="text-right text-xs tabular-nums"
              {...form.register(
                `locations.${row.original.fieldIndex}.par_qty`,
                { valueAsNumber: true },
              )}
            />
          ),
        size: 110,
        meta: { headerClassName: "text-right", cellClassName: "text-right" },
      },
      {
        id: "status",
        header: tfl("status"),
        cell: ({ row }) => {
          const isActive = row.original.is_active;
          if (isActive === undefined || isActive === null) return "";
          return (
            <StatusDotBadge tone={isActive ? "success" : "neutral"}>
              {isActive ? ts("active") : ts("inactive")}
            </StatusDotBadge>
          );
        },
        enableSorting: false,
        size: 100,
        // คอลัมน์สุดท้ายของข้อมูลรับที่เหลือ (ชิดซ้าย) — ไม่ให้คอลัมน์ Location ยืด เพราะโหมดแก้
        // ช่องนั้นเป็น lookup: ยืดแล้วช่องกรอกกว้างเป็นพันพิกเซลบนจอกว้าง
        meta: fixedColumns
          ? { grow: true }
          : { headerClassName: "text-center", cellClassName: "text-center" },
      },
    ];

    const actionCol: ColumnDef<LocationRow> = {
      id: "action",
      header: () => "",
      cell: ({ row }) => (
        <Button
          type="button"
          variant="ghost"
          size="xs"
          aria-label="Remove"
          onClick={() => setDeleteIdx(row.original.fieldIndex)}
        >
          <Trash2 />
        </Button>
      ),
      enableSorting: false,
      size: 40,
      meta: {
        headerClassName: "text-right",
        cellClassName: "text-right",
      },
    };

    return [indexCol, ...dataCols, ...(isDisabled ? [] : [actionCol])];
    // errors ต้องอยู่ใน deps — cell ปิดทับค่านี้ไว้ ถ้าไม่ใส่ columns จะไม่สร้างใหม่
    // ตอน validation fail แล้ว error ที่ส่งเข้า cell ค้างเป็นค่าเก่า
  }, [t, tfl, ts, isDisabled, form, assignedIds, errors, fixedColumns]);

  const table = useReactTable({
    data: tableData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.fieldId,
  });

  return (
    // CompactSection ตัวเดียวกับแท็บ General — สลับแท็บแล้วหัวข้อขนาดเท่ากัน
    <CompactSection
      first
      frameless
      title={t("sectionLocations")}
      count={fields.length}
      action={
        // max-w-full + flex-wrap: กล่อง 302px ของมือถือใส่ช่องค้น 256 + ปุ่มเพิ่มไม่พอในแถวเดียว
        <div className="flex max-w-full min-w-0 flex-wrap items-center gap-2">
          {/* SearchInput ตัวเดียวกับหน้า list — ยิงตอน Enter/กดแว่น ตาม convention
              ของแอป (มีปุ่ม X ล้างคำค้นมาให้ด้วย) */}
          <SearchInput
            defaultValue={search}
            onSearch={setSearch}
            containerClassName="w-64 max-w-full"
            inputClassName="h-8 text-xs placeholder:text-xs"
          />
          {!isDisabled && (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={handleAdd}
            >
              <Plus />
              {t("addLocation")}
            </Button>
          )}
        </div>
      }
    >
      <div ref={setGridBox}>
        {asCards ? (
          tableData.length === 0 ? (
            <EmptyComponent
              title={t("noLocations")}
              description={t("addFirstLocationHint")}
            />
          ) : (
            <RowCards>
              {tableData.map((row) => (
                <RowCard
                  key={row.fieldId}
                  title={row.location_name}
                  subtitle={row.location_code}
                  badge={
                    row.is_active === undefined ||
                    row.is_active === null ? undefined : (
                      <StatusDotBadge
                        tone={row.is_active ? "success" : "neutral"}
                      >
                        {row.is_active ? ts("active") : ts("inactive")}
                      </StatusDotBadge>
                    )
                  }
                >
                  {row.location_type && (
                    <RowCardField label={tfl("type")}>
                      <LocationTypeLabel
                        type={row.location_type as INVENTORY_TYPE}
                      />
                    </RowCardField>
                  )}
                  <RowCardField label={tfl("shelf")}>
                    <Controller
                      control={form.control}
                      name={`locations.${row.fieldIndex}.shelf_id`}
                      render={({ field }) => (
                        <LookupShelf
                          value={field.value ?? ""}
                          onValueChange={field.onChange}
                          readOnly
                        />
                      )}
                    />
                  </RowCardField>
                  <RowCardField label={t("minQty")}>
                    {row.min_qty ?? "—"}
                  </RowCardField>
                  <RowCardField label={t("maxQty")}>
                    {row.max_qty ?? "—"}
                  </RowCardField>
                  <RowCardField label={t("parQty")}>
                    {row.par_qty ?? "—"}
                  </RowCardField>
                </RowCard>
              ))}
            </RowCards>
          )
        ) : (
          <DataGrid
            table={table}
            recordCount={fields.length}
            tableLayout={{
              // โหมดดูใช้ความสูงแถวมาตรฐานของตาราง · โหมดแก้ปล่อยให้แถวสูงตามช่องกรอก
              rowClamp: isDisabled,
              headerSticky: true,
            }}
            tableClassNames={{
              // โหมดแก้: กล่องแคบแล้วเลื่อนแนวนอนแทนการบีบช่องกรอก (900 < กล่อง 1052 ของจอ 1366
              // desktop จึงไม่ต้องเลื่อน)
              base: isDisabled ? undefined : "min-w-[900px]",
            }}
            emptyMessage={
              <EmptyComponent
                title={t("noLocations")}
                description={t("addFirstLocationHint")}
              />
            }
          >
            <DataGridContainer>
              <ScrollArea className="w-full">
                <DataGridTable />
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </DataGridContainer>
          </DataGrid>
        )}
      </div>

      <DeleteDialog
        open={deleteIdx !== null}
        onOpenChange={(open) => !open && setDeleteIdx(null)}
        title={t("removeLocation")}
        description={t("removeLocationConfirm")}
        onConfirm={confirmDelete}
      />
    </CompactSection>
  );
}

export default memo(PdTabLocations);
