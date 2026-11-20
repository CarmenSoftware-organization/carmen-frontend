import { ApiError, ERROR_CODES } from "@/lib/api-error";
import { getRuntimeConfig } from "@/lib/runtime-config";
import { authReachabilityStore } from "./auth-reachability-store";
import { refreshTokenStorage } from "./refresh-token-storage";
import { tokenStore } from "./token-store";


interface LoginResult {
  platform_role?: string;
}

const authHeaders = (): Record<string, string> => ({
  "Content-Type": "application/json",
  "x-app-id": getRuntimeConfig().X_APP_ID,
});

export async function login(
  email: string,
  password: string,
): Promise<LoginResult> {
  const { BACKEND_URL } = getRuntimeConfig();
  let res: Response;
  try {
    res = await fetch(`${BACKEND_URL}/api/auth/login`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ email, password }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new ApiError(
      ERROR_CODES.NETWORK_ERROR,
      "Auth server unavailable",
      undefined,
      true,
    );
  }

  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    const retryAfter: number | undefined =
      typeof json?.retry_after === "number"
        ? json.retry_after
        : (() => {
            const h = res.headers.get("Retry-After");
            const n = h !== null ? Number(h) : NaN;
            return isNaN(n) ? undefined : n;
          })();
    throw new ApiError(
      res.status === 401
        ? ERROR_CODES.UNAUTHORIZED
        : res.status === 429
          ? ERROR_CODES.RATE_LIMITED
          : ERROR_CODES.INTERNAL_ERROR,
      json?.message ?? "Login failed",
      res.status,
      false,
      retryAfter !== undefined ? { retryAfter } : undefined,
      undefined,
      // `error.code` เช่น APP_DISABLED — หน้า login ต้องบอกว่าแอปถูกปิด ไม่ใช่รหัสผ่านผิด
      typeof json?.error?.code === "string" ? json.error.code : undefined,
    );
  }

  const { access_token, refresh_token, platform_role } = json?.data ?? {};
  if (!access_token || !refresh_token) {
    throw new ApiError(
      ERROR_CODES.INTERNAL_ERROR,
      "Invalid login response from backend",
      502,
    );
  }

  tokenStore.set(access_token);
  refreshTokenStorage.set(refresh_token);
  return { platform_role };
}

export interface UserInfo {
  first_name: string;
  middle_name?: string;
  last_name: string;
  telephone?: string;
}

export interface RegisterPayload {
  token: string;
  password: string;
  user_info: UserInfo;
}

/**
 * แปลง error response ของ auth endpoint สาธารณะเป็น ApiError
 * gateway คืน message เป็น array เมื่อ zod ไม่ผ่าน (string เมื่อเป็น error อื่น) — รวมเป็นบรรทัดเดียว
 * ไม่งั้น UI ได้ข้อความคั่นด้วยจุลภาคติดกันพรืด
 * @param res - response ที่ไม่ ok
 * @param fallback - ข้อความเมื่อ backend ไม่ส่ง message มา
 * @param parsed - body ที่ parse ไว้แล้ว (ส่งมาเมื่อผู้เรียกอ่าน body ไปก่อนแล้ว body อ่านซ้ำไม่ได้)
 */
