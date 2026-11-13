import { memo, useState, useMemo } from "react";
import { useTranslations } from "use-intl";
import {
  Controller,
  useFieldArray,
  useFormState,
  useWatch,
  type FieldArrayWithId,
} from "react-hook-form";
import {
  type ColumnDef,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldInput } from "@/components/ui/field";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DataGrid,
  DataGridContainer,
} from "@/components/ui/data-grid/data-grid";
import { DataGridTable } from "@/components/ui/data-grid/data-grid-table";
import { DeleteDialog } from "@/components/ui/delete-dialog";
import { CompactSection } from "@/components/share/compact-section";
import { useElementWidth } from "@/hooks/use-element-width";
import { StatusDotBadge } from "@/components/ui/status-dot-badge";
import {
  ROW_CARDS_BELOW,
  RowCard,
  RowCardField,
  RowCards,
} from "./pd-row-cards";
import {
  capQtyDecimals,
  DEFAULT_QTY_DECIMALS,
  QTY_MAX_DECIMALS,
  QTY_STEP,
} from "@/components/ui/input/qty-decimals";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { useUnit } from "@/hooks/use-unit";
import { useEntitiesByIds } from "@/hooks/use-entities-by-ids";
import type { Unit } from "@/types/unit";
import EmptyComponent from "@/components/empty-component";
import type { ProductFormInstance, ProductFormValues } from "@/types/product";
import { FromUnitCell, ToUnitCell, ConversionPreview } from "./pd-unit-cells";

type UnitField = FieldArrayWithId<
  ProductFormValues,
  "order_units" | "ingredient_units",
  "_fieldKey"
>;

interface PdTabUnitConversionProps {
  form: ProductFormInstance;
  name: "order_units" | "ingredient_units";
  label: string;
  isDisabled: boolean;
}

