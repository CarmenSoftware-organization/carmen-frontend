import { useTranslations } from "use-intl";
import { ListCard, ListCardRow } from "@/components/share/list-card";
import type { RunningCode } from "@/types/running-code";
import { exampleCode } from "./running-code-config";

interface Props {
  /** เลขลำดับแถว (`rowNumber()`) → `ListCard rowNo` */
  readonly rowNo?: number;
  readonly item: RunningCode;
  readonly onEdit: (item: RunningCode) => void;
  readonly onDelete?: (item: RunningCode) => void;
}

export default function RunningCodeCard({
  item,
  onEdit,
  onDelete,
  rowNo,
}: Props) {
  const tfl = useTranslations("field");
  const t = useTranslations("systemAdmin.runningCode");
  const example = exampleCode(item.config, new Date());

  return (
    <ListCard
      rowNo={rowNo}
      title={item.type}
      onOpen={() => onEdit(item)}
      onDelete={onDelete ? () => onDelete(item) : undefined}
    >
      {example && (
        <ListCardRow label={t("example")}>
          <span className="font-mono">{example}</span>
        </ListCardRow>
      )}
      {item.note && <ListCardRow label={tfl("note")}>{item.note}</ListCardRow>}
    </ListCard>
  );
}
