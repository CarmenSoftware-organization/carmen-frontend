import { useTranslations } from "use-intl";
import { toast } from "sonner";
import {
  isDeletedAttachment,
  type LiveAttachment,
} from "@/components/ui/comment-attachment";
import {
  EntryNotesDialog,
  resolveServerImageUrl,
  type SavedNotePayload,
  type ServerEvidenceImage,
} from "../shared/entry-notes-dialog";
import { useErrorToast } from "@/hooks/use-error-toast";
import {
  usePhysicalCountDetailComments,
  useSavePhysicalCountProductNote,
} from "../shared/use-physical-count";

export type {
  SavedEvidenceImage,
  SavedNotePayload,
} from "../shared/entry-notes-dialog";

interface PcEntryNotesDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly productName: string;
  readonly itemId: string;
  readonly onSaved?: (payload: SavedNotePayload) => void;
}

export function PcEntryNotesDialog({
  open,
  onOpenChange,
  productName,
  itemId,
  onSaved,
}: PcEntryNotesDialogProps) {
  const t = useTranslations("inventoryManagement.entryDialogs");
  const errorToast = useErrorToast();
  const { data: existingComments, isLoading: isLoadingComments } =
    usePhysicalCountDetailComments(open ? itemId : undefined);
  const saveNote = useSavePhysicalCountProductNote(itemId);

  // Derive defaults — note ใช้ message ของ comment ล่าสุด, images flatten จากทุก comment
  const latest = existingComments?.[existingComments.length - 1];
  const defaultNote = latest?.message ?? "";
  const defaultServerImages: ServerEvidenceImage[] = (existingComments ?? [])
    .flatMap((c) => c.attachments)
    // tombstone (ไฟล์ถูกลบ) ไม่มี fileToken/fileName — ไม่แสดงเป็นรูป
    .filter(
      (a): a is LiveAttachment =>
        !isDeletedAttachment(a) && a.contentType.startsWith("image/"),
    )
    .map((a) => ({
      id: a.fileToken,
      url: resolveServerImageUrl(a.fileUrl, a.fileToken, a.fileName),
      name: a.fileName,
      size: a.size,
    }))
    .filter((a) => a.url);

  // Remount เมื่อเปิด/data ใหม่ เพื่อให้ shared dialog initialize state ด้วย default ใหม่
  const formKey = `${itemId}-${existingComments?.length ?? 0}-${latest?.id ?? "empty"}-${open ? "open" : "closed"}`;

  return (
    <EntryNotesDialog
      key={formKey}
      open={open}
      onOpenChange={onOpenChange}
      productName={productName}
      defaultNote={defaultNote}
      defaultServerImages={defaultServerImages}
      isLoadingComments={isLoadingComments}
      isSaving={saveNote.isPending}
      onSave={({ note, files, previews }) => {
        saveNote.mutate(
          { message: note, type: "user", files },
          {
            onSuccess: () => {
              toast.success(t("saveNote"));
              onSaved?.({ note, images: previews });
            },
            onError: (err) => {
              errorToast(err);
              // โอน preview ให้ row ดูได้แม้ API ล้มเหลว (UX consistency)
              onSaved?.({ note, images: previews });
            },
          },
        );
      }}
    />
  );
}