function PdTabUnitConversion({
  form,
  name,
  label,
  isDisabled,
}: PdTabUnitConversionProps) {
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
    name,
    keyName: "_fieldKey",
  });

  const [deleteIndex, setDeleteIndex] = useState<number | null>(null);

  const isOrder = name === "order_units";
  const inventoryUnitId = useWatch({
    control: form.control,
    name: "inventory_unit_id",
  });
  const isUsedInRecipe = useWatch({
    control: form.control,
    name: "is_used_in_recipe",
  });

  /* ---- Collect unit IDs referenced by this table ---- */
  // Stable string-key so `usedSelectableIds` / `unitIds` keep their reference
  // when only qty/desc fields change. Keeps `columns` reference stable so cells
  // aren't remounted and inputs keep their focus.
  const watchedUnits = useWatch({ control: form.control, name });
  const usedIdsKey = (watchedUnits ?? [])
    .map((u) => (isOrder ? u.from_unit_id : u.to_unit_id) ?? "")
    .join("|");
  const usedSelectableIds = useMemo(
    () => (usedIdsKey ? usedIdsKey.split("|").filter(Boolean) : []),
    [usedIdsKey],
  );

  /* ---- Resolve unit names ---- */
  // ดึงเฉพาะหน่วยที่ตารางนี้อ้างถึง (หน่วยนับ + from/to ทุกแถว) ไม่ลากทะเบียนทั้ง BU
  // — เลือกหน่วยใหม่ในแถวเมื่อไร key เปลี่ยนแล้วยิงใหม่หนึ่งรอบ (ระหว่างนั้นชื่อว่าง)
  const unitIdsKey = [
    ...new Set(
      [
        inventoryUnitId ?? "",
        ...(watchedUnits ?? []).flatMap((u) => [
          u.from_unit_id ?? "",
          u.to_unit_id ?? "",
        ]),
      ].filter(Boolean),
    ),
  ]
    .sort()
    .join("|");
  const unitIds = useMemo(
    () => (unitIdsKey ? unitIdsKey.split("|") : []),
    [unitIdsKey],
  );
  const { items: units } = useEntitiesByIds<Unit>({
    useListHook: useUnit,
    ids: unitIds,
  });
  // `units` เป็น reference นิ่ง (react-query / EMPTY) — Map ต้อง memo บนมัน ไม่งั้น
  // `columns` สร้างใหม่ทุก render แล้วตาราง editable วน render (memory
  // editable-datagrid-must-memoize-columns)
  const unitMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const u of units) {
      m.set(u.id, u.name);
    }
    return m;
  }, [units]);

  // ทศนิยมที่หน่วยนั้นกรอกได้ — กติกาเดียวกับช่อง qty ของ PR/PO/GRN ที่อ่าน
  // `decimal_place` จาก master data (EA = 0, kg ให้เศษ) ต่างกันแค่ที่นั่นดึงหน่วย
  // ของสินค้ารายตัว ส่วนที่นี่หน่วยยังไม่ผูกกับสินค้าเลยอ่านจากทะเบียนหน่วยตรง ๆ
  const unitDecimalsMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const u of units) {
      const dp = u.decimal_place;
      m.set(
        u.id,
        dp == null || !Number.isFinite(dp)
          ? DEFAULT_QTY_DECIMALS
          : Math.min(Math.max(Math.trunc(dp), 0), QTY_MAX_DECIMALS),
      );
    }
    return m;
  }, [units]);

  const inventoryUnitName = unitMap.get(inventoryUnitId) ?? "";

  /* ---- Add disabled conditions ---- */
  const addDisabled =
    isDisabled || !inventoryUnitId || (!isOrder && !isUsedInRecipe);

  /* ---- Handle add ---- */
  const handleAdd = () => {
    prepend({
      from_unit_id: isOrder ? "" : inventoryUnitId,
      from_unit_qty: 1,
      to_unit_id: isOrder ? inventoryUnitId : "",
      to_unit_qty: 1,
      description: "",
      is_default: fields.length === 0,
      is_active: true,
    });
  };

  const confirmDelete = () => {
    if (deleteIndex !== null) {
      remove(deleteIndex);
      setDeleteIndex(null);
    }
  };

  // กล่องกว้างพอ → คอลัมน์กว้างคงที่ คอลัมน์ Conversion รับที่เหลือ คอลัมน์จึงอยู่ติดกัน ไม่กระจาย
  // ห่างกันบนจอกว้าง · ผลรวมคอลัมน์: # 32 · หน่วย 160×2 · จำนวน 90×2 · conversion 160 · default 60 ·
  // active 60 = 812, โหมดแก้ + ปุ่มลบ 40 = 852 · กล่องแคบกว่านั้นกลับไปแบ่งตามสัดส่วน ไม่งั้นตารางล้น
  const [setGridBox, gridBoxWidth] = useElementWidth();
  const fixedColumns =
    (gridBoxWidth ?? Number.POSITIVE_INFINITY) >= (isDisabled ? 830 : 870);
  // กล่องแคบ + โหมดดู → การ์ดทีละใบ · โหมดแก้ยังเป็นตารางเลื่อนแนวนอน (ช่องกรอก/lookup ในแถว
  // ผูกกับ column cell) · undefined = ยังไม่ได้วัด ใช้ตารางไปก่อน
  const asCards =
    isDisabled && gridBoxWidth !== undefined && gridBoxWidth < ROW_CARDS_BELOW;

  /* ---- Column definitions ---- */
  const columns = useMemo<ColumnDef<UnitField>[]>(() => {
    // Handlers live inside useMemo so cells always see the latest closure
    // without forcing `columns` to rebuild every render. `form` and `name`
    // are stable, and `handleDefaultChange` reads via form.getValues to
    // avoid depending on the unstable `fields` reference.
    const handleDefaultChange = (index: number) => {
      const allFields = form.getValues(name);
      allFields.forEach((f, i) => {
        if (i !== index && f.is_default) {
          form.setValue(`${name}.${i}.is_default`, false, {
            shouldDirty: true,
          });
        }
      });
      form.setValue(`${name}.${index}.is_default`, true, { shouldDirty: true });
    };

    const handleFromUnitChange = (index: number, unitId: string) => {
      form.setValue(`${name}.${index}.from_unit_id`, unitId);
      const toUnit = form.getValues(`${name}.${index}.to_unit_id`);
      if (unitId && unitId === toUnit) {
        const fromQty = form.getValues(`${name}.${index}.from_unit_qty`);
        form.setValue(`${name}.${index}.to_unit_qty`, fromQty);
      }
    };

    const handleToUnitChange = (index: number, unitId: string) => {
      form.setValue(`${name}.${index}.to_unit_id`, unitId);
      const fromUnit = form.getValues(`${name}.${index}.from_unit_id`);
      if (unitId && unitId === fromUnit) {
        const fromQty = form.getValues(`${name}.${index}.from_unit_qty`);
        form.setValue(`${name}.${index}.to_unit_qty`, fromQty);
      }
    };

    const indexCol: ColumnDef<UnitField> = {
      id: "index",
      header: "#",
      cell: ({ row }) => row.index + 1,
      enableSorting: false,
      size: 32,
      meta: {
        headerClassName: "text-center",
        cellClassName: "text-center text-muted-foreground",
      },
    };

    const dataCols: ColumnDef<UnitField>[] = [
      {
        accessorKey: "from_unit_id",
        header: tfl("fromUnit"),
        cell: ({ row }) => (
          <FromUnitCell
            control={form.control}
            name={name}
            index={row.index}
            isOrder={isOrder}
            inventoryUnitName={inventoryUnitName}
            disabled={isDisabled}
            onUnitChange={handleFromUnitChange}
            usedIds={usedSelectableIds}
            unitMap={unitMap}
            error={errors[name]?.[row.index]?.from_unit_id?.message}
          />
        ),
        size: 160,
      },
      {
        accessorKey: "from_unit_qty",
        header: tfl("fromQty"),
        cell: ({ row }) => (
          <div className="text-muted-foreground flex items-center justify-end text-xs tabular-nums">
            <input
              type="hidden"
              {...form.register(`${name}.${row.index}.from_unit_qty`)}
            />
            {row.original.from_unit_qty}
          </div>
        ),
        size: 90,
        meta: { headerClassName: "text-right", cellClassName: "text-right" },
      },
      {
        accessorKey: "to_unit_id",
        header: tfl("toUnit"),
        cell: ({ row }) => (
          <ToUnitCell
            control={form.control}
            name={name}
            index={row.index}
            isOrder={isOrder}
            inventoryUnitName={inventoryUnitName}
            disabled={isDisabled}
            onUnitChange={handleToUnitChange}
            usedIds={usedSelectableIds}
            unitMap={unitMap}
            error={errors[name]?.[row.index]?.to_unit_id?.message}
          />
        ),
        size: 160,
      },
      {
        accessorKey: "to_unit_qty",
        header: tfl("toQty"),
        cell: ({ row }) => {
          if (isDisabled) {
            return (
              <div className="flex items-center justify-end text-xs tabular-nums">
                {row.original.to_unit_qty}
              </div>
            );
          }
          const errorMessage = errors[name]?.[row.index]?.to_unit_qty?.message;
          // จำนวนนี้นับด้วยหน่วยปลายทาง ทศนิยมจึงมาจาก `to_unit_id` ไม่ใช่ค่าคงที่
          const decimals =
            unitDecimalsMap.get(
              form.getValues(`${name}.${row.index}.to_unit_id`) ?? "",
            ) ?? DEFAULT_QTY_DECIMALS;
          const registered = form.register(`${name}.${row.index}.to_unit_qty`);
          return (
            <FieldInput
              type="number"
              inputMode="decimal"
              // step ตายตัวปัดค่าที่ละเอียดกว่านั้นทิ้ง เพดานจริงคุมที่ capQtyDecimals
              step={QTY_STEP}
              min={1}
              className="text-right"
              error={errorMessage}
              errorIconAlign="left"
              {...registered}
              onChange={(e) => {
                capQtyDecimals(e.currentTarget, decimals);
                void registered.onChange(e);
              }}
            />
          );
        },
        size: 90,
        meta: { headerClassName: "text-right", cellClassName: "text-right" },
      },
      {
        id: "conversion",
        header: tfl("conversion"),
        cell: ({ row }) => (
          <ConversionPreview
            control={form.control}
            name={name}
            index={row.index}
            unitMap={unitMap}
          />
        ),
        enableSorting: false,
        size: 160,
        meta: fixedColumns ? { grow: true } : undefined,
      },
      {
        accessorKey: "is_default",
        header: tfl("isDefault"),
        cell: ({ row }) => (
          <div className="flex items-center justify-center">
            <Controller
              control={form.control}
              name={`${name}.${row.index}.is_default`}
              render={({ field: f }) => (
                <input
                  type="radio"
                  name={`${name}-default`}
                  aria-label={tfl("isDefault")}
                  checked={f.value}
                  onChange={() => handleDefaultChange(row.index)}
                  disabled={isDisabled}
                  className="accent-primary h-3.5 w-3.5"
                />
              )}
            />
          </div>
        ),
        enableSorting: false,
        size: 60,
        meta: {
          headerClassName: "text-center",
          cellClassName: "text-center",
        },
      },
      {
        accessorKey: "is_active",
        header: tfl("active"),
        cell: ({ row }) => (
          <div className="flex items-center justify-center">
            <Controller
              control={form.control}
              name={`${name}.${row.index}.is_active`}
              render={({ field: f }) => (
                <Checkbox
                  checked={f.value}
                  onCheckedChange={f.onChange}
                  disabled={isDisabled}
                  aria-label={tfl("active")}
                  className="size-3.5"
                />
              )}
            />
          </div>
        ),
        enableSorting: false,
        size: 60,
        meta: {
          headerClassName: "text-center",
          cellClassName: "text-center",
        },
      },
    ];

    const actionCol: ColumnDef<UnitField> = {
      id: "action",
      header: () => "",
      cell: ({ row }) => (
        <Button
          type="button"
          variant="ghost"
          size="xs"
          aria-label="Remove"
          onClick={() => setDeleteIndex(row.index)}
        >
          <X />
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
  }, [
    tfl,
    isDisabled,
    form,
    name,
    isOrder,
    inventoryUnitName,
    unitMap,
    usedSelectableIds,
    unitDecimalsMap,
    fixedColumns,
    // cell ปิดทับ errors ไว้ ไม่ใส่ใน deps แล้ว columns ไม่สร้างใหม่ตอน
    // validation fail — error ที่ส่งเข้า cell ค้างเป็นค่าเก่า
    errors,
  ]);

  const table = useReactTable({
    data: fields,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row._fieldKey,
  });

  return (
    // CompactSection ตัวเดียวกับแท็บ General — สลับแท็บแล้วหัวข้อขนาดเท่ากัน
    <CompactSection
      first
      frameless
      title={label}
      count={fields.length}
      action={
        !isDisabled ? (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={addDisabled}
            onClick={handleAdd}
          >
            <Plus />
            {t("addUnit", { label })}
          </Button>
        ) : undefined
      }
    >
      {!isOrder && !isUsedInRecipe && (
        <p className="text-muted-foreground text-sm">{t("enableRecipe")}</p>
      )}

      <div ref={setGridBox}>
        {asCards ? (
          fields.length === 0 ? (
            <EmptyComponent
              title={t("noUnits", { label })}
              description={t("addFirstConversionHint")}
            />
          ) : (
            <RowCards>
              {fields.map((field, index) => {
                const u = watchedUnits?.[index] ?? field;
                const fromName = isOrder
                  ? (unitMap.get(u.from_unit_id) ?? "")
                  : inventoryUnitName;
                const toName = isOrder
                  ? inventoryUnitName
                  : (unitMap.get(u.to_unit_id) ?? "");
                return (
                  <RowCard
                    key={field._fieldKey}
                    title={`${u.from_unit_qty} ${fromName} → ${u.to_unit_qty} ${toName}`}
                    badge={
                      <StatusDotBadge
                        tone={u.is_active ? "success" : "neutral"}
                      >
                        {u.is_active ? ts("active") : ts("inactive")}
                      </StatusDotBadge>
                    }
                  >
                    <RowCardField label={tfl("conversion")}>
                      <ConversionPreview
                        control={form.control}
                        name={name}
                        index={index}
                        unitMap={unitMap}
                      />
                    </RowCardField>
                    <RowCardField label={tfl("isDefault")}>
                      {u.is_default ? "✓" : "—"}
                    </RowCardField>
                  </RowCard>
                );
              })}
            </RowCards>
          )
        ) : (
          <DataGrid
            table={table}
            recordCount={fields.length}
            // โหมดดูใช้ความสูงแถวมาตรฐานของตาราง · โหมดแก้ปล่อยให้แถวสูงตามช่องกรอก
            tableLayout={{ rowClamp: isDisabled, headerSticky: true }}
            tableClassNames={{
              // โหมดแก้: กล่องแคบกว่าผลรวมคอลัมน์ (852) แล้วเลื่อนแนวนอนแทนการบีบช่องกรอก
              base: isDisabled ? undefined : "min-w-[852px]",
            }}
            emptyMessage={
              <EmptyComponent
                title={t("noUnits", { label })}
                description={t("addFirstConversionHint")}
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
        open={deleteIndex !== null}
        onOpenChange={(o) => {
          if (!o) setDeleteIndex(null);
        }}
        title={t("removeUnit", { label })}
        description={t("removeUnitConfirm", { label })}
        onConfirm={confirmDelete}
      />
    </CompactSection>
  );
}

export default memo(PdTabUnitConversion);
