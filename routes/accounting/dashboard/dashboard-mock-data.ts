import type { ApDashboardSnapshot } from "@/types/accounts-payable";
import type {
  AccountingDashboardModule,
  AccountingDashboardSnapshot,
  DashboardMetric,
  DashboardTask,
  LocalizedDashboardText,
} from "@/types/accounting-dashboard";

const text = (en: string, th: string): LocalizedDashboardText => ({ en, th });
const metric = (
  id: string,
  label: LocalizedDashboardText,
  value: number,
  detail: LocalizedDashboardText,
  options: Partial<DashboardMetric> = {},
): DashboardMetric => ({
  id,
  label,
  value,
  detail,
  format: "number",
  tone: "neutral",
  ...options,
});
const task = (
  id: string,
  title: LocalizedDashboardText,
  detail: LocalizedDashboardText,
  count: number,
  tone: DashboardTask["tone"],
  href?: string,
): DashboardTask => ({ id, title, detail, count, tone, href });

const generatedAt = new Date().toISOString();
const asOf = generatedAt.slice(0, 10);

const gl: AccountingDashboardSnapshot = {
  module: "generalLedger",
  title: text("General Ledger Dashboard", "แดชบอร์ดบัญชีแยกประเภททั่วไป"),
  description: text(
    "Posting health, period close and financial position",
    "สถานะการผ่านรายการ การปิดงวด และฐานะการเงิน",
  ),
  asOf,
  period: "Sep 2026",
  currency: "THB",
  generatedAt,
  reconciliationVariance: 0,
  operational: {
    metrics: [
      metric(
        "unposted",
        text("Unposted JV", "JV ยังไม่ผ่านรายการ"),
        24,
        text("8 require review", "8 รายการต้องตรวจสอบ"),
        {
          tone: "warning",
          href: "/accounting/journal-voucher?status=in_review",
        },
      ),
      metric(
        "failed",
        text("Posting failures", "ผ่านรายการไม่สำเร็จ"),
        2,
        text("Interface balance errors", "ยอดจาก interface ไม่สมดุล"),
        {
          tone: "destructive",
          href: "/accounting/journal-voucher?status=draft",
        },
      ),
      metric(
        "scheduled",
        text("Scheduled today", "กำหนดผ่านรายการวันนี้"),
        7,
        text("Next run 18:00", "รอบถัดไป 18:00"),
        { tone: "info", href: "/accounting/journal-voucher?status=scheduled" },
      ),
      metric(
        "reversal",
        text("Auto-reversals due", "Auto-reversal ครบกำหนด"),
        3,
        text("Accruals from prior period", "รายการค้างรับค้างจ่ายจากงวดก่อน"),
        {
          tone: "primary",
          href: "/accounting/journal-voucher?auto_reverse=true",
        },
      ),
    ],
    analyses: [
      {
        id: "posting-health",
        title: text("Posting health", "สถานะการผ่านรายการ"),
        description: text(
          "Journal vouchers by lifecycle",
          "จำนวนใบสำคัญแยกตามสถานะ",
        ),
        kind: "bar",
        valueLabel: text("Documents", "เอกสาร"),
        data: [
          { label: "Draft", value: 11 },
          { label: "Submitted", value: 8 },
          { label: "Scheduled", value: 7 },
          { label: "Posted", value: 86 },
          { label: "Failed", value: 2 },
        ],
      },
      {
        id: "close-readiness",
        title: text("Period-close readiness", "ความพร้อมปิดงวด"),
        description: text(
          "Completed versus total checkpoints",
          "จุดตรวจที่เสร็จเทียบกับทั้งหมด",
        ),
        kind: "donut",
        valueLabel: text("Checks", "จุดตรวจ"),
        data: [
          { label: "Completed", value: 17 },
          { label: "Pending", value: 5 },
        ],
      },
    ],
    tasks: [
      task(
        "interface",
        text("Unbalanced interface batches", "ชุดข้อมูล interface ไม่สมดุล"),
        text(
          "Review source mapping before posting",
          "ตรวจ mapping ต้นทางก่อนผ่านรายการ",
        ),
        2,
        "destructive",
        "/accounting/journal-voucher?status=draft",
      ),
      task(
        "accrual",
        text("Month-end accrual review", "ตรวจรายการค้างรับค้างจ่ายสิ้นเดือน"),
        text(
          "Owner: Financial Controller",
          "ผู้รับผิดชอบ: Financial Controller",
        ),
        5,
        "warning",
        "/accounting/recurring-voucher",
      ),
      task(
        "reverse",
        text("Reversals scheduled tomorrow", "รายการกลับบัญชีกำหนดวันพรุ่งนี้"),
        text("Confirm next period is open", "ยืนยันว่างวดถัดไปเปิดอยู่"),
        3,
        "info",
        "/accounting/journal-voucher?auto_reverse=true",
      ),
    ],
  },
  management: {
    metrics: [
      metric(
        "revenue",
        text("Revenue", "รายได้"),
        4_200_000,
        text("+12% versus prior period", "+12% เทียบงวดก่อน"),
        { format: "currency", tone: "success" },
      ),
      metric(
        "expense",
        text("Expense", "ค่าใช้จ่าย"),
        3_180_000,
        text("+4% versus prior period", "+4% เทียบงวดก่อน"),
        { format: "currency", tone: "warning" },
      ),
      metric(
        "result",
        text("Operating result", "ผลการดำเนินงาน"),
        1_020_000,
        text("24.3% operating margin", "อัตรากำไรจากการดำเนินงาน 24.3%"),
        { format: "currency", tone: "primary" },
      ),
      metric(
        "cash",
        text("Cash & bank", "เงินสดและธนาคาร"),
        12_800_000,
        text("4 active bank accounts", "บัญชีธนาคารที่ใช้งาน 4 บัญชี"),
        { format: "currency", tone: "info" },
      ),
    ],
    analyses: [
      {
        id: "pnl",
        title: text("P&L trend", "แนวโน้มกำไรขาดทุน"),
        description: text(
          "Revenue and expense, last 6 months",
          "รายได้และค่าใช้จ่าย 6 เดือนล่าสุด",
        ),
        kind: "line",
        valueLabel: text("Revenue", "รายได้"),
        secondaryLabel: text("Expense", "ค่าใช้จ่าย"),
        format: "currency",
        data: [
          { label: "Apr", value: 3.4, secondary: 2.9 },
          { label: "May", value: 3.6, secondary: 3.0 },
          { label: "Jun", value: 3.7, secondary: 3.1 },
          { label: "Jul", value: 3.9, secondary: 3.05 },
          { label: "Aug", value: 3.75, secondary: 3.06 },
          { label: "Sep", value: 4.2, secondary: 3.18 },
        ].map((point) => ({
          ...point,
          value: point.value * 1_000_000,
          secondary: point.secondary * 1_000_000,
        })),
      },
      {
        id: "position",
        title: text("Financial position", "ฐานะการเงิน"),
        description: text(
          "Assets, liabilities and equity",
          "สินทรัพย์ หนี้สิน และส่วนของผู้ถือหุ้น",
        ),
        kind: "bar",
        valueLabel: text("Balance", "ยอดคงเหลือ"),
        format: "currency",
        data: [
          { label: "Assets", value: 48_600_000 },
          { label: "Liabilities", value: 19_400_000 },
          { label: "Equity", value: 29_200_000 },
        ],
      },
    ],
    tasks: [
      task(
        "variance",
        text("Budget variance to review", "ผลต่างงบประมาณที่ต้องตรวจ"),
        text(
          "Utilities and payroll exceed threshold",
          "ค่าสาธารณูปโภคและเงินเดือนเกินเกณฑ์",
        ),
        2,
        "warning",
        "/accounting/financial-reports",
      ),
    ],
  },
};

