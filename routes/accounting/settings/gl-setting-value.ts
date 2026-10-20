/** key ของ app-config ที่เก็บค่าตั้งค่าบัญชีของ BU (หนึ่งแถวต่อ BU) */
export const GL_SETTING_KEY = "gl_setting";

/**
 * ฟิลด์ uuid ทั้ง 13 ตัวของ `gl_setting` — ตรงกับ zod ฝั่ง micro-business
 * (`app-config.service.ts`) ซึ่งเป็น `.uuid().optional()` ทุกตัว **ไม่รับ null**
 * ล้างค่า = ตัด key ออกจากก้อน (ดู {@link toGlSettingValue})
 */
export const GL_UUID_FIELDS = [
  "retained_earnings_account_id",
  "reversal_prefix_id",
  "auto_jv_prefix_id",
  "ap_control_account_id",
  "input_vat_account_id",
  "wht_payable_account_id",
  "advance_deposit_account_id",
  "realized_fx_gain_account_id",
  "realized_fx_loss_account_id",
  "ap_jv_prefix_id",
  "ar_control_account_id",
  "output_vat_account_id",
  "ar_jv_prefix_id",
] as const;

export type GlUuidField = (typeof GL_UUID_FIELDS)[number];

export type GlSettingForm = {
  fiscal_year_start_month: number;
  allow_post_to_closed_period: boolean;
} & Record<GlUuidField, string | null>;

/**
 * backend บังคับ `fiscal_year_start_month` (1–12, ไม่มี default) — BU ที่ยังไม่เคยมี
 * `gl_setting` ใช้ 1 (ปีบัญชีเริ่มมกราคม) เป็นค่าตั้งต้นของฟอร์ม
 */
const DEFAULT_FISCAL_YEAR_START_MONTH = 1;

function isValidMonth(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 12;
}

/**
 * แปลงค่าที่เก็บใน `gl_setting` เป็นค่าของฟอร์ม
 *
 * ค่าที่ไม่ใช่ string หรือเป็น string ว่าง → null · ไม่มีเดือน (หรือผิดช่วง) → 1 ·
 * ไม่มี boolean → false
 *
 * @param value - `value` ของแถว app-config (undefined = ยังไม่เคยบันทึก / 404)
 * @returns ค่าตั้งต้นของฟอร์ม
 */
export function toGlSettingForm(
  value: Record<string, unknown> | undefined,
): GlSettingForm {
  const month = value?.fiscal_year_start_month;
  const form = {
    fiscal_year_start_month: isValidMonth(month)
      ? month
      : DEFAULT_FISCAL_YEAR_START_MONTH,
    allow_post_to_closed_period: value?.allow_post_to_closed_period === true,
  } as GlSettingForm;
  for (const key of GL_UUID_FIELDS) {
    const v = value?.[key];
    form[key] = typeof v === "string" && v ? v : null;
  }
  return form;
}

/**
 * ประกอบก้อนที่จะ PUT กลับ — PUT **แทนที่ทั้งก้อน** จึงต้องตั้งต้นจากค่าล่าสุดของ server
 * (`fresh`) เสมอ เพื่อไม่ให้ key ที่ฟอร์มไม่รู้จักหายไป
 *
 * ฟิลด์ uuid: ลบ key ทิ้งก่อน แล้วใส่กลับเฉพาะเมื่อไม่ใช่ null (backend ไม่รับ null) ·
 * เดือนและ boolean ใส่เสมอ
 *
 * @param form - ค่าในฟอร์ม
 * @param fresh - `value` ล่าสุดจาก server (undefined = ยังไม่เคยมีแถว)
 * @returns object ที่ส่งเป็น `value` ของ app-config
 */
export function toGlSettingValue(
  form: GlSettingForm,
  fresh: Record<string, unknown> | undefined,
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...fresh };
  for (const key of GL_UUID_FIELDS) {
    delete next[key];
    const v = form[key];
    if (v !== null) next[key] = v;
  }
  next.fiscal_year_start_month = form.fiscal_year_start_month;
  next.allow_post_to_closed_period = form.allow_post_to_closed_period;
  return next;
}
