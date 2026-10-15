const SHORT_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const FULL_MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/**
 * จัดรูปแบบ ISO date string ตาม pattern ที่กำหนดจาก profile config
 *
 * รองรับ token:
 *  - วันที่: DD, D, MM, M, MMM, MMMM, YYYY, YY
 *  - เวลา: HH, hh, mm, ss, A, a
 * ใช้การ match token ที่ยาวที่สุดก่อนเพื่อป้องกัน partial replacement
 * คืน empty string หาก iso ไม่ใช่วันที่ที่ถูกต้อง
 *
 * @param iso - ISO date string ที่จะจัดรูปแบบ
 * @param dateFormat - pattern รูปแบบวันที่ เช่น "DD/MM/YYYY HH:mm"
 * @returns string ของวันที่ตามรูปแบบ หรือ empty string หาก parse ไม่ได้
 * @example
 * ```ts
 * formatDate("2026-04-09T09:30:00Z", "DD MMM YYYY"); // "09 Apr 2026"
 * formatDate("2026-04-09T09:30:00Z", "MM/DD/YYYY hh:mm A"); // "04/09/2026 09:30 AM"
 * ```
 */
export function formatDate(
  iso: string | null | undefined,
  dateFormat: string,
): string {
  // `new Date(null)` คือ epoch 0 ไม่ใช่ Invalid Date — ช่องวันที่ที่ backend ส่ง null
  // มาเคยขึ้นเป็น 1970-01-01 (เช่น invoice_date ของ GRN) จึงต้องดักก่อน parse
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";

  const day = d.getDate();
  const month = d.getMonth(); // 0-indexed
  const year = d.getFullYear();
  const hours24 = d.getHours();
  const hours12 = hours24 % 12 || 12;
  const minutes = d.getMinutes();
  const seconds = d.getSeconds();
  const ampm = hours24 < 12 ? "AM" : "PM";

  const tokens: Record<string, string> = {
    YYYY: String(year),
    yyyy: String(year),
    YY: String(year).slice(-2),
    yy: String(year).slice(-2),
    MMMM: FULL_MONTHS[month],
    MMM: SHORT_MONTHS[month],
    MM: String(month + 1).padStart(2, "0"),
    DD: String(day).padStart(2, "0"),
    dd: String(day).padStart(2, "0"),
    D: String(day),
    M: String(month + 1),
    HH: String(hours24).padStart(2, "0"),
    hh: String(hours12).padStart(2, "0"),
    mm: String(minutes).padStart(2, "0"),
    ss: String(seconds).padStart(2, "0"),
    A: ampm,
    a: ampm.toLowerCase(),
  };

  // Match longest tokens first to avoid partial replacements
  const pattern = Object.keys(tokens)
    .sort((a, b) => b.length - a.length)
    .join("|");

  return dateFormat.replaceAll(
    new RegExp(pattern, "g"),
    (match) => tokens[match],
  );
}

/**
 * ช่วงเวลาระหว่างสองก้าว เป็นข้อความสั้นตาม locale
 *
 * คืน `null` เมื่อห่างกันไม่ถึง 5 วินาที เพราะนั่นคือก้าวที่ระบบทำต่อกันเองใน
 * ทรานแซกชันเดียว (เช่น approve ด่านสุดท้ายแล้ว complete ทันที) — บอกว่า
 * "ผ่านไป 0 วินาที" ไม่ได้ให้ข้อมูลอะไร มีแต่เพิ่มบรรทัด
 *
 * อยู่ที่นี่เพราะเป็น pure function ไม่มี React dependency เข้าชุดกับ `formatDate`
 * ในไฟล์นี้อยู่แล้ว — เดิมอยู่ใน `components/share/history-timeline.tsx` แต่การ
 * `export` function ที่ไม่ใช่ component จากไฟล์ component ทำให้ ESLint
 * `react-refresh/only-export-components` ฟ้อง จึงย้ายมาไว้ที่นี่ ผู้ใช้ทุกไทม์ไลน์
 * (workflow history ระดับเอกสาร และ activity log ของใบขอซื้อ) ยัง import ตัวเดียว
 * ร่วมกันเหมือนเดิม เพียงย้ายที่ import
 *
 * @param fromIso - เวลาของก้าวก่อนหน้า (เก่ากว่า)
 * @param toIso - เวลาของก้าวนี้
 * @param t - ตัวแปลจาก namespace `history`
 * @returns ข้อความช่วงเวลา หรือ null เมื่อสั้นเกินกว่าจะมีความหมาย
 */
