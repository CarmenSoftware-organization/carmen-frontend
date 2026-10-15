import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  ImageIcon,
  Loader2,
  MessageCircle,
  Paperclip,
  PenBox,
  Send,
  Trash2,
  User,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { DeleteDialog } from "@/components/ui/delete-dialog";
import {
  ImageLightbox,
  type LightboxImage,
} from "@/components/ui/image-lightbox";
import { formatDate } from "@/lib/date-utils";
import EmptyComponent from "@/components/empty-component";
import {
  DEFAULT_ATTACHMENT_POLICY,
  acceptFor,
  isFileAllowed,
  maxBytesOf,
  typesLabel,
  type AttachmentPolicy,
} from "@/lib/attachment-policy";
import { safeImageSrc, safeNavigationHref, sanitizeUrl } from "@/lib/utils";

export interface CommentAttachment {
  size: number;
  fileUrl: string;
  fileName: string;
  fileToken: string;
  contentType: string;
}

export interface CommentAudit {
  at: string;
  id?: string;
  name?: string;
}

export interface CommentItem {
  id: string;
  message: string;
  attachments: CommentAttachment[];
  audit: {
    created: CommentAudit;
    updated?: CommentAudit;
  };
}

interface CommentSheetProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly comments: CommentItem[];
  readonly isLoading: boolean;
  /** จำนวนทั้งหมดตาม backend สำหรับหัวแผง — ไม่ส่ง = ใช้ `comments.length` */
  readonly total?: number;
  /** มีหน้าถัดไปให้โหลด — sentinel ท้ายรายการจะเรียก `onLoadMore` เมื่อเลื่อนถึง */
  readonly hasMore?: boolean;
  readonly isFetchingMore?: boolean;
  readonly onLoadMore?: () => void;
  readonly currentUserId?: string;
  readonly dateFormat: string;
  readonly onSubmit: (data: {
    message: string;
    attachments: CommentAttachment[];
    files: File[];
  }) => Promise<void>;
  readonly isSubmitting: boolean;
  readonly onUpdate: (data: {
    id: string;
    message: string;
    attachments: CommentAttachment[];
  }) => Promise<void>;
  readonly isUpdating: boolean;
  readonly onDelete: (id: string) => Promise<void>;
  readonly isDeleting: boolean;
  readonly onUploadFile?: (file: File) => Promise<CommentAttachment>;
  readonly directFileUpload?: boolean;
  /** นโยบายไฟล์แนบของ BU — ไม่ส่ง = ค่าเริ่มต้น */
  readonly attachmentPolicy?: AttachmentPolicy;
}

const getFullName = (c: CommentItem) => c.audit?.created?.name ?? "";

const isImageType = (contentType: string) => contentType.startsWith("image/");

/**
 * แสดงเวลาแบบเข้าใจง่ายแทนที่จะเป็น ISO timestamp ยาวๆ:
 *  - น้อยกว่า 1 นาที → "เมื่อสักครู่"
 *  - น้อยกว่า 60 นาที → "X นาทีที่แล้ว"
 *  - วันนี้ → "วันนี้ HH:mm"
 *  - เมื่อวาน → "เมื่อวาน HH:mm"
 *  - มากกว่านั้น → format ของ user + เวลา
 */
const formatCommentTime = (
  iso: string,
  dateFormat: string,
  t: (key: string, values?: Record<string, string | number>) => string,
): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";

  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60_000);

  if (diffMin < 1) return t("justNow");
  if (diffMin < 60) return t("minutesAgo", { count: diffMin });

  const time = formatDate(iso, "HH:mm");
  const isSameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (isSameDay) return t("today", { time });

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday =
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate();
  if (isYesterday) return t("yesterday", { time });

  return formatDate(iso, `${dateFormat} HH:mm`);
};

