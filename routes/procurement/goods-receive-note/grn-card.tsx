import { FileText } from "lucide-react";
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
import type { GoodsReceiveNote } from "@/types/goods-receive-note";
import { StatusIconLabel } from "@/components/ui/status-icon-label";
import { GRN_STATUS_CONFIG } from "@/constant/goods-receive-note";
import { getGrnDocTypeLabel } from "@/constant/grn-doc-type";

interface GrnCardProps {
  readonly item: GoodsReceiveNote;
  readonly onEdit: (item: GoodsReceiveNote) => void;
  readonly onDelete: (item: GoodsReceiveNote) => void;
  /**
   * การ์ดกระชับสำหรับมือถือ (แบบเดียวกับการ์ด PR/PO) — เลขที่ + ชิปสถานะบนหัว แล้วเป็น
   * บรรทัดสรุปไม่มี label: วันที่รับ·ชนิด / ผู้ขาย / เลขใบแจ้งหนี้ (ไอคอนเอกสาร) + ยอดเงิน
   * ไม่มีแถว audit เปิดใบดูได้ · การ์ดเต็มยังใช้กับโหมด grid บนจอกว้าง
   */
  readonly compact?: boolean;
}

export default function GrnCard({
  item,
  onEdit,
  onDelete,
  compact = false,
}: GrnCardProps) {
  const tfl = useTranslations("field");
  const { dateFormat } = useProfile();

  const status = item.doc_status || "draft";
  const statusConfig = GRN_STATUS_CONFIG[status];
  const docTypeLabel = getGrnDocTypeLabel(tfl, item.doc_type);
  const totalAmount = item.total_amount;
  const hasAmount = totalAmount != null && !Number.isNaN(totalAmount);

  const amountNode = hasAmount ? (
    <span className="font-semibold tabular-nums">
      {formatCurrency(totalAmount)}
      {item.currency?.code && (
        <span className="text-muted-foreground ml-1 font-normal">
          {item.currency.code}
        </span>
      )}
    </span>
  ) : null;

  if (compact) {
    return (
      <ListCard
        title={item.grn_no}
        badge={
          <StatusChip
            status={status}
            label={statusConfig?.label ?? status}
            // ทรงเดียวกับแถวสถานะของการ์ดเต็ม/คอลัมน์ในตาราง (ไม่ใส่สี)
            className="text-muted-foreground shrink-0 [&_svg]:text-current!"
          />
        }
        onOpen={() => onEdit(item)}
        onDelete={() => onDelete(item)}
      >
        <div className="text-muted-foreground flex min-w-0 items-center gap-1.5">
          <span className="shrink-0 tabular-nums">
            {item.grn_date ? formatDate(item.grn_date, dateFormat) : "—"}
          </span>
          <span aria-hidden="true">·</span>
          <StatusIconLabel
            status={item.doc_type}
            label={docTypeLabel}
            className="text-muted-foreground min-w-0 truncate"
          />
        </div>
        {item.vendor_name && (
          <div className="truncate font-medium" title={item.vendor_name}>
            {item.vendor_name}
          </div>
        )}
        <div className="flex min-w-0 items-baseline justify-between gap-3">
          {item.invoice_no ? (
            <span
              className="text-muted-foreground flex min-w-0 items-center gap-1"
              title={tfl("invoiceNo")}
            >
              <FileText className="size-3.5 shrink-0" aria-hidden="true" />
              <span className="sr-only">{tfl("invoiceNo")}</span>
              <span className="truncate">{item.invoice_no}</span>
            </span>
          ) : (
            <span />
          )}
          {amountNode && <span className="shrink-0">{amountNode}</span>}
        </div>
      </ListCard>
    );
  }

  return (
    <ListCard
      title={item.grn_no}
      onOpen={() => onEdit(item)}
      onDelete={() => onDelete(item)}
    >
      <ListCardStatusRow
        status={status}
        label={statusConfig?.label ?? status}
        // สีเดียวกับแถวชนิดใบ ทรงเดียวกับคอลัมน์สถานะในตาราง (ดู use-grn-table)
        className="text-muted-foreground [&_svg]:text-current!"
      />
      <ListCardRow label={tfl("grnDate")}>
        <span className="tabular-nums">
          {item.grn_date ? formatDate(item.grn_date, dateFormat) : "—"}
        </span>
      </ListCardRow>
      <ListCardRow label={tfl("type")}>
        <StatusIconLabel
          status={item.doc_type}
          label={docTypeLabel}
          className="text-muted-foreground"
        />
      </ListCardRow>
      {item.vendor_name && (
        <ListCardRow label={tfl("vendor")}>{item.vendor_name}</ListCardRow>
      )}
      {item.invoice_no && (
        <ListCardRow label={tfl("invoiceNo")}>{item.invoice_no}</ListCardRow>
      )}
      {amountNode && (
        <ListCardRow label={tfl("totalAmount")}>{amountNode}</ListCardRow>
      )}
      <ListCardAuditRows audit={item.audit} />
    </ListCard>
  );
}
