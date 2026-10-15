export const ERROR_CODES = {
  // Auth
  UNAUTHORIZED: "UNAUTHORIZED",
  SESSION_EXPIRED: "SESSION_EXPIRED",
  FORBIDDEN: "FORBIDDEN",

  // Validation
  VALIDATION_ERROR: "VALIDATION_ERROR",
  MISSING_REQUIRED_FIELD: "MISSING_REQUIRED_FIELD",

  // Network
  NETWORK_ERROR: "NETWORK_ERROR",
  TIMEOUT: "TIMEOUT",
  BACKEND_UNAVAILABLE: "BACKEND_UNAVAILABLE",

  // Rate Limit
  RATE_LIMITED: "RATE_LIMITED",

  // Server
  INTERNAL_ERROR: "INTERNAL_ERROR",
  NOT_FOUND: "NOT_FOUND",
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

/**
 * คลาส Error มาตรฐานสำหรับ API errors ทั้งหมดในระบบ
 *
 * ใช้แทน Error ปกติเพื่อให้สามารถจำแนกประเภท error ได้ชัดเจน
 * รองรับการ retry และเก็บ status code ของ HTTP response
 *
 * @example
 * ```ts
 * throw new ApiError(ERROR_CODES.NOT_FOUND, "Vendor not found", 404);
 * ```
 */
export class ApiError extends Error {
  /**
   * ข้อความจาก error body ของ backend (ถ้ามีและอ่านได้)
   *
   * แยกจาก `message` เพราะ `message` เป็น string ที่ dev เขียนไว้ตอนเรียก
   * (ภาษาอังกฤษ ไม่แปล) ส่วนตัวนี้เอามาโชว์ user ได้ **เฉพาะ 4xx** เท่านั้น —
   * 5xx ห้ามโชว์ เพราะอาจหลุด internal detail (ดู `userFacingServerMessage`)
   */
  public readonly serverMessage?: string;

  /**
   * รหัสจาก error catalog ของ backend (`body.error.code`) เมื่อมี
   *
   * ต่างจาก `code` ที่เป็นการจัดหมวดจาก HTTP status ฝั่ง client — ตัวนี้คือเหตุผลที่แท้จริง
   * ที่ backend ปฏิเสธ ใช้ map เป็นข้อความเจาะจงได้โดยไม่ต้องเอา message ดิบมาโชว์
   */
  public readonly appCode?: string;

  /**
   * ชื่อ field ที่ backend บอกว่าไม่ผ่าน validation (`body.error.errors[].field`)
   *
   * เป็น path ดิบของฝั่ง backend เช่น `good_received_note_detail.add.0.received_price`
   * — คนอ่านไม่รู้เรื่อง ต้องผ่านตารางแปลงชื่อที่ `lib/error-message.ts` ก่อนโชว์เสมอ
   */
  public readonly fieldErrors?: readonly string[];

  /**
   * ค่าแทน placeholder ของข้อความใน catalog (`body.params`) เช่น `{blocked}` `{total}`
   *
   * backend แทนค่าลง `message` ของมันเองไปแล้ว แต่เราไม่ได้เอา message นั้นมาโชว์ —
   * เราแปลจาก `appCode` เอง จึงต้องได้ค่าพวกนี้มาเติมในข้อความฝั่งเรา
   */
  public readonly appParams?: Readonly<Record<string, string | number>>;

  /**
   * เลข id ของรหัสใน catalog (`body.error.id`) — gateway ใส่ให้เฉพาะรหัสที่หาเจอใน catalog
   * ตอนเดียวกับที่แปล `message` ตามภาษาของ request ดังนั้นมีค่า = `serverMessage` คือ
   * ข้อความที่ทีมเขียนไว้ใน catalog ไม่ใช่ข้อความดิบที่ส่งต่อมาจาก service
   */
  public readonly catalogId?: number;

  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly statusCode?: number,
    public readonly retryable: boolean = false,
    public readonly details?: unknown,
    serverMessage?: string,
    appCode?: string,
    fieldErrors?: readonly string[],
    appParams?: Readonly<Record<string, string | number>>,
    catalogId?: number,
  ) {
    super(message);
    this.name = "ApiError";
    this.serverMessage = serverMessage;
    this.appCode = appCode;
    this.fieldErrors = fieldErrors;
    this.appParams = appParams;
    this.catalogId = catalogId;
  }

  /**
   * message จาก backend ที่ปลอดภัยพอจะแสดงให้ user เห็น
   *
   * คืนค่าเฉพาะเมื่อเป็น client error (4xx) ที่ backend ตั้งใจอธิบายให้ user
   * แก้ไขได้ เช่น "code ซ้ำ" — 5xx คืน undefined เสมอ ให้ caller ตกไปใช้
   * ข้อความกลางที่แปลแล้วแทน
   */
  get userFacingServerMessage(): string | undefined {
    if (!this.serverMessage) return undefined;
    const status = this.statusCode ?? 0;
    return status >= 400 && status < 500 ? this.serverMessage : undefined;
  }

  /**
   * สร้าง ApiError จาก Response object ของ fetch
   *
   * แปลง HTTP status code เป็น ErrorCode อัตโนมัติ, mark retryable=true สำหรับ
   * 5xx และ **อ่าน `message` จาก error body** เก็บไว้ที่ `serverMessage`
   *
   * async เพราะต้องอ่าน body — เดิมชื่อ `fromResponse` และเป็น sync ซึ่งทิ้ง
   * body ทั้งดุ้น ทำให้ validation error ของ backend ไปไม่ถึง user เลย
   * (เปลี่ยนชื่อเพื่อให้ tsc จับ call site ที่ลืม `await` ได้ — `throw` รับ
   * Promise ได้โดยไม่ error)
   *
   * @param res - Response object จาก fetch
   * @param fallbackMessage - ข้อความสำรองสำหรับ dev หากไม่มี message จาก server
   * @param sanitize - ปรับ message จาก server ก่อนใช้ (เช่นตัด placeholder ที่ค้าง)
   * @returns instance ของ ApiError
   * @example
   * ```ts
   * const res = await httpClient.get("/api/proxy/vendors");
   * if (!res.ok) throw await ApiError.from(res, "Failed to fetch vendors");
   * ```
   */
  static async from(
    res: Response,
    fallbackMessage: string,
    sanitize?: (message: string | undefined, fallback: string) => string,
  ): Promise<ApiError> {
    const code = statusToCode(res.status);
    const {
      message: raw,
      data,
      appCode,
      fieldErrors,
      appParams,
      catalogId,
    } = await readErrorBody(res);
    // sanitize คืน fallback เมื่อ message ใช้ไม่ได้ — เทียบเพื่อไม่ให้ fallback
    // (ข้อความของ dev) กลายเป็น serverMessage ที่เอาไปโชว์ user
    const cleaned = sanitize ? sanitize(raw, fallbackMessage) : raw;
    const serverMessage = cleaned === fallbackMessage ? undefined : cleaned;
    return new ApiError(
      code,
      serverMessage || fallbackMessage,
      res.status,
      // 503 ของสถานะแอปยิงซ้ำก็ได้คำตอบเดิมจนกว่าแอดมินจะเปิดแอป — ไม่ใช่ความล้มเหลวชั่วคราว
      res.status >= 500 && !isAppStatusErrorCode(appCode),
      data,
      serverMessage,
      appCode,
      fieldErrors,
      appParams,
      catalogId,
    );
  }
}

