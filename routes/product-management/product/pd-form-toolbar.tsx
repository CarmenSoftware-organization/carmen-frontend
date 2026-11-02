import { memo } from "react";
import { useWatch } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { StatusDotBadge, type DotTone } from "@/components/ui/status-dot-badge";
import { FormToolbar } from "@/components/share/form-toolbar";
import type { FormMode } from "@/types/form";
import type { ProductDetail, ProductFormInstance } from "@/types/product";
import { Save } from "lucide-react";
import { useTranslations } from "use-intl";

interface PdFormToolbarProps {
  readonly product?: ProductDetail;
  readonly form: ProductFormInstance;
  readonly mode: FormMode;
  readonly isPending: boolean;
  readonly deleteIsPending: boolean;
  /**
   * มีรูปที่เลือกไว้รออัปโหลดหรือยัง — นับเป็น "แก้แล้ว" ด้วย
   *
   * `form.formState.isDirty` เห็นแค่ฟิลด์ในฟอร์ม แต่รูปเก็บอยู่ใน state แยก
   * (อัปโหลดตอนกด Save) ถ้าไม่บอกตรงนี้ คนที่เข้าโหมดแก้แล้วเลือกแต่รูปอย่างเดียว
   * จะกด Save ไม่ได้ทั้งที่มีของรอส่ง
   */
  readonly hasPendingImages?: boolean;
  readonly onBack: () => void;
  readonly onEdit: () => void;
  readonly onCancel: () => void;
  readonly onDelete: () => void;
  readonly onComment?: () => void;
}

function PdFormToolbarInner({
  product,
  form,
  mode,
  isPending,
  deleteIsPending,
  hasPendingImages,
  onBack,
  onEdit,
  onCancel,
  onDelete,
  onComment,
}: PdFormToolbarProps) {
  const tc = useTranslations("common");
  const tf = useTranslations("form");
  const t = useTranslations("productManagement.product");
  const tfl = useTranslations("field");
  const isEdit = mode === "edit";
  const isAdd = mode === "add";

  // Subscribe ONLY to the 3 fields the toolbar displays — `form.watch`
  // would subscribe to every form change (toolbar re-renders on every keystroke).
  const [watchedName, watchedStatus] = useWatch({
    control: form.control,
    name: ["name", "product_status_type"],
  });

  const displayName = isAdd
    ? watchedName || t("newProductTitle")
    : (product?.name ?? watchedName);
  const isDirty = form.formState.isDirty || !!hasPendingImages;
  const saveDisabled = isPending || (isEdit && !isDirty);

  // status → global dot badge (draft=info · active=success · inactive=neutral)
  const statusTone: DotTone = isAdd
    ? "info"
    : watchedStatus === "active"
      ? "success"
      : "neutral";
  const statusLabel = isAdd
    ? t("draft")
    : watchedStatus === "active"
      ? t("active")
      : t("inactive");

  function getButtonLabel() {
    if (isPending) {
      return isEdit ? tf("saving") : tf("creating");
    }
    return isEdit ? tc("save") : t("createProduct");
  }

  // status + hint แสดงข้าง title (badges slot) — รหัสสินค้าไม่อยู่ตรงนี้
  // แต่อยู่ต้นแถบตัวตนใน subtitle ด้านล่าง
  const badges = (
    <>
      <StatusDotBadge tone={statusTone} size="xs">
        {statusLabel}
      </StatusDotBadge>
      {isAdd && (
        <span className="text-muted-foreground text-xs">
          {t("fillRequiredBefore")}
        </span>
      )}
    </>
  );

  // subtitle: add → neverSaved · view/edit → แถบตัวตนของสินค้า = รหัส · ชื่อไทย ·
  // เส้นทางหมวด (category › sub › item group) · หน่วยนับ — อ่านจบได้โดยไม่ต้อง
  // เปิดแท็บ General · ใช้ค่าจาก `product` (ที่บันทึกแล้ว) ไม่ใช่ค่าที่กำลังแก้
  // ในฟอร์ม หัวหน้าจึงไม่เปลี่ยนตามทุกการพิมพ์ · รหัสกลับมาอยู่ในแถบนี้ (ไม่ใช่
  // ข้าง title แบบเดิมที่ถูกเอาออกใน 39a4da71) เพราะคนคลังค้นกันด้วยรหัส
  const categoryPath = [
    product?.product_category?.name,
    product?.product_sub_category?.name,
    product?.product_item_group?.name,
  ].filter(Boolean);
  const unitName = product?.inventory_unit?.name;
  const identity = [
    product?.code && (
      <span key="code" className="text-foreground font-medium tabular-nums">
        {product.code}
      </span>
    ),
    product?.local_name && <span key="local">{product.local_name}</span>,
    categoryPath.length > 0 && (
      <span key="path">{categoryPath.join(" › ")}</span>
    ),
    unitName && (
      <span key="unit">
        {tfl("unit")}{" "}
        <span className="text-foreground font-medium">{unitName}</span>
      </span>
    ),
  ].filter(Boolean);
  const subtitle = isAdd ? (
    t("neverSaved")
  ) : identity.length > 0 ? (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
      {identity.map((part, i) => (
        <span key={i} className="flex items-center gap-2">
          {i > 0 && <span aria-hidden="true">·</span>}
          {part}
        </span>
      ))}
    </span>
  ) : undefined;

  // Save ต้อง disabled จน dirty (หรือมีรูปรอ) จึงเป็น submitSlot — ปุ่มนี้ไม่ผ่าน
  // gate license/permission ของ FormToolbar (Edit ยัง gate อยู่ คนที่ไม่มีสิทธิ์
  // เข้าโหมดแก้ไม่ได้ตั้งแต่แรก; โหมด add ตกที่ 403 ของ backend)
  const submitSlot = (
    <Button type="submit" size="sm" form="product-form" disabled={saveDisabled}>
      <Save className="size-4" aria-hidden="true" />
      {getButtonLabel()}
    </Button>
  );

  return (
    <FormToolbar
      mode={mode}
      formId="product-form"
      isPending={isPending}
      title={displayName ?? ""}
      subtitle={subtitle}
      badges={badges}
      submitSlot={submitSlot}
      onBack={onBack}
      onCancel={onCancel}
      onEdit={onEdit}
      onDelete={product ? onDelete : undefined}
      deleteIsPending={deleteIsPending}
      onComment={product ? onComment : undefined}
      activity={product ? { id: product.id, label: product.code } : undefined}
    />
  );
}

export const PdFormToolbar = memo(PdFormToolbarInner);
