import { useTranslations } from "use-intl";
import { HiddenValue } from "@/components/share/hidden-value";
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
  readonly item: PurchaseOrder;
  readonly onEdit: (item: PurchaseOrder) => void;
  readonly onDelete: (item: PurchaseOrder) => void;
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
export default function PoCard({ item, onEdit, onDelete }: PoCardProps) {
  const tfl = useTranslations("field");
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

  return (
    <ListCard
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
      {totalHidden && (
        <ListCardRow label={tfl("totalAmount")}>
          <HiddenValue />
        </ListCardRow>
      )}
      {!totalHidden && hasAmount && (
        <ListCardRow label={tfl("totalAmount")}>
          <span className="font-semibold tabular-nums">
            {formatCurrency(Number(amount))}
            {item.currency?.code && (
              <span className="text-muted-foreground ml-1 font-normal">
                {item.currency.code}
              </span>
            )}
          </span>
        </ListCardRow>
      )}
      <ListCardAuditRows audit={item.audit} />
    </ListCard>
  );
}