export function formatElapsed(
  fromIso: string,
  toIso: string,
  t: (key: string, values?: Record<string, number>) => string,
): string | null {
  const from = new Date(fromIso).getTime();
  const to = new Date(toIso).getTime();
  if (Number.isNaN(from) || Number.isNaN(to)) return null;

  const seconds = Math.round((to - from) / 1000);
  if (seconds < 5) return null;
  if (seconds < 60) return t("elapsedSeconds", { count: seconds });

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return t("elapsedMinutes", { count: minutes });

  const hours = Math.round(minutes / 60);
  if (hours < 24) return t("elapsedHours", { count: hours });

  return t("elapsedDays", { count: Math.round(hours / 24) });
}

export function daysBetween(a: string, b: string): number {
  if (!a || !b) return 0;
  const start = new Date(a).getTime();
  const end = new Date(b).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return 0;
  return Math.max(0, Math.round((end - start) / (1000 * 60 * 60 * 24)));
}

export function addDays(iso: string, days: number): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

export function isoToDateInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  // ใช้ local-time getters ให้ตรงกับ formatDate/formatLocalizedDate ในไฟล์เดียวกัน
  // ถ้าใช้ toISOString() (UTC) บน deployment UTC+7 timestamp ตั้งแต่ 17:00Z จะได้
  // วันที่คนละวันระหว่าง read view กับ <input type="date"> ของ record เดียวกัน
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * จัดรูปแบบวันที่เป็น "DD MMM YYYY" แบบ locale-aware (ตัว canonical สำหรับ short date)
 *
 * ใช้ `Intl.DateTimeFormat` แปลชื่อเดือนตาม locale (เช่น "Apr" → "เม.ย." เมื่อ
 * locale = "th") และบังคับ Gregorian calendar กันไม่ให้แปลงปีเป็นพุทธศักราช
 * รับได้ทั้ง string, Date และ null/undefined (คืน "" เมื่อ parse ไม่ได้)
 *
 * @param iso - ISO date string หรือ Date object
 * @param locale - locale code (เช่น "en", "th"); default "en"
 * @returns string รูปแบบสั้นตาม locale หรือ empty string หาก parse ไม่ได้
 * @example
 * ```ts
 * formatLocalizedDate("2026-04-09T09:30:00Z", "en"); // "09 Apr 2026"
 * formatLocalizedDate("2026-04-09T09:30:00Z", "th"); // "09 เม.ย. 2026"
 * ```
 */
export function formatLocalizedDate(
  iso: string | Date | null | undefined,
  locale = "en",
): string {
  if (!iso) return "";
  const date = typeof iso === "string" ? new Date(iso) : iso;
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    calendar: "gregory",
  }).format(date);
}

/**
 * วันที่ของเอกสารอยู่นอกงวดบัญชีที่เปิดอยู่หรือเปล่า
 *
 * เทียบแบบ "ทั้งวัน" ไม่ใช่ timestamp — `start_at`/`end_at` ที่ backend ส่งมาเป็น
 * ISO ที่มีเวลาติดมาด้วย ถ้าเทียบดิบ ๆ เอกสารที่ลงวันสุดท้ายของงวดตอนบ่ายจะกลาย
 * เป็น "เลยงวด" ทั้งที่เป็นวันเดียวกัน
 *
 * ไม่มีงวดเปิดอยู่ (`period` เป็น undefined) คืน `false` — เราไม่รู้ก็อย่าไปขวาง
 * ผู้ใช้ ปล่อยให้ backend เป็นคนตัดสิน
 *
 * @param docDate - วันที่บนเอกสาร (ISO)
 * @param period - งวดปัจจุบันจาก `useProfile().currentPeriod`
 */
export function isOutsideOpenPeriod(
  docDate: string | undefined,
  period: { start_at: string; end_at: string } | undefined,
): boolean {
  if (!docDate || !period) return false;
  // ผ่าน isoToDateInput ไม่ใช่ slice(0,10) — ค่าที่ backend ส่งมาเป็น UTC พอตัด
  // สตริงดิบบน deployment UTC+7 เอกสารที่ลงตั้งแต่ 17:00Z จะกลายเป็นคนละวัน
  // (เหตุผลเดียวกับที่ isoToDateInput ใช้ local getter — ดูคอมเมนต์ข้างบน)
  const day = isoToDateInput;
  const d = day(docDate);
  if (!d) return false;
  return d < day(period.start_at) || d > day(period.end_at);
}