const ar: AccountingDashboardSnapshot = {
  module: "accountsReceivable",
  title: text("Accounts Receivable Dashboard", "แดชบอร์ดลูกหนี้การค้า"),
  description: text(
    "Collections, customer exposure and receivable health",
    "การรับชำระ ความเสี่ยงลูกค้า และคุณภาพลูกหนี้",
  ),
  asOf,
  period: "Sep 2026",
  currency: "THB",
  generatedAt,
  reconciliationVariance: 0,
  operational: {
    metrics: [
      metric(
        "outstanding",
        text("AR outstanding", "ลูกหนี้คงค้าง"),
        6_480_000,
        text("42 open invoices", "ใบแจ้งหนี้คงค้าง 42 รายการ"),
        {
          format: "currency",
          tone: "primary",
          href: "/accounting/accounts-receivable/invoice?settlement=open",
        },
      ),
      metric(
        "overdue",
        text("Overdue", "เกินกำหนด"),
        1_360_000,
        text("21% of outstanding", "21% ของยอดคงค้าง"),
        {
          format: "currency",
          tone: "destructive",
          href: "/accounting/accounts-receivable/invoice?due=overdue",
        },
      ),
      metric(
        "unapplied",
        text("Unapplied receipts", "รับชำระรอจัดสรร"),
        285_000,
        text("6 receipts", "ใบรับชำระ 6 รายการ"),
        {
          format: "currency",
          tone: "warning",
          href: "/accounting/accounts-receivable/receipt?allocation=unapplied",
        },
      ),
      metric(
        "approval",
        text("Pending approvals", "รออนุมัติ"),
        5,
        text("Invoices and receipts", "ใบแจ้งหนี้และใบรับชำระ"),
        { tone: "info" },
      ),
    ],
    analyses: [
      {
        id: "aging",
        title: text("AR aging", "อายุลูกหนี้"),
        description: text(
          "Posted open items by due date",
          "รายการคงค้างที่ผ่านบัญชีแยกตามวันครบกำหนด",
        ),
        kind: "bar",
        valueLabel: text("Outstanding", "ยอดคงค้าง"),
        format: "currency",
        data: [
          { label: "Not due", value: 3_920_000 },
          { label: "1–30", value: 760_000 },
          { label: "31–60", value: 340_000 },
          { label: "61–90", value: 160_000 },
          { label: "90+", value: 100_000 },
        ],
      },
      {
        id: "collection",
        title: text("Collection plan", "แผนรับชำระ"),
        description: text(
          "Expected receipts, next 6 weeks",
          "ยอดรับที่คาด 6 สัปดาห์ถัดไป",
        ),
        kind: "line",
        valueLabel: text("Expected receipts", "ยอดรับที่คาด"),
        format: "currency",
        data: [680, 920, 760, 1_050, 840, 980].map((value, index) => ({
          label: `W${index + 1}`,
          value: value * 1_000,
        })),
      },
    ],
    tasks: [
      task(
        "follow-up",
        text("High-value overdue customers", "ลูกหนี้มูลค่าสูงที่เกินกำหนด"),
        text(
          "Contact owners assigned for today",
          "มอบหมายผู้ติดตามภายในวันนี้",
        ),
        7,
        "destructive",
        "/accounting/accounts-receivable/invoice?due=overdue",
      ),
      task(
        "allocation",
        text("Receipts awaiting allocation", "ใบรับชำระรอจัดสรร"),
        text(
          "Do not reduce AR before posting",
          "ยังไม่ลดยอด AR ก่อนจัดสรรและผ่านรายการ",
        ),
        6,
        "warning",
        "/accounting/accounts-receivable/receipt?allocation=unapplied",
      ),
    ],
  },
  management: {
    metrics: [
      metric(
        "dso",
        text("Days sales outstanding", "ระยะเวลาเก็บหนี้เฉลี่ย"),
        34,
        text("Target ≤ 30 days", "เป้าหมายไม่เกิน 30 วัน"),
        { format: "days", tone: "warning" },
      ),
      metric(
        "ratio",
        text("Overdue ratio", "สัดส่วนเกินกำหนด"),
        21,
        text("-3 pp versus last month", "ลดลง 3 จุดเทียบเดือนก่อน"),
        { format: "percent", tone: "warning" },
      ),
      metric(
        "effectiveness",
        text("Collection effectiveness", "ประสิทธิผลการเก็บหนี้"),
        87,
        text("Rolling 90 days", "ย้อนหลัง 90 วัน"),
        { format: "percent", tone: "success" },
      ),
      metric(
        "collected",
        text("Cash collected", "เงินรับแล้ว"),
        3_960_000,
        text("Month to date", "ตั้งแต่ต้นเดือน"),
        { format: "currency", tone: "primary" },
      ),
    ],
    analyses: [
      {
        id: "ar-trend",
        title: text("Receivables and collections", "ลูกหนี้และยอดรับชำระ"),
        description: text(
          "Balance versus cash collected",
          "ยอดคงเหลือเทียบเงินรับ",
        ),
        kind: "line",
        valueLabel: text("Receivables", "ลูกหนี้"),
        secondaryLabel: text("Collections", "ยอดรับ"),
        format: "currency",
        data: [
          { label: "Apr", value: 6.9, secondary: 3.2 },
          { label: "May", value: 6.7, secondary: 3.5 },
          { label: "Jun", value: 7.1, secondary: 3.4 },
          { label: "Jul", value: 6.8, secondary: 3.8 },
          { label: "Aug", value: 6.6, secondary: 3.7 },
          { label: "Sep", value: 6.48, secondary: 3.96 },
        ].map((point) => ({
          ...point,
          value: point.value * 1_000_000,
          secondary: point.secondary * 1_000_000,
        })),
      },
      {
        id: "customers",
        title: text("Customer concentration", "การกระจุกตัวของลูกค้า"),
        description: text(
          "Share of outstanding receivables",
          "สัดส่วนยอดลูกหนี้คงค้าง",
        ),
        kind: "donut",
        valueLabel: text("Outstanding", "ยอดคงค้าง"),
        format: "currency",
        data: [
          { label: "Corporate", value: 2_280_000 },
          { label: "OTA", value: 1_640_000 },
          { label: "Events", value: 1_280_000 },
          { label: "Other", value: 1_280_000 },
        ],
      },
    ],
    tasks: [
      task(
        "risk",
        text("Customers above credit threshold", "ลูกค้าที่เกินวงเงินเครดิต"),
        text("Review terms before new billing", "ตรวจเงื่อนไขก่อนวางบิลเพิ่ม"),
        4,
        "warning",
        "/accounting/accounts-receivable/invoice",
      ),
    ],
  },
};

