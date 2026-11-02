export interface LiveAttachment {
  size: number;
  fileUrl: string;
  fileName: string;
  fileToken: string;
  contentType: string;
  deleted?: false;
}

/**
 * ไฟล์ที่ถูกลบ — gateway ฉายเหลือแค่ 4 ฟิลด์นี้ (ไม่มี fileName/fileToken/fileUrl)
 * ห้ามแตะ `.fileToken` / `.fileName` ก่อนผ่าน `isDeletedAttachment`
 */
export interface DeletedAttachment {
  deleted: true;
  deleted_at: string;
  deleted_by_id: string | null;
  contentType?: string;
}

export type CommentAttachment = LiveAttachment | DeletedAttachment;

export function isDeletedAttachment(
  a: CommentAttachment,
): a is DeletedAttachment {
  return a.deleted === true;
}
