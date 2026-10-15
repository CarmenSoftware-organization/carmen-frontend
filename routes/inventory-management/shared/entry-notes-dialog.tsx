import { useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { ImageIcon, ImagePlus, MessageSquarePlus, Save, X } from "lucide-react";
import { useTranslations } from "use-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useAttachmentPolicy } from "@/hooks/use-attachment-policy";
import { maxBytesOf, typesLabel } from "@/lib/attachment-policy";

export interface SavedEvidenceImage {
  id: string;
  url: string;
  name: string;
  size: number;
}

export interface SavedNotePayload {
  note: string;
  images: SavedEvidenceImage[];
}

export interface ServerEvidenceImage {
  id: string;
  url: string;
  name: string;
  size: number;
}

export interface SubmitNotePayload {
  note: string;
  files: File[];
  previews: SavedEvidenceImage[];
}

interface EntryNotesDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly productName: string;
  readonly defaultNote: string;
  readonly defaultServerImages: readonly ServerEvidenceImage[];
  readonly isLoadingComments: boolean;
  readonly onSave: (payload: SubmitNotePayload) => void;
  readonly isSaving: boolean;
}

interface EvidenceImage {
  id: string;
  file: File;
  url: string;
  size: number;
}

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

export function EntryNotesDialog({
  open,
  onOpenChange,
  productName,
  defaultNote,
  defaultServerImages,
  isLoadingComments,
  onSave,
  isSaving,
}: EntryNotesDialogProps) {
  const t = useTranslations("inventoryManagement.entryDialogs");
  const tc = useTranslations("common");
  const policy = useAttachmentPolicy(open);
  // UI นี้แสดง thumbnail — รับแค่รูปที่นโยบายของ BU เปิดไว้ ขนาดตามนโยบาย (เดิมตายตัว 3MB)
  const imageMimes = policy.mime_types.filter((m) => m.startsWith("image/"));
  const imagesAllowed = imageMimes.length > 0;
  const imageTypes = typesLabel({
    ...policy,
    extensions: policy.extensions.filter((e) =>
      /^\.(jpe?g|png|webp|gif|bmp|heic|heif|avif)$/i.test(e),
    ),
  });
  const maxBytes = maxBytesOf(policy);
  const [note, setNote] = useState(defaultNote);
  const [images, setImages] = useState<EvidenceImage[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // skipRevoke=true เมื่อ save สำเร็จ (โอนกรรมสิทธิ์ URL ไปให้ row)
  const closeDialog = (next: boolean, skipRevoke = false) => {
    if (!next) {
      if (!skipRevoke) {
        for (const i of images) URL.revokeObjectURL(i.url);
      }
      setImages([]);
      setNote("");
    }
    onOpenChange(next);
  };

  const handleDialogOpenChange = (next: boolean) => {
    closeDialog(next, false);
  };

  const addFiles = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const accepted: EvidenceImage[] = [];
    for (const file of Array.from(fileList)) {
      if (!imageMimes.includes(file.type.toLowerCase())) {
        toast.warning(t("evidenceNotImage", { name: file.name }));
        continue;
      }
      if (file.size > maxBytes) {
        toast.warning(
          t("evidenceTooLarge", { name: file.name, max: policy.max_size_mb }),
        );
        continue;
      }
      accepted.push({
        id: `${file.name}-${file.size}-${file.lastModified}-${crypto.randomUUID()}`,
        file,
        url: URL.createObjectURL(file),
        size: file.size,
      });
    }
    if (accepted.length > 0) {
      setImages((prev) => [...prev, ...accepted]);
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    addFiles(e.target.files);
    e.target.value = "";
  };

  const handleDrop = (e: DragEvent<HTMLElement>) => {
    e.preventDefault();
    setIsDragging(false);
    addFiles(e.dataTransfer.files);
  };

  const handleDragOver = (e: DragEvent<HTMLElement>) => {
    e.preventDefault();
    if (!isDragging) setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const removeImage = (id: string) => {
    setImages((prev) => {
      const target = prev.find((i) => i.id === id);
      if (target) URL.revokeObjectURL(target.url);
      return prev.filter((i) => i.id !== id);
    });
  };

  const canSave = note.trim().length > 0 || images.length > 0;

  const handleSave = () => {
    if (!canSave) return;
    const trimmedNote = note.trim();
    onSave({
      note: trimmedNote,
      files: images.map((i) => i.file),
      previews: images.map((i) => ({
        id: i.id,
        url: i.url,
        name: i.file.name,
        size: i.size,
      })),
    });
    // Caller จะปิด dialog เอง — ไม่ revoke ที่นี่ (URLs ถูกโอนไปยัง row)
    closeDialog(false, true);
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-hidden p-0 sm:max-w-md">
        <div className="p-5">
          <DialogHeader className="space-y-2">
            <div className="flex items-start gap-3">
              <div className="bg-muted text-primary flex size-9 shrink-0 items-center justify-center rounded-lg">
                <MessageSquarePlus className="size-4.5" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1 space-y-0.5">
                <DialogTitle className="text-foreground text-base leading-tight font-semibold tracking-tight">
                  {productName}
                </DialogTitle>
                <DialogDescription className="text-muted-foreground text-micro leading-relaxed">
                  {t("notesDialogDesc")}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        {/* Body */}
        <div className="max-h-[55vh] space-y-3 overflow-y-auto px-5 py-3">
          {/* Notes textarea */}
          <div className="space-y-1.5">
            <label
              htmlFor="entry-note-textarea"
              className="text-muted-foreground text-micro-eyebrow flex items-center gap-1 font-semibold tracking-widest uppercase"
            >
              <MessageSquarePlus className="size-2.5" aria-hidden="true" />
              {t("notesLabel")}
            </label>
            <Textarea
              id="entry-note-textarea"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t("notesPlaceholder")}
              className="border-border/40 focus-visible:border-primary bg-card min-h-20 rounded-lg border text-sm shadow-none focus-visible:ring-0"
              maxLength={256}
            />
          </div>

          {/* Evidence — multi-image upload with drag & drop */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground text-micro-eyebrow flex items-center gap-1 font-semibold tracking-widest uppercase">
                <ImagePlus className="size-2.5" aria-hidden="true" />
                {t("evidenceLabel")}
              </span>
              {images.length > 0 && (
                <span className="text-muted-foreground bg-muted/60 text-micro-legal rounded-full px-1.5 font-semibold tabular-nums">
                  {t("evidenceCount", { count: images.length })}
                </span>
              )}
            </div>

            <input
              ref={inputRef}
              type="file"
              accept={imageMimes.join(",")}
              multiple
              className="hidden"
              onChange={handleFileChange}
              aria-label={t("evidenceLabel")}
            />

            {/* Dropzone */}
            <button
              type="button"
              disabled={!imagesAllowed}
              onDrop={imagesAllowed ? handleDrop : undefined}
              onDragOver={imagesAllowed ? handleDragOver : undefined}
              onDragLeave={imagesAllowed ? handleDragLeave : undefined}
              onClick={() => inputRef.current?.click()}
              aria-label={t("evidenceHint")}
              className={cn(
                "flex w-full cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed py-5 transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                isDragging
                  ? "border-primary bg-primary/15"
                  : "border-primary/30 bg-primary/5 hover:border-primary hover:bg-primary/10",
              )}
            >
              <ImagePlus className="text-primary size-5" aria-hidden="true" />
              <span className="text-foreground/80 text-micro font-semibold">
                {imagesAllowed
                  ? t("evidenceHint")
                  : t("evidenceImagesNotAllowed")}
              </span>
              {imagesAllowed && (
                <span className="text-muted-foreground text-micro-legal">
                  {t("evidenceMaxSize", {
                    max: policy.max_size_mb,
                    types: imageTypes,
                  })}
                </span>
              )}
            </button>

            {/* Preview grid */}
            {isLoadingComments && (
              <div className="grid grid-cols-3 gap-2 pt-1">
                <Skeleton className="aspect-square rounded-lg" />
                <Skeleton className="aspect-square rounded-lg" />
                <Skeleton className="aspect-square rounded-lg" />
              </div>
            )}
            {!isLoadingComments &&
              (defaultServerImages.length > 0 || images.length > 0) && (
                <div className="grid grid-cols-3 gap-2 pt-1">
                  {defaultServerImages.map((img) => (
                    <ImageThumb
                      key={`server-${img.id}`}
                      url={img.url}
                      name={img.name}
                      size={formatBytes(img.size)}
                      removeLabel={t("removeImage")}
                    />
                  ))}
                  {images.map((img) => (
                    <ImageThumb
                      key={img.id}
                      url={img.url}
                      name={img.file.name}
                      size={formatBytes(img.size)}
                      onRemove={() => removeImage(img.id)}
                      removeLabel={t("removeImage")}
                    />
                  ))}
                </div>
              )}
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="border-border/40 bg-card/40 flex-row gap-2 border-t px-5 py-3 backdrop-blur-sm sm:gap-2">
          <Button
            variant="outline"
            size="sm"
            className="rounded-full"
            onClick={() => handleDialogOpenChange(false)}
          >
            {tc("close")}
          </Button>
          <Button
            size="sm"
            disabled={!canSave || isSaving}
            className="rounded-full"
            onClick={handleSave}
          >
            <Save className="size-3.5" aria-hidden="true" />
            {isSaving ? tc("saving") : t("saveNote")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── Image preview thumb ─────────────────── */

function ImageThumb({
  url,
  name,
  size,
  onRemove,
  removeLabel,
}: {
  readonly url: string;
  readonly name: string;
  readonly size: string;
  readonly onRemove?: () => void;
  readonly removeLabel: string;
}) {
  const [errored, setErrored] = useState(false);
  return (
    <div className="border-border/60 bg-card group relative aspect-square overflow-hidden rounded-lg border">
      {errored ? (
        <div className="bg-muted/40 text-muted-foreground/70 flex size-full flex-col items-center justify-center gap-1 p-1.5">
          <ImageIcon className="size-5 shrink-0" aria-hidden="true" />
          <span className="text-micro-legal line-clamp-2 w-full text-center leading-tight break-all">
            {name}
          </span>
        </div>
      ) : (
        <img
          src={url}
          alt={name}
          className="size-full object-cover"
          loading="lazy"
          onError={() => setErrored(true)}
        />
      )}
      {/* Gradient overlay + filename */}
      {!errored && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-linear-to-t from-black/70 via-black/30 to-transparent px-1.5 py-1">
          <div className="text-micro-legal truncate font-semibold text-white">
            {name}
          </div>
          <div className="text-micro-floor text-white/80 tabular-nums">
            {size}
          </div>
        </div>
      )}
      {/* Remove button — เฉพาะรูปที่ user เพิ่งเพิ่ม (ไม่ใช่จาก server) */}
      {onRemove && (
        <Button
          type="button"
          variant="secondary"
          size="icon-xs"
          onClick={onRemove}
          aria-label={removeLabel}
          className="bg-foreground/80 hover:bg-destructive text-background absolute top-1 right-1 size-5 rounded-full opacity-0 transition-opacity group-hover:opacity-100"
        >
          <X className="size-3" />
        </Button>
      )}
    </div>
  );
}

export const resolveServerImageUrl = (
  fileUrl: string,
  fileToken: string,
  fileName: string,
): string => {
  if (fileUrl) {
    const proxied =
      fileUrl.startsWith("/api/") && !fileUrl.startsWith("/api/proxy/")
        ? `/api/proxy${fileUrl}`
        : fileUrl;
    return fileName ? `${proxied}/${encodeURIComponent(fileName)}` : proxied;
  }
  const slashIdx = fileToken.indexOf("/");
  if (slashIdx > 0) {
    const buCode = fileToken.slice(0, slashIdx);
    const id = fileToken.slice(slashIdx + 1);
    if (buCode && id) {
      const base = `/api/proxy/api/${buCode}/documents/${encodeURIComponent(id)}/download`;
      return fileName ? `${base}/${encodeURIComponent(fileName)}` : base;
    }
  }
  return "";
};
