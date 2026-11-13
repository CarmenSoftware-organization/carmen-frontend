import { memo, useState } from "react";
import { useTranslations } from "use-intl";
import { Percent, Plus } from "lucide-react";
import {
  Controller,
  useFieldArray,
  useFormState,
  useWatch,
} from "react-hook-form";
import { getCoreRowModel, useReactTable } from "@tanstack/react-table";
import type { ProductDetail, ProductFormInstance } from "@/types/product";
import type { ItemGroupDto } from "@/types/category";
import type { LookupItem } from "@/types/lookup";
import {
  Field,
  FieldError,
  FieldInput,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { StatusDotBadge } from "@/components/ui/status-dot-badge";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  CompactSection,
  FieldGrid,
  SECTION_PAIR,
} from "@/components/share/compact-section";
import { SettingField } from "@/components/share/setting-field";
import {
  DataGrid,
  DataGridContainer,
} from "@/components/ui/data-grid/data-grid";
import { DataGridTable } from "@/components/ui/data-grid/data-grid-table";
import { DeleteDialog } from "@/components/ui/delete-dialog";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { LookupUnit } from "@/components/lookup/lookup-unit";
import { LookupCategory } from "@/components/lookup/lookup-category";
import { LookupSubCategory } from "@/components/lookup/lookup-sub-category";
import { LookupItemGroup } from "@/components/lookup/lookup-item-group";
import { LookupTaxProfile } from "@/components/lookup/lookup-tax-profile";
import { ProductImages } from "./pd-images";
import { usePdInfoColumns } from "./use-pd-info-columns";

interface PdTabGeneralProps {
  readonly form: ProductFormInstance;
  readonly isDisabled: boolean;
  readonly product?: ProductDetail;
  readonly onGroupChange?: (
    categoryName: string,
    subCategoryName: string,
  ) => void;
  readonly pendingImages?: readonly File[];
  readonly onPendingImagesChange?: (files: File[]) => void;
}

