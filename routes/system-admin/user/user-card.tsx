import { useTranslations } from "use-intl";
import { ListCard, ListCardRow } from "@/components/share/list-card";
import type { User } from "@/types/workflows";

interface Props {
  /** เลขลำดับแถว (`rowNumber()`) → `ListCard rowNo` */
  readonly rowNo?: number;
  readonly item: User;
  readonly onEdit: (item: User) => void;
  readonly onDelete?: (item: User) => void;
}

export default function UserCard({ item, onEdit, onDelete, rowNo }: Props) {
  const tfl = useTranslations("field");

  const fullName = [item.firstname, item.middlename, item.lastname]
    .filter(Boolean)
    .join(" ");

  return (
    <ListCard
      rowNo={rowNo}
      title={fullName || "..."}
      onOpen={() => onEdit(item)}
      onDelete={onDelete ? () => onDelete(item) : undefined}
    >
      {item.email && (
        <ListCardRow label={tfl("email")}>{item.email}</ListCardRow>
      )}
      {item.department?.name && (
        <ListCardRow label={tfl("department")}>
          {item.department.name}
        </ListCardRow>
      )}
    </ListCard>
  );
}
