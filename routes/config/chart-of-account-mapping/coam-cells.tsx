import { TriangleAlert } from "lucide-react";
import { Link } from "react-router";
import { useTranslations } from "use-intl";
import { NameWithSubtext } from "@/components/share/name-with-sub-text";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type {
  AccountIssue,
  AccountMappingRow,
  AccountSource,
  CostCenterIssue,
  CostCenterSource,
} from "@/types/chart-of-account-mapping";

const SOURCE_KEY = {
  override: "sourceOverride",
  item_group: "sourceItemGroup",
  sub_category: "sourceSubCategory",
  category: "sourceCategory",
  location: "sourceLocation",
} as const;

const ISSUE_KEY = {
  missing_inventory_account: "issueMissingInventoryAccount",
  missing_direct_account: "issueMissingDirectAccount",
  account_not_in_coa: "issueAccountNotInCoa",
  missing_ap_account: "issueMissingApAccount",
  missing_adjustment_account: "issueMissingAdjustmentAccount",
  missing_cost_center: "issueMissingCostCenter",
} as const;

/** ป้ายสั้นในตาราง — ประโยคเต็ม (ISSUE_KEY) ย้ายไปอยู่ใน tooltip */
const ISSUE_SHORT_KEY = {
  missing_inventory_account: "issueShortNoAccount",
  missing_direct_account: "issueShortNoAccount",
  account_not_in_coa: "issueShortNotInCoa",
  missing_ap_account: "issueShortNoAccount",
  missing_adjustment_account: "issueShortNoAccount",
  missing_cost_center: "issueShortNoCostCenter",
} as const;

export type MappingSource = AccountSource | CostCenterSource;
export type MappingIssue = AccountIssue | CostCenterIssue;

/** ปลายทางที่ใช้แก้ค่าเริ่มต้นต้นทาง (spec §6.1) — override ไม่มีลิงก์ */
function sourceHref(
  source: MappingSource | null,
  row: AccountMappingRow,
): string | undefined {
  switch (source) {
    case "item_group":
    case "sub_category":
    case "category":
      return "/product-management/category";
    case "location":
      return `/config/location/${row.location.id}`;
    default:
      return undefined;
  }
}

/**
 * ป้ายบอกว่าค่ามาจากไหน — แก้ทับ = ทึบ (primary) · ค่าเริ่มต้น = outline
 * ส่ง `href` แล้วป้ายเป็นลิงก์ไปหน้าที่แก้ค่าต้นทางได้
 */
export function SourceBadge({
  source,
  href,
}: {
  readonly source: MappingSource | null;
  readonly href?: string;
}) {
  const t = useTranslations("config.chartOfAccountMapping");
  if (!source) return null;
  const override = source === "override";
  const key = SOURCE_KEY[source];
  // backend รุ่นเก่ายังส่ง vendor / bu_default / adjustment_type ที่ไม่มีคีย์แปลแล้ว — ไม่แสดงป้าย
  if (!key) return null;
  const label = t(key);
  if (href) {
    return (
      <Badge asChild size="xs" variant="outline">
        <Link to={href}>{label}</Link>
      </Badge>
    );
  }
  return (
    <Badge size="xs" variant={override ? "default" : "outline"}>
      {label}
    </Badge>
  );
}

/**
 * หน้าที่ต้องไปแก้เพื่อให้ issue หาย — แก้ที่ต้นทางแล้วทุกแถวที่ใช้ค่าเริ่มต้นตามไปเอง
 * (ไม่ใช่ override ทีละแถว) · หน้า category รับ `?search=` แล้วกางต้นไม้ถึง item group นั้น
 */
function issueHref(
  issue: MappingIssue,
  row: AccountMappingRow,
): string | undefined {
  switch (issue) {
    case "missing_cost_center":
      return `/config/location/${row.location.id}`;
    case "account_not_in_coa":
      return "/config/chart-of-accounts";
    // AP / adjustment: บัญชีมาจาก mapping อย่างเดียว — ไม่มีต้นทางอื่นให้ไปแก้
    // (กดแถวเพื่อเปิดแผงแก้ override ของแถวนั้น)
    case "missing_ap_account":
    case "missing_adjustment_account":
      return undefined;
    case "missing_inventory_account":
    case "missing_direct_account":
      return `/product-management/category?search=${encodeURIComponent(row.item_group.code)}`;
  }
}

