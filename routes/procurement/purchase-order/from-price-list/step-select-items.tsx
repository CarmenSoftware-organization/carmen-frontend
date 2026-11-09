import { useCallback, useMemo, useState } from "react";
import { useWatch, useFormState, type UseFormReturn } from "react-hook-form";
import { useTranslations } from "use-intl";
import {
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type RowSelectionState,
  type Updater,
} from "@tanstack/react-table";
import { AlertTriangle, FilterX } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  DataGrid,
  DataGridContainer,
} from "@/components/ui/data-grid/data-grid";
import {
  DataGridTable,
  DataGridTableRowSelect,
} from "@/components/ui/data-grid/data-grid-table";
import {
  columnSkeletons,
  selectColumn,
} from "@/components/ui/data-grid/columns";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { InputQty } from "@/components/ui/input/input-qty";
import { LookupProductLocation } from "@/components/lookup/lookup-product-location";
import EmptyComponent from "@/components/empty-component";
import SearchInput from "@/components/search-input";
import { ListFilter } from "@/components/list-filter/list-filter";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/date-utils";
import { round2 } from "@/lib/currency-utils";
import { computeLineAmounts } from "@/lib/line-pricing";
import { useCurrency } from "@/hooks/use-currency";
import { useEntitiesByIds } from "@/hooks/use-entities-by-ids";
import type { Currency } from "@/types/currency";
import { useActivePriceListsByVendor } from "@/hooks/use-price-list";
import type { PriceList, PriceListDetailItem } from "@/types/price-list";
import { usePoRowFilter, type PoFilterField } from "../po-row-filter";
import {
  WIZARD_ITEM_TEMPLATE,
  type FromPriceListFormValues,
  type FromPriceListSelectedItem,
} from "./from-price-list-form-schema";

interface StepSelectItemsProps {
  readonly form: UseFormReturn<FromPriceListFormValues>;
}

interface PlRow {
  readonly detail: PriceListDetailItem;
  readonly pricelistNo: string;
  readonly currency: PriceList["currency"];
  readonly canUse: boolean;
}

const FILTER_FIELDS: PoFilterField<PlRow>[] = [
  {
    key: "product_id",
    labelKey: "field.product",
    of: (r) => [r.detail.product?.id ?? "", r.detail.product?.name ?? ""],
  },
  {
    key: "currency_id",
    labelKey: "field.currency",
    of: (r) => [r.currency?.id ?? "", r.currency?.code ?? ""],
  },
];

function toRows(priceLists: PriceList[]): PlRow[] {
  return priceLists.flatMap((pl) =>
    pl.pricelist_detail.map((detail) => ({
      detail,
      pricelistNo: pl.no,
      currency: pl.currency,
      // ทั้งใบต้องใช้ได้ **และ** บรรทัดนั้นต้องใช้ได้ · เทียบกับ false ตรง ๆ ไม่ใช่
      // ตีเป็น boolean — หลังบ้านรุ่นที่ยังไม่ส่งฟิลด์นี้มาต้องถือว่าใช้ได้ ไม่ใช่
      // ล็อกทั้งตารางเงียบ ๆ
      canUse: pl.can_use !== false && detail.can_use !== false,
    })),
  );
}

function filterRows(rows: PlRow[], q: string): PlRow[] {
  if (!q) return rows;
  const needle = q.toLowerCase();
  return rows.filter(
    ({ detail, pricelistNo }) =>
      (detail.product?.code ?? "").toLowerCase().includes(needle) ||
      (detail.product?.name ?? "").toLowerCase().includes(needle) ||
      (detail.product?.local_name ?? "").toLowerCase().includes(needle) ||
      pricelistNo.toLowerCase().includes(needle),
  );
}

