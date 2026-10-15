import { z } from "zod";
import {
  CONSUMERS_TENANT,
  SECRET_MASK,
  authTypeOf,
  type EmailProfile,
  type EmailProfileAuthType,
} from "@/types/email-profile";

export const emailProfileSchema = z
  .object({
    name: z.string().min(1),
    enabled: z.boolean(),
    smtp_auth_type: z.enum(["password", "oauth2_delegated", "oauth2_app"]),
    smtp_host: z.string().min(1),
    smtp_port: z.coerce.number().int().min(1).max(65535),
    smtp_secure: z.boolean(),
    smtp_username: z.string().min(1),
    smtp_password: z.string(),
    oauth_tenant_id: z.string(),
    oauth_client_id: z.string(),
    oauth_client_secret: z.string(),
    from_email: z.string().email(),
    from_name: z.string(),
  })
  .superRefine((v, ctx) => {
    const required = (path: keyof typeof v) =>
      ctx.addIssue({ code: "custom", path: [path], message: "Required" });
    if (v.smtp_auth_type === "password" && !v.smtp_password)
      required("smtp_password");
    if (v.smtp_auth_type !== "password" && !v.oauth_client_id.trim())
      required("oauth_client_id");
    if (v.smtp_auth_type === "oauth2_app") {
      if (!v.oauth_tenant_id.trim()) required("oauth_tenant_id");
      if (!v.oauth_client_secret) required("oauth_client_secret");
    }
  });

export type EmailProfileFormValues = z.infer<typeof emailProfileSchema>;

export const EMPTY_EMAIL_PROFILE_FORM: EmailProfileFormValues = {
  name: "",
  enabled: true,
  smtp_auth_type: "password",
  smtp_host: "",
  smtp_port: 587,
  smtp_secure: true,
  smtp_username: "",
  smtp_password: "",
  oauth_tenant_id: "",
  oauth_client_id: "",
  oauth_client_secret: "",
  from_email: "",
  from_name: "",
};

/**
 * คืนค่าเริ่มต้นของฟอร์มจากโปรไฟล์ที่มีอยู่ (หรือฟอร์มเปล่าถ้าเป็นโปรไฟล์ใหม่)
 *
 * โปรไฟล์เดิมเติมช่องรหัสผ่านด้วย `SECRET_MASK` (ไม่ใช่รหัสผ่านจริง — backend คืนค่านี้
 * เสมอ) ถ้าผู้ใช้ไม่แตะช่องนี้ ค่าที่ submit กลับไปคือ mask ตัวเดิม ซึ่ง backend จะแปลว่า
 * "ไม่เปลี่ยนรหัสผ่าน" แล้วคืนรหัสผ่านเดิมกลับมาเอง (ดู Task B1 Step 2)
 *
 * โปรไฟล์ OAuth2 ไม่มีรหัสผ่านให้คืน ช่องรหัสผ่านจึงว่าง; `client_secret` (แบบ oauth2_app)
 * ใช้ mask หลักการเดียวกัน; `refresh_token` / `connected_*` ไม่เข้าฟอร์ม
 *
 * @param profile - โปรไฟล์ที่จะแก้ไข หรือ undefined สำหรับโปรไฟล์ใหม่
 * @returns ค่าเริ่มต้นของฟอร์ม
 */
export function toEmailProfileFormValues(
  profile?: EmailProfile,
): EmailProfileFormValues {
  if (!profile) return { ...EMPTY_EMAIL_PROFILE_FORM };
  const type = authTypeOf(profile);
  const oauth = profile.smtp.oauth;
  return {
    name: profile.name,
    enabled: profile.enabled,
    smtp_auth_type: type,
    smtp_host: profile.smtp.host,
    smtp_port: profile.smtp.port,
    smtp_secure: profile.smtp.secure,
    smtp_username: profile.smtp.username,
    // mask = "ใช้ของเดิม" เฉพาะเมื่อมีของเดิมจริง — โปรไฟล์ OAuth ไม่มีรหัสผ่านให้คืน
    smtp_password: type === "password" ? SECRET_MASK : "",
    oauth_tenant_id: oauth?.tenant_id ?? "",
    oauth_client_id: oauth?.client_id ?? "",
    oauth_client_secret:
      type === "oauth2_app" && oauth?.client_secret ? SECRET_MASK : "",
    from_email: profile.from_email,
    from_name: profile.from_name,
  };
}

/**
 * แปลงค่าฟอร์มกลับเป็น `EmailProfile` หนึ่งรายการ
 *
 * โปรไฟล์ใหม่ (ไม่มี `existing`) สร้าง `id` ด้วย `crypto.randomUUID()` ตอนกดบันทึก
 * โปรไฟล์เดิมคง `id` เดิมไว้เสมอ — ตัวเรียก (หน้า list) เป็นคนเอาค่านี้ไปประกอบกับ
 * `profiles[]` ทั้งชุดก่อนส่ง ไม่ใช่หน้าที่ของฟังก์ชันนี้
 *
 * @param values - ค่าจากฟอร์ม
 * @param existing - โปรไฟล์เดิมที่กำลังแก้ไข (ไม่ใส่ = สร้างใหม่)
 * @returns `EmailProfile` ที่พร้อมประกอบเข้า `profiles[]`
 */
export function fromEmailProfileFormValues(
  values: EmailProfileFormValues,
  existing?: EmailProfile,
): EmailProfile {
  const type: EmailProfileAuthType = values.smtp_auth_type;
  return {
    id: existing?.id ?? crypto.randomUUID(),
    name: values.name,
    enabled: values.enabled,
    smtp: {
      host: values.smtp_host,
      port: values.smtp_port,
      secure: values.smtp_secure,
      username: values.smtp_username.trim(),
      auth_type: type,
      ...(type === "password" ? { password: values.smtp_password } : {}),
      ...(type === "password"
        ? {}
        : {
            // refresh_token / connected_* ไม่ส่ง — backend คงของเดิมเอง (หรือล้างถ้าตัวตนเปลี่ยน)
            oauth: {
              tenant_id:
                type === "oauth2_delegated"
                  ? CONSUMERS_TENANT
                  : values.oauth_tenant_id.trim(),
              client_id: values.oauth_client_id.trim(),
              ...(type === "oauth2_app"
                ? { client_secret: values.oauth_client_secret }
                : {}),
            },
          }),
    },
    from_email: values.from_email,
    from_name: values.from_name,
  };
}
