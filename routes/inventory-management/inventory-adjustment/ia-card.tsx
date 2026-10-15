import { useTranslations } from "use-intl";
import {
  ListCard,
  ListCardAuditRows,
  ListCardRow,
  ListCardStatusRow,
} from "@/components/share/list-card";
import { useProfile } from "@/hooks/use-profile";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/date-utils";
import { formatAmount } from "@/lib/currency-utils";
import {
  IA_STATUS_CONFIG,
  IA_TYPE_ICON_COLOR,
  IA_TYPE_SIGN,
} from "@/constant/inventory-adjustment";
import {
  getAdjustmentType,
  type InventoryAdjustment,
} from "@/types/inventory-adjustment";

interface IaCardProps {
  readonly item: InventoryAdjustment;
  readonly onEdit: (item: InventoryAdjustment) => void;
  readonly onDelete: (item: InventoryAdjustment) => void;
}

export default function IaCard({ item, onEdit, onDelete }: IaCardProps) {
  const tfl = useTranslations("field");
  const { dateFormat, amountFormat, defaultCurrencyCode } = useProfile();

  const typeKey = getAdjustmentType(item);
  const isStockIn = typeKey === "stock-in";
  const docNo = isStockIn ? item.si_no : item.so_no;
  const docDate = isStockIn ? item.si_date : item.so_date;
  const statusConfig =
    IA_STATUS_CONFIG[item.doc_status] ?? IA_STATUS_CONFIG.draft;
  const itemCount =
    item.item_count ??
    (isStockIn ? item.stock_in_detail : item.stock_out_detail)?.length ??
    0;

  // หมึกตามทิศ ใช้ชุดเดียวกับตาราง: ป้าย type + ยอดรวมที่มีเครื่องหมาย (ยอด 0 ไม่ลงสี)
  const accentText = IA_TYPE_ICON_COLOR[typeKey];
  const total = Number(item.base_total_cost) || 0;

  return (
    <ListCard
      title={docNo}
      onOpen={() => onEdit(item)}
      onDelete={() => onDelete(item)}
    >
      <ListCardStatusRow status={item.doc_status} label={statusConfig.label} />
      {docDate && (
        <ListCardRow label={tfl("date")}>
          <span className="tabular-nums">
            {formatDate(docDate, dateFormat)}
          </span>
        </ListCardRow>
      )}
      <ListCardRow label={tfl("type")}>
        <span className={cn("font-semibold", accentText)}>
          {isStockIn ? tfl("stockIn") : tfl("stockOut")}
        </span>
      </ListCardRow>
      {item.adjustment_type_name && (
        <ListCardRow label={tfl("reason")}>
          {item.adjustment_type_name}
        </ListCardRow>
      )}
      {item.location_name && (
        <ListCardRow label={tfl("location")}>{item.location_name}</ListCardRow>
      )}
      <ListCardRow label={tfl("items")}>
        <span className="tabular-nums">{itemCount}</span>
      </ListCardRow>
      <ListCardRow label={tfl("total")}>
        <span
          className={cn(
            "font-semibold tabular-nums",
            total !== 0 && accentText,
          )}
        >
          {total !== 0 && IA_TYPE_SIGN[typeKey]}
          {formatAmount(item.base_total_cost, amountFormat)}
          {defaultCurrencyCode && (
            <span className="text-muted-foreground ml-1 font-normal">
              {defaultCurrencyCode}
            </span>
          )}
        </span>
      </ListCardRow>
      <ListCardAuditRows audit={item.audit} />
    </ListCard>
  );
}
