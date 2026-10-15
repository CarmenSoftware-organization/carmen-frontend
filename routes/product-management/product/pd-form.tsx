import { useState } from "react";
import { type FieldErrors, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate, useSearchParams } from "react-router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { useTranslations } from "use-intl";
import {
  useCreateProduct,
  useUpdateProduct,
  useDeleteProduct,
} from "@/hooks/use-product";
import { useUploadProductImages } from "./use-product-image";
import {
  type ProductDetail,
  type ProductFormValues,
  type ProductUnitConversion,
  type ProductUnitConversionDetail,
  type CreateProductDto,
  createProductSchema,
} from "@/types/product";
import { DeleteDialog } from "@/components/ui/delete-dialog";
import { DiscardDialog } from "@/components/ui/discard-dialog";
import { useEntityForm } from "@/hooks/use-entity-form";
import {
  buildItemChanges,
  scrollToFirstInvalidField,
} from "@/lib/form-helpers";
import { PdFormToolbar } from "./pd-form-toolbar";
import { FormPageShell } from "@/components/share/form-page-shell";
import PdTabGeneral from "./pd-tab-general";
import PdTabLocations from "./pd-tab-locations";
import PdTabUnitConversion from "./pd-tab-unit-conversion";
import TabArrayCount, { TabEcoLabelCount } from "./pd-tab-count";
import { PdTabEco } from "./pd-tab-eco";

const getDefaultValues = (product?: ProductDetail): ProductFormValues => {
  if (!product) {
    return {
      name: "",
      code: "",
      local_name: "",
      description: "",
      inventory_unit_id: "",
      product_category_id: "",
      product_sub_category_id: "",
      product_item_group_id: "",
      product_status_type: "active",
      tax_profile_id: "",
      is_used_in_recipe: false,
      is_sold_directly: false,
      barcode: "",
      sku: "",
      price: 0,
      price_deviation_limit: 0,
      qty_deviation_limit: 0,
      info: [],
      locations: [],
      order_units: [],
      ingredient_units: [],
    };
  }

  return {
    name: product.name,
    code: product.code,
    local_name: product.local_name ?? "",
    description: product.description ?? "",
    inventory_unit_id: product.inventory_unit?.id ?? "",
    product_category_id: product.product_category?.id ?? "",
    product_sub_category_id: product.product_sub_category?.id ?? "",
    product_item_group_id: product.product_item_group?.id ?? "",
    product_status_type: product.product_status_type,
    tax_profile_id: product.tax_profile?.id ?? "",
    is_used_in_recipe: product.is_used_in_recipe ?? false,
    is_sold_directly: product.is_sold_directly ?? false,
    barcode: product.barcode ?? "",
    sku: product.sku ?? "",
    price: product.price ?? 0,
    price_deviation_limit: product.price_deviation_limit ?? 0,
    qty_deviation_limit: product.qty_deviation_limit ?? 0,
    info: product.info ?? [],
    locations: (product.locations ?? []).map(toFormLocation),
    order_units: (product.order_units ?? []).map(toFormUnit),
    ingredient_units: (product.ingredient_units ?? []).map(toFormUnit),
  };
};

// ฝั่งอ่าน (detail) ส่ง location/shelf/from_unit/to_unit เป็น object แล้ว แต่
// ฟอร์มยังแก้เป็น flat id เดิม (lookup ผูกกับ id ตรง ๆ ไม่ต้องมีชื่อคู่กันใน
// form state — LookupShelf/LookupLocation/LookupUnit resolve ชื่อเองจาก id) จึง
// ต้อง "แบน" object กลับเป็น flat ทั้งตอน hydrate ฟอร์ม และตอนเทียบ diff กับของเดิม
const toFormLocation = (
  loc: ProductDetail["locations"][number],
): ProductFormValues["locations"][number] => ({
  id: loc.id,
  location_id: loc.location?.id ?? "",
  location_code: loc.location?.code ?? null,
  location_name: loc.location?.name ?? null,
  location_type: loc.location_type ?? null,
  is_active: loc.is_active ?? null,
  shelf_id: loc.shelf?.id ?? null,
  delivery_point_id: loc.delivery_point_id ?? null,
  delivery_point: loc.delivery_point ?? null,
  min_qty: loc.min_qty ?? null,
  max_qty: loc.max_qty ?? null,
  re_order_qty: loc.re_order_qty ?? null,
  par_qty: loc.par_qty ?? null,
});

