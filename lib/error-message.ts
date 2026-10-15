import { ApiError, ERROR_CODES, type ErrorCode } from "@/lib/api-error";
import type { TranslationFn } from "@/lib/i18n-schema";

const CODE_TO_KEY: Record<ErrorCode, string> = {
  [ERROR_CODES.UNAUTHORIZED]: "sessionExpired",
  [ERROR_CODES.SESSION_EXPIRED]: "sessionExpired",
  [ERROR_CODES.FORBIDDEN]: "noPermission",
  [ERROR_CODES.VALIDATION_ERROR]: "missingField",
  [ERROR_CODES.MISSING_REQUIRED_FIELD]: "missingField",
  [ERROR_CODES.NETWORK_ERROR]: "network",
  [ERROR_CODES.TIMEOUT]: "timeout",
  [ERROR_CODES.BACKEND_UNAVAILABLE]: "serverDown",
  [ERROR_CODES.RATE_LIMITED]: "tooFast",
  [ERROR_CODES.INTERNAL_ERROR]: "serverDown",
  [ERROR_CODES.NOT_FOUND]: "notFound",
};

/**
 * `error.code` จาก backend ที่ผู้ใช้แก้เองได้ → คีย์ i18n เฉพาะเรื่อง
 *
 * ข้อความกลางถูกใช้กับ 400/422 ทุกตัวเพราะ backend เคยส่ง stack trace ของ Prisma กลับมา — แต่การ
 * เหวี่ยงแหแบบนั้นกลืนเหตุผลที่ผู้ใช้แก้ได้เองไปด้วย เช่น workflow ที่แก้ไม่ได้เพราะยังมีเอกสารค้าง
 * ผู้ใช้เห็นแค่ "กรอกไม่ถูกต้อง" แล้วไล่ตรวจฟอร์มที่ไม่มีอะไรผิดเลย
 *
 * ใส่เฉพาะรหัสที่ผู้ใช้ทำอะไรกับมันได้ รหัสที่เป็นความผิดพลาดภายในให้ตกไปที่ข้อความกลางตามเดิม
 */
const APP_CODE_TO_KEY: Record<string, string> = {
  WORKFLOW_HAS_IN_PROGRESS_DOCUMENTS: "workflowInProgress",
  WORKFLOW_STAGE_CHANGE_BLOCKED: "workflowInProgress",
  WORKFLOW_STAGE_WOULD_HAVE_NO_ACTOR: "workflowStageNoActor",
  // วันที่รับของอยู่นอกงวดที่เปิดอยู่ — ผู้ใช้แก้เองได้ (เปลี่ยนวันที่ หรือให้ฝ่าย
  // บัญชีเปิดงวด) ปล่อยตกไปข้อความกลางจะกลายเป็น "กรอกไม่ถูกต้อง" แล้วไล่ตรวจ
  // ทั้งฟอร์มโดยไม่มีอะไรผิดสักช่อง
  GRN_DATE_OUTSIDE_OPEN_PERIOD: "dateOutsideOpenPeriod",
  // เรื่องเดียวกับ GRN แต่คนละคำในประโยค — ใบเบิกพูดถึง "วันที่เบิก" ไม่ใช่ "วันที่รับของ"
  SR_DATE_OUTSIDE_OPEN_PERIOD: "srDateOutsideOpenPeriod",
};

/**
 * ชื่อ field ของ backend → คีย์ใน namespace `field` (ชื่อที่คนหน้างานเรียกจริง)
 *
 * ใส่เฉพาะ field ที่ฟอร์มของเราส่งไปเองและมีป้ายชื่อบนจอให้อ้างถึงได้ — ตัวที่ไม่รู้จัก
 * ปล่อยตกไปข้อความกลาง ดีกว่าโชว์ `received_price` ให้พนักงานงงว่าช่องไหน
 */
export const FIELD_TO_KEY: Record<string, string> = {
  received_price: "unitPrice",
  received_qty: "receivedQty",
  received_unit_id: "unit",
  foc_qty: "focQty",
  approved_qty: "approvedQty",
  product_id: "product",
  location_id: "location",
  vendor_id: "vendor",
  currency_id: "currency",
  exchange_rate: "exchangeRate",
  tax_profile_id: "taxProfile",
  invoice_no: "invoiceNo",
  invoice_date: "invoiceDate",
  delivery_date: "deliveryDate",
  credit_term_id: "creditTerm",
  description: "description",
  note: "note",
};