function detailToItem(row: PlRow): FromPriceListSelectedItem {
  const { detail } = row;
  const qty = detail.moq_qty || 1;
  // ราคากับ flag มาจากบรรทัดเดียวกันเสมอ — ติ๊ก Inc VAT แล้วถอด VAT ออกจากราคา
  const isTaxIncluded = detail.is_tax_included ?? false;
  const line = computeLineAmounts({
    price: detail.price,
    qty,
    discRate: 0,
    isDiscAdj: false,
    discAmt: 0,
    taxRate: detail.tax_rate ?? 0,
    isTaxAdj: false,
    taxAmt: 0,
    isTaxIncluded,
  });
  return {
    ...WIZARD_ITEM_TEMPLATE,
    pricelist_detail_id: detail.id,
    pricelist_no: row.pricelistNo,
    product_id: detail.product?.id ?? null,
    product_code: detail.product?.code ?? "",
    product_name: detail.product?.name ?? "",
    product_local_name: detail.product?.local_name ?? "",
    product_sku: detail.product_sku ?? "",
    order_unit_id: detail.unit?.id ?? null,
    order_unit_name: detail.unit?.name ?? "",
    order_unit_conversion_factor: 1,
    order_qty: qty,
    base_unit_id: detail.unit?.id ?? null,
    base_unit_name: detail.unit?.name ?? "",
    base_qty: qty,
    price: detail.price,
    is_tax_included: isTaxIncluded,
    sub_total_price: line.subtotal,
    net_amount: line.netAmount,
    total_price: line.totalPrice,
    tax_profile_id: detail.tax_profile?.id ?? null,
    tax_profile_name: detail.tax_profile?.name ?? "",
    tax_rate: detail.tax_rate ?? 0,
    tax_amount: line.taxAmount,
  };
}

type RowError =
  | {
      location_id?: { message?: string };
      order_qty?: { message?: string };
    }
  | undefined;

