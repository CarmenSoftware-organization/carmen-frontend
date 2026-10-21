/**
 * ช่องทางส่งการแจ้งเตือน
 *
 * ค่าทั้งสี่มีอยู่จริงใน DB มาตั้งแต่ seed (app/email/line/sms อย่างละ 20 รายการ)
 * เดิมประกาศไว้แค่ `"app"` ทำให้เปิดเทมเพลตช่องทางอื่นแล้วช่อง Channel ว่างเปล่า
 * และกด Save ไม่ผ่าน validation — อย่าหดกลับเป็นค่าเดียวอีก
 */
export type NotificationTemplateType = "app" | "email" | "line" | "sms";

export interface NotificationTemplate {
  id: string;
  doc_version?: number;
  name: string;
  /** รหัสเทมเพลตของระบบ (เช่น wf.approve.next_step) — null = เทมเพลตที่ผู้ใช้สร้างเอง */
  code?: string | null;
  type: NotificationTemplateType;
  subject: string | null;
  body: string;
  description: string;
  is_active: boolean;
}

export interface CreateNotificationTemplateDto {
  doc_version?: number;
  name: string;
  type: NotificationTemplateType;
  subject?: string | null;
  body: string;
  description?: string;
  is_active?: boolean;
}
