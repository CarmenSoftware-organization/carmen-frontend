import { z } from "zod";
import type { TranslationFn } from "@/lib/i18n-schema";
import type {
  JvAmortizeType,
  JvTemplate,
  JvTemplateInput,
  JvTemplateSide,
  JvTemplateType,
} from "./jv-template-types";

/** อัตราส่วนคิดเป็นจำนวนเต็ม ×10⁴ — 0.3333+0.3333+0.3334 ต้องได้ 1 พอดี ไม่ใช่ 0.9999999… */
export const RATIO_SCALE = 10000;
export const ratioUnits = (r: number | null | undefined): number =>
  Math.round(Number(r ?? 0) * RATIO_SCALE);

/** ยอดเงินคิดเป็นสตางค์ — เทียบ Σdebit = Σcredit โดยไม่โดน float บวกเพี้ยน */
export const moneyUnits = (v: number | null | undefined): number =>
  Math.round(Number(v ?? 0) * 100);

/**
 * start/end ของ amortize เป็น**วันตามปฏิทิน** ไม่ใช่เวลา — ฟอร์มเก็บ `YYYY-MM-DD` แล้ว
 * repository ส่งเป็นเที่ยงคืน UTC ของวันนั้น · DatePicker คืนเที่ยงคืน local เป็น ISO
 * (ไทย = 17:00Z ของวันก่อน) ถ้าส่งตรง ๆ วันเริ่มจะเลื่อนไปหนึ่งวัน
 */
export function ymdFromPicker(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** `YYYY-MM-DD` → เที่ยงคืน local เป็น ISO ให้ DatePicker แสดงวันเดียวกันทุก timezone */
export function ymdToPicker(ymd: string): string {
  if (!ymd) return "";
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d).toISOString();
}

export interface JvTemplateLineValues {
  chart_of_accounts_id: string;
  cost_center_id: string | null;
  description: string;
  debit: number;
  credit: number;
  side: JvTemplateSide | null;
  allocation_ratio: number | null;
}

export interface JvTemplateFormValues {
  /** "" = หน้ารวมยังไม่ได้เลือกชนิด (add เท่านั้น) */
  template_type: JvTemplateType | "";
  code: string;
  name: string;
  description: string;
  prefix_id: string;
  from_fiscal_year: number;
  from_period_no: number;
  to_fiscal_year: number;
  to_period_no: number;
  frequency_months: number | null;
  currency_id: string;
  exchange_rate: number | null;
  allocate_amount: number | null;
  amortize_type: JvAmortizeType | null;
  start_date: string;
  end_date: string;
  total_amount: number | null;
  is_active: boolean;
  note: string;
  lines: JvTemplateLineValues[];
}

const emptyLine = (
  side: JvTemplateSide | null = null,
  ratio: number | null = null,
): JvTemplateLineValues => ({
  chart_of_accounts_id: "",
  cost_center_id: null,
  description: "",
  debit: 0,
  credit: 0,
  side,
  allocation_ratio: ratio,
});

/** บรรทัดตั้งต้นของแต่ละชนิด — สลับชนิดตอนสร้างใหม่ = เริ่มบรรทัดชุดนี้ใหม่ */
export function defaultLinesFor(
  type: JvTemplateType | "",
): JvTemplateLineValues[] {
  if (type === "allocation") {
    return [emptyLine("debit", 1), emptyLine("credit", 1)];
  }
  if (type === "amortize") return [emptyLine("debit"), emptyLine("credit")];
  return [emptyLine(), emptyLine()];
}

export function getJvTemplateDefaultValues(
  template: JvTemplate | undefined,
  type: JvTemplateType | "",
): JvTemplateFormValues {
  if (!template) {
    const year = new Date().getFullYear();
    return {
      template_type: type,
      code: "",
      name: "",
      description: "",
      prefix_id: "",
      from_fiscal_year: year,
      from_period_no: 1,
      to_fiscal_year: year,
      to_period_no: 12,
      frequency_months: 1,
      currency_id: "",
      exchange_rate: null,
      allocate_amount: null,
      amortize_type: type === "amortize" ? "monthly" : null,
      start_date: "",
      end_date: "",
      total_amount: null,
      is_active: true,
      note: "",
      lines: defaultLinesFor(type),
    };
  }
  return {
    template_type: template.template_type,
    code: template.code,
    name: template.name,
    description: template.description ?? "",
    prefix_id: template.prefix_id,
    from_fiscal_year: template.from_fiscal_year,
    from_period_no: template.from_period_no,
    to_fiscal_year: template.to_fiscal_year,
    to_period_no: template.to_period_no,
    frequency_months: template.frequency_months ?? 1,
    currency_id: template.currency_id ?? "",
    exchange_rate: template.exchange_rate,
    allocate_amount: template.allocate_amount,
    amortize_type: template.amortize_type,
    start_date: template.start_date?.slice(0, 10) ?? "",
    end_date: template.end_date?.slice(0, 10) ?? "",
    total_amount: template.total_amount,
    is_active: template.is_active,
    note: template.note ?? "",
    lines: [...template.lines]
      .sort((a, b) => a.sequence_no - b.sequence_no)
      .map((l) => ({
        chart_of_accounts_id: l.chart_of_accounts_id,
        cost_center_id: l.cost_center_id,
        description: l.description ?? "",
        debit: l.debit,
        credit: l.credit,
        side: l.side,
        allocation_ratio: l.allocation_ratio,
      })),
  };
}

