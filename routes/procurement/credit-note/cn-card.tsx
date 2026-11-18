import { FileText, PackageCheck, type LucideIcon } from "lucide-react";
import { useTranslations } from "use-intl";
import { StatusChip } from "@/components/ui/status-chip";
import {
  ListCard,
  ListCardAuditRows,
  ListCardRow,
  ListCardStatusRow,
} from "@/components/share/list-card";
import { useProfile } from "@/hooks/use-profile";
import { formatDate } from "@/lib/date-utils";
import { formatCurrency } from "@/lib/currency-utils";
import type { CreditNote } from "@/types/credit-note";
import { StatusIconLabel } from "@/components/ui/status-icon-label";
import { CN_STATUS_CONFIG, CN_TYPE_CONFIG } from "@/constant/credit-note";

interface CnCardProps {
  readonly item: CreditNote;
  readonly onEdit: (item: CreditNote) => void;
  readonly onDelete: (item: CreditNote) => void;
  /**
   * การ์ดกระชับสำหรับมือถือ (แบบเดียวกับการ์ด PR/PO/GRN) — เลขที่ + ชิปสถานะบนหัว แล้วเป็น
   * บรรทัดสรุปไม่มี label: วันที่·ชนิด / ผู้ขาย / ผู้สร้าง + ยอดเงิน
   * การ์ดเต็มยังใช้กับโหมด grid บนจอกว้าง
   */
  readonly compact?: boolean;
}

/**
 * บรรทัดอ้างอิงในการ์ดกระชับ: ไอคอน (ป้ายอยู่ใน sr-only + title) · เลข · วันที่
 * ไม่มีทั้งเลขและวันที่ = ไม่ render
 */
function RefLine({
  icon: Icon,
  label,
  no,
  date,
}: {
  readonly icon: LucideIcon;
  readonly label: string;
  readonly no?: string | null;
  readonly date?: string;
}) {
  if (!no && !date) return null;
  return (
    <div
      className="text-muted-foreground flex min-w-0 items-center gap-1.5"
      title={label}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden="true" />
      <span className="sr-only">{label}</span>
      <span className="text-foreground truncate">{no || "—"}</span>
      {date && (
        <>
          <span aria-hidden="true">·</span>
          <span className="shrink-0 tabular-nums">{date}</span>
        </>
      )}
    </div>
  );
}

export default function CnCard({
  item,
  onEdit,
  onDelete,
  compact = false,
}: CnCardProps) {
  const tfl = useTranslations("field");
  const { dateFormat } = useProfile();

  const statusConfig = CN_STATUS_CONFIG[item.doc_status];
  const typeConfig = CN_TYPE_CONFIG[item.credit_note_type];
  const amount = item.total_amount;
  const hasAmount = amount != null && !Number.isNaN(Number(amount));

  const amountNode = hasAmount ? (
    <span className="font-semibold tabular-nums">
      {formatCurrency(Number(amount))}
      {item.currency_code && (
        <span className="text-muted-foreground ml-1 font-normal">
          {item.currency_code}
        </span>
      )}
    </span>
  ) : null;

  if (compact) {
    const by = item.audit?.created?.name;
    return (
      <ListCard
        title={item.cn_no}
        badge={
          item.doc_status ? (
            <StatusChip
              status={item.doc_status}
              label={statusConfig?.label ?? item.doc_status}
              className="shrink-0"
            />
          ) : undefined
        }
        onOpen={() => onEdit(item)}
        onDelete={() => onDelete(item)}
      >
        <div className="text-muted-foreground flex min-w-0 items-center gap-1.5">
          <span className="shrink-0 tabular-nums">
            {formatDate(item.cn_date, dateFormat)}
          </span>
          <span aria-hidden="true">·</span>
          <StatusIconLabel
            status={item.credit_note_type}
            label={typeConfig?.label ?? item.credit_note_type}
            className="text-muted-foreground min-w-0 truncate"
          />
        </div>
        {item.vendor_name && (
          <div className="truncate font-medium" title={item.vendor_name}>
            {item.vendor_name}
          </div>
        )}
        <RefLine
          icon={PackageCheck}
          label={`${tfl("grnNo")} · ${tfl("grnDate")}`}
          no={item.grn_no}
          date={formatDate(item.grn_date, dateFormat) || undefined}
        />
        <RefLine
          icon={FileText}
          label={`${tfl("invoiceNo")} · ${tfl("invoiceDate")}`}
          no={item.invoice_no}
          date={formatDate(item.invoice_date, dateFormat) || undefined}
        />
        <div className="flex min-w-0 items-baseline justify-between gap-3">
          <span
            className="text-muted-foreground truncate"
            title={by ? `${tfl("createdBy")}: ${by}` : undefined}
          >
            {by}
          </span>
          {amountNode && <span className="shrink-0">{amountNode}</span>}
        </div>
      </ListCard>
    );
  }

  return (
    <ListCard
      title={item.cn_no}
      onOpen={() => onEdit(item)}
      onDelete={() => onDelete(item)}
    >
      <ListCardStatusRow
        status={item.doc_status}
        label={statusConfig?.label ?? item.doc_status}
      />
      <ListCardRow label={tfl("docDate")}>
        <span className="tabular-nums">
          {formatDate(item.cn_date, dateFormat)}
        </span>
      </ListCardRow>
      <ListCardRow label={tfl("type")}>
        <StatusIconLabel
          status={item.credit_note_type}
          label={typeConfig?.label ?? item.credit_note_type}
          className="text-muted-foreground"
        />
      </ListCardRow>
      {item.vendor_name && (
        <ListCardRow label={tfl("vendor")}>{item.vendor_name}</ListCardRow>
      )}
      {item.grn_no && (
        <ListCardRow label={tfl("grnNo")}>{item.grn_no}</ListCardRow>
      )}
      {item.grn_date && (
        <ListCardRow label={tfl("grnDate")}>
          <span className="tabular-nums">
            {formatDate(item.grn_date, dateFormat)}
          </span>
        </ListCardRow>
      )}
      {item.invoice_no && (
        <ListCardRow label={tfl("invoiceNo")}>{item.invoice_no}</ListCardRow>
      )}
      {item.invoice_date && (
        <ListCardRow label={tfl("invoiceDate")}>
          <span className="tabular-nums">
            {formatDate(item.invoice_date, dateFormat)}
          </span>
        </ListCardRow>
      )}
      {amountNode && (
        <ListCardRow label={tfl("totalAmount")}>{amountNode}</ListCardRow>
      )}
      <ListCardAuditRows audit={item.audit} />
    </ListCard>
  );
}