/**
 * error code สามตัวที่ `LicenseInterceptor` ฝั่ง backend โยนมาเมื่อ feature ไม่อยู่ในสัญญา/
 * สัญญาหมดอายุ/cluster เกินโควตาที่นั่ง (`SEAT_LIMIT_EXCEEDED` — Task 5.1/5.2, evaluateSeat)
 */
export const LICENSE_ERROR_CODES = {
  LICENSE_REQUIRED: "LICENSE_REQUIRED",
  LICENSE_EXPIRED: "LICENSE_EXPIRED",
  SEAT_LIMIT_EXCEEDED: "SEAT_LIMIT_EXCEEDED",
} as const;

export type LicenseErrorCode =
  (typeof LICENSE_ERROR_CODES)[keyof typeof LICENSE_ERROR_CODES];

/**
 * แยก 403 ของ license ออกจาก 403 ของสิทธิ์ (permission) — คีย์เดียวที่แยกได้เด็ดขาดคือ
 * `body.error.code` ("LICENSE_REQUIRED" | "LICENSE_EXPIRED" | "SEAT_LIMIT_EXCEEDED") ตาม
 * สัญญาจริงจาก `LicenseInterceptor` (backend) — **ห้ามคีย์กับ `message` หรือ `status`** เพราะ 403
 * ของ permission ก็เป็น 403 เหมือนกันและ `message` ขึ้นกับภาษา
 *
 * permission 403 ของ backend ส่ง `error` เป็น `{message:"Forbidden"}` เสมอ (ไม่มี `code`)
 * — คืน `undefined` สำหรับกรณีนั้นและกรณี body รูปแปลกทุกแบบ (null, ไม่มี `error`,
 * `error` เป็น string) เพื่อให้ caller ปล่อยไปเส้นทาง permission เดิม ไม่ throw
 *
 * @param body - error body ที่ parse จาก response แล้ว (JSON.parse ผลลัพธ์, ชนิดอะไรก็ได้)
 * @returns license error code เมื่อแมตช์ ไม่งั้น undefined
 * @example
 * ```ts
 * licenseErrorCodeFrom({ error: { code: "LICENSE_REQUIRED" } }); // "LICENSE_REQUIRED"
 * licenseErrorCodeFrom({ error: { message: "Forbidden" } });     // undefined
 * licenseErrorCodeFrom(null);                                    // undefined
 * ```
 */