async function toAuthApiError(
  res: Response,
  fallback: string,
  parsed?: unknown,
): Promise<ApiError> {
  const json = (parsed ?? (await res.json().catch(() => ({})))) as {
    message?: string | string[];
    retry_after?: number;
    code?: string;
  };
  const message: string = Array.isArray(json?.message)
    ? json.message.join(" · ")
    : (json?.message ?? fallback);
  const retryAfter: number | undefined =
    typeof json?.retry_after === "number" ? json.retry_after : undefined;
  // code ของ error catalog — สถานะ HTTP เดียวกันมีได้หลายความหมายและคำแนะนำคนละทาง เช่น 409 จาก
  // `register` เป็นได้ทั้ง AUTH_EMAIL_ALREADY_EXISTS (เข้าสู่ระบบได้) และ AUTH_USERNAME_ALREADY_EXISTS
  // (เข้าสู่ระบบไม่ได้ บัญชีที่ชนเป็นของคนอื่น) การทิ้งฟิลด์นี้ทำให้หน้าจอแยกสองกรณีไม่ได้เลยและต้อง
  // เดาว่าเป็นกรณีที่พบบ่อยกว่า ซึ่งคือคำแนะนำที่ผิดสำหรับอีกกรณีหนึ่งเสมอ
  const serverCode: string | undefined =
    typeof json?.code === "string" ? json.code : undefined;
  const details =
    retryAfter !== undefined || serverCode !== undefined
      ? {
          ...(retryAfter !== undefined ? { retryAfter } : {}),
          ...(serverCode ? { serverCode } : {}),
        }
      : undefined;
  // 410 (ลิงก์ใช้ไม่ได้) กับ 409 (มีบัญชีแล้ว) ใช้ code เดียวกัน หน้าจอแยกสองกรณีนี้ด้วย
  // `error.status` ไม่ใช่ด้วย code
  const code =
    res.status === 400 || res.status === 409 || res.status === 410
      ? ERROR_CODES.VALIDATION_ERROR
      : res.status === 429
        ? ERROR_CODES.RATE_LIMITED
        : ERROR_CODES.INTERNAL_ERROR;
  return new ApiError(
    code,
    message,
    res.status,
    false,
    details,
    // เก็บเป็น serverMessage เฉพาะเมื่อ backend ส่งมาจริง — `fallback` เป็นข้อความของ dev
    // (ภาษาอังกฤษ ไม่แปล) ที่ห้ามหลุดไปโชว์ user ในฐานะคำอธิบายจาก backend
    json?.message !== undefined ? message : undefined,
  );
}

/**
 * ขอลิงก์ยืนยันอีเมลเพื่อสมัคร — POST /api/auth/signup-request (public)
 * backend ตอบ 200 เสมอ ไม่ว่าอีเมลนั้นจะมีบัญชีอยู่แล้วหรือไม่ เพื่อไม่ให้ใครใช้ endpoint นี้
 * ค้นว่าใครสมัครไว้แล้ว จึงห้ามตีความ 200 ว่า "อีเมลนี้ว่าง" และห้ามแสดงข้อความที่บอกเป็นนัยแบบนั้น
 */
export async function signupRequest(email: string): Promise<void> {
  const { BACKEND_URL } = getRuntimeConfig();
  let res: Response;
  try {
    res = await fetch(`${BACKEND_URL}/api/auth/signup-request`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ email }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new ApiError(
      ERROR_CODES.NETWORK_ERROR,
      "Auth server unavailable",
      undefined,
      true,
    );
  }
  if (res.ok) return;
  throw await toAuthApiError(res, "Could not send the verification link");
}

/**
 * ตรวจลิงก์ก่อนแสดงฟอร์มสมัคร — POST /api/auth/signup-token/verify (public)
 * 410 แปลว่าลิงก์ไม่มีจริง หมดอายุ หรือถูกใช้ไปแล้ว โดยแยกสามกรณีนี้ไม่ได้ตั้งใจ
 */
export async function verifySignupToken(
  token: string,
): Promise<{ email: string }> {
  const { BACKEND_URL } = getRuntimeConfig();
  let res: Response;
  try {
    res = await fetch(`${BACKEND_URL}/api/auth/signup-token/verify`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ token }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new ApiError(
      ERROR_CODES.NETWORK_ERROR,
      "Auth server unavailable",
      undefined,
      true,
    );
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok)
    throw await toAuthApiError(res, "This link is no longer valid", json);
  const email: string | undefined = json?.data?.email;
  if (!email)
    throw new ApiError(
      ERROR_CODES.INTERNAL_ERROR,
      "Invalid response from backend",
      502,
    );
  return { email };
}

/**
 * สร้างบัญชีจาก token ที่ยืนยันอีเมลแล้ว — POST /api/auth/register (public)
 * backend คืน 201 เปล่า ๆ ไม่มี token กลับมา ผู้ใช้ต้องไป login ต่อเอง
 */