/**
 * ป้ายเตือนสั้น ๆ เมื่อ resolve ไม่ได้ — ลิงก์ไปหน้าต้นทางที่ต้องแก้ ประโยคเต็มอยู่ใน tooltip
 * สี warning ต้องใช้ `-ink` ให้ผ่าน WCAG AA
 */
export function IssueText({
  issue,
  row,
}: {
  readonly issue: MappingIssue;
  readonly row: AccountMappingRow;
}) {
  const t = useTranslations("config.chartOfAccountMapping");
  const href = issueHref(issue, row);
  const body = (
    <>
      <TriangleAlert className="size-3.5 shrink-0" aria-hidden />
      {t(ISSUE_SHORT_KEY[issue])}
    </>
  );
  const cls = "text-warning-ink inline-flex w-fit items-center gap-1 text-xs";
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {href ? (
          <Link to={href} className={`${cls} hover:underline`}>
            {body}
          </Link>
        ) : (
          <span className={cls}>{body}</span>
        )}
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        <p>{t(ISSUE_KEY[issue])}</p>
        {href && <p className="text-muted-foreground">{t("issueFixHint")}</p>}
      </TooltipContent>
    </Tooltip>
  );
}

/** รหัสบัญชีที่ resolve แล้ว + ที่มา หรือข้อความ issue ถ้าหาไม่เจอ */
export function AccountCell({ row }: { readonly row: AccountMappingRow }) {
  const a = row.account;
  if (!a.code) return a.issue ? <IssueText issue={a.issue} row={row} /> : null;
  return (
    <div className="flex flex-col gap-1">
      <NameWithSubtext primary={a.code} secondary={a.name ?? undefined} />
      {a.issue ? (
        <IssueText issue={a.issue} row={row} />
      ) : (
        <SourceBadge source={a.source} href={sourceHref(a.source, row)} />
      )}
    </div>
  );
}

/** cost center ที่ resolve แล้ว + ที่มา หรือข้อความ issue ถ้า location ไม่มี */
export function CostCenterCell({ row }: { readonly row: AccountMappingRow }) {
  const c = row.cost_center;
  if (!c.id) return c.issue ? <IssueText issue={c.issue} row={row} /> : null;
  return (
    <div className="flex flex-col gap-1">
      <NameWithSubtext
        primary={c.code ?? c.id}
        secondary={c.name ?? undefined}
      />
      <SourceBadge source={c.source} href={sourceHref(c.source, row)} />
    </div>
  );
}

/**
 * สถานะของแถวตามกติกาเดียวกับตัวกรอง `status` ฝั่ง backend —
 * ไม่มีบัญชีหรือ cost center = ยังไม่ครบ · ไม่งั้นแก้ทับ/ค่าเริ่มต้น และติดป้าย "ยังไม่ตรวจ" เพิ่มเมื่อ `!is_reviewed`
 */
export function StatusCell({ row }: { readonly row: AccountMappingRow }) {
  const t = useTranslations("config.chartOfAccountMapping");
  // ตรงกับตัวกรอง incomplete ฝั่ง backend — account_not_in_coa (มี code) ไม่นับ
  const incomplete = row.account.code === null || row.cost_center.id === null;
  const overridden =
    row.account.source === "override" || row.cost_center.source === "override";
  return (
    <div className="flex flex-wrap items-center gap-1">
      {incomplete ? (
        <Badge size="xs" variant="warning-light">
          {t("statusIncomplete")}
        </Badge>
      ) : (
        <Badge
          size="xs"
          variant={overridden ? "primary-light" : "invert-light"}
        >
          {t(overridden ? "statusOverridden" : "statusDefault")}
        </Badge>
      )}
      {!row.is_reviewed && (
        <Badge size="xs" variant="outline">
          {t("statusUnreviewed")}
        </Badge>
      )}
    </div>
  );
}