const asset: AccountingDashboardSnapshot = {
  module: "asset",
  title: text("Asset Dashboard", "แดชบอร์ดสินทรัพย์"),
  description: text(
    "Asset value, depreciation and lifecycle exceptions",
    "มูลค่าสินทรัพย์ ค่าเสื่อมราคา และข้อยกเว้นตามวงจร",
  ),
  asOf,
  period: "Sep 2026",
  currency: "THB",
  generatedAt,
  reconciliationVariance: 0,
  operational: {
    metrics: [
      metric(
        "registered",
        text("Registered assets", "สินทรัพย์ในทะเบียน"),
        428,
        text("Across 8 asset classes", "ครอบคลุม 8 ประเภทสินทรัพย์"),
        { tone: "primary", href: "/accounting/asset/register" },
      ),
      metric(
        "capitalize",
        text("Pending capitalization", "รอบันทึกเป็นสินทรัพย์"),
        9,
        text("3 missing supporting documents", "3 รายการขาดเอกสารประกอบ"),
        { tone: "warning", href: "/accounting/asset/register?status=pending" },
      ),
      metric(
        "depreciation",
        text("Depreciation due", "ค่าเสื่อมรอดำเนินการ"),
        18,
        text("2 calculation exceptions", "มีข้อยกเว้นการคำนวณ 2 รายการ"),
        {
          tone: "destructive",
          href: "/accounting/asset/register?depreciation=due",
        },
      ),
      metric(
        "disposal",
        text("Pending disposals", "รอจำหน่าย"),
        6,
        text("Net book value ฿240,000", "มูลค่าตามบัญชี 240,000 บาท"),
        { tone: "info", href: "/accounting/asset/disposal?status=submitted" },
      ),
    ],
    analyses: [
      {
        id: "depreciation-run",
        title: text("Depreciation run", "สถานะประมวลผลค่าเสื่อม"),
        description: text(
          "Assets processed by class",
          "สินทรัพย์ที่ประมวลผลแยกตามประเภท",
        ),
        kind: "bar",
        valueLabel: text("Processed", "ประมวลผลแล้ว"),
        data: [
          { label: "Building", value: 42 },
          { label: "Equipment", value: 138 },
          { label: "Furniture", value: 96 },
          { label: "IT", value: 74 },
          { label: "Vehicles", value: 21 },
        ],
      },
      {
        id: "data-quality",
        title: text("Register data quality", "คุณภาพข้อมูลทะเบียน"),
        description: text(
          "Complete versus records requiring action",
          "รายการครบถ้วนเทียบรายการที่ต้องแก้ไข",
        ),
        kind: "donut",
        valueLabel: text("Assets", "สินทรัพย์"),
        data: [
          { label: "Complete", value: 407 },
          { label: "Missing data", value: 21 },
        ],
      },
    ],
    tasks: [
      task(
        "master-data",
        text(
          "Missing useful life or cost center",
          "ขาดอายุการใช้งานหรือศูนย์ต้นทุน",
        ),
        text(
          "Required before depreciation posting",
          "ต้องแก้ก่อนผ่านรายการค่าเสื่อม",
        ),
        12,
        "destructive",
        "/accounting/asset/register?quality=incomplete",
      ),
      task(
        "custodian",
        text(
          "Custodian confirmation overdue",
          "เกินกำหนดยืนยันผู้ดูแลสินทรัพย์",
        ),
        text("Physical verification follow-up", "ติดตามการตรวจนับสินทรัพย์"),
        9,
        "warning",
        "/accounting/asset/register?verification=overdue",
      ),
    ],
  },
  management: {
    metrics: [
      metric(
        "gross",
        text("Gross asset cost", "ราคาทุนสินทรัพย์"),
        42_800_000,
        text("As of current period", "ณ งวดปัจจุบัน"),
        { format: "currency", tone: "primary" },
      ),
      metric(
        "accumulated",
        text("Accumulated depreciation", "ค่าเสื่อมราคาสะสม"),
        18_450_000,
        text("43.1% of gross cost", "43.1% ของราคาทุน"),
        { format: "currency", tone: "warning" },
      ),
      metric(
        "nbv",
        text("Net book value", "มูลค่าตามบัญชีสุทธิ"),
        24_350_000,
        text("Reconciled to GL", "กระทบยอดกับ GL แล้ว"),
        { format: "currency", tone: "success" },
      ),
      metric(
        "capex",
        text("Capex YTD", "เงินลงทุนตั้งแต่ต้นปี"),
        4_720_000,
        text("Disposals YTD ฿680,000", "จำหน่ายตั้งแต่ต้นปี 680,000 บาท"),
        { format: "currency", tone: "info" },
      ),
    ],
    analyses: [
      {
        id: "nbv",
        title: text("NBV and depreciation", "NBV และค่าเสื่อมราคา"),
        description: text("Last 6 periods", "6 งวดล่าสุด"),
        kind: "line",
        valueLabel: text("NBV", "NBV"),
        secondaryLabel: text("Depreciation", "ค่าเสื่อม"),
        format: "currency",
        data: [
          { label: "Apr", value: 25.8, secondary: 0.36 },
          { label: "May", value: 25.5, secondary: 0.37 },
          { label: "Jun", value: 25.2, secondary: 0.38 },
          { label: "Jul", value: 24.9, secondary: 0.37 },
          { label: "Aug", value: 24.6, secondary: 0.38 },
          { label: "Sep", value: 24.35, secondary: 0.39 },
        ].map((point) => ({
          ...point,
          value: point.value * 1_000_000,
          secondary: point.secondary * 1_000_000,
        })),
      },
      {
        id: "mix",
        title: text("Asset-class mix", "สัดส่วนประเภทสินทรัพย์"),
        description: text(
          "Net book value by class",
          "มูลค่าตามบัญชีสุทธิแยกตามประเภท",
        ),
        kind: "donut",
        valueLabel: text("NBV", "NBV"),
        format: "currency",
        data: [
          { label: "Building", value: 10_800_000 },
          { label: "Equipment", value: 5_650_000 },
          { label: "Furniture", value: 3_280_000 },
          { label: "IT", value: 2_420_000 },
          { label: "Other", value: 2_200_000 },
        ],
      },
    ],
    tasks: [
      task(
        "replacement",
        text(
          "Assets nearing end of useful life",
          "สินทรัพย์ใกล้หมดอายุการใช้งาน",
        ),
        text("Review replacement plan and budget", "ตรวจแผนทดแทนและงบประมาณ"),
        14,
        "info",
        "/accounting/asset/register?age=ending",
      ),
    ],
  },
};