/**
 * รวม URL สำหรับแสดง attachment — ถ้า server คืน `fileUrl` ใช้ตามนั้น
 *
 * Priority:
 * 1. data URI ชนิดรูปภาพ (`data:image/…` — SVG placeholder หรือ base64) — ใช้ตรงได้เลย
 * 2. absolute URL (presigned MinIO / https) — ใช้ตรงได้เลย ไม่ต้อง proxy
 * 3. relative `/api/...` path — prepend `/api/proxy` (เส้นทางเดิมจาก source app)
 * 4. fallback: derive จาก `fileToken` รูปแบบ `{buCode}/{uuid}`
 *
 * ข้อ 1–2 คือเส้นทางที่ใช้งานได้จริงในบริบทนี้ เพราะ URL ที่ได้ถูกส่งให้เบราว์เซอร์
 * โหลดเอง (`<img src>` / `<a href>`) ซึ่ง **ไม่ผ่าน** `lib/http-client.ts` — ตัว rewrite
 * `/api/proxy/<rest>` → `${BACKEND_URL}/<rest>` ทำงานเฉพาะชั้น fetch เท่านั้น ข้อ 3–4
 * จึงเป็นของตกทอดที่เก็บไว้กันรีเกรสชัน ไม่ใช่เส้นทางหลัก
 *
 * รับ data URI เฉพาะ `data:image/` — ชนิดอื่น (เช่น `data:text/html`) ตกไปให้
 * `sanitizeUrl` ปฏิเสธตามเดิม เพราะปลายทางของไฟล์ที่ไม่ใช่รูปคือ `<a href target="_blank">`
 */
const resolveAttachmentUrl = (
  fileUrl: string,
  fileToken: string,
): string | null => {
  if (fileUrl) {
    // data URI ของรูปภาพ — pass through โดยตรง (sanitizeUrl บล็อก data: ทุกชนิด)
    if (fileUrl.startsWith("data:image/")) {
      return fileUrl;
    }
    // Absolute URL (presigned MinIO URL / external https) — ใช้โดยตรงโดยไม่ proxy
    if (fileUrl.startsWith("http://") || fileUrl.startsWith("https://")) {
      const safe = sanitizeUrl(fileUrl);
      if (safe) return safe;
    }
    // Relative gateway URL — prepend /api/proxy
    const proxied =
      fileUrl.startsWith("/api/") && !fileUrl.startsWith("/api/proxy/")
        ? `/api/proxy${fileUrl}`
        : fileUrl;
    const safe = sanitizeUrl(proxied);
    if (safe) return safe;
  }
  const slashIdx = fileToken.indexOf("/");
  if (slashIdx > 0) {
    const buCode = fileToken.slice(0, slashIdx);
    const id = fileToken.slice(slashIdx + 1);
    // Allowlist: buCode must be alphanumeric + dash/underscore — block path traversal
    if (buCode && id && /^[A-Za-z0-9_-]+$/.test(buCode)) {
      return safeNavigationHref(
        `/api/proxy/api/${encodeURIComponent(buCode)}/documents/${encodeURIComponent(id)}/download`,
      );
    }
  }
  return null;
};

interface AttachmentImageProps {
  readonly src: string;
  readonly fileName: string;
  readonly size?: "sm" | "md";
}

function AttachmentImage({ src, fileName, size = "md" }: AttachmentImageProps) {
  const [errored, setErrored] = useState(false);
  const dimension = size === "sm" ? "size-14" : "size-16";
  // ด่านสุดท้ายก่อนเข้า <img> — ผู้เรียกทั้งสามที่ส่งของที่ผ่านการตรวจมาแล้ว แต่
  // ด่านต้องอยู่ตรงนี้ ไม่ใช่ฝากไว้กับผู้เรียก คนเพิ่มที่เรียกคนถัดไปจะไม่รู้กติกา
  // ไม่ผ่าน = ตกไปกล่อง fallback เหมือนตอนโหลดรูปไม่ขึ้น
  const safeSrc = safeImageSrc(src);

  if (errored || !safeSrc) {
    return (
      <div
        className={`${dimension} bg-muted text-muted-foreground/70 flex flex-col items-center justify-center gap-0.5 rounded p-1`}
        title={fileName}
      >
        <ImageIcon className="size-4 shrink-0" aria-hidden="true" />
        <span className="text-micro-legal line-clamp-2 w-full text-center leading-tight break-all">
          {fileName}
        </span>
      </div>
    );
  }

  return (
    /* plain <img>: ไม่มี @next/next/jsx-a11y plugin ใน Vite eslint config */
    <img
      src={safeSrc}
      alt={fileName}
      className={`${dimension} object-cover`}
      loading="lazy"
      onError={() => setErrored(true)}
    />
  );
}

