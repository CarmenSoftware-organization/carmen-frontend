import { useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "use-intl";
import { ImageIcon, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  IMAGE_ACCEPT_ATTR,
  IMAGE_MAX_BYTES,
  IMAGE_MIME_TYPES,
  formatBytes,
} from "@/lib/image-upload";
import { cn } from "@/lib/utils";

export interface EqImageChange {
  file: File | null;
  removed: boolean;
}

interface EqImageFieldProps {
  readonly disabled?: boolean;
  readonly serverImageUrl?: string | null;
  readonly file: File | null;
  readonly removed: boolean;
  readonly onChange: (next: EqImageChange) => void;
}

/**
 * Single-image upload/preview for equipment (controlled). Backend accepts
 * jpeg/png/webp ≤ {IMAGE_MAX_BYTES}; gif is excluded. The parent form owns the
 * selected file + removal flag and sends them as multipart on submit.
 */
export function EqImageField({
  disabled,
  serverImageUrl,
  file,
  removed,
  onChange,
}: EqImageFieldProps) {
  const t = useTranslations("operationPlan.equipment");
  const [isDragging, setIsDragging] = useState(false);
  const fileInputId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const previewUrl = file ? URL.createObjectURL(file) : null;

  // Revoke the preview object URL when the file changes or on unmount
  useEffect(() => {
    if (!previewUrl) return;
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  let displayUrl: string | null = null;
  if (file) displayUrl = previewUrl;
  else if (!removed) displayUrl = serverImageUrl ?? null;

  const pickFile = (selected: File) => {
    if (!IMAGE_MIME_TYPES.includes(selected.type)) {
      toast.warning(t("imageTypeError"));
      return;
    }
    if (selected.size > IMAGE_MAX_BYTES) {
      toast.warning(
        t("imageSizeError", { size: formatBytes(IMAGE_MAX_BYTES) }),
      );
      return;
    }
    onChange({ file: selected, removed: false });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) pickFile(dropped);
  };

  const openFilePicker = () => {
    if (!disabled) fileInputRef.current?.click();
  };

  return (
    <div className="space-y-2">
      <span className="text-micro-legal text-muted-foreground block font-bold tracking-[0.14em] uppercase">
        {t("image")}
      </span>

      {/* โหมดอ่าน + ไม่มีรูป: บอกว่าไม่มี ไม่ใช่ชวนอัปโหลดทั้งที่กดไม่ได้ */}
      {!displayUrl && disabled ? (
        <div className="bg-muted/40 text-muted-foreground flex h-24 items-center justify-center gap-2 rounded-md border border-dashed text-sm">
          <ImageIcon className="size-4" aria-hidden="true" />
          {t("noPhoto")}
        </div>
      ) : displayUrl ? (
        <div className="bg-muted relative flex h-44 items-center justify-center overflow-hidden rounded-md border md:h-56">
          <img
            src={displayUrl}
            alt={t("entity")}
            className="size-full object-contain"
          />
          {!disabled && (
            <div className="absolute right-2 bottom-2 flex gap-1.5">
              <Button
                type="button"
                size="xs"
                variant="secondary"
                onClick={openFilePicker}
                className="shadow"
              >
                <Upload className="size-3" aria-hidden="true" />
                {t("changeImage")}
              </Button>
              <Button
                type="button"
                size="icon-xs"
                variant="secondary"
                onClick={() => onChange({ file: null, removed: true })}
                aria-label={t("removeImage")}
                className="shadow"
              >
                <X className="size-3" aria-hidden="true" />
              </Button>
            </div>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={openFilePicker}
          onDragOver={(e) => {
            if (disabled) return;
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={(e) => {
            if (e.currentTarget.contains(e.relatedTarget as Node)) return;
            setIsDragging(false);
          }}
          onDrop={handleDrop}
          disabled={disabled}
          className={cn(
            "bg-muted/40 flex h-44 w-full flex-col items-center justify-center gap-2 rounded-md border border-dashed px-4 text-center transition-colors md:h-56",
            !disabled && "hover:bg-muted/60 cursor-pointer",
            disabled && "cursor-not-allowed opacity-60",
            isDragging && "border-primary bg-primary/10",
          )}
        >
          <div className="bg-card flex size-12 items-center justify-center rounded-md border">
            {isDragging ? (
              <Upload className="text-primary size-5" aria-hidden="true" />
            ) : (
              <ImageIcon className="text-primary size-5" aria-hidden="true" />
            )}
          </div>
          <div className="space-y-0.5">
            <div className="text-sm font-semibold">{t("dropPhoto")}</div>
            <div className="text-muted-foreground text-xs">
              {t("imageUploadHint", { size: formatBytes(IMAGE_MAX_BYTES) })}
            </div>
          </div>
        </button>
      )}

      <Input
        ref={fileInputRef}
        id={fileInputId}
        type="file"
        accept={IMAGE_ACCEPT_ATTR}
        className="sr-only"
        disabled={disabled}
        onChange={(e) => {
          const selected = e.target.files?.[0];
          if (selected) pickFile(selected);
          e.target.value = "";
        }}
      />
    </div>
  );
}