const toFormUnit = (
  unit: ProductUnitConversionDetail,
): ProductFormValues["order_units"][number] => ({
  id: unit.id,
  from_unit_id: unit.from_unit?.id ?? "",
  from_unit_qty: unit.from_unit_qty,
  to_unit_id: unit.to_unit?.id ?? "",
  to_unit_qty: unit.to_unit_qty,
  description: unit.description,
  is_default: unit.is_default,
  is_active: unit.is_active,
});

const mapUnitToPayload = (unit: ProductUnitConversion) => ({
  from_unit_id: unit.from_unit_id,
  from_unit_qty: unit.from_unit_qty,
  to_unit_id: unit.to_unit_id,
  to_unit_qty: unit.to_unit_qty,
  description: unit.description,
  is_default: unit.is_default,
  is_active: unit.is_active,
});

const mapLocationToPayload = (l: ProductFormValues["locations"][number]) => ({
  location_id: l.location_id,
  shelf_id: l.shelf_id ?? null,
  min_qty: l.min_qty ?? null,
  max_qty: l.max_qty ?? null,
  re_order_qty: l.re_order_qty ?? null,
  par_qty: l.par_qty ?? null,
});

export const buildPayload = (
  values: ProductFormValues,
  product?: ProductDetail,
  isAdd?: boolean,
): CreateProductDto => {
  const defaultLocations = (product?.locations ?? []).map(toFormLocation);
  const locationDiff = buildItemChanges(
    values.locations,
    defaultLocations,
    mapLocationToPayload,
  );
  // หลังบ้านลบตามคู่ (product, location) จึงต้องการ location_id ของแถวที่ถูกลบ ไม่ใช่ id ของแถว
  const locationIdByRowId = new Map(
    defaultLocations.map((l) => [l.id, l.location_id]),
  );
  const removedLocations = (locationDiff.remove ?? []).map(({ id }) => ({
    location_id: locationIdByRowId.get(id) ?? "",
  }));

  const orderDiff = buildItemChanges(
    values.order_units,
    (product?.order_units ?? []).map(toFormUnit),
    mapUnitToPayload,
  );
  const ingredientDiff = buildItemChanges(
    values.ingredient_units,
    (product?.ingredient_units ?? []).map(toFormUnit),
    mapUnitToPayload,
  );

  return {
    name: values.name,
    code: isAdd ? undefined : values.code,
    local_name: values.local_name,
    description: values.description ?? "",
    inventory_unit_id: values.inventory_unit_id,
    product_item_group_id: values.product_item_group_id,
    product_status_type: values.product_status_type,
    tax_profile_id: values.tax_profile_id || null,
    price_deviation_limit: values.price_deviation_limit ?? null,
    qty_deviation_limit: values.qty_deviation_limit ?? null,
    product_info: {
      is_used_in_recipe: values.is_used_in_recipe,
      is_sold_directly: values.is_sold_directly,
      barcode: values.barcode ?? "",
      sku: values.sku ?? "",
      price: values.price,
      info: values.info,
    },
    ...((locationDiff.add?.length ||
      locationDiff.update?.length ||
      removedLocations.length) && {
      locations: {
        ...(locationDiff.add?.length && { add: locationDiff.add }),
        ...(locationDiff.update?.length && { update: locationDiff.update }),
        ...(removedLocations.length && { remove: removedLocations }),
      },
    }),
    ...((orderDiff.add?.length ||
      orderDiff.update?.length ||
      orderDiff.remove?.length) && {
      order_units: {
        ...(orderDiff.add?.length && { add: orderDiff.add }),
        ...(orderDiff.update?.length && {
          update: orderDiff.update.map(({ id, ...rest }) => ({
            ...rest,
            product_order_unit_id: id,
          })),
        }),
        ...(orderDiff.remove?.length && {
          remove: orderDiff.remove.map(({ id }) => ({
            product_order_unit_id: id,
          })),
        }),
      },
    }),
    ...((ingredientDiff.add?.length ||
      ingredientDiff.update?.length ||
      ingredientDiff.remove?.length) && {
      // แบบเดียวกับ order_units — หลังบ้านระบุแถวด้วย product_ingredient_unit_id ทั้งแก้และลบ
      ingredient_units: {
        ...(ingredientDiff.add?.length && { add: ingredientDiff.add }),
        ...(ingredientDiff.update?.length && {
          update: ingredientDiff.update.map(({ id, ...rest }) => ({
            ...rest,
            product_ingredient_unit_id: id,
          })),
        }),
        ...(ingredientDiff.remove?.length && {
          remove: ingredientDiff.remove.map(({ id }) => ({
            product_ingredient_unit_id: id,
          })),
        }),
      },
    }),
  };
};

