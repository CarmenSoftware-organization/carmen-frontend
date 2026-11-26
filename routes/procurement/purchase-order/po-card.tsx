import { Truck } from "lucide-react";
import { useTranslations } from "use-intl";
import { StatusChip } from "@/components/ui/status-chip";
import { isSentBack } from "@/constant/last-action";
import { HiddenValue } from "@/components/share/hidden-value";
import { SlaStatus } from "@/components/share/sla-status";
import { isPriceHidden } from "@/types/workflows";
import {
  ListCard,
  ListCardAuditRows,
  ListCardRow,
  ListCardStatusRow,
  ListCardSendBackRow,
} from "@/components/share/list-card";
import { useProfile } from "@/hooks/use-profile";
import { formatDate } from "@/lib/date-utils";
import { formatCurrency } from "@/lib/currency-utils";
import { StatusIconLabel } from "@/components/ui/status-icon-label";
import { PO_STATUS_CONFIG, PO_TYPE_CONFIG } from "@/constant/purchase-order";
import { PO_TYPE, type PurchaseOrder } from "@/types/purchase-order";

interface PoCardProps {
  /** เลขลำดับแถว (`rowNumber()`) → `ListCard rowNo` */
  readonly rowNo?: number;
  readonly item: PurchaseOrder;
  readonly onEdit: (item: PurchaseOrder) => void;
  readonly onDelete: (item: PurchaseOrder) => void;
  /**
   * การ์ดกระชับสำหรับมือถือ (แบบเดียวกับการ์ด PR) — เลขที่ + ชิปสถานะบนหัว แล้วเป็น
   * บรรทัดสรุปไม่มี label: วันที่สั่ง·ชนิด / ผู้ขาย / วันส่ง (ไอคอนรถ) + ยอดเงิน
   * ไม่มีแถว audit เปิดใบดูได้ · การ์ดเต็มยังใช้กับโหมด grid บนจอกว้าง
   */
  readonly compact?: boolean;
}

/**
 * การ์ดใบสั่งซื้อ 1 ใบ สำหรับหน้ารายการโหมด grid/mobile
 *
 * ใช้ `ListCard` ตัวเดียวกับการ์ด PR/SR/IA/PRT — ไฟล์นี้เหลือแค่ว่าข้อมูลอะไร
 * อยู่แถวไหน ครบเท่าคอลัมน์ของตาราง PO · ยอดเงินใช้ `currency_code` ของใบนั้น
 * (PO มีสกุลเงินต่อใบ ไม่ใช่สกุลของ BU เหมือนโมดูลอื่น)
 *
 * ไม่มีแถว credit term เพราะ list endpoint ไม่ส่ง `credit_term_value` (ดู
 * `PurchaseOrder`) — เคยมีแถวนี้ตอนที่คิดว่ามันส่งมา
 *
 * @param props.item - ข้อมูลใบสั่งซื้อ
 * @param props.onEdit - callback เมื่อคลิกการ์ด
 * @param props.onDelete - callback เมื่อกดปุ่มลบ
 */
export default function PoCard({
  item,
  onEdit,
  onDelete,
  compact = false,
  rowNo,
}: PoCardProps) {
  const tfl = useTranslations("field");
  const tc = useTranslations("common");
  const { dateFormat } = useProfile();

  const statusConfig = item.po_status
    ? PO_STATUS_CONFIG[item.po_status]
    : undefined;
  const typeConfig =
    PO_TYPE_CONFIG[item.po_type ?? PO_TYPE.MANUAL] ??
    PO_TYPE_CONFIG[PO_TYPE.MANUAL];
  const amount = item.total_amount;
  const totalHidden = isPriceHidden(item.hidden_fields, "total_price");
  const hasAmount = amount != null && !Number.isNaN(Number(amount));

  const amountNode = totalHidden ? (
    <HiddenValue />
  ) : hasAmount ? (
    <span className="font-semibold tabular-nums">
      {formatCurrency(Number(amount))}
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
        rowNo={rowNo}
        title={item.po_no}
        badge={
          statusConfig?.label || isSentBack(item.last_action) ? (
            <div className="flex shrink-0 items-center gap-1">
              {isSentBack(item.last_action) && (
                <StatusChip status="send_back" label={tc("sendBack")} />
              )}
              {item.po_status && statusConfig?.label && (
                <StatusChip
                  status={item.po_status}
                  label={statusConfig.label}
                />
              )}
            </div>
          ) : undefined
        }
        onOpen={() => onEdit(item)}
        onDelete={() => onDelete(item)}
      >
        <div className="text-muted-foreground flex min-w-0 items-center gap-1.5">
          <span className="shrink-0 tabular-nums">
            {formatDate(item.order_date, dateFormat)}
          </span>
          {typeConfig?.label && (
            <>
              <span aria-hidden="true">·</span>
              <StatusIconLabel
                status={item.po_type ?? PO_TYPE.MANUAL}
                label={typeConfig.label}
                className="text-muted-foreground min-w-0 truncate"
              />
            </>
          )}
        </div>
        {item.vendor?.name && (
          <div className="truncate font-medium" title={item.vendor.name}>
            {item.vendor.name}
          </div>
        )}
        <div className="flex min-w-0 items-baseline justify-between gap-3">
          {item.delivery_date ? (
            <span
              className="text-muted-foreground flex items-center gap-1 tabular-nums"
              title={tfl("deliveryDate")}
            >
              <Truck className="size-3.5 shrink-0" aria-hidden="true" />
              <span className="sr-only">{tfl("deliveryDate")}</span>
              {formatDate(item.delivery_date, dateFormat)}
            </span>
          ) : (
            <span />
          )}
          {amountNode && <span className="shrink-0">{amountNode}</span>}
        </div>
        <SlaStatus dueAt={item.sla_due_at} minutes={item.sla_minutes} />
      </ListCard>
    );
  }

  return (
    <ListCard
      rowNo={rowNo}
      title={item.po_no}
      onOpen={() => onEdit(item)}
      onDelete={() => onDelete(item)}
    >
      <ListCardStatusRow status={item.po_status} label={statusConfig?.label} />
      <ListCardSendBackRow lastAction={item.last_action} />
      <ListCardRow label={tfl("orderDate")}>
        <span className="tabular-nums">
          {formatDate(item.order_date, dateFormat)}
        </span>
      </ListCardRow>
      {typeConfig?.label && (
        <ListCardRow label={tfl("poType")}>
          <StatusIconLabel
            status={item.po_type ?? PO_TYPE.MANUAL}
            label={typeConfig.label}
            className="text-muted-foreground"
          />
        </ListCardRow>
      )}
      {item.vendor?.name && (
        <ListCardRow label={tfl("vendor")}>{item.vendor.name}</ListCardRow>
      )}
      {item.delivery_date && (
        <ListCardRow label={tfl("deliveryDate")}>
          <span className="tabular-nums">
            {formatDate(item.delivery_date, dateFormat)}
          </span>
        </ListCardRow>
      )}
      {item.workflow_current_stage && (
        <ListCardRow label={tfl("stage")}>
          {item.workflow_current_stage}
          <SlaStatus
            dueAt={item.sla_due_at}
            minutes={item.sla_minutes}
            className="block"
          />
        </ListCardRow>
      )}
      {amountNode && (
        <ListCardRow label={tfl("totalAmount")}>{amountNode}</ListCardRow>
      )}
      <ListCardAuditRows audit={item.audit} />
    </ListCard>
  );
}
