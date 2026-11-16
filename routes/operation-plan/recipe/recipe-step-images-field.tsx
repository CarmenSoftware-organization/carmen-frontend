import { useId, useRef } from "react";
import { useWatch, type UseFormReturn } from "react-hook-form";
import { useTranslations } from "use-intl";
import { toast } from "sonner";
import { ImagePlus, X } from "lucide-react";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  IMAGE_ACCEPT_ATTR,
  IMAGE_MAX_BYTES,
  IMAGE_MIME_TYPES,
  formatBytes,
} from "@/lib/image-upload";
import type { RecipeFormValues } from "./recipe-form-schema";
import { MAX_STEP_IMAGES } from "./recipe-steps-sync";
import { useRecipeStepImages } from "./use-recipe-step-images";
import {
  previewUrl,
  releaseStepImagePreview,
} from "./recipe-step-image-preview";

interface RecipeStepImagesFieldProps {
  readonly form: UseFormReturn<RecipeFormValues>;
  readonly index: number;
  readonly recipeId: string | undefined;
  readonly isDisabled: boolean;
}

/**
 * รูปของขั้นตอน (ไม่เกิน 5 รูปต่อขั้น) — แสดงบนหน้าสูตรข้างคำอธิบายของขั้นนั้น
 *
 * รูปที่บันทึกแล้วดึงจาก server ต่อขั้น · ฟอร์มถือเฉพาะส่วนที่เปลี่ยน (ไฟล์ใหม่ + id ที่กดลบ) แล้วเขียนจริง
 * ตอนกด Save พร้อมขั้นตอน (use-recipe-steps-sync) — ขั้นที่เพิ่งเพิ่มจึงใส่รูปได้เลยโดยไม่ต้อง Save ก่อน
 * แยกเป็นคอมโพเนนต์เพราะต้อง useWatch/useQuery ของขั้นเดียว (เรียก hook ในลูปของ fields ไม่ได้)
 */
export function RecipeStepImagesField({
  form,
  index,
  recipeId,
  isDisabled,
}: RecipeStepImagesFieldProps) {
  const t = useTranslations("operationPlan.recipe");
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const stepId = useWatch({
    control: form.control,
    name: `preparation_steps.${index}.step_id`,
  });
  const files =
    useWatch({
      control: form.control,
      name: `preparation_steps.${index}.image_files`,
    }) ?? [];
  const removed =
    useWatch({
      control: form.control,
      name: `preparation_steps.${index}.removed_image_ids`,
    }) ?? [];
  const { data: saved = [], isError } = useRecipeStepImages(recipeId, stepId);

  const kept = saved.filter((img) => !removed.includes(img.id));
  const total = kept.length + files.length;
  const room = MAX_STEP_IMAGES - total;

  const addFiles = (picked: FileList) => {
    const accepted: File[] = [];
    for (const file of Array.from(picked)) {
      if (accepted.length >= room) {
        toast.warning(t("maxStepImages", { max: MAX_STEP_IMAGES }));
        break;
      }
      if (!IMAGE_MIME_TYPES.includes(file.type)) {
        toast.warning(t("imageTypeError"));
        continue;
      }
      if (file.size > IMAGE_MAX_BYTES) {
        toast.warning(
          t("imageSizeError", { size: formatBytes(IMAGE_MAX_BYTES) }),
        );
        continue;
      }
      accepted.push(file);
    }
    if (accepted.length === 0) return;
    form.setValue(
      `preparation_steps.${index}.image_files`,
      [...files, ...accepted],
      { shouldDirty: true },
    );
  };

  const removeFile = (file: File) => {
    releaseStepImagePreview(file);
    form.setValue(
      `preparation_steps.${index}.image_files`,
      files.filter((f) => f !== file),
      { shouldDirty: true },
    );
  };

  const removeSaved = (id: string) =>
    form.setValue(
      `preparation_steps.${index}.removed_image_ids`,
      [...removed, id],
      { shouldDirty: true },
    );

  const thumb =
    "bg-muted relative size-20 shrink-0 overflow-hidden rounded-md border";
  const removeButton =
    "bg-foreground/70 text-background focus-visible:ring-ring absolute top-1 right-1 flex size-6 items-center justify-center rounded-full outline-none focus-visible:ring-2";

  return (
    <Field className="mt-3">
      <FieldLabel htmlFor={inputId}>
        {t("stepImages")}
        <span className="text-muted-foreground text-xs font-normal tabular-nums">
          {total} / {MAX_STEP_IMAGES}
        </span>
      </FieldLabel>
      <ul className="flex flex-wrap gap-2" aria-label={t("stepImages")}>
        {kept.map((img, i) => (
          <li key={img.id} className={thumb}>
            {img.url && (
              <img
                src={img.url}
                alt={img.alt_text ?? t("stepImageN", { n: i + 1 })}
                loading="lazy"
                className="size-full object-cover"
              />
            )}
            {!isDisabled && (
              <button
                type="button"
                className={removeButton}
                aria-label={t("removeStepImage", { n: i + 1 })}
                onClick={() => removeSaved(img.id)}
              >
                <X className="size-3.5" />
              </button>
            )}
          </li>
        ))}
        {files.map((file, i) => {
          const n = kept.length + i + 1;
          return (
            <li key={previewUrl(file)} className={thumb}>
              <img
                src={previewUrl(file)}
                alt={t("stepImageN", { n })}
                className="size-full object-cover"
              />
              {!isDisabled && (
                <button
                  type="button"
                  className={removeButton}
                  aria-label={t("removeStepImage", { n })}
                  onClick={() => removeFile(file)}
                >
                  <X className="size-3.5" />
                </button>
              )}
            </li>
          );
        })}
        {!isDisabled && room > 0 && (
          <li>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              aria-label={t("addStepImage")}
              className="bg-card text-muted-foreground hover:border-primary hover:text-foreground focus-visible:ring-ring flex size-20 flex-col items-center justify-center gap-1 rounded-md border border-dashed text-xs transition-colors outline-none focus-visible:ring-2"
            >
              <ImagePlus className="size-5" aria-hidden="true" />
              {t("addImage")}
            </button>
          </li>
        )}
        {isDisabled && total === 0 && (
          <li className="text-muted-foreground text-xs">—</li>
        )}
      </ul>
      {isError ? (
        <FieldDescription className="text-destructive">
          {t("stepImagesLoadFailed")}
        </FieldDescription>
      ) : (
        !isDisabled && (
          <FieldDescription>
            {t("stepImagesDesc", {
              max: MAX_STEP_IMAGES,
              size: formatBytes(IMAGE_MAX_BYTES),
            })}
          </FieldDescription>
        )
      )}
      <Input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={IMAGE_ACCEPT_ATTR}
        multiple
        className="sr-only"
        disabled={isDisabled || room <= 0}
        onChange={(e) => {
          if (e.target.files?.length) addFiles(e.target.files);
          e.target.value = "";
        }}
      />
    </Field>
  );
}
