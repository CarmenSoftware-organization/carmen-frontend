import { useState, useMemo } from "react";
import {
  useFieldArray,
  useWatch,
  Controller,
  type UseFormReturn,
  type FieldArrayWithId,
} from "react-hook-form";
import { useTranslations } from "use-intl";
import { DollarSign, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  InputSuffixAddon,
  InputSuffixField,
  InputSuffixInput,
} from "@/components/ui/input/input-suffix";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DataGrid,
  DataGridContainer,
} from "@/components/ui/data-grid/data-grid";
import { DataGridTable } from "@/components/ui/data-grid/data-grid-table";
import { DeleteDialog } from "@/components/ui/delete-dialog";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { LookupExtraCost } from "@/components/lookup/lookup-extra-cost";
import EmptyComponent from "@/components/empty-component";
import { SettingField } from "@/components/share/setting-field";
import { useLookupResource } from "@/hooks/use-lookup-resource";
import { useElementWidth } from "@/hooks/use-element-width";
import { lookupLabel } from "@/types/lookup";
import { formatCurrency } from "@/lib/currency-utils";
import type { GrnFormValues } from "./grn-form-schema";
import { EMPTY_EXTRA_COST } from "./grn-form-schema";
import {
  type ColumnDef,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";

type ExtraCostField = FieldArrayWithId<
  GrnFormValues,
  "extra_cost_details",
  "id"
>;

interface GrnExtraCostFieldsProps {
  readonly form: UseFormReturn<GrnFormValues>;
  readonly disabled: boolean;
  /**
   * วิธีปันส่วนเป็นข้อความแทนกล่อง select (กฎ: โหมดดูไม่ตีกรอบค่า) — แยกจาก `disabled`
   * เพราะ disabled รวม isPending ด้วย ถ้าใช้ตัวนั้นช่องจะกลายเป็นข้อความชั่วขณะตอนกดบันทึก
   */
  readonly readOnly?: boolean;
}

export function GrnExtraCostFields({
  form,
  disabled,
  readOnly = false,
}: GrnExtraCostFieldsProps) {
  "use no memo";
  const t = useTranslations("procurement.goodsReceiveNote");
  const tfl = useTranslations("field");

  const [deleteIndex, setDeleteIndex] = useState<number | null>(null);

  // currency code (doc-level) สำหรับต่อท้ายช่องจำนวนเงิน
  const currencyCode =
    useWatch({ control: form.control, name: "currency_name" }) ?? "";

  const {
    fields: costFields,
    prepend: prependCost,
    remove: removeCost,
  } = useFieldArray({ control: form.control, name: "extra_cost_details" });

  // 32 + 200 + 120 + 200 = 552 คือผลรวมคอลัมน์ บวกเผื่อขอบ
  const [setBoxEl, boxWidth] = useElementWidth();
  const growNote = readOnly && (boxWidth ?? 0) >= 600;

  const columns = useMemo<ColumnDef<ExtraCostField>[]>(() => {
    const indexCol: ColumnDef<ExtraCostField> = {
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

    const dataCols: ColumnDef<ExtraCostField>[] = [
      {
        accessorKey: "extra_cost_type_id",
        header: tfl("type"),
        cell: ({ row }) =>
          readOnly ? (
            <ExtraCostTypeText id={row.original.extra_cost_type_id} />
          ) : (
            <Controller
              control={form.control}
              name={`extra_cost_details.${row.index}.extra_cost_type_id`}
              render={({ field }) => (
                <LookupExtraCost
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={disabled}
                  size="xs"
                  className="w-full text-xs"
                />
              )}
            />
          ),
        size: 200,
      },
      {
        accessorKey: "amount",
        header: tfl("amount"),
        cell: ({ row }) =>
          readOnly ? (
            <span className="block text-right tabular-nums">
              {formatCurrency(Number(row.original.amount) || 0)}
              {currencyCode && (
                <span className="text-muted-foreground ms-1">
                  {currencyCode}
                </span>
              )}
            </span>
          ) : (
            <InputSuffixField className="h-6 w-full" disabled={disabled}>
              <InputSuffixInput
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                {...form.register(`extra_cost_details.${row.index}.amount`, {
                  valueAsNumber: true,
                })}
              />
              {currencyCode && (
                <InputSuffixAddon>
                  <span className="text-muted-foreground px-1.5 text-xs">
                    {currencyCode}
                  </span>
                </InputSuffixAddon>
              )}
            </InputSuffixField>
          ),
        size: 120,
        meta: { headerClassName: "text-right" },
      },
      {
        accessorKey: "note",
        header: tfl("note"),
        cell: ({ row }) =>
          readOnly ? (
            <span className="break-words whitespace-pre-wrap">
              {row.original.note || (
                <span className="text-muted-foreground/60">—</span>
              )}
            </span>
          ) : (
            <Input
              className="h-6 text-xs"
              disabled={disabled}
              maxLength={256}
              {...form.register(`extra_cost_details.${row.index}.note`)}
            />
          ),
        size: 200,
        // โหมดอ่านไม่มีปุ่มลบท้ายแถว — โน้ตรับที่เหลือ ไม่งั้นคอลัมน์ Type ยืดจนยอดเงิน
        // ไปอยู่กลางจอห่างจากชื่อรายการ (1366 ขึ้นไป) · เฉพาะกล่องกว้างกว่าผลรวมคอลัมน์
        // กล่องแคบ (มือถือ) grow ทำให้ตารางกว้างตามขนาดคอลัมน์จนต้องเลื่อนแนวนอน
        meta: growNote ? { grow: true } : undefined,
      },
    ];

    const actionCol: ColumnDef<ExtraCostField> = {
      id: "action",
      header: () => "",
      cell: ({ row }: { row: { index: number } }) => (
        <Button
          type="button"
          variant="ghost"
          size="xs"
          aria-label="Remove"
          onClick={() => setDeleteIndex(row.index)}
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

    return [indexCol, ...dataCols, ...(disabled ? [] : [actionCol])];
  }, [form, disabled, readOnly, growNote, tfl, currencyCode]);

  const allocateOptions = [
    { value: "by_qty", label: t("byQuantity") },
    { value: "by_value", label: t("byValue") },
  ];
  const allocateType = useWatch({
    control: form.control,
    name: "allocate_extra_cost_type",
  });

  const table = useReactTable({
    data: costFields,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.id,
  });

  return (
    <div ref={setBoxEl} className="space-y-4 pt-4">
      {/* Extra Cost Header */}
      {readOnly ? (
        <SettingField
          label={tfl("type")}
          value={
            allocateOptions.find((opt) => opt.value === allocateType)?.label ??
            allocateType
          }
        />
      ) : (
        <div className="max-w-xs">
          <Field>
            <FieldLabel className="text-xs">{tfl("type")}</FieldLabel>
            <Controller
              control={form.control}
              name="allocate_extra_cost_type"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={disabled}
                >
                  <SelectTrigger className="h-8 w-full text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {allocateOptions.map((opt) => (
                      <SelectItem
                        key={opt.value}
                        value={opt.value}
                        className="text-xs"
                      >
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
        </div>
      )}

      {/* Extra Cost Details Table */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-foreground text-sm font-semibold tracking-tight">
            {t("extraCostDetails")}
          </h2>
          {!disabled && (
            <Button
              type="button"
              size="xs"
              onClick={() => prependCost({ ...EMPTY_EXTRA_COST })}
            >
              <Plus /> {t("addCost")}
            </Button>
          )}
        </div>

        <DataGrid
          tableLayout={{ rowClamp: false }}
          table={table}
          recordCount={costFields.length}
          emptyMessage={
            <EmptyComponent
              icon={DollarSign}
              title={t("noExtraCosts")}
              description={t("noExtraCostsDesc")}
              content={
                !disabled && (
                  <Button
                    type="button"
                    size="xs"
                    onClick={() => prependCost({ ...EMPTY_EXTRA_COST })}
                  >
                    <Plus /> {t("addCost")}
                  </Button>
                )
              }
            />
          }
        >
          <DataGridContainer>
            <ScrollArea className="w-full pb-2">
              <DataGridTable />
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </DataGridContainer>
        </DataGrid>
      </div>

      <DeleteDialog
        open={deleteIndex !== null}
        onOpenChange={(o) => {
          if (!o) setDeleteIndex(null);
        }}
        title={t("removeExtraCost")}
        description={t("removeExtraCostConfirm")}
        onConfirm={() => {
          if (deleteIndex === null) return;
          removeCost(deleteIndex);
          setDeleteIndex(null);
        }}
      />
    </div>
  );
}

/** ชื่อประเภทค่าใช้จ่ายโหมดอ่าน — ดึงเฉพาะ id ที่ใช้ (`?ids=`) cache ร่วมกับ LookupExtraCost */
function ExtraCostTypeText({ id }: { readonly id: string }) {
  const { selectedItems } = useLookupResource("extra_cost_type", {
    search: "",
    enabled: false,
    selectedIds: id ? [id] : [],
  });
  const item = selectedItems[0];
  return item ? (
    <span className="break-words">{lookupLabel(item)}</span>
  ) : (
    <span className="text-muted-foreground/60">—</span>
  );
}
