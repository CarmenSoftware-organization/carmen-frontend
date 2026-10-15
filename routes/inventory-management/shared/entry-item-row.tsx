import { memo, useState, type ComponentType } from "react";
import {
  Calculator,
  ImageIcon,
  MessageSquarePlus,
  MessageSquareText,
} from "lucide-react";
import { useTranslations } from "use-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { SavedNotePayload } from "./entry-notes-dialog";
interface NotesDialogComponentProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly productName: string;
  readonly itemId: string;
  readonly onSaved?: (payload: SavedNotePayload) => void;
}
export interface EntryItemRowProps {
  readonly id: string;
  readonly index: number;
  readonly productId: string;
  readonly productName: string;
  readonly productSku: string;
  readonly inventoryUnitName: string;
  readonly committedQty: number | null;
  readonly isCounted: boolean;
  readonly onCommit: (id: string, value: number | null) => void;
  readonly onOpenCalc: (item: {
    id: string;
    productId: string;
    name: string;
    unit: string;
  }) => void;
  /** Enter ในช่องนับ → ไปช่องของรายการถัดไป (ไม่ส่ง = Enter แค่ blur) */
  readonly onAdvance?: (id: string) => void;
  readonly sequenceNo?: number;
  readonly productCode?: string;
  readonly productLocalName?: string;
  readonly commitOnChange?: boolean;
  readonly NotesDialog: ComponentType<NotesDialogComponentProps>;
  readonly translationNamespace: string;
}

/**
 * ความกว้างคอลัมน์ใช้ร่วมกับ EntrySheetHeader — แก้ที่เดียวให้หัวตรงกับแถว
 * จอแคบ (<sm) แถวตัดเป็นสองบรรทัด: ชื่อเต็มบรรทัดบน · โน้ต/ช่องนับ/หน่วยบรรทัดล่าง
 */
export const ENTRY_COL = {
  seq: "hidden w-8 shrink-0 text-right sm:block",
  name: "min-w-0 basis-full sm:basis-0 sm:flex-1",
  notes: "w-8 shrink-0",
  qty: "min-w-0 flex-1 sm:w-40 sm:flex-none",
  unit: "w-12 shrink-0 sm:w-14",
} as const;