function PdTabGeneral({
  form,
  isDisabled,
  product,
  onGroupChange,
  pendingImages,
  onPendingImagesChange,
}: PdTabGeneralProps) {
  "use no memo";
  // อ่าน error ผ่าน useFormState ไม่ใช่ form.formState — component นี้ห่อ memo()
  // และ props (form/isDisabled) เป็น ref นิ่ง กด save แล้ว validation fail ตัว
  // parent re-render แต่ตัวนี้ถูก memo กั้นไว้ กรอบแดงเลยไม่ขึ้นจนกว่าจะสลับแท็บ
  // ไปกลับ (remount แล้วอ่านใหม่) · useFormState subscribe ที่ component นี้เอง
  const { errors } = useFormState({ control: form.control });
  const t = useTranslations("productManagement.product");
  const tfl = useTranslations("field");
  const tc = useTranslations("common");
  const ts = useTranslations("status");

  const [categoryName, setCategoryName] = useState(
    product?.product_category?.name ?? "",
  );
  const [subCategoryName, setSubCategoryName] = useState(
    product?.product_sub_category?.name ?? "",
  );

  const isAdd = !product;

  // id ของ category/sub-category อยู่ในฟอร์ม (ไม่ใช่ useState) เพื่อให้ zod
  // ตรวจได้เหมือนช่องอื่น · ส่วน "ชื่อ" ยังเป็น state เพราะใช้แค่โชว์ตอน view
  const [categoryId, subCategoryId] = useWatch({
    control: form.control,
    name: ["product_category_id", "product_sub_category_id"],
  });

  const setField = (
    name:
      | "product_category_id"
      | "product_sub_category_id"
      | "product_item_group_id",
    value: string,
  ) => {
    form.setValue(name, value, { shouldDirty: true, shouldValidate: true });
  };

  const handleCategoryChange = (id: string, item?: LookupItem) => {
    setField("product_category_id", id);
    setCategoryName(item?.name ?? "");
    // เปลี่ยนหมวดแล้วหมวดย่อย/กลุ่มเดิมไม่เกี่ยวกันอีกต่อไป ล้างทิ้ง
    setField("product_sub_category_id", "");
    setSubCategoryName("");
    setField("product_item_group_id", "");
  };

  const handleSubCategoryChange = (id: string, item?: LookupItem) => {
    setField("product_sub_category_id", id);
    setSubCategoryName(item?.name ?? "");
    setField("product_item_group_id", "");
  };

  const handleItemGroupChange = (id: string, item?: ItemGroupDto) => {
    form.setValue("product_item_group_id", id, {
      shouldDirty: true,
      shouldValidate: true,
    });
    if (item) {
      form.setValue(
        "price_deviation_limit",
        item.price_deviation_limit ?? null,
      );
      form.setValue("qty_deviation_limit", item.qty_deviation_limit ?? null);
      form.setValue("is_used_in_recipe", item.is_used_in_recipe ?? false);
      form.setValue("is_sold_directly", item.is_sold_directly ?? false);
      if (item.tax_profile_id)
        form.setValue("tax_profile_id", item.tax_profile_id);
      setCategoryName(item.category?.name ?? "");
      setSubCategoryName(item.sub_category?.name ?? "");
      // เลือกกลุ่มสินค้าตรง ๆ (โหมดแก้ไข) ก็ต้องเติม id หมวดตามไปด้วย ไม่งั้น
      // ช่องหมวดว่างแล้ว validate ไม่ผ่านทั้งที่ผู้ใช้เลือกครบแล้ว
      if (item.category?.id) setField("product_category_id", item.category.id);
      if (item.sub_category?.id)
        setField("product_sub_category_id", item.sub_category.id);
      if (item.category)
        onGroupChange?.(item.category.name, item.sub_category?.name ?? "—");
    } else {
      setCategoryName("");
      setSubCategoryName("");
    }
  };

  // Form values used only for readOnly rendering (no reactivity needed when disabled)
  const v = form.getValues();

  // ── Attributes section (merged from former ProductInfoTab) ────────────────
  const {
    fields: infoFields,
    prepend: prependInfo,
    remove: removeInfo,
  } = useFieldArray({
    control: form.control,
    name: "info",
    keyName: "_fieldKey",
  });

  const [deleteIdx, setDeleteIdx] = useState<number | null>(null);
  const confirmDeleteInfo = () => {
    if (deleteIdx !== null) {
      removeInfo(deleteIdx);
      setDeleteIdx(null);
    }
  };
  const addAttribute = () =>
    prependInfo({ label: "", value: "", data_type: "string" });

  const infoColumns = usePdInfoColumns({
    form,
    isDisabled,
    onDelete: setDeleteIdx,
  });

  const infoTable = useReactTable({
    data: infoFields,
    columns: infoColumns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row._fieldKey,
  });

  const percent = (n: number | null | undefined) =>
    n === null || n === undefined ? null : `${n}%`;

  const flags = (
    // โหมดดู: ป้ายสถานะ (จุดสี + ข้อความ) แบบเดียวกับสถานะในตาราง — สวิตช์ที่กดไม่ได้อ่านเป็น
    // "ฟอร์มที่ถูกล็อก" ไม่ใช่ข้อมูล · โหมดแก้: สวิตช์
    <CompactSection title={t("sectionFlags")}>
      <FieldGrid>
        <ToggleCell
          title={tfl("status")}
          desc={t("statusToggleDesc")}
          isDisabled={isDisabled}
          on={v.product_status_type === "active"}
          onLabel={ts("active")}
          offLabel={ts("inactive")}
        >
          <Controller
            control={form.control}
            name="product_status_type"
            render={({ field }) => (
              <Switch
                checked={field.value === "active"}
                onCheckedChange={(checked) =>
                  field.onChange(checked ? "active" : "inactive")
                }
                disabled={isDisabled}
                aria-label={tfl("status")}
              />
            )}
          />
        </ToggleCell>
        <ToggleCell
          title={t("usedInRecipe")}
          desc={t("usedInRecipeShort")}
          isDisabled={isDisabled}
          on={!!v.is_used_in_recipe}
          onLabel={tc("yes")}
          offLabel={tc("no")}
        >
          <Controller
            control={form.control}
            name="is_used_in_recipe"
            render={({ field }) => (
              <Switch
                checked={field.value}
                onCheckedChange={field.onChange}
                disabled={isDisabled}
                aria-label={t("usedInRecipe")}
              />
            )}
          />
        </ToggleCell>
        <ToggleCell
          title={t("soldDirectly")}
          desc={t("soldDirectlyShort")}
          isDisabled={isDisabled}
          on={!!v.is_sold_directly}
          onLabel={tc("yes")}
          offLabel={tc("no")}
        >
          <Controller
            control={form.control}
            name="is_sold_directly"
            render={({ field }) => (
              <Switch
                checked={field.value}
                onCheckedChange={field.onChange}
                disabled={isDisabled}
                aria-label={t("soldDirectly")}
              />
            )}
          />
        </ToggleCell>
      </FieldGrid>
    </CompactSection>
  );

  const attributesEditing = !isDisabled && infoFields.length > 0;

  // เต็มความกว้างจอ (skill `carmen-blue-ui-design`): หมวดเป็นการ์ดกะทัดรัด ช่องแตกคอลัมน์ตาม
  // ความกว้างการ์ด หมวดที่มี 2–3 ช่องจับคู่กันบนจอกว้าง · โหมดดูเป็นข้อความ (`SettingField`)
  // ไม่มีกรอบ กรอบมีเฉพาะช่องที่แก้ได้จริง · คำอธิบายหมวดที่แค่ทวนชื่อช่องถูกตัดออก
  return (
    <>
      {/* Identification — ชื่อ + รหัสทุกแบบที่ใช้ระบุสินค้า · 6 ช่อง = หนึ่งแถวพอดีที่ 6 คอลัมน์ (Full HD)
    สองแถวที่ 3 คอลัมน์ (1366) · คำอธิบายเป็นช่องกว้างช่องเดียวของหมวด อยู่ท้ายสุด */}
      <CompactSection first title={t("sectionIdentification")}>
        {/* รูปสินค้าอยู่คู่กับชื่อและรหัส แบบหัว spec sheet — เป็นสิ่งเดียวที่ทำให้จำสินค้าได้ในแวบเดียว
            (เดิมอยู่ล่างสุดในหมวดของตัวเอง การ์ดครึ่งจอมีกรอบรูป 160px ใบเดียว) · การ์ดแคบกว่า 672px (ช่องข้างรูปจะเหลือคอลัมน์เดียว)
            รูปขึ้นไปอยู่เหนือช่อง · สินค้าใหม่ยังไม่มี id ให้แนบรูป จึงไม่มีช่องรูป */}
        <div className="@container">
          <div className="flex flex-col gap-4 @2xl:flex-row @2xl:gap-5">
            {product && (
              <div className="w-40 shrink-0 self-start">
                <ProductImages
                  productId={product.id}
                  readOnly={isDisabled}
                  pendingFiles={pendingImages}
                  onPendingFilesChange={onPendingImagesChange}
                />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <FieldGrid>
                {isDisabled ? (
                  <>
                    <SettingField label={tfl("name")} value={v.name} />
                    <SettingField
                      label={t("localNameLabel")}
                      value={v.local_name}
                    />
                    <SettingField label={tfl("code")} value={v.code} />
                    <SettingField label={tfl("sku")} value={v.sku} />
                    <SettingField label={t("barcodeEan13")} value={v.barcode} />
                    <SettingField
                      label={tfl("description")}
                      value={v.description}
                      fullWidth
                    />
                  </>
                ) : (
                  <>
                    <Field data-invalid={!!errors.name}>
                      <FieldLabel required>{tfl("name")}</FieldLabel>
                      <FieldInput
                        className="h-9 text-sm"
                        maxLength={100}
                        placeholder={t("namePlaceholder")}
                        error={errors.name?.message}
                        {...form.register("name")}
                      />
                    </Field>
                    <Field data-invalid={!!errors.local_name}>
                      <FieldLabel required>{t("localNameLabel")}</FieldLabel>
                      <FieldInput
                        className="h-9 text-sm"
                        style={{
                          fontFamily: '"IBM Plex Sans Thai", var(--font-sans)',
                        }}
                        maxLength={100}
                        placeholder={t("localNamePlaceholder")}
                        error={errors.local_name?.message}
                        {...form.register("local_name")}
                      />
                    </Field>
                    <Field>
                      <FieldLabel>{tfl("code")}</FieldLabel>
                      {/* รหัสแก้ไม่ได้ทั้งตอนสร้าง (ระบบออกให้) และตอนแก้ */}
                      <FieldInput
                        className="h-9 text-sm"
                        disabled
                        placeholder={tfl("autoGenerated")}
                        value={isAdd ? "" : (v.code ?? "")}
                        readOnly
                      />
                    </Field>
                    <Field>
                      <FieldLabel>{tfl("sku")}</FieldLabel>
                      <Input
                        className="h-9"
                        placeholder={t("skuPlaceholder")}
                        {...form.register("sku")}
                      />
                    </Field>
                    <Field>
                      <FieldLabel>{t("barcodeEan13")}</FieldLabel>
                      <Input
                        className="h-9"
                        placeholder={t("barcodePlaceholder")}
                        {...form.register("barcode")}
                      />
                    </Field>
                    <Field
                      data-invalid={!!errors.description}
                      className="@md:col-span-2"
                    >
                      <FieldLabel>{tfl("description")}</FieldLabel>
                      <Textarea
                        rows={3}
                        maxLength={256}
                        aria-invalid={!!errors.description}
                        className="resize-none"
                        style={{
                          fontFamily: '"IBM Plex Sans Thai", var(--font-sans)',
                        }}
                        placeholder={t("descriptionPlaceholder")}
                        {...form.register("description")}
                      />
                      <FieldError>{errors.description?.message}</FieldError>
                    </Field>
                  </>
                )}
              </FieldGrid>
            </div>
          </div>
        </div>
      </CompactSection>

      {/* คู่ละ 4 ช่อง: การ์ดคู่บน Full HD ได้ 2 คอลัมน์ → 2 แถวเท่ากันทั้งสองใบ ไม่มีแถวที่ค้างช่องเดียว
    (เดิมแยก 4 หมวด หมวดละ 2–3 ช่อง ต้องเรียง 4 ชั้นบนจอ 1366) */}
      <div className={SECTION_PAIR}>
        {/* Classification & unit */}
        <CompactSection title={t("sectionClassificationUnit")}>
          <FieldGrid>
            {isDisabled ? (
              <>
                <SettingField label={tfl("category")} value={categoryName} />
                <SettingField
                  label={tfl("subCategory")}
                  value={subCategoryName}
                />
                <SettingField
                  label={tfl("itemGroup")}
                  value={product?.product_item_group?.name}
                />
                <SettingField
                  label={tfl("inventoryUnit")}
                  value={product?.inventory_unit?.name}
                />
              </>
            ) : (
              <>
                <Field data-invalid={!!errors.product_category_id}>
                  <FieldLabel required>{tfl("category")}</FieldLabel>
                  <LookupCategory
                    value={categoryId}
                    onValueChange={handleCategoryChange}
                    defaultLabel={product?.product_category?.name ?? undefined}
                    className="w-full"
                    error={errors.product_category_id?.message}
                  />
                </Field>
                <Field data-invalid={!!errors.product_sub_category_id}>
                  <FieldLabel required>{tfl("subCategory")}</FieldLabel>
                  <LookupSubCategory
                    value={subCategoryId}
                    onValueChange={handleSubCategoryChange}
                    filterCategoryId={categoryId}
                    disabled={!categoryId}
                    defaultLabel={
                      product?.product_sub_category?.name ?? undefined
                    }
                    className="w-full"
                    error={errors.product_sub_category_id?.message}
                  />
                </Field>
                <Field>
                  <FieldLabel required>{tfl("itemGroup")}</FieldLabel>
                  <Controller
                    control={form.control}
                    name="product_item_group_id"
                    render={({ field }) => (
                      <LookupItemGroup
                        value={field.value}
                        onValueChange={handleItemGroupChange}
                        filterSubCategoryId={subCategoryId}
                        disabled={!subCategoryId && !field.value}
                        defaultLabel={
                          product?.product_item_group?.name ?? undefined
                        }
                        placeholder={t("itemGroupPlaceholder")}
                        error={errors.product_item_group_id?.message}
                      />
                    )}
                  />
                </Field>
                <Field>
                  <FieldLabel required>{tfl("inventoryUnit")}</FieldLabel>
                  <Controller
                    control={form.control}
                    name="inventory_unit_id"
                    render={({ field }) => (
                      <LookupUnit
                        value={field.value}
                        onValueChange={field.onChange}
                        defaultLabel={
                          field.value === product?.inventory_unit?.id
                            ? (product?.inventory_unit?.name ?? undefined)
                            : undefined
                        }
                        error={errors.inventory_unit_id?.message}
                      />
                    )}
                  />
                </Field>
              </>
            )}
          </FieldGrid>
        </CompactSection>
        {/* Tax, price & thresholds */}
        <CompactSection title={t("sectionTaxPriceThresholds")}>
          <FieldGrid>
            {isDisabled ? (
              <>
                <SettingField
                  label={tfl("taxProfile")}
                  value={product?.tax_profile?.name}
                />
                <SettingField label={tfl("price")} value={v.price} />
                <SettingField
                  label={t("priceDeviationShort")}
                  value={percent(v.price_deviation_limit)}
                />
                <SettingField
                  label={t("qtyDeviationShort")}
                  value={percent(v.qty_deviation_limit)}
                />
              </>
            ) : (
              <>
                <Field>
                  <FieldLabel>{tfl("taxProfile")}</FieldLabel>
                  <Controller
                    control={form.control}
                    name="tax_profile_id"
                    render={({ field }) => (
                      <LookupTaxProfile
                        value={field.value}
                        onValueChange={field.onChange}
                        className="w-full"
                      />
                    )}
                  />
                </Field>
                <Field data-invalid={!!errors.price}>
                  <FieldLabel>{tfl("price")}</FieldLabel>
                  <FieldInput
                    type="number"
                    inputMode="decimal"
                    step="any"
                    min="0"
                    placeholder="0.00"
                    className="h-9 pr-3 pl-8 text-right text-sm"
                    error={errors.price?.message}
                    errorIconAlign="left"
                    {...form.register("price")}
                  />
                </Field>
                <Field data-invalid={!!errors.price_deviation_limit}>
                  <FieldLabel>{t("priceDeviationShort")}</FieldLabel>
                  <div className="relative">
                    <FieldInput
                      type="number"
                      inputMode="decimal"
                      step="any"
                      min="0"
                      max="100"
                      placeholder="0"
                      className={`h-9 pr-8 text-right text-sm ${
                        errors.price_deviation_limit ? "pl-8" : ""
                      }`}
                      error={errors.price_deviation_limit?.message}
                      errorIconAlign="left"
                      {...form.register("price_deviation_limit")}
                    />
                    <Percent
                      aria-hidden="true"
                      className="text-muted-foreground pointer-events-none absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2"
                    />
                  </div>
                </Field>
                <Field data-invalid={!!errors.qty_deviation_limit}>
                  <FieldLabel>{t("qtyDeviationShort")}</FieldLabel>
                  <div className="relative">
                    <FieldInput
                      type="number"
                      inputMode="decimal"
                      step="any"
                      min="0"
                      max="100"
                      placeholder="0"
                      className={`h-9 pr-8 text-right text-sm ${
                        errors.qty_deviation_limit ? "pl-8" : ""
                      }`}
                      error={errors.qty_deviation_limit?.message}
                      errorIconAlign="left"
                      {...form.register("qty_deviation_limit")}
                    />
                    <Percent
                      aria-hidden="true"
                      className="text-muted-foreground pointer-events-none absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2"
                    />
                  </div>
                </Field>
              </>
            )}
          </FieldGrid>
        </CompactSection>
      </div>

      {flags}

      {/* Attributes — ตารางแก้ไขมีกรอบของตัวเอง (frameless) · โหมดดู/ว่าง อยู่ในการ์ด */}
      <CompactSection
        title={t("sectionAttributes")}
        description={t("sectionAttributesDesc")}
        count={infoFields.length}
        frameless={attributesEditing}
        action={
          attributesEditing ? (
            <Button type="button" size="sm" onClick={addAttribute}>
              <Plus aria-hidden="true" />
              {t("addAttribute")}
            </Button>
          ) : undefined
        }
      >
        {isDisabled ? (
          infoFields.length === 0 ? (
            // โหมดดูที่ยังไม่มี attribute — บรรทัดเดียวพอ ภาพประกอบเต็มการ์ดกินที่มากกว่าเนื้อหา
            <p className="text-muted-foreground text-sm">
              {t("noAdditionalInfo")}
            </p>
          ) : (
            <FieldGrid>
              {infoFields.map((field, index) => (
                <SettingField
                  key={field._fieldKey}
                  label={attributeLabel(form.getValues(`info.${index}.label`))}
                  value={form.getValues(`info.${index}.value`)}
                />
              ))}
            </FieldGrid>
          )
        ) : infoFields.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-6 text-center">
            <p className="text-sm font-semibold">{t("noAdditionalInfo")}</p>
            <p className="text-muted-foreground text-xs">
              {t.rich("addFirstAttributeHintRich", {
                code: (chunks) => (
                  <code className="bg-muted text-micro mx-0.5 rounded px-1.5 py-0.5">
                    {chunks}
                  </code>
                ),
              })}
            </p>
            <Button
              type="button"
              size="xs"
              variant="outline"
              onClick={addAttribute}
            >
              <Plus aria-hidden="true" />
              {t("addFirstAttribute")}
            </Button>
          </div>
        ) : (
          <DataGrid
            table={infoTable}
            recordCount={infoFields.length}
            tableLayout={{ rowClamp: false, headerSticky: true }}
          >
            <DataGridContainer>
              <ScrollArea className="w-full">
                <DataGridTable />
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </DataGridContainer>
          </DataGrid>
        )}
      </CompactSection>

      <DeleteDialog
        open={deleteIdx !== null}
        onOpenChange={(open) => !open && setDeleteIdx(null)}
        title={t("removeInfo")}
        description={t("removeInfoConfirm")}
        onConfirm={confirmDeleteInfo}
      />
    </>
  );
}

export default memo(PdTabGeneral);

/** `shelf_life` → `Shelf Life` — ป้ายของ attribute เก็บเป็น key ตัวพิมพ์เล็กคั่นด้วย _ */
const attributeLabel = (label: string) =>
  label.replaceAll("_", " ").replace(/\b[a-z]/g, (c) => c.toUpperCase());

/**
 * สวิตช์เป็นช่องหนึ่งของกริด — ป้ายบน สวิตช์ล่าง คำอธิบายใต้สวิตช์ (เดิมป้ายซ้าย สวิตช์ขวาสุดของ
 * แถวเต็มความกว้าง บนจอกว้างสวิตช์อยู่ห่างจากป้ายทั้งการ์ด) ป้ายใช้น้ำหนักเดียวกับช่องอื่นของโหมดนั้น
 */
function ToggleCell({
  title,
  desc,
  isDisabled,
  on,
  onLabel,
  offLabel,
  children,
}: Readonly<{
  title: string;
  desc: string;
  isDisabled: boolean;
  /** ค่าปัจจุบัน + ข้อความของสองสถานะ — ใช้แสดงป้ายในโหมดดู */
  on: boolean;
  onLabel: string;
  offLabel: string;
  /** สวิตช์ของโหมดแก้ */
  children: React.ReactNode;
}>) {
  "use no memo";
  return (
    <div className="min-w-0">
      <div
        className={cn(
          "text-xs",
          isDisabled
            ? "text-muted-foreground"
            : "text-foreground font-semibold",
        )}
      >
        {title}
      </div>
      <div className="mt-1.5 flex">
        {isDisabled ? (
          <StatusDotBadge tone={on ? "success" : "neutral"}>
            {on ? onLabel : offLabel}
          </StatusDotBadge>
        ) : (
          children
        )}
      </div>
      <div className="text-muted-foreground text-micro mt-1">{desc}</div>
    </div>
  );
}