export function StepSelectItems({ form }: StepSelectItemsProps) {
  "use no memo";
  const t = useTranslations("procurement.purchaseOrder");
  const tfl = useTranslations("field");
  const tc = useTranslations("common");
  const tl = useTranslations("lookup");

  const vendorId = useWatch({ control: form.control, name: "vendor_id" });
  const deliveryDate = useWatch({
    control: form.control,
    name: "delivery_date",
  });
  const workflowId =
    useWatch({ control: form.control, name: "workflow_id" }) ?? "";
  const itemsRaw = useWatch({ control: form.control, name: "items" });
  const items = useMemo(
    () => (itemsRaw ?? []) as FromPriceListSelectedItem[],
    [itemsRaw],
  );

  // ต้อง subscribe ผ่าน useFormState — อ่าน form.formState.errors ตรง ๆ จะได้ค่า
  // เก่า (stale) ทำให้ error ของคลังแสดงช้าไป 1 จังหวะ (เลือกแล้วเพิ่งแดง)
  const { errors: formErrors } = useFormState({ control: form.control });
  const itemsError = formErrors.items;
  const itemsErrorMessage =
    typeof itemsError?.message === "string" ? itemsError.message : undefined;

  const apiDate = deliveryDate
    ? formatDate(deliveryDate, "yyyy-MM-dd")
    : undefined;

  const {
    data: priceLists,
    isLoading,
    error,
  } = useActivePriceListsByVendor(vendorId, apiDate, workflowId);

  const [search, setSearch] = useState("");
  // `data` ของ TanStack ต้องคงตัวตนไว้ระหว่าง render ที่ไม่มีอะไรเปลี่ยน — ส่ง array
  // ใหม่ทุกรอบจะไปปลุก autoReset ของ table ให้ setState แล้ววนไม่จบ (จอค้าง กดติ๊ก
  // ไม่ติด) ด้วยเหตุผลเดียวกันจึงต้อง default `?? []` **ในนี้** ไม่ใช่ตอน destructure
  const allRows = useMemo(() => toRows(priceLists ?? []), [priceLists]);
  const filter = usePoRowFilter(allRows, FILTER_FIELDS);
  const rows = useMemo(
    () => filterRows(allRows, search.trim()).filter(filter.matches),
    [allRows, search, filter.matches],
  );

  // เรตของสกุลเงินของ price list ที่อยู่ในตาราง (ดึงตาม id) — ถ้าไม่มีเรต ใบสกุล
  // ต่างประเทศจะถูกส่งด้วย exchange_rate 1 ของ EMPTY_FORM เงียบ ๆ (บั๊กเดิม) จึงถือว่า
  // แถวที่เรตของสกุลยังไม่มา "ยังไม่พร้อม" — ติ๊กไม่ได้จนกว่าเรตจะมาถึง
  const currencyIds = useMemo(
    () => allRows.map((r) => r.currency?.id ?? ""),
    [allRows],
  );
  const { items: rateCurrencies } = useEntitiesByIds<Currency>({
    useListHook: useCurrency,
    ids: currencyIds,
  });
  const rateById = useMemo(
    () => new Map(rateCurrencies.map((c) => [c.id, c.exchange_rate] as const)),
    [rateCurrencies],
  );
  const isRateReady = useCallback(
    (row: PlRow) => !row.currency?.id || rateById.get(row.currency.id) != null,
    [rateById],
  );

  const selectedByDetail = useMemo(
    () => new Map(items.map((i) => [i.pricelist_detail_id, i] as const)),
    [items],
  );

  // ล็อก 1 ใบ = 1 สกุลเงิน — สกุลของแถวที่ติ๊กไว้ตัวแรกเป็นตัวตั้ง แถวสกุลอื่นถูกปิด
  // จนกว่าจะติ๊กออกหมด (กติกาเดิมของ dialog ที่ถูกยกมา)
  const activeCurrency =
    allRows.find((r) => selectedByDetail.has(r.detail.id))?.currency ?? null;

  /**
   * ติ๊กแถวนี้ได้ไหม — หลังบ้านห้าม หรือคนละสกุลกับที่ล็อกไว้แล้ว
   *
   * ต้องคงตัวตนข้าม render เพราะเป็น dep ของ columns — ฟังก์ชันใหม่ทุกรอบเท่ากับ
   * สร้างคอลัมน์ใหม่ทุกรอบ แล้วช่องกรอกจำนวนในแถวจะโดน remount จนโฟกัสหลุด
   */
  const canSelectRow = useCallback(
    (row: PlRow) =>
      row.canUse &&
      isRateReady(row) &&
      (activeCurrency == null || row.currency?.id === activeCurrency.id),
    [activeCurrency, isRateReady],
  );

  const hasUnusableRow = rows.some((r) => !r.canUse);

  const totalAmount = items.reduce(
    (sum, item) => sum + round2((Number(item.order_qty) || 0) * item.price),
    0,
  );

  const setItems = useCallback(
    (next: FromPriceListSelectedItem[]) => {
      form.setValue("items", next, { shouldDirty: true, shouldValidate: true });
    },
    [form],
  );

  const patchItem = useCallback(
    (detailId: string, patch: Partial<FromPriceListSelectedItem>) => {
      const current = (form.getValues("items") ??
        []) as FromPriceListSelectedItem[];
      setItems(
        current.map((i) =>
          i.pricelist_detail_id === detailId ? { ...i, ...patch } : i,
        ),
      );
    },
    [form, setItems],
  );

  const rowSelection = useMemo<RowSelectionState>(
    () => Object.fromEntries(items.map((i) => [i.pricelist_detail_id, true])),
    [items],
  );

  const handleRowSelectionChange = (updater: Updater<RowSelectionState>) => {
    const next =
      typeof updater === "function" ? updater(rowSelection) : updater;
    const wanted = new Set(Object.keys(next).filter((key) => next[key]));

    const current = (form.getValues("items") ??
      []) as FromPriceListSelectedItem[];
    const kept = current.filter((i) => wanted.has(i.pricelist_detail_id));
    const keptIds = new Set(kept.map((i) => i.pricelist_detail_id));
    const added = allRows.filter(
      (r) =>
        wanted.has(r.detail.id) &&
        !keptIds.has(r.detail.id) &&
        r.canUse &&
        isRateReady(r),
    );

    // "เลือกทั้งหมด" กวาดได้ทุกแถวตอนที่ยังไม่มีสกุลตั้งต้น (ยังไม่มีแถวไหนถูกล็อก)
    // กติกา 1 ใบ 1 สกุลจึงต้องบังคับซ้ำตรงนี้ ไม่ใช่พึ่ง enableRowSelection อย่างเดียว
    // — ยึดสกุลของแถวแรกที่เพิ่มเข้ามา แล้วทิ้งแถวสกุลอื่น
    const currency =
      kept.length > 0 ? activeCurrency : (added[0]?.currency ?? null);
    const accepted = currency
      ? added.filter((r) => r.currency?.id === currency.id)
      : added;

    const nextItems = [...kept, ...accepted.map(detailToItem)];
    setItems(nextItems);

    if (nextItems.length === 0) {
      // ไม่เหลือของแล้ว = ปลดล็อกสกุลเงิน รอบหน้าติ๊ก PL ใบไหนก็ได้
      form.setValue("currency_id", "", { shouldDirty: true });
      form.setValue("currency_code", "", { shouldDirty: true });
      form.setValue("exchange_rate", 1, { shouldDirty: true });
      return;
    }

    if (currency && !form.getValues("currency_id")) {
      form.setValue("currency_id", currency.id, { shouldDirty: true });
      form.setValue("currency_code", currency.code ?? "", {
        shouldDirty: true,
      });
      const rate = rateById.get(currency.id);
      if (rate != null) {
        form.setValue("exchange_rate", rate, { shouldDirty: true });
      }
    }
  };

  const errorOf = useCallback(
    (detailId: string): RowError => {
      if (!Array.isArray(itemsError)) return undefined;
      const index = items.findIndex((i) => i.pricelist_detail_id === detailId);
      return index < 0 ? undefined : (itemsError[index] as RowError);
    },
    [items, itemsError],
  );

  const columns = useMemo<ColumnDef<PlRow>[]>(() => {
    const dim = (row: PlRow) => (canSelectRow(row) ? undefined : "opacity-50");

    return [
      {
        ...selectColumn<PlRow>(),
        size: 44,
        // ของกลางไม่ส่ง disabled ให้ checkbox — แถวที่เลือกไม่ได้จะกดแล้วเงียบ
        cell: ({ row }) => (
          <DataGridTableRowSelect row={row} disabled={!row.getCanSelect()} />
        ),
      },
      {
        id: "pricelist_no",
        header: t("priceListNo"),
        size: 130,
        meta: { skeleton: columnSkeletons.textShort },
        cell: ({ row }) => (
          <span className={cn("font-semibold", dim(row.original))}>
            {row.original.pricelistNo}
          </span>
        ),
      },
      {
        id: "product",
        header: tfl("product"),
        size: 240,
        meta: { skeleton: columnSkeletons.text },
        cell: ({ row }) => (
          <div className={cn("flex flex-col", dim(row.original))}>
            <span className="font-semibold">
              {row.original.detail.product?.name}
            </span>
            <span className="text-muted-foreground text-micro-legal">
              {row.original.detail.product?.local_name}
            </span>
          </div>
        ),
      },
      {
        id: "unit",
        header: tfl("unit"),
        size: 90,
        meta: {
          cellClassName: "text-muted-foreground",
          skeleton: columnSkeletons.textShort,
        },
        cell: ({ row }) => (
          <span className={dim(row.original)}>
            {row.original.detail.unit?.name ?? "—"}
          </span>
        ),
      },
      {
        id: "price",
        header: tfl("unitPrice"),
        size: 130,
        meta: {
          headerClassName: "text-right",
          cellClassName: "text-right tabular-nums",
          skeleton: columnSkeletons.textShort,
        },
        cell: ({ row }) => (
          <span className={dim(row.original)}>
            {row.original.detail.price.toLocaleString()}{" "}
            <span className="text-muted-foreground text-micro">
              {row.original.currency?.code}
            </span>
          </span>
        ),
      },
      {
        id: "qty",
        header: tfl("qty"),
        size: 110,
        meta: {
          headerClassName: "text-right",
          skeleton: columnSkeletons.textShort,
        },
        cell: ({ row }) => {
          const { detail } = row.original;
          const selected = selectedByDetail.get(detail.id);
          // กรอกได้เฉพาะแถวที่ติ๊กแล้ว — ยังไม่ติ๊กก็ยังไม่มี item ให้แก้
          return (
            <InputQty
              errorIconAlign="left"
              className="h-8 text-right"
              disabled={!selected}
              error={errorOf(detail.id)?.order_qty?.message}
              value={Number(selected?.order_qty ?? detail.moq_qty)}
              onChange={(e) => {
                const n = e.target.valueAsNumber;
                patchItem(detail.id, {
                  order_qty: Number.isNaN(n) ? 0 : n,
                  base_qty: Number.isNaN(n) ? 0 : n,
                });
              }}
            />
          );
        },
      },
      {
        id: "location",
        header: tfl("location"),
        size: 200,
        meta: { skeleton: columnSkeletons.text },
        cell: ({ row }) => {
          const { detail } = row.original;
          const selected = selectedByDetail.get(detail.id);
          return (
            <LookupProductLocation
              productId={detail.product?.id ?? ""}
              workflowId={workflowId}
              value={selected?.location_id ?? ""}
              // StepperContent unmount ขั้นที่ไม่ active — ย้อนกลับมาขั้นนี้แล้ว
              // pickedItem ของ combobox หาย ใช้ชื่อที่ patch เก็บไว้แทน
              defaultLabel={
                selected?.location_name
                  ? selected.location_code
                    ? `${selected.location_name} - ${selected.location_code}`
                    : selected.location_name
                  : undefined
              }
              onValueChange={(v) => patchItem(detail.id, { location_id: v })}
              onItemChange={(loc) =>
                patchItem(detail.id, {
                  location_code: loc.code ?? "",
                  location_name: loc.name ?? "",
                })
              }
              disabled={!selected}
              error={errorOf(detail.id)?.location_id?.message}
              className="h-8 w-full text-xs"
            />
          );
        },
      },
    ];
  }, [
    // ไม่ต้องมี activeCurrency — canSelectRow ห่อมันไว้แล้ว ใส่ซ้ำเท่ากับสร้าง
    // คอลัมน์ใหม่โดยไม่จำเป็น
    canSelectRow,
    selectedByDetail,
    errorOf,
    patchItem,
    workflowId,
    t,
    tfl,
  ]);

  const disabled = !vendorId || !apiDate || !workflowId;

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    // ตารางนี้ไม่มีหน้า — ปิด autoReset ไว้ไม่ให้ data ที่เปลี่ยนไปสั่ง setPageIndex
    autoResetPageIndex: false,
    // id ของแถว = id ของบรรทัด price list ตัวเดียวกับที่ item ใช้จับคู่
    getRowId: (row) => row.detail.id,
    state: { rowSelection },
    onRowSelectionChange: handleRowSelectionChange,
    enableRowSelection: (row) => canSelectRow(row.original),
  });

  return (
    <Field>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <FieldLabel required>{tfl("product")}</FieldLabel>
        <div className="flex items-center gap-2">
          <Badge variant={items.length > 0 ? "default" : "secondary"}>
            {t("nProductsSelected", { count: items.length })}
          </Badge>
          {totalAmount > 0 && (
            <Badge variant="secondary">
              {tfl("total")}: {totalAmount.toLocaleString()}
            </Badge>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {/* กรองในฝั่ง client จากรายการที่โหลดมาแล้ว — onInputChange กรองทันทีที่พิมพ์
            (ไม่ใช่รอ Enter) เหมือนช่องค้นผู้ขายใน step ก่อนหน้า */}
        <SearchInput
          defaultValue={search}
          onSearch={setSearch}
          onInputChange={setSearch}
          placeholder={t("searchProduct")}
          containerClassName="w-96"
          inputClassName="h-8 text-xs placeholder:text-xs"
        />
        {/* ไม่มี onSaveClick เพราะ saved view ผูกกับหน้า list ไม่ใช่ตารางใน wizard
            (เหตุผลเดียวกับตัวกรองรายการสินค้าของ PR) */}
        <ListFilter
          fields={filter.fields}
          values={filter.values}
          setValue={filter.setValue}
          onClearAll={filter.clearAll}
          activeCount={filter.activeCount}
        />
      </div>

      {activeCurrency && (
        <div
          className="border-warning/30 bg-warning/5 text-warning-foreground text-micro flex items-start gap-2 rounded-md border px-3 py-2"
          role="status"
          aria-live="polite"
        >
          <AlertTriangle
            aria-hidden="true"
            className="text-warning-ink mt-px size-3.5 shrink-0"
          />
          <span>
            {t("singleCurrencyHint", { currency: activeCurrency.code ?? "" })}
          </span>
        </div>
      )}

      {/* บอกครั้งเดียวเหนือตาราง ไม่ติดป้ายซ้ำทุกแถว — ตัวอย่างจริงมีแถวที่ใช้
          ไม่ได้เกือบทั้งตาราง ป้ายรายแถวจะกลายเป็นเสียงรบกวนแทนที่จะเป็นข้อมูล */}
      {hasUnusableRow && (
        <p className="text-muted-foreground text-micro">
          {t("notSelectableHint")}
        </p>
      )}

      {error ? (
        <p className="text-destructive p-3 text-xs">
          {error instanceof Error ? error.message : String(error)}
        </p>
      ) : (
        <DataGrid
          table={table}
          recordCount={rows.length}
          isLoading={!disabled && isLoading}
          loadingMode="skeleton"
          tableLayout={{
            rowClamp: false,
            checkbox: true,
            headerSticky: true,
          }}
          emptyMessage={
            // กรอง/ค้นจนไม่เหลือแถว ≠ ผู้ขายรายนี้ไม่มีของ — ข้อความเดียวกันจะหลอก
            // ให้ถอยไปเปลี่ยนผู้ขายทั้งที่ของอยู่ครบ แค่ถูกซ่อน
            !disabled && (filter.activeCount > 0 || search.trim()) ? (
              <EmptyComponent
                icon={FilterX}
                title={tc("noSearchResult")}
                description={tl("noFoundDesc")}
              />
            ) : (
              <EmptyComponent
                title={t("noItemsAvailable")}
                description={t("noItemsAvailableDesc")}
              />
            )
          }
        >
          <DataGridContainer scroll className="max-h-96">
            <DataGridTable />
          </DataGridContainer>
        </DataGrid>
      )}

      {itemsErrorMessage && <FieldError>{itemsErrorMessage}</FieldError>}
    </Field>
  );
}