export async function register(payload: RegisterPayload): Promise<void> {
  const { BACKEND_URL } = getRuntimeConfig();
  let res: Response;
  try {
    res = await fetch(`${BACKEND_URL}/api/auth/register`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new ApiError(
      ERROR_CODES.NETWORK_ERROR,
      "Auth server unavailable",
      undefined,
      true,
    );
  }
  if (res.ok) return;
  throw await toAuthApiError(res, "Register failed");
}

/**
 * ขอลิงก์ตั้งรหัสผ่านใหม่ — POST /api/auth/forgot-password (public)
 *
 * **กลืน 404 ให้เท่ากับสำเร็จตั้งแต่ชั้นนี้** — backend ตอบ 404 "User not found" เมื่ออีเมลนั้น
 * ไม่มีบัญชี ซึ่งเปลี่ยนฟอร์มนี้ให้กลายเป็นเครื่องมือค้นว่าอีเมลไหนมีบัญชีในระบบ การกลืนไว้ที่นี่
 * แทนที่จะให้หน้าจอตัดสินใจเอง แปลว่าหน้าจอไหนก็เผลอแสดงให้ต่างกันไม่ได้ เทียบกับเส้นทางสมัคร
 * ที่ backend ตอบ 200 เสมออยู่แล้ว ตรงนี้เป็นการชดเชยฝั่ง client ให้ได้พฤติกรรมเดียวกัน
 *
 * หมายเหตุ: endpoint นี้ไม่มี rate limit ฝั่ง backend (ต่างจาก `signup-request`) คูลดาวน์ปุ่ม
 * "ส่งอีกครั้ง" บนหน้าจอจึงเป็นแค่ UX ไม่ใช่การป้องกันการยิงซ้ำ
 */
export async function forgotPassword(email: string): Promise<void> {
  const { BACKEND_URL } = getRuntimeConfig();
  let res: Response;
  try {
    res = await fetch(`${BACKEND_URL}/api/auth/forgot-password`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ email }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new ApiError(
      ERROR_CODES.NETWORK_ERROR,
      "Auth server unavailable",
      undefined,
      true,
    );
  }
  if (res.ok || res.status === 404) return;
  throw await toAuthApiError(res, "Could not send the reset link");
}

/**
 * ตั้งรหัสผ่านใหม่ด้วย token จากลิงก์ในอีเมล — POST /api/auth/reset-password-with-token (public)
 *
 * `token` คือรหัสสั้นใน query ของลิงก์ ไม่ใช่ JWT — ตัว JWT ถูกเก็บคู่กันไว้ฝั่ง backend และถูก
 * ตรวจอีกชั้นที่นั่น ค่านี้จึงส่งต่อไปตรง ๆ ได้โดยไม่ต้องแกะอะไร
 *
 * 400 ครอบสามกรณีรวมกัน: token ไม่มีจริง หมดอายุ หรือถูกใช้ไปแล้ว — backend ตอบเหมือนกันหมด
 * โดยตั้งใจ และหน้าจอต้องไม่พยายามเดาว่าเป็นกรณีไหน
 *
 * backend ไม่คืน access token กลับมา ผู้ใช้จึงต้องไปเข้าสู่ระบบเองหลังตั้งรหัสสำเร็จ
 */
export async function resetPasswordWithToken(
  token: string,
  newPassword: string,
): Promise<void> {
  const { BACKEND_URL } = getRuntimeConfig();
  let res: Response;
  try {
    res = await fetch(`${BACKEND_URL}/api/auth/reset-password-with-token`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ token, new_password: newPassword }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new ApiError(
      ERROR_CODES.NETWORK_ERROR,
      "Auth server unavailable",
      undefined,
      true,
    );
  }
  if (res.ok) return;
  throw await toAuthApiError(res, "Could not reset the password");
}

/**
 * ผลของการ refresh — แยก "ติดต่อ server ไม่ได้" ออกจาก "token ถูกปฏิเสธ" เพราะมีแค่อย่างหลัง
 * ที่ต้องล้าง session และพาไป login ส่วนอย่างแรก session ยังดีอยู่ แค่รอ server กลับมา
 * - `ok` — ได้ access token ใหม่แล้ว
 * - `rejected` — ไม่มี refresh token หรือ backend ตอบ 4xx (ยกเว้น 408/429) → session ถูกล้าง
 * - `unreachable` — network/timeout/5xx/408/429 → เก็บ session ไว้ทั้งหมด ตั้ง authReachabilityStore
 */
export type RefreshResult = "ok" | "rejected" | "unreachable";

// Mutex — concurrent 401s แชร์ refresh request เดียวกัน (พฤติกรรมเดิมจาก http-client)
let refreshPromise: Promise<RefreshResult> | null = null;

export function refreshTokens(): Promise<RefreshResult> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = doRefresh().finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}

