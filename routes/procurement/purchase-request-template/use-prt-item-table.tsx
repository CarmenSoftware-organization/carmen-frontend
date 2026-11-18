import { useTranslations } from "use-intl";
import {
  Controller,
  useWatch,
  type UseFormReturn,
  type Control,
  type FieldArrayWithId,
} from "react-hook-form";
import {
  type ColumnDef,
  type SortingState,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  InputSuffixAddon,
  InputSuffixField,
  InputSuffixPlain,
  InputSuffixQty,
} from "@/components/ui/input/input-suffix";
import { LookupUserLocation } from "@/components/lookup/lookup-user-location";
import { useUnitDecimals } from "@/hooks/use-product-units";
import { useQuantityFormatter } from "@/hooks/use-number-formatter";
import { LookupProductInLocation } from "@/components/lookup/lookup-product-in-location";
import { NameWithSubtext } from "@/components/share/name-with-sub-text";
import { DataGridColumnHeader } from "@/components/ui/data-grid/data-grid-column-header";
import { LookupProductUnit } from "@/components/lookup/lookup-product-unit";
import { LookupCurrency } from "@/components/lookup/lookup-currency";
import { LookupDeliveryPoint } from "@/components/lookup/lookup-delivery-point";
import type { ProductLookupItem } from "@/types/product";
import type { PrtFormValues } from "./prt-form-schema";

const setProductToItem = (
  form: UseFormReturn<PrtFormValues>,
  index: number,
  value: string,
  product?: ProductLookupItem,
) => {
  const current = form.getValues(`items.${index}`);
  // shouldDirty: true จำเป็น — setValue ทั้ง object เลี่ยง field.onChange ของ
  // Controller ทำให้ dirtyFields ไม่อัปเดต buildItemChanges (ที่ใช้ dirtyFields)
  // จะมองข้ามแถวนี้ตอน submit
  form.setValue(
    `items.${index}`,
    {
      ...current,
      product_id: value,
      ...(product
        ? {
            product_name: product.name,
            // สอง endpoint ของ lookup คืนหน่วยคนละทรง — เส้นธรรมดาเป็น object
            // เส้น workflow เป็น flat string อ่านทั้งสองทางไว้ (ท่าเดียวกับ IA)
            inventory_unit_id: product.inventory_unit?.id ?? null,
            inventory_unit_name:
              product.inventory_unit?.name ?? product.inventory_unit_name ?? "",
            requested_unit_id: product.inventory_unit?.id ?? null,
            requested_unit_name:
              product.inventory_unit?.name ?? product.inventory_unit_name ?? "",
          }
        : {
            product_name: "",
            inventory_unit_id: null,
            inventory_unit_name: "",
            requested_unit_id: null,
            requested_unit_name: "",
          }),
    },
    { shouldDirty: true },
  );
};

const ProductCell = ({
  control,
  form,
  index,
  disabled,
  readOnly,
}: {
  control: Control<PrtFormValues>;
  form: UseFormReturn<PrtFormValues>;
  index: number;
  disabled: boolean;
  readOnly: boolean;
}) => {
  "use no memo";
  const locationId =
    useWatch({ control, name: `items.${index}.location_id` }) ?? "";
  const workflowId = useWatch({ control, name: "workflow_id" }) ?? "";
  const productName =
    useWatch({ control, name: `items.${index}.product_name` }) ?? "";
  const productLocalName =
    useWatch({ control, name: `items.${index}.product_local_name` }) ?? "";
  const productError =
    form.formState.errors.items?.[index]?.product_id?.message;
  if (readOnly) {
    return (
      <NameWithSubtext primary={productName} secondary={productLocalName} />
    );
  }
  return (
    <Controller
      control={control}
      name={`items.${index}.product_id`}
      render={({ field }) => (
        <LookupProductInLocation
          locationId={locationId}
          workflowId={workflowId}
          value={field.value ?? ""}
          onValueChange={(value, product) =>
            setProductToItem(form, index, value, product)
          }
          defaultLabel={productName || undefined}
          disabled={disabled}
          readOnly={readOnly}
          className="w-full text-xs"
          error={productError}
        />
      )}
    />
  );
};