export function buildApDashboardSnapshot(
  data?: ApDashboardSnapshot,
): AccountingDashboardSnapshot {
  const aging = data?.aging.map((item) => ({
    label: item.code.replaceAll("_", " "),
    value: Number(item.amount),
  })) ?? [
    { label: "Not due", value: 2_950_000 },
    { label: "1–30", value: 720_000 },
    { label: "31–60", value: 360_000 },
    { label: "61–90", value: 180_000 },
    { label: "90+", value: 90_000 },
  ];
  const outstanding = data ? Number(data.outstanding_amount) : 4_300_000;
  const overdue =
    aging
      .filter(
        (item) => item.label.includes("overdue") || item.label.match(/\d/),
      )
      .reduce((sum, item) => sum + item.value, 0) || 1_350_000;
  return {
    module: "accountsPayable",
    title: text("Accounts Payable Dashboard", "แดชบอร์ดเจ้าหนี้การค้า"),
    description: text(
      "Liabilities, payment obligations and supplier exposure",
      "หนี้สิน ภาระการจ่าย และความเสี่ยงผู้ขาย",
    ),
    asOf: data?.as_of_date ?? asOf,
    period: "Sep 2026",
    currency: data?.functional_currency ?? "THB",
    generatedAt: data?.generated_at ?? generatedAt,
    reconciliationVariance: Number(data?.reconciliation_variance ?? 0),
    operational: {
      metrics: [
        metric(
          "outstanding",
          text("AP outstanding", "เจ้าหนี้คงค้าง"),
          outstanding,
          text(
            `${data?.outstanding_count ?? 31} open items`,
            `รายการคงค้าง ${data?.outstanding_count ?? 31} รายการ`,
          ),
          {
            format: "currency",
            tone: "primary",
            href: "/accounting/accounts-payable/invoice?lifecycle=posted&settlement=open",
          },
        ),
        metric(
          "prepaid",
          text("Prepaid deposits", "เงินมัดจำจ่ายล่วงหน้า"),
          Number(data?.prepaid_amount ?? 420_000),
          text(
            `${data?.prepaid_count ?? 4} unapplied deposits`,
            `เงินมัดจำรอใช้ ${data?.prepaid_count ?? 4} รายการ`,
          ),
          { format: "currency", tone: "info" },
        ),
        metric(
          "paid",
          text("Paid out", "ยอดจ่ายแล้ว"),
          Number(data?.paid_out_amount ?? 3_180_000),
          text(
            `${data?.payment_count ?? 18} payments this period`,
            `การจ่าย ${data?.payment_count ?? 18} รายการในงวด`,
          ),
          {
            format: "currency",
            tone: "success",
            href: "/accounting/accounts-payable/payment?execution=executed",
          },
        ),
        metric(
          "overdue",
          text("Overdue items", "รายการเกินกำหนด"),
          data?.due.overdue ?? 8,
          text("Prioritize before payment run", "จัดลำดับก่อนรอบจ่าย"),
          {
            tone: "destructive",
            href: "/accounting/accounts-payable/invoice?due_bucket=overdue",
          },
        ),
      ],
      analyses: [
        {
          id: "aging",
          title: text("AP aging analysis", "วิเคราะห์อายุเจ้าหนี้"),
          description: text(
            "Posted open items by due date",
            "รายการคงค้างที่ผ่านบัญชีแยกตามวันครบกำหนด",
          ),
          kind: "bar",
          valueLabel: text("Outstanding", "ยอดคงค้าง"),
          format: "currency",
          data: aging,
        },
        {
          id: "due",
          title: text("Due-date tracker", "ติดตามวันครบกำหนด"),
          description: text(
            "Items requiring payment attention",
            "รายการที่ต้องติดตามก่อนจ่าย",
          ),
          kind: "donut",
          valueLabel: text("Items", "รายการ"),
          data: [
            { label: "Overdue", value: data?.due.overdue ?? 8 },
            { label: "On hold", value: data?.due.on_hold ?? 3 },
            { label: "Reserved", value: data?.due.reserved ?? 6 },
          ],
        },
      ],
      tasks: [
        task(
          "approval-invoice",
          text("AP invoices awaiting approval", "ใบแจ้งหนี้ AP รออนุมัติ"),
          text("Assigned workflow queue", "คิวงานตาม workflow"),
          data?.approvals.invoice ?? 5,
          "warning",
          "/accounting/accounts-payable/invoice?lifecycle=submitted",
        ),
        task(
          "approval-payment",
          text("Payments awaiting approval", "การจ่ายรออนุมัติ"),
          text("Review before release", "ตรวจสอบก่อนปล่อยจ่าย"),
          data?.approvals.payment ?? 3,
          "warning",
          "/accounting/accounts-payable/payment?lifecycle=submitted",
        ),
        task(
          "tax",
          text("Tax and audit exceptions", "ข้อยกเว้นภาษีและการตรวจสอบ"),
          text(
            "Missing documents or matching corrections",
            "เอกสารไม่ครบหรือผลต่างรอแก้ไข",
          ),
          (data?.tax.missing_documents ?? 2) +
            (data?.tax.pending_corrections ?? 2),
          "destructive",
          "/accounting/accounts-payable/invoice?tax=pending",
        ),
      ],
    },
    management: {
      metrics: [
        metric(
          "outstanding",
          text("AP outstanding", "เจ้าหนี้คงค้าง"),
          outstanding,
          text("Posted open liabilities", "หนี้คงค้างที่ผ่านรายการแล้ว"),
          { format: "currency", tone: "primary" },
        ),
        metric(
          "ratio",
          text("Overdue ratio", "สัดส่วนเกินกำหนด"),
          Math.round((overdue / Math.max(outstanding, 1)) * 100),
          text("Share of outstanding", "สัดส่วนของยอดคงค้าง"),
          { format: "percent", tone: "destructive" },
        ),
        metric(
          "obligation",
          text("Due next 30 days", "ครบกำหนดใน 30 วัน"),
          2_740_000,
          text("Committed payment obligations", "ภาระการจ่ายที่ผูกพัน"),
          { format: "currency", tone: "warning" },
        ),
        metric(
          "paid",
          text("Paid out MTD", "ยอดจ่ายตั้งแต่ต้นเดือน"),
          Number(data?.paid_out_amount ?? 3_180_000),
          text("Executed payments", "การจ่ายที่ดำเนินการแล้ว"),
          { format: "currency", tone: "success" },
        ),
      ],
      analyses: [
        {
          id: "payments",
          title: text("Payment trend", "แนวโน้มการจ่าย"),
          description: text(
            "Executed payments, last 6 periods",
            "การจ่ายที่ดำเนินการแล้ว 6 งวดล่าสุด",
          ),
          kind: "line",
          valueLabel: text("Paid out", "ยอดจ่าย"),
          format: "currency",
          data: [2.6, 2.9, 2.7, 3.2, 3.0, 3.18].map((value, index) => ({
            label: ["Apr", "May", "Jun", "Jul", "Aug", "Sep"][index],
            value: value * 1_000_000,
          })),
        },
        {
          id: "vendors",
          title: text("Vendor concentration", "การกระจุกตัวของผู้ขาย"),
          description: text(
            "Outstanding by supplier group",
            "ยอดคงค้างแยกตามกลุ่มผู้ขาย",
          ),
          kind: "donut",
          valueLabel: text("Outstanding", "ยอดคงค้าง"),
          format: "currency",
          data: [
            { label: "Food", value: 1_480_000 },
            { label: "Beverage", value: 960_000 },
            { label: "Utilities", value: 740_000 },
            { label: "Services", value: 620_000 },
            { label: "Other", value: 500_000 },
          ],
        },
      ],
      tasks: [
        task(
          "exposure",
          text(
            "Suppliers above concentration threshold",
            "ผู้ขายที่เกินเกณฑ์การกระจุกตัว",
          ),
          text(
            "Review payment dependency",
            "ตรวจความเสี่ยงจากการพึ่งพาการจ่าย",
          ),
          3,
          "info",
          "/accounting/accounts-payable/invoice",
        ),
      ],
    },
  };
}

export function getAccountingDashboardSnapshot(
  module: Exclude<AccountingDashboardModule, "accountsPayable">,
) {
  return module === "generalLedger"
    ? gl
    : module === "accountsReceivable"
      ? ar
      : asset;
}
