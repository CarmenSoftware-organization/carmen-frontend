import { useTranslations } from "use-intl";
import {
  ListCard,
  ListCardAuditRows,
  ListCardRow,
  ListCardStatusRow,
  ListCardSendBackRow,
} from "@/components/share/list-card";
import { useProfile } from "@/hooks/use-profile";
import { formatDate } from "@/lib/date-utils";
import { StatusIconLabel } from "@/components/ui/status-icon-label";
import type { StoreRequisition } from "@/types/store-requisition";

interface SrCardProps {
  readonly item: StoreRequisition;
  readonly onEdit: (item: StoreRequisition) => void;
  readonly onDelete: (item: StoreRequisition) => void;
}

export default function SrCard({ item, onEdit, onDelete }: SrCardProps) {
  const tfl = useTranslations("field");
  const ts = useTranslations("status");
  const tc = useTranslations("common");
  const { dateFormat } = useProfile();

  return (
    <ListCard
      title={item.sr_no}
      onOpen={() => onEdit(item)}
      onDelete={() => onDelete(item)}
      deleteDisabledTitle={
        item.doc_status === "draft" ? undefined : tc("deleteOnlyDraft")
      }
    >
      <ListCardStatusRow status={item.doc_status} label={ts(item.doc_status)} />
      <ListCardSendBackRow lastAction={item.last_action} />
      <ListCardRow label={tfl("date")}>
        <span className="tabular-nums">
          {formatDate(item.sr_date, dateFormat)}
        </span>
      </ListCardRow>
      {item.sr_type && (
        <ListCardRow label={tfl("type")}>
          <StatusIconLabel
            status={item.sr_type}
            label={item.sr_type}
            className="text-muted-foreground uppercase"
          />
        </ListCardRow>
      )}
      <ListCardRow label={tfl("fromTo")}>
        {item.from_location_name}
        {item.to_location_name && (
          <span className="text-muted-foreground font-normal">
            {" → "}
            {item.to_location_name}
          </span>
        )}
      </ListCardRow>
      <ListCardRow label={tfl("requester")}>{item.requestor_name}</ListCardRow>
      <ListCardRow label={tfl("department")}>
        {item.department_name}
      </ListCardRow>
      {item.workflow_name && (
        <ListCardRow label={tfl("workflow")}>
          {item.workflow_name}
        </ListCardRow>
      )}
      {item.workflow_current_stage && (
        <ListCardRow label={tfl("currentStage")}>
          {item.workflow_current_stage}
        </ListCardRow>
      )}
      <ListCardAuditRows audit={item.audit} />
    </ListCard>
  );
}
