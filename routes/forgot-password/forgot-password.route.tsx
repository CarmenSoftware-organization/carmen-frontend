import { useState } from "react";
import { RedirectIfAuthed } from "@/components/auth/redirect-if-authed";
import CheckInbox from "@/components/auth/check-inbox";
import { forgotPassword } from "@/lib/auth/auth-api";
import ForgotPasswordForm from "./forgot-password-form";

/**
 * หน้า `/forgot-password` ขั้นที่หนึ่ง — กรอกอีเมลเพื่อขอลิงก์ตั้งรหัสผ่านใหม่
 *
 * ผู้ใช้จะตั้งรหัสจริงที่ `/reset-password?token=...` หลังกดลิงก์ในอีเมล ปลายทางของลิงก์นั้นมาจาก
 * Backstage config คีย์ `password_reset.base_url` ไม่ได้ถูกกำหนดจากฝั่งนี้ — ถ้าค่านั้นไม่ได้ชี้มาที่
 * `/reset-password` ของแอปนี้ ลิงก์ในอีเมลจะพาไปที่อื่นทั้งที่หน้าจอทั้งสองฝั่งทำงานถูกต้อง
 *
 * public เหมือน `/login` และครอบด้วย `RedirectIfAuthed` — คนที่ล็อกอินอยู่แล้วเปลี่ยนรหัสผ่าน
 * ได้จากหน้าโปรไฟล์ ซึ่งปลอดภัยกว่าเพราะไม่ต้องส่งอะไรผ่านอีเมล
 */
export function Component() {
  const [sentTo, setSentTo] = useState<string | null>(null);

  return (
    <RedirectIfAuthed>
      {sentTo ? (
        <CheckInbox
          email={sentTo}
          namespace="auth.forgotPassword"
          onResend={forgotPassword}
        />
      ) : (
        <ForgotPasswordForm onSent={setSentTo} />
      )}
    </RedirectIfAuthed>
  );
}
