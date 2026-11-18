import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "use-intl";
import { ChevronLeft, ChevronRight, ImageIcon, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { DeleteDialog } from "@/components/ui/delete-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { fileRejectMessage } from "@/lib/image-upload";
import { useDeleteProductImage, useProductImages } from "./use-product-image";
import type { ProductImage } from "@/types/product-image";
import { type MockImage, validateImageFiles } from "./pd-image-utils";
import { ImageLightbox } from "./pd-image-lightbox";
import { EmptyImage } from "./pd-image-empty";

interface ProductImagesProps {
  readonly productId?: string;
  readonly readOnly?: boolean;
  /** โหมดดูที่ไม่มีรูป = ไม่ render เลย (แยกจาก readOnly ที่รวมตอนกำลังบันทึกด้วย) */
  readonly hideWhenEmpty?: boolean;
  readonly pendingFiles?: readonly File[];
  readonly onPendingFilesChange?: (files: File[]) => void;
}

function toDisplayImage(
  img: ProductImage,
  index: number,
  t: ReturnType<typeof useTranslations>,
): MockImage {
  return {
    id: img.id,
    label:
      img.caption || img.alt_text || t("imgFallbackLabel", { n: index + 1 }),
    url: img.url,
  };
}

export function ProductImages({
  productId,
  readOnly,
  hideWhenEmpty,
  pendingFiles = [],
  onPendingFilesChange,
}: ProductImagesProps) {
  const t = useTranslations("productManagement.product");
  const tv = useTranslations("validation");
  const { data, isLoading } = useProductImages(productId);
  const deleteImage = useDeleteProductImage();

  const [activeIndex, setActiveIndex] = useState(0);
  const [dialogIndex, setDialogIndex] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MockImage | null>(null);

  const savedImages = (data?.data.images ?? [])
    .toSorted((a, b) => a.sort_order - b.sort_order)
    .map((img, i) => toDisplayImage(img, i, t));

  // preview ของไฟล์ที่ยังไม่ได้อัปโหลด — object URL ต้องคืนทิ้งเองไม่งั้นรั่ว
  const pendingPreviews = useMemo(
    () =>
      pendingFiles.map((file, i) => ({
        id: `pending-${i}-${file.name}`,
        label: file.name,
        url: URL.createObjectURL(file),
        pending: true as const,
      })),
    [pendingFiles],
  );
  useEffect(
    () => () => pendingPreviews.forEach((p) => URL.revokeObjectURL(p.url)),
    [pendingPreviews],
  );

  const images = [...savedImages, ...pendingPreviews];
  const total = images.length;
  // clamp index กันหลุดช่วงหลัง refetch (จำนวนรูปเปลี่ยน)
  const safeIndex = total === 0 ? 0 : Math.min(activeIndex, total - 1);
  const goPrev = () => setActiveIndex((safeIndex - 1 + total) % total);
  const goNext = () => setActiveIndex((safeIndex + 1) % total);

  const handleAddFiles = (files: FileList | File[]) => {
    const { valid, rejected } = validateImageFiles(Array.from(files));

    if (rejected.length > 0) {
      // ไฟล์ไม่ผ่านกติกา = ผู้ใช้เลือกใหม่ได้เอง ไม่ใช่ระบบพัง → warning
      // และเดิมประโยคทั้งท่อนเป็นภาษาอังกฤษที่ประกอบมาจาก lib
      const first = `${rejected[0].name}: ${fileRejectMessage(rejected[0].reason, tv)}`;
      toast.warning(
        rejected.length === 1
          ? first
          : tv("filesRejected", { count: String(rejected.length), first }),
      );
    }

    if (valid.length === 0) return;

    // เก็บไว้ในฟอร์มเฉย ๆ — อัปโหลดจริงตอนกด Save (ดู pd-form.tsx) เพื่อไม่ให้มี
    // รูปค้างบน backend เมื่อผู้ใช้กดยกเลิกการแก้ไข
    onPendingFilesChange?.([...pendingFiles, ...valid]);
  };

  const handleConfirmDelete = () => {
    if (!deleteTarget) return;
    // รูปที่ยังไม่ได้อัปโหลด ลบทิ้งจากรายการที่รออยู่เฉย ๆ ไม่ต้องยิง API
    const pendingIdx = pendingPreviews.findIndex(
      (p) => p.id === deleteTarget.id,
    );
    if (pendingIdx >= 0) {
      onPendingFilesChange?.(pendingFiles.filter((_, i) => i !== pendingIdx));
      setDeleteTarget(null);
      return;
    }
    if (!productId) return;
    deleteImage.mutate(
      { product_id: productId, imageId: deleteTarget.id },
      {
        onSuccess: () => {
          toast.success(t("imgDeleted"));
          setDeleteTarget(null);
        },
      },
    );
  };

  if (isLoading) {
    return <Skeleton className="aspect-square w-full rounded-lg" />;
  }

  // โหมดดูไม่มีรูป = ไม่ render เลย กรอบ "No images" เป็นแค่ที่ว่างที่ไม่บอกอะไร · ตัวห่อฝั่ง
  // pd-tab-general ใช้ empty:hidden ช่องข้างรูปจึงขยายเต็มการ์ด โหมดแก้ยังมีช่องอัปโหลดเหมือนเดิม
  if (total === 0) {
    if (hideWhenEmpty) return null;
    if (readOnly) {
      return (
        <div className="text-muted-foreground flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed">
          <ImageIcon className="size-10 opacity-60" aria-hidden="true" />
          <p className="text-xs">{t("imgNone")}</p>
        </div>
      );
    }
    return <EmptyImage onAddFiles={handleAddFiles} />;
  }

  const active = images[safeIndex];

  return (
    <div className="space-y-3">
      <div className="group relative">
        <button
          type="button"
          onClick={() => setDialogIndex(safeIndex)}
          aria-label={t("imgViewAria", { label: active.label })}
          className="ring-offset-background focus-visible:ring-ring relative block aspect-square w-full cursor-pointer overflow-hidden rounded-lg border focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          <img
            src={active.url}
            alt={active.label}
            className="absolute inset-0 size-full object-cover"
          />
          <span className="bg-background text-foreground text-micro absolute bottom-2 left-2 rounded px-2 py-0.5 font-semibold">
            {active.label}
          </span>
          <span className="bg-background text-muted-foreground text-micro absolute right-2 bottom-2 rounded px-2 py-0.5 tabular-nums">
            {safeIndex + 1} / {total}
          </span>
        </button>

        {!readOnly && (
          <Button
            type="button"
            size="icon-sm"
            variant="destructive"
            aria-label={t("imgDeleteAria")}
            onClick={() => setDeleteTarget(active)}
            disabled={deleteImage.isPending}
            className="absolute top-2 right-2 opacity-0 shadow transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
          >
            <Trash2 />
          </Button>
        )}

        {total > 1 && (
          <>
            <Button
              type="button"
              size="icon-sm"
              variant="secondary"
              aria-label={t("imgPrevAria")}
              onClick={goPrev}
              className="absolute top-1/2 left-2 -translate-y-1/2 opacity-0 shadow transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
            >
              <ChevronLeft />
            </Button>
            <Button
              type="button"
              size="icon-sm"
              variant="secondary"
              aria-label={t("imgNextAria")}
              onClick={goNext}
              className="absolute top-1/2 right-2 -translate-y-1/2 opacity-0 shadow transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
            >
              <ChevronRight />
            </Button>
          </>
        )}
      </div>

      {total > 1 && (
        <div className="flex items-center justify-center gap-3 overflow-x-auto px-1 pt-2 pb-1">
          {images.map((img, idx) => (
            <button
              key={img.id}
              type="button"
              onClick={() => setActiveIndex(idx)}
              aria-label={t("imgShowAria", { label: img.label })}
              aria-current={idx === safeIndex}
              className={cn(
                "ring-offset-background focus-visible:ring-ring relative size-12 shrink-0 cursor-pointer overflow-hidden rounded-md border transition-all focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
                idx === safeIndex
                  ? "border-primary bg-primary/5"
                  : "opacity-60 hover:opacity-100",
              )}
            >
              <img
                src={img.url}
                alt={img.label}
                className="absolute inset-0 size-full object-cover"
              />
            </button>
          ))}
        </div>
      )}

      <ImageLightbox
        images={images}
        index={dialogIndex}
        onIndexChange={setDialogIndex}
        onAddFiles={readOnly ? undefined : handleAddFiles}
      />

      <DeleteDialog
        open={!!deleteTarget}
        onOpenChange={(open) =>
          !open && !deleteImage.isPending && setDeleteTarget(null)
        }
        title={t("imgDeleteTitle")}
        description={t("imgDeleteConfirm")}
        isPending={deleteImage.isPending}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