const intOrNaN = z.number().or(z.nan());
const numOrNull = z.number().nullable();

/**
 * กฎเดียวกับที่ backend ตรวจ (`gl-jv-template.validation.ts` + DTO ของ gateway) — ให้ผู้ใช้
 * เห็นก่อนกดบันทึก · ไม่ได้ตรวจ "prefix active / code ซ้ำ / COA มีจริง" ซึ่งต้องถาม server
 *
 * @param t - `accounting.jvTemplate`
 * @param tv - `validation`
 */
export function createJvTemplateFormSchema(t: TranslationFn, tv: TranslationFn) {
  const required = (field: string) => tv("required", { field });
  const yearOk = (n: number) => Number.isInteger(n) && n >= 1900 && n <= 2200;
  const periodOk = (n: number) => Number.isInteger(n) && n >= 1 && n <= 12;

  const line = z.object({
    chart_of_accounts_id: z.string().min(1, required(t("account"))),
    cost_center_id: z.string().nullable(),
    description: z.string(),
    debit: z.number(),
    credit: z.number(),
    side: z.enum(["debit", "credit"]).nullable(),
    allocation_ratio: numOrNull,
  });

  return z
    .object({
      template_type: z.enum(["recurring", "allocation", "amortize", ""]),
      code: z.string().trim().min(1, required(t("code"))).max(50),
      name: z.string().trim().min(1, required(t("name"))),
      description: z.string(),
      prefix_id: z.string().min(1, required(t("prefix"))),
      from_fiscal_year: intOrNaN,
      from_period_no: intOrNaN,
      to_fiscal_year: intOrNaN,
      to_period_no: intOrNaN,
      frequency_months: numOrNull,
      currency_id: z.string(),
      exchange_rate: numOrNull,
      allocate_amount: numOrNull,
      amortize_type: z.enum(["day_in_month", "monthly"]).nullable(),
      start_date: z.string(),
      end_date: z.string(),
      total_amount: numOrNull,
      is_active: z.boolean(),
      note: z.string(),
      lines: z.array(line),
    })
    .superRefine((v, ctx) => {
      const issue = (path: (string | number)[], message: string) =>
        ctx.addIssue({ code: "custom", path, message });

      if (!v.template_type) issue(["template_type"], required(t("type")));

      // ---- ทุกชนิด: งวด 1–12 · ปี 1900–2200 · from ≤ to ----
      const fyMsg = tv("required", { field: t("fiscalYear") });
      const pMsg = t("errPeriodNo");
      if (!yearOk(v.from_fiscal_year)) issue(["from_fiscal_year"], fyMsg);
      if (!yearOk(v.to_fiscal_year)) issue(["to_fiscal_year"], fyMsg);
      if (!periodOk(v.from_period_no)) issue(["from_period_no"], pMsg);
      if (!periodOk(v.to_period_no)) issue(["to_period_no"], pMsg);
      const from = v.from_fiscal_year * 100 + v.from_period_no;
      const to = v.to_fiscal_year * 100 + v.to_period_no;
      if (
        yearOk(v.from_fiscal_year) &&
        yearOk(v.to_fiscal_year) &&
        from > to
      ) {
        issue(["to_period_no"], t("errPeriodOrder"));
      }
      if (v.exchange_rate != null && !(v.exchange_rate > 0)) {
        issue(
          ["exchange_rate"],
          tv("positive", { field: t("exchangeRate") }),
        );
      }
      if (v.lines.length === 0) {
        issue(["lines"], t("errAtLeastOneLine"));
        return;
      }

      // ---- recurring ----
      if (v.template_type === "recurring") {
        if (
          v.frequency_months == null ||
          !Number.isInteger(v.frequency_months) ||
          v.frequency_months < 1
        ) {
          issue(
            ["frequency_months"],
            tv("minNumber", { field: t("frequencyMonths"), min: 1 }),
          );
        }
        let debit = 0;
        let credit = 0;
        v.lines.forEach((l, i) => {
          const d = moneyUnits(l.debit);
          const c = moneyUnits(l.credit);
          if ((d > 0) === (c > 0) || d < 0 || c < 0) {
            issue(["lines", i, "debit"], t("errDebitOrCredit"));
          }
          debit += d;
          credit += c;
        });
        if (debit !== credit) issue(["lines"], t("notBalanced"));
      }

      // ---- allocation ----
      if (v.template_type === "allocation") {
        if (v.allocate_amount == null || !(v.allocate_amount > 0)) {
          issue(
            ["allocate_amount"],
            tv("positive", { field: t("allocateAmount") }),
          );
        }
        const sum = { debit: 0, credit: 0 };
        v.lines.forEach((l, i) => {
          if (!l.side) issue(["lines", i, "side"], required(t("side")));
          const r = ratioUnits(l.allocation_ratio);
          if (l.allocation_ratio == null || r <= 0 || r > RATIO_SCALE) {
            issue(
              ["lines", i, "allocation_ratio"],
              tv("positive", { field: t("ratio") }),
            );
          }
          if (l.side) sum[l.side] += r;
        });
        const hasDebit = v.lines.some((l) => l.side === "debit");
        const hasCredit = v.lines.some((l) => l.side === "credit");
        if (!hasDebit || !hasCredit) {
          issue(["lines"], t("errDebitAndCreditSide"));
        } else if (sum.debit !== RATIO_SCALE || sum.credit !== RATIO_SCALE) {
          issue(["lines"], t("ratioNotOne"));
        }
      }

      // ---- amortize ----
      if (v.template_type === "amortize") {
        if (!v.amortize_type) {
          issue(["amortize_type"], required(t("amortizeType")));
        }
        if (!v.start_date) issue(["start_date"], required(t("startDate")));
        if (!v.end_date) issue(["end_date"], required(t("endDate")));
        // YYYY-MM-DD เทียบแบบสตริงได้ตรงตามลำดับวัน
        if (v.start_date && v.end_date && v.end_date < v.start_date) {
          issue(["end_date"], tv("endDateAfterStart"));
        }
        if (v.total_amount == null || !(v.total_amount > 0)) {
          issue(["total_amount"], tv("positive", { field: t("totalAmount") }));
        }
        const debitLines = v.lines.filter((l) => l.side === "debit").length;
        const creditLines = v.lines.filter((l) => l.side === "credit").length;
        if (v.lines.length !== 2 || debitLines !== 1 || creditLines !== 1) {
          issue(["lines"], t("amortizeTwoLines"));
        }
      }
    });
}