export function licenseErrorCodeFrom(
  body: unknown,
): LicenseErrorCode | undefined {
  if (typeof body !== "object" || body === null) return undefined;
  const error = (body as { error?: unknown }).error;
  if (typeof error !== "object" || error === null) return undefined;
  const code = (error as { code?: unknown }).code;
  return code === LICENSE_ERROR_CODES.LICENSE_REQUIRED ||
    code === LICENSE_ERROR_CODES.LICENSE_EXPIRED ||
    code === LICENSE_ERROR_CODES.SEAT_LIMIT_EXCEEDED
    ? code
    : undefined;
}

/**
 * error code สามตัวที่ `AppIdGuard` ฝั่ง gateway ส่งมาเมื่อแอป (x-app-id) ไม่ได้อยู่ในสถานะ
 * `running` — แอดมินตั้งไว้ที่หน้า Applications ของ carmen-platform
 *
 * `APP_MAINTENANCE` / `APP_READ_ONLY` มากับ 503, `APP_DISABLED` มากับ 403 · แยกด้วย
 * `body.error.code` เท่านั้น (เหมือน license) — 503 ตัวจริงตอน gateway ล่มไม่มี code นี้
 */
export const APP_STATUS_ERROR_CODES = {
  APP_MAINTENANCE: "APP_MAINTENANCE",
  APP_READ_ONLY: "APP_READ_ONLY",
  APP_DISABLED: "APP_DISABLED",
} as const;

export type AppStatusErrorCode =
  (typeof APP_STATUS_ERROR_CODES)[keyof typeof APP_STATUS_ERROR_CODES];

const APP_STATUS_ERROR_CODE_SET: ReadonlySet<string> = new Set(
  Object.values(APP_STATUS_ERROR_CODES),
);

/**
 * เป็นรหัสสถานะแอปหรือไม่ — ใช้กับ `ApiError.appCode` ที่อ่านมาแล้ว
 *
 * @param code - ค่าอะไรก็ได้
 * @returns true เมื่อเป็นหนึ่งในสามรหัสของ `APP_STATUS_ERROR_CODES`
 */
export function isAppStatusErrorCode(
  code: unknown,
): code is AppStatusErrorCode {
  return typeof code === "string" && APP_STATUS_ERROR_CODE_SET.has(code);
}

