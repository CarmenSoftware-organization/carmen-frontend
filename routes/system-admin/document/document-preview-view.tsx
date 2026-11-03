import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import type { Table } from "@tanstack/react-table";
import { Download, Loader2, Trash2 } from "lucide-react";
import { useTranslations } from "use-intl";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { useProfile } from "@/hooks/use-profile";
import { formatDate } from "@/lib/date-utils";
import { formatFileSize } from "@/lib/format-file-size";
import { cn } from "@/lib/utils";
import type { DocumentFile } from "@/types/document";
import { DocumentUsageList } from "./document-usage-list";
import { getFileTypeInfo, getPreviewKind } from "./document-file-type";
import { DocumentReference } from "./document-reference";
import { DocumentThumb } from "./document-thumb";
import { useDocumentBlob, useObjectUrl } from "./use-document-blob";

/** แสดงข้อความได้ไม่เกินนี้ — csv/log ใหญ่ ๆ ทำให้หน้าอืด ที่เหลือให้ดาวน์โหลด */
const TEXT_PREVIEW_MAX_CHARS = 100_000;

interface DocumentPreviewViewProps {
  readonly table: Table<DocumentFile>;
  readonly isLoading: boolean;
  readonly selectable: boolean;
  /** token ที่กำลังดู — ไม่อยู่ในหน้านี้ (เปลี่ยนหน้า/กรอง) = ดูใบแรกแทน */
  readonly activeToken: string | null;
  readonly onActiveChange: (token: string) => void;
  readonly onDelete: (doc: DocumentFile) => void;
  readonly deleteDisabled?: boolean;
  readonly deleteDisabledTitle?: string;
  /** ท้ายรายการด้านซ้าย — sentinel ของ lazy load (ต้องอยู่ใน scroll container ของรายการ) */
  readonly footer?: ReactNode;
}

/**
 * มุมมอง preview ของหน้า Document — รายการแคบด้านซ้าย + แผงพรีวิวและรายละเอียดด้านขวา
 * ลูกศรขึ้น/ลงเลื่อนไฟล์ที่ดูได้ เมื่อโฟกัสอยู่ในรายการ
 */
