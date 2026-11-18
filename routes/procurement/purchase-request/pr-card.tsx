import { CheckCircle2, XCircle } from "lucide-react";
import { useTranslations } from "use-intl";
import { Button } from "@/components/ui/button";
import { StatusChip } from "@/components/ui/status-chip";
import { isSentBack } from "@/constant/last-action";
import {
  ListCard,
  ListCardAuditRows,
  ListCardRow,
  ListCardStatusRow,
  ListCardSendBackRow,
} from "@/components/share/list-card";
import { useProfile } from "@/hooks/use-profile";
import { formatDate } from "@/lib/date-utils";
import { formatAmount } from "@/lib/currency-utils";
import { PR_STATUS_CONFIG } from "@/constant/purchase-request";
import type { PurchaseRequest } from "@/types/purchase-request";
import { PR_STATUS } from "@/types/purchase-request";
import { HiddenValue } from "@/components/share/hidden-value";
import { isPriceHidden } from "@/types/workflows";

interface PrCardProps {
  readonly item: PurchaseRequest;
  readonly onEdit: (item: PurchaseRequest) => void;
  readonly onApprove?: (item: PurchaseRequest) => void;
  readonly onReject?: (item: PurchaseRequest) => void;
  readonly onDelete?: (item: PurchaseRequest) => void;
  readonly isMyPending?: boolean;
  /**
   * การ์ดกระชับสำหรับมือถือ — เลขที่ + ชิปสถานะบนหัว แล้วเป็นบรรทัดสรุปไม่มี label
   * (~110px ต่อใบ แทน ~306px) ข้อมูลผู้สร้าง/เวลาสร้างไม่อยู่ในการ์ดนี้ เปิดใบดูได้
   * การ์ดเต็ม (label ทุกแถว) ยังใช้กับโหมด grid บนจอกว้าง
   */
  readonly compact?: boolean;
}

export default function PrCard({
  item,
  onEdit,
  onApprove,
  onReject,
  onDelete,
  isMyPending = false,
  compact = false,
}: PrCardProps) {
  const tfl = useTranslations("field");
  const tc = useTranslations("common");
  const { dateFormat, amountFormat, defaultCurrencyCode } = useProfile();

  const config = PR_STATUS_CONFIG[item.pr_status] ?? PR_STATUS_CONFIG.draft;
  const totalAmount = item.base_total_amount;
  const totalHidden = isPriceHidden(item.hidden_fields, "total_price");
  const hasTotal = totalAmount != null && !Number.isNaN(Number(totalAmount));
  const isDraft = item.pr_status === PR_STATUS.DRAFT;
  const isPendingApproval = item.pr_status === PR_STATUS.IN_PROGRESS;
  // ตัดสินรายใบได้เฉพาะใน view my-pending และเฉพาะสถานะที่ตรงกับการกระทำนั้น
  const showApproveReject =
    isMyPending && isPendingApproval && (onApprove || onReject);
  const canDelete = isMyPending && isDraft && !!onDelete;

  const amount = totalHidden ? (
    <HiddenValue />
  ) : hasTotal ? (
    <span className="font-semibold tabular-nums">
      {formatAmount(Number(totalAmount), amountFormat)}
      {defaultCurrencyCode && (
        <span className="text-muted-foreground ml-1 font-normal">
          {defaultCurrencyCode}
        </span>
      )}
    </span>
  ) : null;

  const actions = showApproveReject ? (
    <>
      {onApprove && (
        <Button
          type="button"
          size="xs"
          variant="success"
          onClick={(e) => {
            e.stopPropagation();
            onApprove(item);
          }}
        >
          <CheckCircle2 aria-hidden="true" />
          {tc("approve")}
        </Button>
      )}
      {onReject && (
        <Button
          type="button"
          size="xs"
          variant="destructive"
          onClick={(e) => {
            e.stopPropagation();
            onReject(item);
          }}
        >
          <XCircle aria-hidden="true" />
          {tc("reject")}
        </Button>
      )}
    </>
  ) : undefined;

  if (compact) {
    const who = [item.requestor_name, item.department_name]
      .filter(Boolean)
      .join(" · ");
    return (
      <ListCard
        title={item.pr_no}
        badge={
          <div className="flex shrink-0 items-center gap-1">
            {isSentBack(item.last_action) && (
              <StatusChip status="send_back" label={tc("sendBack")} />
            )}
            <StatusChip status={item.pr_status} label={config.label} />
          </div>
        }
        onOpen={() => onEdit(item)}
        onDelete={canDelete ? () => onDelete?.(item) : undefined}
        actions={actions}
      >
        <div className="text-muted-foreground flex min-w-0 items-center gap-1.5">
          <span className="shrink-0 tabular-nums">
            {formatDate(item.pr_date, dateFormat)}
          </span>
          {item.workflow_name && (
            <>
              <span aria-hidden="true">·</span>
              <span className="truncate" title={item.workflow_name}>
                {item.workflow_name}
              </span>
            </>
          )}
        </div>
        {who && (
          <div className="truncate font-medium" title={who}>
            {who}
          </div>
        )}
        <div className="flex min-w-0 items-baseline justify-between gap-3">
          <span
            className="text-muted-foreground truncate"
            title={item.workflow_current_stage ?? undefined}
          >
            {item.workflow_current_stage}
          </span>
          {amount && <span className="shrink-0">{amount}</span>}
        </div>
      </ListCard>
    );
  }

  return (
    <ListCard
      title={item.pr_no}
      onOpen={() => onEdit(item)}
      onDelete={canDelete ? () => onDelete?.(item) : undefined}
      actions={actions}
    >
      <ListCardStatusRow status={item.pr_status} label={config.label} />
      <ListCardSendBackRow lastAction={item.last_action} />
      <ListCardRow label={tfl("date")}>
        <span className="tabular-nums">
          {formatDate(item.pr_date, dateFormat)}
        </span>
      </ListCardRow>
      {item.requestor_name && (
        <ListCardRow label={tfl("requester")}>
          {item.requestor_name}
        </ListCardRow>
      )}
      {item.department_name && (
        <ListCardRow label={tfl("department")}>
          {item.department_name}
        </ListCardRow>
      )}
      {item.workflow_name && (
        <ListCardRow label={tfl("type")}>{item.workflow_name}</ListCardRow>
      )}
      {item.workflow_current_stage && (
        <ListCardRow label={tfl("stage")}>
          {item.workflow_current_stage}
        </ListCardRow>
      )}
      {amount && <ListCardRow label={tfl("totalAmount")}>{amount}</ListCardRow>}
      <ListCardAuditRows audit={item.audit} />
    </ListCard>
  );
}