/**
 * อ่านรหัสสถานะแอปจาก error body ดิบ — รูปเดียวกับ `licenseErrorCodeFrom`
 *
 * @param body - error body ที่ parse แล้ว (ชนิดอะไรก็ได้)
 * @returns รหัสเมื่อแมตช์ ไม่งั้น undefined (body รูปแปลกทุกแบบไม่ throw)
 * @example
 * ```ts
 * appStatusErrorCodeFrom({ error: { code: "APP_MAINTENANCE" } }); // "APP_MAINTENANCE"
 * appStatusErrorCodeFrom({ error: { message: "Forbidden" } });    // undefined
 * ```
 */
export function appStatusErrorCodeFrom(
  body: unknown,
): AppStatusErrorCode | undefined {
  if (typeof body !== "object" || body === null) return undefined;
  const error = (body as { error?: unknown }).error;
  if (typeof error !== "object" || error === null) return undefined;
  const code = (error as { code?: unknown }).code;
  return isAppStatusErrorCode(code) ? code : undefined;
}

/**
 * error นี้เกิดจากการ "ส่งไม่ถึง" ไม่ใช่คำตอบจาก backend หรือไม่
 *
 * message ของสองกรณีนี้เป็นภาษาอังกฤษที่ dev เขียนไว้ตอน throw (เช่น "Auth server unavailable")
 * ไม่ได้ผ่านระบบแปล การเอา `error.message` ไปโชว์ตรง ๆ จึงทำให้ผู้ใช้ภาษาไทยเห็นอังกฤษดิบ
 * หน้าจอต้องเช็คด้วยตัวนี้แล้วใช้ข้อความที่แปลไว้แทน
 *
 * @param error - error ที่ catch มา รูปแบบใดก็ได้
 * @returns true เมื่อเป็น network error หรือ timeout
 */
export function isTransportError(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    (error.code === ERROR_CODES.NETWORK_ERROR ||
      error.code === ERROR_CODES.TIMEOUT)
  );
}

/**
 * อ่าน `message` และ `data` จาก error body — clone() ก่อนเพื่อไม่ consume body ของ caller
 *
 * `data` คือช่องที่ backend ใช้ส่งรายละเอียดที่ client เอาไปเรนเดอร์ต่อได้ (ฝั่ง backend
 * เรียกมันว่า `details` แล้ว `StdResponse.error` วางลงฟิลด์ `data` ของ error body)
 * เช่นรายการเอกสารที่บล็อกการเปิดรอบตรวจนับ — เดิมอ่านแค่ `message` รายละเอียดจึงหล่นหาย
 * ทั้งที่ backend ส่งมาครบ
 *
 * คืน message เป็น undefined หาก parse ไม่ได้หรือไม่มี field `message` ที่เป็น string
 */
/**
 * `body.params` ของ error catalog — เอาเฉพาะค่าที่เติมลงข้อความได้จริง
 *
 * ค่าที่เป็น object/array ถูกทิ้ง เพราะ ICU จะ render มันเป็น "[object Object]"
 * กลางประโยค (`SR_DEPARTMENT_AMBIGUOUS` ส่ง departments มาเป็น string อยู่แล้ว)
 */
const readParams = (
  raw: unknown,
): Readonly<Record<string, string | number>> | undefined => {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return undefined;
  }
  const out: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === "string" || typeof v === "number") out[k] = v;
  }
  return Object.keys(out).length > 0 ? out : undefined;
};

const readErrorBody = async (
  res: Response,
): Promise<{
  message: string | undefined;
  data: unknown;
  appCode?: string;
  fieldErrors?: readonly string[];
  appParams?: Readonly<Record<string, string | number>>;
  catalogId?: number;
}> => {
  try {
    const body = await res.clone().json();
    return {
      message:
        typeof body?.message === "string" && body.message.trim()
          ? body.message
          : undefined,
      data: body?.data ?? undefined,
      // `error.code` คือรหัสจาก error catalog ของ backend (เช่น
      // WORKFLOW_HAS_IN_PROGRESS_DOCUMENTS) เป็นสิ่งเดียวที่บอกได้ว่า 400 นี้คือเรื่องอะไร
      // — status กับ message บอกไม่ได้ ตัวหลังยังเปลี่ยนตามภาษาด้วย
      appCode:
        typeof body?.error?.code === "string" ? body.error.code : undefined,
      // `error.errors[]` ของ 400 validation — เก็บแค่ชื่อ field ส่วน message ข้างใน
      // เป็นอังกฤษของ backend ("received_price is required when...") ไม่เอามาโชว์
      fieldErrors: Array.isArray(body?.error?.errors)
        ? body.error.errors
            .map((e: { field?: unknown }) =>
              typeof e?.field === "string" ? e.field : undefined,
            )
            .filter((f: string | undefined): f is string => !!f)
        : undefined,
      appParams: readParams(body?.params),
      catalogId:
        typeof body?.error?.id === "number" ? body.error.id : undefined,
    };
  } catch {
    return { message: undefined, data: undefined };
  }
};

