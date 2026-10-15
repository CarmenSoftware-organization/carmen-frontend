// Opt out of React Compiler memoization — useFieldArray + dynamic setValue calls
// cause stale closure issues when auto-memoized (ทรงเดียวกับ pr-item-fields).
"use no memo";

import { useState } from "react";
import { useFieldArray, useWatch, type UseFormReturn } from "react-hook-form";
import { useTranslations } from "use-intl";
import { DeleteDialog } from "@/components/ui/delete-dialog";
import { SettingSection } from "@/components/ui/setting-section";
import { TreeProductLookup } from "@/components/share/tree-product-lookup";
import { useProductAll } from "@/hooks/use-product";
import { EmptyProducts } from "../price-list/pl-empty-states";
import type { PriceListTemplate } from "@/types/price-list-template";
import { PLT_DETAIL_EMPTY, type PltFormValues } from "./plt-form-schema";
import { PltItemCards } from "./plt-item-cards";
import { PltItemGroupedView } from "./plt-item-grouped-view";

interface PltItemFieldsProps {
  readonly form: UseFormReturn<PltFormValues>;
  readonly priceListTemplate?: PriceListTemplate;
  readonly isView: boolean;
  readonly isDisabled: boolean;
}

export function PltItemFields({
  form,
  priceListTemplate,
  isView,
  isDisabled,
}: PltItemFieldsProps) {
  const t = useTranslations("vendorManagement.priceListTemplate");
  const tc = useTranslations("common");

  const [removeDetailIndex, setRemoveDetailIndex] = useState<number | null>(
    null,
  );
  const [removeProductId, setRemoveProductId] = useState<string | null>(null);

  const {
    fields: detailFields,
    append: appendDetail,
    prepend: prependDetail,
    remove: removeDetail,
  } = useFieldArray({ control: form.control, name: "details" });

  // ต้นไม้ใช้เฉพาะตอนแก้ไข/เพิ่ม — หน้าดูใช้ PltItemGroupedView จากข้อมูลของ template
  const { data: allProducts = [], isLoading: productsLoading } = useProductAll(
    undefined,
    { enabled: !isView },
  );
  const watchedDetails = useWatch({ control: form.control, name: "details" });
  const selectedProductIds = new Set(
    (watchedDetails ?? []).map((d) => d.product_id).filter(Boolean),
  );

  const handleAddProduct = () => {
    prependDetail({ ...PLT_DETAIL_EMPTY });
  };

  // ติ๊ก tree → sync กับ details: product ที่ติ๊กใหม่ = เพิ่มแถวเปล่า (unit
  // auto-select เองใน UnitCell), product ที่เอาติ๊กออก = ลบทุกแถวของ product นั้น
  // (รวม moq tier หลายแถว) · group toggle ยิงทิศเดียวเสมอ เพิ่ม/ลบ ไม่ปนกัน
  const handleTreeSelectionChange = (ids: string[]) => {
    const next = new Set(ids);
    const rows = form.getValues("details");
    const removeIdx = rows.reduce<number[]>((acc, d, i) => {
      if (d.product_id && !next.has(d.product_id)) acc.push(i);
      return acc;
    }, []);
    const current = new Set(rows.map((d) => d.product_id).filter(Boolean));
    const added = ids.filter((id) => !current.has(id));
    if (removeIdx.length) removeDetail(removeIdx);
    if (added.length)
      prependDetail(
        added.map((id) => ({ ...PLT_DETAIL_EMPTY, product_id: id })),
      );
  };

  // เพิ่ม MOQ tier อีกหน่วยให้ product เดิม (แถวใหม่ product_id เดียวกัน)
  // default qty = max ของ tier เดิม +1 กันชนกับ qty ที่มีอยู่แล้วตั้งแต่แรก
  const handleAddTier = (productId: string) => {
    const qtys = form
      .getValues("details")
      .filter((r) => r.product_id === productId)
      .map((r) => Number(r.qty) || 0);
    const nextQty = qtys.length ? Math.max(...qtys) + 1 : 1;
    appendDetail({ ...PLT_DETAIL_EMPTY, product_id: productId, qty: nextQty });
  };

  const handleConfirmRemoveTier = () => {
    if (removeDetailIndex === null) return;
    removeDetail(removeDetailIndex);
    setRemoveDetailIndex(null);
  };

  // ลบทั้ง product (ทุก tier) — เท่ากับเอาติ๊กออกจาก tree · confirm ก่อนลบ
  const handleConfirmRemoveProduct = () => {
    if (removeProductId === null) return;
    const idx = form.getValues("details").reduce<number[]>((acc, d, i) => {
      if (d.product_id === removeProductId) acc.push(i);
      return acc;
    }, []);
    if (idx.length) removeDetail(idx);
    setRemoveProductId(null);
  };

  // ชื่อ product ที่กำลังจะลบ — ไว้โชว์ใน confirm dialog (master ก่อน, fallback ref)
  const removeProductName = removeProductId
    ? (allProducts.find((p) => p.id === removeProductId)?.name ??
      priceListTemplate?.products?.find(
        (p) => p.product?.id === removeProductId,
      )?.product?.name ??
      "")
    : "";

  // ชื่อ product สำหรับ header ของการ์ด — ดูจาก master ก่อน (tree/lookup)
  // fallback ไปที่ product ref ใน template (เผื่อ product ถูกปิด/ลบไม่อยู่ใน list)
  const getProductName = (productId: string) => {
    const p = allProducts.find((x) => x.id === productId);
    if (p) return `${p.code} — ${p.name}`;
    const ref = priceListTemplate?.products?.find(
      (x) => x.product?.id === productId,
    );
    return ref ? `${ref.product?.code ?? ref.code} — ${ref.product?.name}` : "";
  };

  // หน่วยสั่งซื้อ (default_order) ของ product — มีเฉพาะ product ที่ save แล้วใน
  // template · product ที่พึ่งติ๊กจาก tree (ยังไม่ save) จะยังไม่มี → ไม่โชว์ badge
  const getOrderUnitName = (productId: string) =>
    priceListTemplate?.products?.find((x) => x.product?.id === productId)
      ?.default_order.unit?.name ?? "";

  return (
    <>
      <SettingSection
        wide
        frameless
        title={t("productsTitle")}
        description={isView ? undefined : t("detail.noItemsDesc")}
        count={detailFields.length}
      >
        {isView ? (
          detailFields.length === 0 ? (
            <EmptyProducts
              onAdd={handleAddProduct}
              disabled={isDisabled}
              title={t("detail.noItems")}
              description={t("detail.noItemsDesc")}
              addLabel={tc("addItem")}
            />
          ) : (
            <PltItemGroupedView products={priceListTemplate?.products ?? []} />
          )
        ) : (
          // edit/add → ซ้าย: tree เลือก product · ขวา: ตารางกรอก unit/qty/note
          // จอเล็กซ้อนลงล่าง (grid-cols-1) จอ lg ขึ้นไปแยกซ้าย-ขวา
          <div className="grid gap-4 lg:grid-cols-[22rem_minmax(0,1fr)] lg:items-start">
            <TreeProductLookup
              products={allProducts}
              selectedProductIds={selectedProductIds}
              onSelectionChange={handleTreeSelectionChange}
              disabled={isDisabled}
              loading={productsLoading}
            />
            <div className="min-w-0">
              {detailFields.length === 0 ? (
                <div className="text-muted-foreground flex h-full min-h-40 flex-col items-center justify-center gap-1 rounded-lg border border-dashed p-6 text-center">
                  <p className="text-sm font-medium">{t("detail.noItems")}</p>
                  <p className="text-xs">{t("detail.noItemsDesc")}</p>
                </div>
              ) : (
                <PltItemCards
                  form={form}
                  detailFields={detailFields}
                  isDisabled={isDisabled}
                  onRequestRemoveTier={setRemoveDetailIndex}
                  onAddTier={handleAddTier}
                  onRequestRemoveProduct={setRemoveProductId}
                  getProductName={getProductName}
                  getOrderUnitName={getOrderUnitName}
                />
              )}
            </div>
          </div>
        )}
      </SettingSection>

      <DeleteDialog
        open={removeDetailIndex !== null}
        onOpenChange={(o) => {
          if (!o) setRemoveDetailIndex(null);
        }}
        title={t("removeTierTitle")}
        description={t("removeTierConfirm")}
        onConfirm={handleConfirmRemoveTier}
      />

      <DeleteDialog
        open={removeProductId !== null}
        onOpenChange={(o) => {
          if (!o) setRemoveProductId(null);
        }}
        title={t("removeProductTitle", { name: removeProductName })}
        description={t("removeProductConfirm")}
        onConfirm={handleConfirmRemoveProduct}
      />
    </>
  );
}