export function DocumentPreviewView({
  table,
  isLoading,
  selectable,
  activeToken,
  onActiveChange,
  onDelete,
  deleteDisabled,
  deleteDisabledTitle,
  footer,
}: DocumentPreviewViewProps) {
  "use no memo";
  const { dateFormat } = useProfile();
  const listRef = useRef<HTMLUListElement>(null);
  const rows = table.getRowModel().rows;
  const active =
    rows.find((r) => r.id === activeToken)?.original ?? rows[0]?.original;

  if (isLoading) {
    return (
      <div className="grid h-[60vh] grid-cols-[18rem_minmax(0,1fr)] gap-3">
        <Skeleton className="rounded-md" />
        <Skeleton className="rounded-md" />
      </div>
    );
  }
  if (!active) return null;

  const move = (delta: number) => {
    const i = rows.findIndex((r) => r.id === active.fileToken);
    const next = rows[i + delta];
    if (!next) return;
    onActiveChange(next.id);
    listRef.current
      ?.querySelector<HTMLButtonElement>(
        `[data-token="${CSS.escape(next.id)}"]`,
      )
      ?.focus();
  };

  return (
    <div className="grid h-[calc(100vh-22rem)] min-h-96 grid-cols-[18rem_minmax(0,1fr)] overflow-hidden rounded-md border">
      <ul
        ref={listRef}
        className="divide-y overflow-y-auto border-r"
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            move(e.key === "ArrowDown" ? 1 : -1);
          }
        }}
      >
        {rows.map((row) => {
          const doc = row.original;
          const isActive = doc.fileToken === active.fileToken;
          const at = doc.audit?.created?.at ?? doc.lastModified;
          return (
            <li
              key={row.id}
              className={cn(
                "flex items-center gap-2 pr-2 pl-2",
                isActive ? "bg-primary/10" : "hover:bg-muted/60",
              )}
            >
              {selectable && (
                <Checkbox
                  disabled={!row.getCanSelect()}
                  checked={row.getIsSelected()}
                  onCheckedChange={(v) => row.toggleSelected(!!v)}
                  aria-label={doc.originalName}
                />
              )}
              <button
                type="button"
                data-token={row.id}
                aria-current={isActive || undefined}
                onClick={() => onActiveChange(row.id)}
                className="focus-visible:ring-ring flex min-w-0 flex-1 items-center gap-2.5 rounded-sm py-2 text-left outline-none focus-visible:ring-2"
              >
                <DocumentThumb
                  doc={doc}
                  className="size-9 shrink-0 rounded"
                  iconClassName="size-4"
                />
                <span className="flex min-w-0 flex-col">
                  <span
                    className={cn(
                      "truncate text-xs",
                      isActive ? "font-semibold" : "font-medium",
                    )}
                  >
                    {doc.originalName}
                  </span>
                  <span className="text-muted-foreground text-micro truncate tabular-nums">
                    {formatFileSize(doc.size)}
                    {at ? ` · ${formatDate(at, dateFormat)}` : ""}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
        {footer && <li>{footer}</li>}
      </ul>

      <PreviewPane
        key={active.fileToken}
        doc={active}
        onDelete={onDelete}
        deleteDisabled={deleteDisabled}
        deleteDisabledTitle={deleteDisabledTitle}
        canDelete={selectable}
      />
    </div>
  );
}

interface PreviewPaneProps {
  readonly doc: DocumentFile;
  readonly onDelete: (doc: DocumentFile) => void;
  readonly canDelete: boolean;
  readonly deleteDisabled?: boolean;
  readonly deleteDisabledTitle?: string;
}

function PreviewPane({
  doc,
  onDelete,
  canDelete,
  deleteDisabled,
  deleteDisabledTitle,
}: PreviewPaneProps) {
  const t = useTranslations("systemAdmin.document");
  const tfl = useTranslations("field");
  const { dateFormat } = useProfile();
  const kind = getPreviewKind(doc.contentType);
  const { data: blob, isLoading, isError } = useDocumentBlob(doc.fileToken);
  // blob URL ได้ origin ของแอป — ถ้าไฟล์ที่ registry บอกว่าเป็น PDF จริง ๆ แล้วเป็น HTML แล้วเปิดใน
  // iframe ตามชนิดที่ server ส่งมา สคริปต์ในไฟล์จะรันบน origin เรา (XSS) จึงห่อใหม่เป็น
  // application/pdf เสมอ: เบราว์เซอร์เปิดได้แค่ตัวแสดง PDF ไม่ตีความเป็นหน้าเว็บ
  // (sandbox="" ใช้ไม่ได้ — Chrome ไม่เปิดตัวแสดง PDF ใน frame ที่ sandbox)
  // รูปแสดงผ่าน <img> ซึ่งไม่รันสคริปต์ (รวม SVG) ส่วนข้อความอ่านด้วย blob.text() ลง <pre>
  const safeBlob = useMemo(
    () =>
      blob && kind === "pdf"
        ? new Blob([blob], { type: "application/pdf" })
        : blob,
    [blob, kind],
  );
  const url = useObjectUrl(safeBlob);
  const {
    icon: Icon,
    labelKey,
    className: iconColor,
  } = getFileTypeInfo(doc.contentType);
  const at = doc.audit?.created?.at ?? doc.lastModified;

  const download = () => {
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = doc.originalName;
    a.click();
  };

  return (
    <section className="flex min-h-0 flex-col" aria-label={doc.originalName}>
      <div className="bg-muted/40 relative flex min-h-0 flex-1 items-center justify-center overflow-hidden">
        {isLoading ? (
          <Loader2 className="text-muted-foreground size-6 animate-spin" />
        ) : isError || !url || kind === "none" ? (
          <div className="flex flex-col items-center gap-2 px-6 text-center">
            <Icon className={cn("size-14", iconColor)} aria-hidden="true" />
            <p className="text-muted-foreground text-xs">
              {isError ? t("preview.failed") : t("preview.unavailable")}
            </p>
          </div>
        ) : kind === "image" ? (
          <img
            src={url}
            alt={doc.originalName}
            className="max-h-full max-w-full object-contain p-4"
          />
        ) : kind === "pdf" ? (
          <iframe
            src={url}
            title={doc.originalName}
            // PDF viewer ของเบราว์เซอร์ออกแบบมาบนพื้นขาว — วางบนพื้นสว่างเสมอทั้งสองธีม
            className="size-full bg-white"
          />
        ) : (
          <TextPreview blob={blob!} />
        )}
      </div>

      <div className="flex flex-col gap-3 border-t p-4">
        <div className="flex items-start justify-between gap-3">
          <h2
            className="min-w-0 text-sm font-semibold break-all"
            title={doc.originalName}
          >
            {doc.originalName}
          </h2>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={download}
              disabled={!url}
            >
              <Download />
              {t("preview.download")}
            </Button>
            {canDelete && (
              <Button
                size="sm"
                variant="outline"
                className="text-destructive"
                onClick={() => onDelete(doc)}
                disabled={deleteDisabled || !!doc.delete_blocked}
                title={
                  doc.delete_blocked
                    ? t("deleteBlocked")
                    : deleteDisabled
                      ? deleteDisabledTitle
                      : undefined
                }
              >
                <Trash2 />
                {t("preview.delete")}
              </Button>
            )}
          </div>
        </div>
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-6 gap-y-1.5 text-xs sm:grid-cols-[auto_minmax(0,1fr)_auto_minmax(0,1fr)]">
          <dt className="text-muted-foreground">{tfl("type")}</dt>
          <dd>{t(labelKey)}</dd>
          <dt className="text-muted-foreground">{tfl("size")}</dt>
          <dd className="tabular-nums">{formatFileSize(doc.size)}</dd>
          <dt className="text-muted-foreground">{t("attachedFrom")}</dt>
          <dd className="min-w-0">
            <DocumentReference doc={doc} className="max-w-full" />
          </dd>
          {!!doc.usages?.length && (
            <>
              <dt className="text-muted-foreground">{t("usedIn")}</dt>
              <dd className="min-w-0">
                <DocumentUsageList usages={doc.usages} />
              </dd>
            </>
          )}
          <dt className="text-muted-foreground">{t("uploadedBy")}</dt>
          <dd className="truncate">{doc.audit?.created?.name || "—"}</dd>
          <dt className="text-muted-foreground">{t("uploadedAt")}</dt>
          <dd className="tabular-nums">
            {at ? formatDate(at, dateFormat) : "—"}
          </dd>
        </dl>
      </div>
    </section>
  );
}

function TextPreview({ blob }: { readonly blob: Blob }) {
  const t = useTranslations("systemAdmin.document");
  const [text, setText] = useState<string>();
  useEffect(() => {
    let alive = true;
    blob.text().then((v) => alive && setText(v));
    return () => {
      alive = false;
    };
  }, [blob]);

  if (text === undefined)
    return <Loader2 className="text-muted-foreground size-6 animate-spin" />;
  const cut = text.length > TEXT_PREVIEW_MAX_CHARS;
  return (
    <div className="bg-background size-full overflow-auto">
      <pre className="p-4 font-mono text-xs leading-relaxed break-all whitespace-pre-wrap">
        {cut ? text.slice(0, TEXT_PREVIEW_MAX_CHARS) : text}
      </pre>
      {cut && (
        <p className="text-muted-foreground border-t px-4 py-2 text-xs">
          {t("preview.truncated")}
        </p>
      )}
    </div>
  );
}