const WatchedProductUnit = ({
  control,
  form,
  index,
  disabled,
  readOnly,
}: {
  control: Control<PrtFormValues>;
  form: UseFormReturn<PrtFormValues>;
  index: number;
  disabled: boolean;
  readOnly: boolean;
}) => {
  "use no memo";
  const productId =
    useWatch({ control, name: `items.${index}.product_id` }) ?? "";
  const unitError =
    form.formState.errors.items?.[index]?.requested_unit_id?.message;
  return (
    <Controller
      control={control}
      name={`items.${index}.requested_unit_id`}
      render={({ field }) => (
        <LookupProductUnit
          productId={productId}
          value={field.value ?? ""}
          onValueChange={field.onChange}
          defaultLabel={
            form.getValues(`items.${index}.requested_unit_name`) || undefined
          }
          disabled={disabled}
          readOnly={readOnly}
          // ความกว้างคงที่ = 4 ตัวอักษร + ที่ของลูกศร (ช่องว่างซ้ายขวา 1rem +
          // ไอคอน 1rem) ผูกกับ `ch` ไม่ใช่ px คงที่ เปลี่ยนขนาดฟอนต์เมื่อไรก็ยัง
          // พอดี 4 ตัวเท่าเดิม · ของเดิม w-20 ตัดชื่อหน่วยสี่ตัวทิ้งเป็นจุดไข่ปลา
          className="w-[calc(4ch+4rem)] shrink-0 rounded-none border-0 bg-transparent px-2 text-xs shadow-none hover:bg-transparent focus-visible:ring-0"
          error={unitError}
        />
      )}
    />
  );
};

// รวม qty + unit เป็น InputSuffix เดียว (เหมือน GRN): input จำนวน + addon เลือกหน่วย
const QtyUnitCell = ({
  control,
  form,
  index,
  disabled,
  readOnly,
}: {
  control: Control<PrtFormValues>;
  form: UseFormReturn<PrtFormValues>;
  index: number;
  disabled: boolean;
  readOnly: boolean;
}) => {
  "use no memo";
  const tfl = useTranslations("field");
  const qty = useWatch({ control, name: `items.${index}.requested_qty` });
  const unitName =
    useWatch({ control, name: `items.${index}.requested_unit_name` }) ?? "";
  const qtyError = form.formState.errors.items?.[index]?.requested_qty?.message;
  const productId =
    useWatch({ control, name: `items.${index}.product_id` }) ?? "";
  const unitId =
    useWatch({ control, name: `items.${index}.requested_unit_id` }) ?? "";
  // ทศนิยมที่กรอกได้มาจาก decimal_place ของหน่วยที่เลือก (master data)
  const decimals = useUnitDecimals(productId, unitId);
  // ตัวเดียวกับที่คุม input — โหมดอ่านจึงแสดงเท่าที่โหมดกรอกพิมพ์ได้พอดี
  const formatQty = useQuantityFormatter(decimals);

  if (readOnly) {
    return (
      <InputSuffixPlain
        // 0 เป็นค่าที่ตั้งใจใส่ได้ จึงต้องโชว์เป็น 0 ไม่ใช่ขีด — ขีดไว้ให้เฉพาะ
        // แถวที่ไม่มีค่าเลยจริง ๆ · ทศนิยมตามหน่วยเดียวกับตอนกรอก คนอ่านจะได้เห็น
        // เท่าที่พิมพ์ได้พอดี
        value={
          qty == null ? (
            <span className="text-muted-foreground">—</span>
          ) : (
            formatQty(Number(qty))
          )
        }
        suffix={unitName}
        suffixClassName="ml-1 inline-block w-[4ch] text-right"
      />
    );
  }

  return (
    <InputSuffixField error={!!qtyError} disabled={disabled}>
      <InputSuffixQty
        // ไม่ override min — InputSuffixQty เป็น min=0 อยู่แล้ว และ 0 เป็นค่าที่
        // ใส่ได้จริงในแม่แบบ (schema ก็ min(0)) ของเดิม min=1 บล็อกไว้ที่ตัว input
        decimals={decimals}
        placeholder={tfl("qty")}
        {...form.register(`items.${index}.requested_qty`)}
        // ลบเลขจนช่องว่าง = `valueAsNumber` คืน NaN ซึ่ง zod ตีเป็น "ไม่ใช่ตัวเลข"
        // แล้วขอบแดงค้างอยู่อย่างนั้น แม้ผู้ใช้จะพิมพ์ 0 กลับเข้าไปก็ยังไม่หาย
        // เพราะค่าที่ค้างในฟอร์มเป็น NaN ไม่ใช่ 0 — ช่องว่างคือ 0 อ่านเขียนที่เดียว
        // ตรงนี้ (ท่าเดียวกับ PO/GRN) ไม่ใช่ปล่อย NaN ไหลเข้าฟอร์ม
        onChange={(e) => {
          const n = e.currentTarget.valueAsNumber;
          form.setValue(
            `items.${index}.requested_qty`,
            Number.isNaN(n) ? 0 : n,
            { shouldDirty: true, shouldValidate: true },
          );
        }}
      />
      <InputSuffixAddon>
        <WatchedProductUnit
          control={control}
          form={form}
          index={index}
          disabled={disabled}
          readOnly={readOnly}
        />
      </InputSuffixAddon>
    </InputSuffixField>
  );
};

