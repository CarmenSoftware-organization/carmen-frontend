import { useTranslations } from "use-intl";
import { Badge } from "@/components/ui/badge";
import { ListCard, ListCardRow } from "@/components/share/list-card";
import type { Role } from "@/types/role";

interface Props {
  /** เลขลำดับแถว (`rowNumber()`) → `ListCard rowNo` */
  readonly rowNo?: number;
  readonly item: Role;
  readonly onEdit: (item: Role) => void;
  readonly onDelete?: (item: Role) => void;
}

export default function RoleCard({ item, onEdit, onDelete, rowNo }: Props) {
  const t = useTranslations("systemAdmin.role");
  const tfl = useTranslations("field");

  const permCount = item.permissions?.count ?? 0;

  return (
    <ListCard
      rowNo={rowNo}
      title={item.name || "..."}
      badge={
        <Badge variant="secondary" size="xs">
          <span className="tabular-nums">{permCount}</span> {t("permissions")}
        </Badge>
      }
      onOpen={() => onEdit(item)}
      onDelete={onDelete ? () => onDelete(item) : undefined}
    >
      {item.description && (
        <ListCardRow label={tfl("description")}>{item.description}</ListCardRow>
      )}
      <ListCardRow label={t("permissions")}>
        <span className="tabular-nums">{permCount}</span>
      </ListCardRow>
    </ListCard>
  );
}