interface ProductFormProps {
  readonly product?: ProductDetail;
}

const GENERAL_FIELDS = [
  "name",
  "code",
  "local_name",
  "description",
  "barcode",
  "sku",
  "price",
  "inventory_unit_id",
  "tax_profile_id",
  "product_category_id",
  "product_sub_category_id",
  "product_item_group_id",
  "product_status_type",
  "price_deviation_limit",
  "qty_deviation_limit",
  "is_used_in_recipe",
  "is_sold_directly",
] as const;

const FORM_TABS = ["general", "units", "locations"] as const;
type FormTab = (typeof FORM_TABS)[number];

/**
 * แท็บนี้มีช่องที่กรอกผิดไหม — ตัวเดียวที่ทั้งจุดแดงบนแท็บและการเด้งแท็บอัตโนมัติ
 * ตอน submit ใช้ร่วมกัน แยกสองชุดเมื่อไรก็ได้จุดแดงขึ้นแท็บหนึ่งแต่เด้งไปอีกแท็บ
 */
function hasErrorInTab(
  errors: FieldErrors<ProductFormValues>,
  tab: FormTab,
): boolean {
  if (tab === "general") {
    return (
      GENERAL_FIELDS.some((key) => errors[key] !== undefined) ||
      errors.info !== undefined
    );
  }
  if (tab === "units") {
    return (
      errors.order_units !== undefined || errors.ingredient_units !== undefined
    );
  }
  return errors.locations !== undefined;
}