export const EntryItemRow = memo(function EntryItemRow({
  id,
  index,
  productId,
  productName,
  productSku,
  inventoryUnitName,
  committedQty,
  isCounted,
  onCommit,
  onOpenCalc,
  onAdvance,
  sequenceNo,
  productCode,
  productLocalName,
  commitOnChange = false,
  NotesDialog,
  translationNamespace,
}: EntryItemRowProps) {
  const t = useTranslations(translationNamespace);
  const [isFocused, setIsFocused] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [savedNote, setSavedNote] = useState<SavedNotePayload | null>(null);
  const [draft, setDraft] = useState<string>(
    committedQty == null ? "" : String(committedQty),
  );
  // Sync draft จาก parent เฉพาะตอนไม่ได้ focus เพื่อไม่กวนการพิมพ์
  const [lastCommitted, setLastCommitted] = useState(committedQty);
  if (committedQty !== lastCommitted) {
    setLastCommitted(committedQty);
    if (!isFocused) {
      setDraft(committedQty == null ? "" : String(committedQty));
    }
  }

  const parseValue = (raw: string): number | null =>
    raw === "" ? null : Math.max(0, Number.parseFloat(raw) || 0);

  const commit = () => {
    const value = parseValue(draft);
    if (value !== committedQty) onCommit(id, value);
  };

  // บรรทัดรอง: code · SKU · ชื่อท้องถิ่น — ตัดตัวที่ซ้ำกันทิ้ง
  const metaParts = [
    productCode,
    productSku && productSku !== productCode
      ? t("sku", { code: productSku })
      : null,
    productLocalName && productLocalName !== productName
      ? productLocalName
      : null,
  ].filter(Boolean);

  const hasNote =
    !!savedNote && (savedNote.note.length > 0 || savedNote.images.length > 0);

  return (
    <div
      className={cn(
        "hover:bg-muted/40 focus-within:bg-primary/5 relative flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b py-2 pr-3 pl-4 transition-colors sm:flex-nowrap",
      )}
    >
      {/* แถบซ้าย = นับแล้ว — สีเดียวกับแถบสรุปและหน้า list */}
      <span
        className={cn(
          "absolute inset-y-0 left-0 w-1 transition-colors",
          isCounted ? "bg-success" : "bg-transparent",
        )}
        aria-hidden="true"
      />

      <span
        className={cn(
          ENTRY_COL.seq,
          "text-muted-foreground text-micro tabular-nums",
        )}
      >
        {sequenceNo ?? index + 1}
      </span>

      <div className={ENTRY_COL.name}>
        <p className="text-foreground truncate text-sm leading-snug font-medium">
          {productName}
          {isCounted && <span className="sr-only"> — {t("counted")}</span>}
        </p>
        {metaParts.length > 0 && (
          <p className="text-muted-foreground text-micro-legal truncate tracking-wide uppercase">
            {metaParts.join(" · ")}
          </p>
        )}
        {hasNote && (
          <button
            type="button"
            onClick={() => setNotesOpen(true)}
            className="text-primary text-micro mt-0.5 flex max-w-full items-center gap-1 text-left hover:underline"
          >
            {savedNote.note.length > 0 && (
              <span className="truncate">{savedNote.note}</span>
            )}
            {savedNote.images.length > 0 && (
              <span className="inline-flex shrink-0 items-center gap-0.5 font-medium">
                <ImageIcon className="size-3" aria-hidden="true" />
                {t("evidenceCount", { count: savedNote.images.length })}
              </span>
            )}
          </button>
        )}
      </div>

      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={() => setNotesOpen(true)}
        aria-label={t("addNotes")}
        title={t("addNotes")}
        className={cn(
          ENTRY_COL.notes,
          hasNote ? "text-primary" : "text-muted-foreground",
        )}
      >
        {hasNote ? (
          <MessageSquareText className="size-4" />
        ) : (
          <MessageSquarePlus className="size-4" />
        )}
      </Button>

      <div className={cn(ENTRY_COL.qty, "flex")}>
        <Input
          type="number"
          inputMode="decimal"
          enterKeyHint={onAdvance ? "next" : "done"}
          min={0}
          step="any"
          value={draft}
          data-entry-id={id}
          aria-label={`${productName}${inventoryUnitName ? ` (${inventoryUnitName})` : ""}`}
          onFocus={(e) => {
            setIsFocused(true);
            e.target.select();
          }}
          onBlur={() => {
            setIsFocused(false);
            commit();
          }}
          onChange={(e) => {
            const newDraft = e.target.value;
            setDraft(newDraft);
            if (commitOnChange) {
              const value = parseValue(newDraft);
              if (value !== committedQty) onCommit(id, value);
            }
          }}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            if (onAdvance) onAdvance(id);
            else (e.target as HTMLInputElement).blur();
          }}
          className={cn(
            "bg-card h-8 min-w-0 flex-1 rounded-l-md rounded-r-none border pr-2 text-right text-sm tabular-nums shadow-none focus-visible:ring-0",
            isCounted
              ? "border-success/50 focus-visible:border-primary"
              : "border-border focus-visible:border-primary",
          )}
        />
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          className="bg-card h-8 w-8 shrink-0 rounded-l-none border-l-0"
          onClick={() =>
            onOpenCalc({
              id,
              productId,
              name: productName,
              unit: inventoryUnitName,
            })
          }
          aria-label={t("calculator")}
          title={t("calculator")}
        >
          <Calculator className="size-3.5" />
        </Button>
      </div>

      <span
        className={cn(
          ENTRY_COL.unit,
          "text-muted-foreground text-micro truncate uppercase",
        )}
        title={inventoryUnitName}
      >
        {inventoryUnitName}
      </span>

      <NotesDialog
        open={notesOpen}
        onOpenChange={setNotesOpen}
        productName={productName}
        itemId={id}
        onSaved={(payload) => setSavedNote(payload)}
      />
    </div>
  );
});
