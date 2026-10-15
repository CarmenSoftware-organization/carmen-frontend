import { useProfile } from "@/hooks/use-profile";
import { useAttachmentPolicy } from "@/hooks/use-attachment-policy";
import { CommentSheet } from "@/components/ui/comment-sheet";
import type { createCommentCrud } from "@/hooks/use-comment-crud";

type CommentCrud = ReturnType<typeof createCommentCrud>;

interface EntityCommentSheetProps {
  readonly crud: CommentCrud;
  readonly entityId: string | undefined;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}

/**
 * แผง comment ของเอกสารหนึ่งใบ — ใช้ร่วมกันทุกโมดูลที่มี comment
 * (PR · PO · GRN · CN · SR)
 *
 * เดิมแต่ละโมดูลมีไฟล์ของตัวเองไฟล์ละ ~60 บรรทัดที่ต่างกันแค่ชื่อ hook ที่เรียก
 * กับชื่อ prop id — เวลาแก้พฤติกรรมของแผง comment ต้องไล่แก้ห้าที่แล้วมักลืมสักที่
 *
 * ดึง comment เฉพาะตอนเปิดจริง (`open ? entityId : undefined`) — คนส่วนใหญ่เปิดใบมา
 * แล้วไม่กดดู ไม่ต้องจ่ายค่า request · เปิดแล้วโหลดทีละหน้า (ใหม่ → เก่า) ตอนเลื่อนถึงท้าย
 *
 * @example
 * <EntityCommentSheet crud={prCommentCrud} entityId={prId} open={open} onOpenChange={setOpen} />
 */
export function EntityCommentSheet({
  crud,
  entityId,
  open,
  onOpenChange,
}: EntityCommentSheetProps) {
  const { data: profile, dateFormat } = useProfile();
  const attachmentPolicy = useAttachmentPolicy();

  const {
    comments,
    total,
    isLoading,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = crud.useComments(open ? entityId : undefined);
  const createComment = crud.useCreate();
  const updateComment = crud.useUpdate();
  const deleteComment = crud.useDelete();

  return (
    <CommentSheet
      open={open}
      onOpenChange={onOpenChange}
      comments={comments}
      isLoading={isLoading}
      total={total}
      hasMore={hasNextPage}
      isFetchingMore={isFetchingNextPage}
      onLoadMore={fetchNextPage}
      currentUserId={profile?.id}
      dateFormat={dateFormat}
      directFileUpload
      attachmentPolicy={attachmentPolicy}
      onSubmit={async (data) => {
        if (!entityId) return;
        await createComment.mutateAsync({
          [crud.idFieldName]: entityId,
          message: data.message,
          type: "user",
          files: data.files,
        });
      }}
      isSubmitting={createComment.isPending}
      onUpdate={async (data) => {
        await updateComment.mutateAsync({
          id: data.id,
          message: data.message,
          attachments: data.attachments,
        });
      }}
      isUpdating={updateComment.isPending}
      onDelete={async (id) => {
        await deleteComment.mutateAsync(id);
      }}
      isDeleting={deleteComment.isPending}
    />
  );
}
