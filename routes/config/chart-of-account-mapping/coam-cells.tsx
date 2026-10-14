import { Link } from "react-router";
import { useTranslations } from "use-intl";
import { NameWithSubtext } from "@/components/share/name-with-sub-text";
import { Badge } from "@/components/ui/badge";
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
  missing_cost_center: "issueMissingCostCenter",
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
  const label = t(SOURCE_KEY[source]);
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

/** ข้อความเตือนเมื่อ resolve ไม่ได้ — สี warning ต้องใช้ `-ink` ให้ผ่าน WCAG AA */
export function IssueText({ issue }: { readonly issue: MappingIssue }) {
  const t = useTranslations("config.chartOfAccountMapping");
  return <span className="text-warning-ink text-xs">{t(ISSUE_KEY[issue])}</span>;
}

/** รหัสบัญชีที่ resolve แล้ว + ที่มา หรือข้อความ issue ถ้าหาไม่เจอ */
export function AccountCell({ row }: { readonly row: AccountMappingRow }) {
  const a = row.account;
  if (!a.code) return a.issue ? <IssueText issue={a.issue} /> : null;
  return (
    <div className="flex flex-col gap-1">
      <NameWithSubtext primary={a.code} secondary={a.name ?? undefined} />
      {a.issue ? (
        <IssueText issue={a.issue} />
      ) : (
        <SourceBadge source={a.source} href={sourceHref(a.source, row)} />
      )}
    </div>
  );
}

/** cost center ที่ resolve แล้ว + ที่มา หรือข้อความ issue ถ้า location ไม่มี */
export function CostCenterCell({ row }: { readonly row: AccountMappingRow }) {
  const c = row.cost_center;
  if (!c.id) return c.issue ? <IssueText issue={c.issue} /> : null;
  return (
    <div className="flex flex-col gap-1">
      <NameWithSubtext primary={c.code ?? c.id} secondary={c.name ?? undefined} />
      <SourceBadge source={c.source} href={sourceHref(c.source, row)} />
    </div>
  );
}

/**
 * สถานะของแถวตามกติกาเดียวกับตัวกรอง `status` ฝั่ง backend —
 * มี issue = ยังไม่ครบ · ไม่งั้นแก้ทับ/ค่าเริ่มต้น และติดป้าย "ยังไม่ตรวจ" เพิ่มเมื่อ `!is_reviewed`
 */
export function StatusCell({ row }: { readonly row: AccountMappingRow }) {
  const t = useTranslations("config.chartOfAccountMapping");
  const incomplete = !!row.account.issue || !!row.cost_center.issue;
  const overridden =
    row.account.source === "override" || row.cost_center.source === "override";
  return (
    <div className="flex flex-wrap items-center gap-1">
      {incomplete ? (
        <Badge size="xs" variant="warning-light">
          {t("statusIncomplete")}
        </Badge>
      ) : (
        <Badge size="xs" variant={overridden ? "primary-light" : "invert-light"}>
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