export function ProductForm({ product }: ProductFormProps) {
  const t = useTranslations("productManagement.product");
  const tt = useTranslations("toast");
  const tv = useTranslations("validation");
  const tfl = useTranslations("field");
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const rawReturnUrl = searchParams.get("returnUrl");
  const returnUrl =
    rawReturnUrl &&
    rawReturnUrl.startsWith("/") &&
    !rawReturnUrl.startsWith("//")
      ? rawReturnUrl
      : "/product-management/product";

  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();
  const [showDelete, setShowDelete] = useState(false);
  // รูปที่เลือกไว้แต่ยังไม่อัปโหลด — ค้างอยู่ในฟอร์มจนกว่าจะกด Save ถ้ากดยกเลิก
  // ก็หายไปพร้อมกัน ไม่มีรูปค้างบน backend
  const [pendingImages, setPendingImages] = useState<File[]>([]);
  const uploadImages = useUploadProductImages();
  const isPending =
    createProduct.isPending ||
    updateProduct.isPending ||
    uploadImages.isPending;

  const defaultValues = getDefaultValues(product);
  const f = useEntityForm<ProductFormValues>({
    entity: product,
    serverFieldErrors: { PRODUCT_ALREADY_EXISTS: ["code", "name"] },
    resolver: zodResolver(
      createProductSchema(tv, tfl),
    ) as Resolver<ProductFormValues>,
    defaultValues,
    // ปุ่ม Back/Cancel กลับไปที่ที่ผู้ใช้มา ไม่ใช่หน้ารายการเสมอ (?returnUrl=)
    listPath: returnUrl,
    isPending,
    // รูปที่เลือกไว้แต่ยังไม่ได้อัปโหลดก็นับเป็นของที่จะหาย — ไม่งั้นกดออกแล้วรูป
    // หายเงียบ ๆ โดยไม่ถามสักคำ
    extraDirty: pendingImages.length > 0,
  });
  const { form, isAdd, isEdit, isDisabled } = f;

  const [tab, setTab] = useState<string>("general");

  const fieldErrors = form.formState.errors;
  const hasGeneralError = hasErrorInTab(fieldErrors, "general");
  const hasUnitsError = hasErrorInTab(fieldErrors, "units");
  const hasLocationsError = hasErrorInTab(fieldErrors, "locations");

  const flushPendingImages = async (id: string) => {
    if (pendingImages.length === 0) return;
    await uploadImages.mutateAsync({ product_id: id, images: pendingImages });
    setPendingImages([]);
  };

  const onSubmit = async (values: ProductFormValues) => {
    const normalizedValues: ProductFormValues =
      values.order_units.length === 0 && values.inventory_unit_id
        ? {
            ...values,
            order_units: [
              {
                from_unit_id: values.inventory_unit_id,
                from_unit_qty: 1,
                to_unit_id: values.inventory_unit_id,
                to_unit_qty: 1,
                description: "",
                is_default: true,
                is_active: true,
              },
            ],
          }
        : values;

    const payload = buildPayload(normalizedValues, product, isAdd);

    try {
      if (isEdit && product) {
        // รูปขึ้นก่อน แล้วค่อยบันทึกฟอร์ม — ถ้ารูปพลาดจะได้ไม่บันทึกครึ่ง ๆ กลาง ๆ
        await flushPendingImages(product.id);
        await updateProduct.mutateAsync({
          id: product.id,
          doc_version: product.doc_version,
          ...payload,
        });
        toast.success(tt("updateSuccess", { entity: t("entity") }));
        form.reset(normalizedValues);
        f.setMode("view");
        return;
      }
      if (isAdd) {
        // ปิด guard ก่อนยิง mutation → sentinel ถูก teardown ลบระหว่างรอ network
        f.setIsSubmitting(true);
        // ตอนสร้างยังไม่มี id ให้แนบรูป ต้องสร้างก่อนแล้วค่อยอัปโหลดตามไป
        const res = await createProduct.mutateAsync(payload);
        toast.success(tt("createSuccess", { entity: t("entity") }));
        const newId = (res as { data?: { id?: string } })?.data?.id;
        if (newId) {
          await flushPendingImages(newId);
          navigate(`/product-management/product/${newId}`, f.returnState);
        } else {
          f.backToList();
        }
      }
    } catch {
      f.setIsSubmitting(false);
    }
  };

  const onInvalid = (errs: FieldErrors<ProductFormValues>) => {
    toast.warning(tv("incompleteDocument"));
    // ช่องที่ผิดอยู่คนละแท็บกับที่เปิดค้างไว้ = ผู้ใช้เห็นแต่ toast แล้วหาไม่เจอว่า
    // ผิดตรงไหน เด้งไปแท็บแรกที่มีปัญหาก่อน แล้วค่อยเลื่อนไปหาช่อง — ต้องรอให้
    // TabsContent ของแท็บนั้น mount ก่อน ไม่งั้นเลื่อนไปหา element ที่ยังไม่มี
    const target = FORM_TABS.find((name) => hasErrorInTab(errs, name));
    if (target && target !== tab) {
      setTab(target);
      requestAnimationFrame(() => scrollToFirstInvalidField());
      return;
    }
    scrollToFirstInvalidField();
  };

  return (
    <FormPageShell
      width="wide"
      header={
        <PdFormToolbar
          product={product}
          form={form}
          mode={f.mode}
          isPending={isPending}
          deleteIsPending={deleteProduct.isPending}
          hasPendingImages={pendingImages.length > 0}
          onBack={f.handleBack}
          onEdit={f.handleEdit}
          onCancel={f.handleCancel}
          onDelete={() => setShowDelete(true)}
        />
      }
    >
      <form
        id="product-form"
        onSubmit={form.handleSubmit(onSubmit, onInvalid)}
        className="space-y-4"
      >
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList variant="line">
            <TabsTrigger value="general">
              {t("tabGeneral")}
              <TabArrayCount form={form} name="info" />
              {hasGeneralError && <TabErrorDot />}
            </TabsTrigger>
            <TabsTrigger value="units">
              {t("tabUnits")}
              <TabArrayCount
                form={form}
                name={["order_units", "ingredient_units"]}
              />
              {hasUnitsError && <TabErrorDot />}
            </TabsTrigger>
            <TabsTrigger value="locations">
              {t("tabLocations")}
              <TabArrayCount form={form} name="locations" />
              {hasLocationsError && <TabErrorDot />}
            </TabsTrigger>
            {product?.id && (
              <TabsTrigger value="eco-labels">
                {t("tabEcoLabels")}
                <TabEcoLabelCount productId={product.id} />
              </TabsTrigger>
            )}
          </TabsList>
          <TabsContent value="general">
            <PdTabGeneral
              form={form}
              isDisabled={isDisabled}
              product={product}
              pendingImages={pendingImages}
              onPendingImagesChange={setPendingImages}
            />
          </TabsContent>
          <TabsContent value="units">
            <div className="space-y-6">
              <PdTabUnitConversion
                form={form}
                name="order_units"
                label={t("orderUnit")}
                isDisabled={isDisabled}
              />
              <PdTabUnitConversion
                form={form}
                name="ingredient_units"
                label={t("ingredientUnit")}
                isDisabled={isDisabled}
              />
            </div>
          </TabsContent>
          <TabsContent value="locations">
            <PdTabLocations form={form} isDisabled={isDisabled} />
          </TabsContent>
          {product?.id && (
            <TabsContent value="eco-labels">
              <PdTabEco productId={product.id} readOnly={isDisabled} />
            </TabsContent>
          )}
        </Tabs>
      </form>

      {product && (
        <DeleteDialog
          open={showDelete}
          onOpenChange={(open) =>
            !open && !deleteProduct.isPending && setShowDelete(false)
          }
          title={t("deleteTitle")}
          description={t("deleteConfirm", { name: product.name })}
          isPending={deleteProduct.isPending}
          onConfirm={() => {
            deleteProduct.mutate(product.id, {
              onSuccess: () => {
                toast.success(tt("deleteSuccess", { entity: t("entity") }));
                f.backToList();
              },
            });
          }}
        />
      )}

      <DiscardDialog {...f.discard.dialogProps} variant="warning" />

      <DiscardDialog
        open={f.navGuard.isOpen}
        onOpenChange={(o) => {
          if (!o) f.navGuard.cancel();
        }}
        onConfirm={f.navGuard.confirm}
        onCancel={f.navGuard.cancel}
        variant="warning"
      />
    </FormPageShell>
  );
}

function TabErrorDot() {
  return (
    <span
      aria-label="has errors"
      className="bg-destructive ml-1.5 inline-block size-1.5 rounded-full"
    />
  );
}