export type PrtItemField = FieldArrayWithId<PrtFormValues, "items", "id">;

interface UsePrtItemTableOptions {
  form: UseFormReturn<PrtFormValues>;
  itemFields: PrtItemField[];
  disabled: boolean;
  readOnly?: boolean;
  onDelete: (index: number) => void;
  /**
   * ความกว้างกล่องของตาราง (วัดด้วย `useElementWidth`) — `undefined` = ยังไม่วัด
   * ใช้ชุดแบ่งตามสัดส่วน
   */
  containerWidth?: number;
}

/**
 * กล่องกว้างถึงจุดนี้ = คอลัมน์ข้อมูลกว้างคงที่ แล้วคอลัมน์สุดท้ายรับที่เหลือ (ไม่ให้คอลัมน์
 * ห่างกันหลายร้อย px ที่ Full HD/4K) · ผลรวม size ชุดกว้าง: 50+220+360+150+90+180 = 1050
 * (+ ปุ่มลบ 40 ตอนแก้ = 1090) — จุดสลับต้องสูงกว่าผลรวม ไม่งั้นคอลัมน์ grow ยุบเหลือขั้นต่ำ
 */
export const PRT_ITEM_WIDE_BOX = 1140;

export function usePrtItemTable({
  form,
  itemFields,
  disabled,
  readOnly = false,
  onDelete,
  containerWidth,
}: UsePrtItemTableOptions) {
  "use no memo";
  const tfl = useTranslations("field");
  const wide = (containerWidth ?? 0) >= PRT_ITEM_WIDE_BOX;
  const allColumns = useMemo<ColumnDef<PrtItemField>[]>(() => {
    const indexColumn: ColumnDef<PrtItemField> = {
      id: "index",
      header: "#",
      cell: ({ row }) => row.index + 1,
      enableSorting: false,
      size: 50,
      meta: {
        headerClassName: "text-center",
        cellClassName: "text-center text-muted-foreground",
      },
    };

    const dataColumns: ColumnDef<PrtItemField>[] = [
      {
        accessorKey: "location_id",
        // เรียงตามชื่อคลัง ไม่ใช่ค่าใน accessor (location_id เป็น uuid เรียงแล้วมั่ว)
        // และอ่านค่าสดจากฟอร์ม — `itemFields` เป็น snapshot ตอน mount ไม่ขยับตาม
        // setValue ที่ cell เขียนลงไป เปลี่ยนคลังแล้วเรียงจะได้ชื่อเก่า
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title={tfl("location")} />
        ),
        sortingFn: (a, b) =>
          (
            form.getValues(`items.${a.index}.location_name`) ?? ""
          ).localeCompare(
            form.getValues(`items.${b.index}.location_name`) ?? "",
          ),
        cell: ({ row }) => {
          if (readOnly) {
            return (
              <NameWithSubtext
                primary={form.getValues(`items.${row.index}.location_name`)}
                secondary={form.getValues(`items.${row.index}.location_code`)}
              />
            );
          }
          const locationError =
            form.formState.errors.items?.[row.index]?.location_id?.message;
          return (
            <Controller
              control={form.control}
              name={`items.${row.index}.location_id`}
              render={({ field }) => (
                <LookupUserLocation
                  value={field.value ?? ""}
                  onValueChange={field.onChange}
                  onItemChange={(location) => {
                    // ชื่อกับรหัสคลังเป็นของ display ล้วน ไม่เข้า payload — แต่
                    // โหมดอ่านของคอลัมน์นี้อ่านจากสองฟิลด์นี้ ของเดิมไม่เคยเขียน
                    // ลงฟอร์มเลย แถวที่เพิ่งเลือกคลังจึงว่างเปล่าจนกว่าจะโหลดใหม่
                    form.setValue(
                      `items.${row.index}.location_name`,
                      location.name ?? "",
                    );
                    form.setValue(
                      `items.${row.index}.location_code`,
                      location.code ?? "",
                    );
                    // คลังที่ไม่มีจุดส่งของต้องล้างของเดิมทิ้ง ไม่ใช่ปล่อยค้าง —
                    // ไม่งั้นแถวนี้แบกจุดส่งของคลังก่อนหน้าไปกับแม่แบบโดยไม่มีใครเห็น
                    // (ทรงเดียวกับ PR) · ล้างแล้วช่องจุดส่งของจะแดงให้เลือกใหม่เอง
                    form.setValue(
                      `items.${row.index}.delivery_point_id`,
                      location.delivery_point?.id ?? null,
                    );
                    form.setValue(
                      `items.${row.index}.delivery_point_name`,
                      location.delivery_point?.name ?? "",
                    );
                  }}
                  disabled={disabled}
                  defaultLabel={form.getValues(
                    `items.${row.index}.location_name`,
                  )}
                  popoverWidth="w-[26.25rem]"
                  className="h-8 w-full text-xs"
                  error={locationError}
                />
              )}
            />
          );
        },
        size: wide ? 220 : 160,
      },

      {
        accessorKey: "product_id",
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title={tfl("product")} />
        ),
        sortingFn: (a, b) =>
          (form.getValues(`items.${a.index}.product_name`) ?? "").localeCompare(
            form.getValues(`items.${b.index}.product_name`) ?? "",
          ),
        cell: ({ row }) => (
          <ProductCell
            control={form.control}
            form={form}
            index={row.index}
            disabled={disabled}
            readOnly={readOnly}
          />
        ),
        size: wide ? 360 : 160,
      },
      {
        id: "requested_qty",
        header: tfl("requested"),
        enableSorting: false,
        cell: ({ row }) => (
          <QtyUnitCell
            control={form.control}
            form={form}
            index={row.index}
            disabled={disabled}
            readOnly={readOnly}
          />
        ),
        size: 150,
        meta: {
          headerClassName: "text-right",
          cellClassName: "text-right",
        },
      },
      {
        accessorKey: "currency_id",
        header: tfl("currency"),
        enableSorting: false,
        cell: ({ row }) => {
          const currencyError =
            form.formState.errors.items?.[row.index]?.currency_id?.message;
          return (
            <Controller
              control={form.control}
              name={`items.${row.index}.currency_id`}
              render={({ field }) => (
                <LookupCurrency
                  value={field.value ?? ""}
                  onValueChange={field.onChange}
                  disabled={disabled}
                  readOnly={readOnly}
                  className="flex w-full justify-center text-xs"
                  error={currencyError}
                  size="sm"
                />
              )}
            />
          );
        },
        size: wide ? 90 : 80,
        meta: {
          headerClassName: "text-center",
        },
      },
      {
        accessorKey: "delivery_point_id",
        header: tfl("deliveryPoint"),
        enableSorting: false,
        cell: ({ row }) => {
          const deliveryPointError =
            form.formState.errors.items?.[row.index]?.delivery_point_id
              ?.message;
          return (
            <Controller
              control={form.control}
              name={`items.${row.index}.delivery_point_id`}
              render={({ field }) => (
                <LookupDeliveryPoint
                  value={field.value ?? ""}
                  onValueChange={field.onChange}
                  onItemChange={(deliveryPoint) => {
                    form.setValue(
                      `items.${row.index}.delivery_point_name`,
                      deliveryPoint.name,
                    );
                  }}
                  // จุดส่งของที่ถูกปิดใช้งานแล้วไม่อยู่ใน list ที่ lookup ดึงมา
                  // (lookup กรอง is_active) ไม่ส่งป้ายสำรองไป = ช่องว่างเปล่า
                  // ทั้งที่แม่แบบมีค่าอยู่
                  defaultLabel={form.getValues(
                    `items.${row.index}.delivery_point_name`,
                  )}
                  disabled={disabled}
                  readOnly={readOnly}
                  className="w-full text-xs"
                  error={deliveryPointError}
                />
              )}
            />
          );
        },
        size: wide ? 180 : 100,
        // โหมดดูไม่มีคอลัมน์ปุ่ม — คอลัมน์ข้อมูลสุดท้ายรับที่เหลือ
        meta: { grow: wide && readOnly },
      },
    ];

    const actionColumn: ColumnDef<PrtItemField> = {
      id: "action",
      header: () => "",
      cell: ({ row }: { row: { index: number } }) => (
        <Button
          type="button"
          variant="ghost"
          size="xs"
          aria-label="Remove"
          disabled={disabled}
          onClick={() => onDelete(row.index)}
        >
          <Trash2 />
        </Button>
      ),
      enableSorting: false,
      size: 40,
      meta: {
        // โหมดแก้: ปุ่มลบรับที่เหลือ ช่องกรอกจึงไม่ยืดตามจอ (กฎ 2) และปุ่มชิดขวาของกรอบ
        grow: wide,
        headerClassName: "text-right",
        cellClassName: "text-right",
      },
    };

    return [indexColumn, ...dataColumns, ...(readOnly ? [] : [actionColumn])];
  }, [tfl, readOnly, form, disabled, onDelete, wide]);

  const [sorting, setSorting] = useState<SortingState>([]);

  const table = useReactTable({
    data: itemFields,
    columns: allColumns,
    // เรียงที่ table ไม่ใช่ที่ `data` — ทุก cell ผูก `items.${row.index}` ไว้กับฟอร์ม
    // ถ้าสลับลำดับใน data เอง index จะไม่ตรงกับ field array อีก (ท่าเดียวกับ PR)
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return { table };
}