const trimOrNull = (s: string): string | null => s.trim() || null;

/**
 * ค่าฟอร์ม → payload — ส่ง**ทุกบรรทัด**เสมอ (update = แทนที่ทั้งชุด) · sequence_no = ลำดับบนจอ
 * ฟิลด์ของชนิดอื่นส่ง null (DTO รับ null ได้ทุกตัว ยกเว้น frequency_months ที่ repository ตัดทิ้งให้)
 */
export function toJvTemplateInput(values: JvTemplateFormValues): JvTemplateInput {
  const type = values.template_type as JvTemplateType;
  return {
    template_type: type,
    code: values.code.trim(),
    name: values.name.trim(),
    description: trimOrNull(values.description),
    is_active: values.is_active,
    prefix_id: values.prefix_id,
    from_fiscal_year: values.from_fiscal_year,
    from_period_no: values.from_period_no,
    to_fiscal_year: values.to_fiscal_year,
    to_period_no: values.to_period_no,
    frequency_months: type === "recurring" ? values.frequency_months : null,
    currency_id: values.currency_id || null,
    // DTO: positive().nullable() — 0 = 400 จึงส่ง null แทน
    exchange_rate:
      values.exchange_rate != null && values.exchange_rate > 0
        ? values.exchange_rate
        : null,
    allocate_amount: type === "allocation" ? values.allocate_amount : null,
    amortize_type: type === "amortize" ? values.amortize_type : null,
    start_date: type === "amortize" ? values.start_date || null : null,
    end_date: type === "amortize" ? values.end_date || null : null,
    total_amount: type === "amortize" ? values.total_amount : null,
    note: trimOrNull(values.note),
    lines: values.lines.map((l, i) => ({
      sequence_no: i + 1,
      chart_of_accounts_id: l.chart_of_accounts_id,
      cost_center_id: l.cost_center_id || null,
      description: trimOrNull(l.description),
      debit: type === "recurring" ? l.debit : 0,
      credit: type === "recurring" ? l.credit : 0,
      side: type === "recurring" ? null : l.side,
      allocation_ratio: type === "allocation" ? l.allocation_ratio : null,
    })),
  };
}