async function doRefresh(): Promise<RefreshResult> {
  const refresh_token = refreshTokenStorage.get();
  if (!refresh_token) {
    authReachabilityStore.set(false);
    return "rejected";
  }

  const { BACKEND_URL } = getRuntimeConfig();
  let res: Response;
  try {
    res = await fetch(`${BACKEND_URL}/api/auth/refresh-token`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ refresh_token }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    // network/timeout — อย่าเคลียร์ session (อาจ offline หรือ server ล่มชั่วคราว)
    authReachabilityStore.set(true);
    return "unreachable";
  }

  if (!res.ok) {
    // ล้าง session เฉพาะตอน refresh token ถูกปฏิเสธจริง (4xx) — 5xx/408/429
    // เป็นปัญหาชั่วคราวฝั่ง server เหมือน network error: เก็บ session ไว้แล้วรอลองใหม่
    // (backend ตอบ 5xx เมื่อ Keycloak ล่ม — เดิมตอบ 401 ทำให้ผู้ใช้โดนเตะออกทั้งระบบ)
    // 4xx อื่น (422 จาก DTO validation ฯลฯ) ก็นับเป็นถูกปฏิเสธ — ถ้านับเป็น unreachable ผู้ใช้ที่ token
    // เสียจะค้างหน้า "ติดต่อเซิร์ฟเวอร์ไม่ได้" ตลอดไป ยกเว้น 408/429 ที่เป็นเรื่องชั่วคราว
    if (res.status >= 400 && res.status < 500 && res.status !== 408 && res.status !== 429) {
      clearSession();
      return "rejected";
    }
    authReachabilityStore.set(true);
    return "unreachable";
  }

  const json = await res.json().catch(() => null);
  const tokens = json?.data;
  if (!tokens?.access_token) {
    clearSession();
    return "rejected";
  }

  // ล้าง flag ก่อนใส่ token — RequireAuth จะ render หน้าเดิมทันทีที่ token เข้า store
  authReachabilityStore.set(false);
  tokenStore.set(tokens.access_token);
  if (tokens.refresh_token) refreshTokenStorage.set(tokens.refresh_token);
  return "ok";
}

export async function logout(): Promise<void> {
  const { BACKEND_URL } = getRuntimeConfig();
  const accessToken = tokenStore.get();
  const refresh_token = refreshTokenStorage.get() ?? "";
  clearSession();

  // ยิง revoke เมื่อมี token อย่างใดอย่างหนึ่ง — ถ้า gate ด้วย accessToken อย่างเดียว
  // กรณี access token ว่าง (mid-refresh / หลัง 401) จะข้าม revoke ทำให้ refresh
  // token ยัง valid อยู่ฝั่ง server
  if (!accessToken && !refresh_token) return;
  try {
    await fetch(`${BACKEND_URL}/api/auth/logout`, {
      method: "POST",
      headers: {
        ...authHeaders(),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify({ refresh_token }),
      signal: AbortSignal.timeout(5_000),
    });
  } catch {
    // fire-and-forget — local session เคลียร์ไปแล้ว
  }
}

function clearSession(): void {
  // ล้าง flag ก่อน token — flag ค้าง true (server เคยล่มแล้วกลับมา) จะทำให้ logout ไปค้างหน้า
  // "ติดต่อเซิร์ฟเวอร์ไม่ได้" แทนหน้า login
  authReachabilityStore.set(false);
  tokenStore.clear();
  refreshTokenStorage.clear();
}
