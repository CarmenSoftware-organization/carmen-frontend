import { useTranslations } from "use-intl";
import {
  ListCard,
  ListCardAuditRows,
  ListCardRow,
  ListCardActiveRow,
} from "@/components/share/list-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { useProfile } from "@/hooks/use-profile";
import { formatDate } from "@/lib/date-utils";
import type { PurchaseRequestTemplate } from "@/types/purchase-request";

interface PrtCardProps {
  /** เลขลำดับแถว (`rowNumber()`) → `ListCard rowNo` */
  readonly rowNo?: number;
  readonly item: PurchaseRequestTemplate;
  readonly onEdit: (item: PurchaseRequestTemplate) => void;
  readonly onDelete: (item: PurchaseRequestTemplate) => void;
  /**
   * การ์ดกระชับสำหรับมือถือ (แบบเดียวกับการ์ด PR/PO) — ชื่อ + ชิป Active บนหัว แล้วเป็น
   * บรรทัดสรุปไม่มี label: workflow · คำอธิบาย / ผู้สร้าง + วันที่แก้ล่าสุด
   * การ์ดเต็มยังใช้กับโหมด grid บนจอกว้าง
   */
  readonly compact?: boolean;
}

export default function PrtCard({
  item,
  onEdit,
  onDelete,
  compact = false,
  rowNo,
}: PrtCardProps) {
  const tfl = useTranslations("field");
  const { dateFormat } = useProfile();

  if (compact) {
    const summary = [item.workflow?.name, item.description]
      .filter(Boolean)
      .join(" · ");
    const by = item.audit?.created?.name;
    const at = item.audit?.updated?.at ?? item.audit?.created?.at;
    return (
      <ListCard
        rowNo={rowNo}
        title={item.name || "..."}
        badge={<StatusBadge active={item.is_active} className="shrink-0" />}
        onOpen={() => onEdit(item)}
        onDelete={() => onDelete(item)}
      >
        {summary && (
          <div className="text-muted-foreground truncate" title={summary}>
            {summary}
          </div>
        )}
        {(by || at) && (
          <div className="flex min-w-0 items-baseline justify-between gap-3">
            <span className="truncate font-medium" title={by ?? undefined}>
              {by}
            </span>
            {at && (
              <span
                className="text-muted-foreground shrink-0 tabular-nums"
                title={tfl("updated")}
              >
                {formatDate(at, dateFormat)}
              </span>
            )}
          </div>
        )}
      </ListCard>
    );
  }

  return (
    <ListCard
      rowNo={rowNo}
      title={item.name || "..."}
      onOpen={() => onEdit(item)}
      onDelete={() => onDelete(item)}
    >
      <ListCardActiveRow active={item.is_active} />
      {item.workflow?.name && (
        <ListCardRow label={tfl("workflow")}>{item.workflow.name}</ListCardRow>
      )}
      {item.description && (
        <ListCardRow label={tfl("description")}>{item.description}</ListCardRow>
      )}
      <ListCardAuditRows audit={item.audit} />
    </ListCard>
  );
}
