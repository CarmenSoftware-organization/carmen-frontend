import { useTranslations } from "use-intl";
import {
  ListCard,
  ListCardAuditRows,
  ListCardRow,
  ListCardActiveRow,
} from "@/components/share/list-card";
import type { Department } from "@/types/department";

interface Props {
  readonly rowNo?: number;
  readonly item: Department;
  readonly onEdit: (item: Department) => void;
  readonly onDelete?: (item: Department) => void;
}

export default function DepartmentCard({ item, onEdit, onDelete, rowNo }: Props) {
  const t = useTranslations("config.department");
  const tfl = useTranslations("field");

  const memberCount = item.department_users?.length ?? 0;

  return (
    <ListCard
      rowNo={rowNo}
      title={item.name || "..."}
      onOpen={() => onEdit(item)}
      onDelete={onDelete ? () => onDelete(item) : undefined}
    >
      <ListCardActiveRow active={item.is_active} />
      {item.code && <ListCardRow label={tfl("code")}>{item.code}</ListCardRow>}
      {item.account_code && (
        <ListCardRow label={tfl("accountCode")}>
          {item.account_code}
        </ListCardRow>
      )}
      {memberCount > 0 && (
        <ListCardRow label={t("members")}>
          <span className="tabular-nums">{memberCount}</span>
        </ListCardRow>
      )}
      {item.description && (
        <ListCardRow label={tfl("description")}>{item.description}</ListCardRow>
      )}
      <ListCardAuditRows audit={item.audit} />
    </ListCard>
  );
}