/**
 * แปลง HTTP status code เป็น ErrorCode ของระบบ
 *
 * ใช้ภายใน `ApiError.from` เพื่อ map 401/403/404/429/5xx ไปยัง ErrorCode
 * ที่สอดคล้องกัน
 *
 * @param status - HTTP status code
 * @returns ErrorCode ที่ตรงกับ status
 * @example
 * ```ts
 * statusToCode(404); // "NOT_FOUND"
 * statusToCode(503); // "INTERNAL_ERROR"
 * ```
 */
function statusToCode(status: number): ErrorCode {
  switch (status) {
    case 401:
      return ERROR_CODES.UNAUTHORIZED;
    case 403:
      return ERROR_CODES.FORBIDDEN;
    case 404:
      return ERROR_CODES.NOT_FOUND;
    case 429:
      return ERROR_CODES.RATE_LIMITED;
    default:
      return status >= 500
        ? ERROR_CODES.INTERNAL_ERROR
        : ERROR_CODES.VALIDATION_ERROR;
  }
}

/**
 * รายละเอียดประกอบของ 403 ฝั่ง license — `feature` (คีย์ที่ BU ไม่มีสิทธิ์) กับ `bu_codes` /
 * `bu_names` (หน่วยงานที่ถูกบล็อก) ที่ `LicenseInterceptor` วางไว้ **ระดับบนสุด** ของ error body
 * ไม่ใช่ใน `error` (ดู `throw new ForbiddenException({ code, feature, bu_codes, bu_names })`)
 *
 * ข้อความอย่างเดียว ("หน่วยงานของคุณยังไม่ได้เปิดใช้งานความสามารถนี้") ไม่บอกว่า *ความสามารถไหน*
 * ผู้ดูแลจึงเอาไปสั่งงานต่อไม่ได้ ต้องถาม dev ทุกครั้ง — สามฟิลด์นี้คือสิ่งที่ตอบคำถามนั้นได้
 *
 * `bu_names` เป็นของใหม่ที่ gateway เพิ่งเริ่มส่ง — gateway รุ่นก่อนหน้าจะไม่มีฟิลด์นี้เลย
 * ผู้เรียกจึงต้องมีทางลงของตัวเองเสมอ (ดู `PermissionDeniedDialog` ที่แปลงจาก profile ต่อ)
 *
 * @param body - error body ที่ parse แล้ว (ชนิดอะไรก็ได้)
 * @returns ฟิลด์ที่ไม่มีหรือรูปไม่ตรงถูกตัดทิ้งเป็น undefined
 * @example
 * ```ts
 * licenseContextFrom({ feature: "configuration.currency", bu_codes: ["GR2VYNKQ"] });
 * // { feature: "configuration.currency", buCodes: ["GR2VYNKQ"] }
 * licenseContextFrom(null); // {}
 * ```
 */
export function licenseContextFrom(body: unknown): {
  feature?: string;
  buCodes?: string[];
  buNames?: string[];
} {
  if (typeof body !== "object" || body === null) return {};
  const {
    feature,
    bu_codes: buCodes,
    bu_names: buNames,
  } = body as {
    feature?: unknown;
    bu_codes?: unknown;
    bu_names?: unknown;
  };
  const stringList = (value: unknown) =>
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((v) => typeof v === "string")
      ? (value as string[])
      : undefined;
  return {
    feature: typeof feature === "string" && feature ? feature : undefined,
    buCodes: stringList(buCodes),
    buNames: stringList(buNames),
  };
}