function SkeletonRow() {
  return (
    <div className="space-y-1.5 px-3 py-2">
      <div className="flex items-center gap-1.5">
        <Skeleton className="size-5 rounded-full" />
        <Skeleton className="h-3 w-24" />
        <Skeleton className="ml-auto h-3 w-16" />
      </div>
      <div className="space-y-1 pl-6.5">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-4/5" />
      </div>
    </div>
  );
}

/**
 * จุดท้ายรายการที่เรียก `onLoadMore` เมื่อเลื่อนเข้าใกล้ (เผื่อ 200px)
 *
 * ไม่ใช้ `useInViewport` เพราะตัวนั้นปิด observer หลังติดครั้งแรก — ที่นี่ผู้เรียก mount
 * ตัวนี้ใหม่ทุกครั้งที่โหลดหน้าถัดไปเสร็จ ถ้ายังอยู่ในจอ (รายการสั้นกว่าจอ) ก็ยิงต่อทันที
 * จนเต็มจอหรือหมดหน้า · ไม่มี IntersectionObserver (jsdom) = ไม่ยิง
 */
function LoadMoreSentinel({ onLoadMore }: { onLoadMore: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const callbackRef = useRef(onLoadMore);
  useEffect(() => {
    callbackRef.current = onLoadMore;
  });

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          observer.disconnect();
          callbackRef.current();
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return <div ref={ref} aria-hidden="true" className="h-px" />;
}

export function CommentSheet({
  open,
  onOpenChange,
  comments,
  isLoading,
  total,
  hasMore = false,
  isFetchingMore = false,
  onLoadMore,
  currentUserId,
  dateFormat,
  onSubmit,
  isSubmitting,
  onUpdate,
  isUpdating,
  onDelete,
  isDeleting,
  onUploadFile,
  directFileUpload,
  attachmentPolicy = DEFAULT_ATTACHMENT_POLICY,
}: CommentSheetProps) {
  const t = useTranslations("commentSheet");
  const tc = useTranslations("common");
  const [message, setMessage] = useState("");
  const [pendingFiles, setPendingFiles] = useState<CommentAttachment[]>([]);
  const [pendingRawFiles, setPendingRawFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editMessage, setEditMessage] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<CommentItem | null>(null);
  const [lightbox, setLightbox] = useState<{
    images: LightboxImage[];
    startIndex: number;
  } | null>(null);

  const rawFilePreviews = useMemo(
    () =>
      pendingRawFiles.map((file) =>
        file.type.startsWith("image/") ? URL.createObjectURL(file) : null,
      ),
    [pendingRawFiles],
  );

  useEffect(() => {
    return () => {
      for (const url of rawFilePreviews) {
        if (url) URL.revokeObjectURL(url);
      }
    };
  }, [rawFilePreviews]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    if (!directFileUpload && !onUploadFile) return;

    const validFiles: File[] = [];
    for (const file of Array.from(files)) {
      if (!isFileAllowed(file, attachmentPolicy)) {
        toast.warning(
          t("fileNotAllowed", {
            name: file.name,
            types: typesLabel(attachmentPolicy),
          }),
        );
      } else if (file.size > maxBytesOf(attachmentPolicy)) {
        toast.warning(
          t("fileTooLarge", {
            name: file.name,
            max: attachmentPolicy.max_size_mb,
          }),
        );
      } else {
        validFiles.push(file);
      }
    }
    if (validFiles.length === 0) return;

    if (directFileUpload) {
      setPendingRawFiles((prev) => [...prev, ...validFiles]);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setIsUploading(true);
    try {
      const results = await Promise.allSettled(
        validFiles.map((file) => onUploadFile!(file)),
      );
      const uploaded = results
        .filter(
          (r): r is PromiseFulfilledResult<CommentAttachment> =>
            r.status === "fulfilled",
        )
        .map((r) => r.value);
      const failedCount = results.length - uploaded.length;
      if (failedCount > 0)
        toast.error(t("uploadCountFailed", { count: failedCount }));
      if (uploaded.length > 0)
        setPendingFiles((prev) => [...prev, ...uploaded]);
    } catch {
      toast.error(t("uploadFailed"));
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removePendingFile = (index: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const removePendingRawFile = (index: number) => {
    setPendingRawFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    // กัน double-submit จากการกด Enter รัว ๆ ระหว่าง mutation ยัง in-flight
    // (ปุ่ม Send disabled อยู่แล้ว แต่ Enter handler เรียกตรงนี้)
    if (isSubmitting || isUploading) return;
    const totalFiles = directFileUpload
      ? pendingRawFiles.length
      : pendingFiles.length;
    if (!message.trim() && totalFiles === 0) return;
    try {
      await onSubmit({
        message: message.trim(),
        attachments: pendingFiles,
        files: pendingRawFiles,
      });
      setMessage("");
      setPendingFiles([]);
      setPendingRawFiles([]);
      toast.success(t("added"));
    } catch {
      // toast ขึ้นจาก MutationCache กลางแล้ว — ที่นี่แค่ไม่ล้างช่องพิมพ์ทิ้ง
    }
  };

  const startEdit = (c: CommentItem) => {
    setEditingId(c.id);
    setEditMessage(c.message);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditMessage("");
  };

  const handleUpdate = async (c: CommentItem) => {
    if (isUpdating) return; // กัน double-submit จาก Enter ใน edit mode
    if (!editMessage.trim()) return;
    try {
      await onUpdate({
        id: c.id,
        message: editMessage.trim(),
        attachments: c.attachments,
      });
      cancelEdit();
      toast.success(t("updated"));
    } catch {
      // toast ขึ้นจาก MutationCache กลางแล้ว — คง edit mode ไว้ให้แก้ต่อ
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await onDelete(deleteTarget.id);
      setDeleteTarget(null);
      toast.success(t("deleted"));
    } catch {
      // toast ขึ้นจาก MutationCache กลางแล้ว — คง dialog ยืนยันไว้ให้ลองใหม่
    }
  };

  const isOwner = (c: CommentItem) =>
    !!currentUserId && currentUserId === c.audit?.created?.id;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex h-full flex-col gap-0 overflow-hidden p-0"
      >
        <SheetHeader className="animate-fade-in-left shrink-0 gap-0 border-b px-5 py-4">
          <div className="flex items-center gap-2">
            <MessageCircle className="text-primary size-4.5" />
            <div className="min-w-0 flex-1">
              <SheetTitle className="text-base">
                {t("title", { count: total ?? comments.length })}
              </SheetTitle>
            </div>
          </div>
        </SheetHeader>

        <ScrollArea
          className="animate-fade-in-left min-h-0 flex-1 [animation-delay:75ms]"
          aria-live="polite"
          aria-busy={isLoading || isFetchingMore}
        >
          {isLoading && (
            <div className="divide-y" aria-label={tc("loading")}>
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
            </div>
          )}
          {!isLoading && comments.length === 0 && (
            <EmptyComponent
              icon={MessageCircle}
              title={t("noComments")}
              description={t("noCommentsDesc")}
              classNames="mt-10"
            />
          )}
          {!isLoading && comments.length > 0 && (
            <div className="divide-y">
              {comments.map((c) => (
                <div key={c.id} className="space-y-0.5 px-5 py-4">
                  <div className="flex items-center gap-1.5">
                    <div className="bg-muted flex size-5 shrink-0 items-center justify-center rounded-full">
                      <User className="text-muted-foreground size-3" />
                    </div>
                    <span className="truncate text-xs font-semibold">
                      {getFullName(c)}
                    </span>
                    <span
                      className="text-muted-foreground text-micro-legal shrink-0"
                      title={formatDate(
                        c.audit?.created?.at ?? "",
                        `${dateFormat} HH:mm`,
                      )}
                    >
                      {formatCommentTime(
                        c.audit?.created?.at ?? "",
                        dateFormat,
                        t,
                      )}
                    </span>
                  </div>

                  {editingId === c.id ? (
                    <div className="space-y-1 pl-6.5">
                      <Textarea
                        className="min-h-7 resize-none text-xs"
                        rows={2}
                        maxLength={256}
                        value={editMessage}
                        onChange={(e) => setEditMessage(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            handleUpdate(c);
                          }
                          if (e.key === "Escape") cancelEdit();
                        }}
                      />
                      <div className="flex gap-1">
                        <Button
                          size="icon-xs"
                          aria-label={t("saveComment")}
                          onClick={() => handleUpdate(c)}
                          disabled={!editMessage.trim() || isUpdating}
                        >
                          {isUpdating ? (
                            <Loader2 className="size-3 animate-spin" />
                          ) : (
                            <Check className="size-3" />
                          )}
                        </Button>
                        <Button
                          size="icon-xs"
                          variant="ghost"
                          aria-label={t("cancelEdit")}
                          onClick={cancelEdit}
                        >
                          <X className="size-3" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="text-foreground/80 pl-6.5 text-xs">
                        {c.message}
                      </p>
                      {c.attachments.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-0.5 pl-6.5">
                          {(() => {
                            const imageAttachments = c.attachments
                              .filter((a) => isImageType(a.contentType))
                              .map((a) => ({
                                src:
                                  resolveAttachmentUrl(
                                    a.fileUrl,
                                    a.fileToken,
                                  ) ?? "",
                                fileName: a.fileName,
                                fileToken: a.fileToken,
                              }))
                              .filter((a) => a.src);

                            return c.attachments.map((att) => {
                              const safeUrl = resolveAttachmentUrl(
                                att.fileUrl,
                                att.fileToken,
                              );
                              const isImage = isImageType(att.contentType);

                              if (isImage && safeUrl) {
                                const startIndex = imageAttachments.findIndex(
                                  (img) => img.fileToken === att.fileToken,
                                );
                                return (
                                  <button
                                    key={att.fileToken}
                                    type="button"
                                    onClick={() =>
                                      setLightbox({
                                        images: imageAttachments.map((img) => ({
                                          src: img.src,
                                          fileName: img.fileName,
                                        })),
                                        startIndex:
                                          startIndex >= 0 ? startIndex : 0,
                                      })
                                    }
                                    className="hover:ring-primary/40 focus-visible:ring-ring block overflow-hidden rounded border transition hover:ring-2 focus-visible:ring-2 focus-visible:outline-none"
                                    aria-label={att.fileName}
                                  >
                                    <AttachmentImage
                                      src={safeUrl}
                                      fileName={att.fileName}
                                    />
                                  </button>
                                );
                              }

                              if (!safeUrl) return null;
                              return (
                                <a
                                  key={att.fileToken}
                                  href={safeUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="bg-muted/50 text-muted-foreground hover:bg-muted text-micro-legal inline-flex items-center gap-1 rounded border px-1.5 py-0.5 transition-colors"
                                >
                                  <Paperclip className="size-2.5 shrink-0" />
                                  <span className="truncate">
                                    {att.fileName}
                                  </span>
                                </a>
                              );
                            });
                          })()}
                        </div>
                      )}
                      {isOwner(c) && (
                        <div className="flex justify-end">
                          <Button
                            size="icon-xs"
                            variant="ghost"
                            aria-label={tc("edit")}
                            className="hover:text-foreground hover:bg-transparent"
                            onClick={() => startEdit(c)}
                          >
                            <PenBox />
                          </Button>

                          <Button
                            size="icon-xs"
                            variant="ghost"
                            aria-label={tc("delete")}
                            className="hover:text-destructive hover:bg-transparent"
                            onClick={() => setDeleteTarget(c)}
                          >
                            <Trash2 />
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              ))}
              {isFetchingMore && <SkeletonRow />}
              {hasMore && !isFetchingMore && onLoadMore && (
                <LoadMoreSentinel onLoadMore={onLoadMore} />
              )}
            </div>
          )}
        </ScrollArea>

        <div className="animate-fade-in-left bg-muted/30 shrink-0 space-y-2 border-t p-3 [animation-delay:150ms]">
          {!directFileUpload && pendingFiles.length > 0 && (
            <div className="flex max-h-32 flex-wrap gap-1 overflow-y-auto">
              {pendingFiles.map((file, i) => {
                const safeUrl = resolveAttachmentUrl(
                  file.fileUrl,
                  file.fileToken,
                );
                const isImage = isImageType(file.contentType);

                if (isImage && safeUrl) {
                  return (
                    <div
                      key={file.fileToken}
                      className="group relative overflow-hidden rounded border"
                    >
                      <AttachmentImage src={safeUrl} fileName={file.fileName} />
                      <button
                        type="button"
                        onClick={() => removePendingFile(i)}
                        className="bg-background/80 text-foreground hover:bg-background absolute top-0.5 right-0.5 rounded-full p-0.5 shadow-sm"
                        aria-label={t("removeFile", { name: file.fileName })}
                      >
                        <X className="size-2.5" />
                      </button>
                    </div>
                  );
                }

                return (
                  <div
                    key={file.fileToken}
                    className="bg-background text-muted-foreground text-micro-legal inline-flex items-center gap-1 rounded border px-1.5 py-0.5"
                  >
                    <Paperclip className="size-2.5 shrink-0" />
                    <span className="max-w-32 truncate">{file.fileName}</span>
                    <button
                      type="button"
                      onClick={() => removePendingFile(i)}
                      className="hover:text-foreground shrink-0"
                      aria-label={t("removeFile", { name: file.fileName })}
                    >
                      <X className="size-2.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
          {directFileUpload && pendingRawFiles.length > 0 && (
            <div className="flex max-h-32 flex-wrap gap-1 overflow-y-auto">
              {pendingRawFiles.map((file, i) => {
                const previewUrl = rawFilePreviews[i];

                if (previewUrl) {
                  return (
                    <div
                      key={`${file.name}-${i}`}
                      className="group relative overflow-hidden rounded border"
                    >
                      <AttachmentImage src={previewUrl} fileName={file.name} />
                      <button
                        type="button"
                        onClick={() => removePendingRawFile(i)}
                        className="bg-background/80 text-foreground hover:bg-background absolute top-0.5 right-0.5 rounded-full p-0.5 shadow-sm"
                        aria-label={t("removeFile", { name: file.name })}
                      >
                        <X className="size-2.5" />
                      </button>
                    </div>
                  );
                }

                return (
                  <div
                    key={`${file.name}-${i}`}
                    className="bg-background text-muted-foreground text-micro-legal inline-flex items-center gap-1 rounded border px-1.5 py-0.5"
                  >
                    <Paperclip className="size-2.5 shrink-0" />
                    <span className="max-w-32 truncate">{file.name}</span>
                    <button
                      type="button"
                      onClick={() => removePendingRawFile(i)}
                      className="hover:text-foreground shrink-0"
                      aria-label={t("removeFile", { name: file.name })}
                    >
                      <X className="size-2.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={acceptFor(attachmentPolicy)}
            className="hidden"
            onChange={handleFileSelect}
          />
          <div className="bg-background focus-within:ring-ring/50 flex items-end gap-1.5 rounded-lg border px-2 py-1.5 focus-within:ring-1">
            {(onUploadFile || directFileUpload) && (
              <Button
                type="button"
                size="icon-xs"
                variant="ghost"
                aria-label={t("attachFile")}
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="mb-0.5 shrink-0"
              >
                {isUploading ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Paperclip className="size-3.5" />
                )}
              </Button>
            )}
            <div className="min-w-0 flex-1">
              <Textarea
                placeholder={t("placeholder")}
                className="field-sizing-content min-h-7 w-full resize-none border-0 px-0 py-1 text-sm shadow-none focus-visible:ring-0"
                rows={1}
                maxLength={256}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
              />
            </div>
            <Button
              size="icon-xs"
              aria-label={t("sendComment")}
              onClick={handleSubmit}
              disabled={
                (!message.trim() &&
                  pendingFiles.length === 0 &&
                  pendingRawFiles.length === 0) ||
                isSubmitting
              }
              className="mb-0.5 shrink-0"
            >
              {isSubmitting ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Send className="size-3.5" />
              )}
            </Button>
          </div>
        </div>
      </SheetContent>

      <DeleteDialog
        open={deleteTarget !== null}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title={t("deleteTitle")}
        description={t("deleteConfirm")}
        isPending={isDeleting}
        onConfirm={handleDelete}
      />

      <ImageLightbox
        open={lightbox !== null}
        onClose={() => setLightbox(null)}
        images={lightbox?.images ?? []}
        startIndex={lightbox?.startIndex ?? 0}
      />
    </Sheet>
  );
}
