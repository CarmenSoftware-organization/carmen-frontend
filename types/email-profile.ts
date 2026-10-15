export type EmailProfileAuthType = "password" | "oauth2_delegated" | "oauth2_app";

/** App registration ใน Microsoft Entra ของลูกค้า — `refresh_token` / `connected_*` backend เขียนเอง */
export interface EmailProfileOAuth {
  tenant_id: string;
  client_id: string;
  client_secret?: string;
  refresh_token?: string;
  connected_account?: string;
  connected_at?: string;
}

export interface EmailProfile {
  id: string;
  name: string;
  enabled: boolean;
  smtp: {
    host: string;
    port: number;
    secure: boolean;
    username: string;
    /** ไม่มี = "password" (โปรไฟล์ที่บันทึกก่อนมีฟิลด์นี้) */
    auth_type?: EmailProfileAuthType;
    password?: string;
    oauth?: EmailProfileOAuth;
  };
  from_email: string;
  from_name: string;
}

export interface EmailProfilesValue {
  default_profile_id: string | null;
  profiles: EmailProfile[];
}

export const SECRET_MASK = "***ENCRYPTED***";

export const EMAIL_PROFILES_CONFIG_KEY = "email_profiles";

/** Hotmail ส่วนตัว — Microsoft บังคับ tenant นี้สำหรับ personal account */
export const CONSUMERS_TENANT = "consumers";

/** host/port ของ Microsoft — ทั้งคู่เป็น STARTTLS จึงต้อง `secure: false` */
export const MICROSOFT_PRESETS = {
  oauth2_delegated: { host: "smtp-mail.outlook.com", port: 587 },
  oauth2_app: { host: "smtp.office365.com", port: 587 },
} as const;

export function authTypeOf(profile: EmailProfile): EmailProfileAuthType {
  return profile.smtp.auth_type ?? "password";
}

export function isOAuthConnected(profile: EmailProfile): boolean {
  return !!profile.smtp.oauth?.connected_at;
}

export interface DeviceLoginStart {
  user_code: string;
  verification_uri: string;
  interval: number;
  expires_in: number;
  handle: string;
}

export interface DeviceLoginPoll {
  status: "pending" | "slow_down" | "connected" | "expired" | "denied" | "error";
  account?: string;
  message?: string;
}