/**
 * `good_received_note_detail.add.0.received_price` → ชื่อช่องที่คนอ่านรู้เรื่อง
 *
 * path ของ backend มีชื่อ table/ลำดับแถวปนมาด้วย ซึ่งไม่มีความหมายกับคนกรอก —
 * เอาแค่ส่วนท้ายที่เป็นชื่อ field จริง แล้วแปลงผ่าน `FIELD_TO_KEY`
 */
function fieldLabels(
  fields: readonly string[],
  tField: TranslationFn,
): string[] {
  const seen = new Set<string>();
  for (const path of fields) {
    const key = FIELD_TO_KEY[path.split(".").pop() ?? ""];
    if (key) seen.add(tField(key));
  }
  return [...seen];
}

/**
 * ข้อความของ `OptimisticLockError` ฝั่ง backend ("Record was modified by another request
 * (model=…, expected doc_version=N)") — ตัวเดียวที่แปลว่า "มีคนแก้ใบนี้" จริง
 */
const DOC_VERSION_CONFLICT = /doc_version|modified by another request/i;

function fallbackKey(
  code: ErrorCode,
  statusCode?: number,
  appCode?: string,
  serverMessage?: string,
): string {
  // 400 ทั่วไปไม่ได้แปลว่า "กรอกไม่ครบ" เสมอไป กรอกครบแต่ค่าผิดก็ 400 —
  // บอกให้ตรวจฟอร์มอีกรอบตรงกว่า ส่วนโค้ดที่บอกชัดว่าขาด field ค่อยใช้ missingField
  if (code === ERROR_CODES.MISSING_REQUIRED_FIELD) return "missingField";
  // 409 มีสองความหมาย: doc_version ชนกัน (OptimisticLockError → TryCatch ของ backend
  // คืน 409 ไม่มีรหัส) กับกฎธุรกิจปฏิเสธ — ซ้ำ ถูกใช้อยู่ หรือของที่รับเข้าถูกเบิกไปแล้ว
  // "มีคนแก้ใบนี้ รีเฟรชแล้วลองใหม่" กับเคสหลังผิดทั้งเหตุและทางแก้ ผู้ใช้จะรีเฟรชแล้ว
  // กดซ้ำไปเรื่อย ๆ โดยไม่มีวันผ่าน (void GRN ที่ของถูกเบิกไปแล้ว · สร้าง vendor รหัสซ้ำ
  // ที่ backend ยังไม่ติดรหัส) — จึงเชื่อ "มีคนแก้" เฉพาะเมื่อข้อความบอกว่าเป็น
  // doc_version จริง หรือไม่มีข้อความให้ตัดสินเลย
  if (statusCode === 409) {
    if (appCode) return "conflictsWithData";
    return !serverMessage || DOC_VERSION_CONFLICT.test(serverMessage)
      ? "documentChanged"
      : "conflictsWithData";
  }
  return "invalidForm";
}

/**
 * แปลง error ใดๆ ให้เป็นข้อความ user-friendly ตาม i18n
 *
 * - `ApiError` → match code กับ `errors.*` namespace
 * - 400/422/409: ใช้ข้อความกลางของเราเสมอ ไม่ส่งต่อข้อความจาก server
 * - Error อื่นๆ → fallback `errors.unexpected`
 *
 * ข้อความดิบไม่ได้หายไปไหน — dev ยังเห็นครบใน description ผ่าน
 * `getDevErrorDetail` และผู้ใช้ยังได้ error id ไว้แจ้งทีมงานเสมอ
 *
 * @param err - error ที่จับได้
 * @param t - useTranslations("errors") instance
 * @returns ข้อความสำหรับแสดงให้ user
 *
 * @example
 * ```ts
 * const tErr = useTranslations("errors");
 * try { ... } catch (err) { toast.error(getUserErrorMessage(err, tErr)); }
 * ```
 */
export function getUserErrorMessage(
  err: unknown,
  t: TranslationFn,
  tField?: TranslationFn,
): string {
  if (!(err instanceof ApiError)) return t("unexpected");

  // รหัสจาก catalog มาก่อนเสมอ: มันบอกเหตุผลจริงที่ backend ปฏิเสธ ส่วนข้อความกลางที่
  // แปลจาก HTTP status เป็นทางลงเมื่อไม่รู้ว่าเป็นเรื่องอะไร ไม่ใช่ค่าเริ่มต้นที่ควร
  // กลบเหตุผลที่รู้อยู่แล้ว — "ไม่พบข้อมูล" กับ "ใบนี้ไม่ใช่ร่างแล้ว เพิ่มรายการไม่ได้"
  // เป็น 404/400 เหมือนกันทั้งคู่
  if (err.appCode) {
    const mapped = APP_CODE_TO_KEY[err.appCode];
    if (mapped) return t(mapped, err.appParams);
    // คีย์ตรงตามชื่อรหัส — ไม่ต้องตั้งชื่อกลางให้ทุกตัว เติม catalog ใหม่ = เติม
    // `errors.byCode.<CODE>` ใน messages/{en,th}.json อย่างเดียว ไม่มีตารางให้ลืมซิงก์
    const byCode = `byCode.${err.appCode}`;
    if (t.has?.(byCode)) return t(byCode, err.appParams);
    // ยังไม่มีข้อความของเรา — ข้อความของรหัส catalog ทีม backend เขียนเองทั้งสองภาษา
    // และ gateway แปลตาม `Accept-Language` ที่ http-client ส่งไปแล้ว จึงตรงเรื่องกว่า
    // ข้อความกลางที่เดาจาก HTTP status เสมอ ("ไม่มีหน่วยนับนี้แล้ว" vs "ขัดกับข้อมูลในระบบ")
    const fromCatalog =
      err.catalogId === undefined ? undefined : shortServerMessage(err);
    if (fromCatalog) return fromCatalog;
  }

  if (
    err.code === ERROR_CODES.VALIDATION_ERROR ||
    err.code === ERROR_CODES.MISSING_REQUIRED_FIELD
  ) {
    // ไม่เอา message จาก server มาโชว์เลย — backend ส่ง stack trace ของ Prisma
    // กลับมาใน 400 ได้จริง ("1482 await prisma.tb_purchase_request_detail
    // .updateMany(... Unique constraint failed on the fields: ...") ซึ่งพนักงาน
    // หน้างานอ่านไม่รู้เรื่อง · ข้อความกลางที่บอกว่าให้ทำอะไรต่อใช้ได้จริงกว่า
    // บอกชื่อช่องที่ backend ตีกลับ ถ้าแปลงเป็นชื่อที่คนอ่านรู้เรื่องได้ทุกตัว —
    // แปลงไม่ได้สักตัวก็ตกไปข้อความกลาง ไม่ยัด field name ดิบใส่หน้าผู้ใช้
    if (tField && err.fieldErrors?.length) {
      const labels = fieldLabels(err.fieldErrors, tField);
      if (labels.length > 0) {
        return t("checkFields", { fields: labels.join(", ") });
      }
    }
    return t(
      fallbackKey(err.code, err.statusCode, err.appCode, err.serverMessage),
    );
  }

  const key = CODE_TO_KEY[err.code];
  return key ? t(key) : t("unexpected");
}

/** ยาวกว่านี้ถือว่าไม่ใช่ประโยคที่ตั้งใจเขียนให้คนอ่าน (มักเป็น trace/SQL) */
const MAX_SERVER_MESSAGE_LENGTH = 160;

/**
 * ข้อความจาก backend ที่แสดงบน toast ได้ — ใช้กับหน้าที่ opt-in
 * `meta.preferServerMessage` เท่านั้น ไม่ใช่ค่าเริ่มต้นของแอป
 *
 * คืน `undefined` (ให้ตกไป `getUserErrorMessage`) เมื่อ:
 * - มี `appCode` — รหัส catalog แปลเป็นภาษาของผู้ใช้ได้ ดีกว่าข้อความอังกฤษดิบ
 * - เป็น 5xx — `userFacingServerMessage` กรองไว้แล้ว
 * - หลายบรรทัดหรือยาวเกิน — ลักษณะของ Prisma stack trace ที่เคยหลุดขึ้น toast
 *
 * @param err - error ที่จับได้
 * @returns ข้อความจาก backend หรือ undefined
 */
export function getDisplayableServerMessage(err: unknown): string | undefined {
  if (!(err instanceof ApiError) || err.appCode) return undefined;
  return shortServerMessage(err);
}

/** ข้อความ 4xx จาก backend ที่เป็นประโยคบรรทัดเดียวสั้น ๆ — ไม่ใช่ trace/SQL */
function shortServerMessage(err: ApiError): string | undefined {
  const msg = err.userFacingServerMessage?.trim();
  if (!msg || msg.length > MAX_SERVER_MESSAGE_LENGTH || /[\r\n]/.test(msg)) {
    return undefined;
  }
  return msg;
}

export function getErrorId(err: unknown): string | undefined {
  if (err instanceof ApiError && err.statusCode) {
    const ts = Date.now().toString(36).slice(-6).toUpperCase();
    return `${err.code.slice(0, 3)}-${err.statusCode}-${ts}`;
  }
  return undefined;
}
