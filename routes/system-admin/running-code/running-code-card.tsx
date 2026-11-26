import { useTranslations } from "use-intl";
import { ListCard, ListCardRow } from "@/components/share/list-card";
import type { RunningCode } from "@/types/running-code";
import { exampleSegments } from "./running-code-config";
import { isDefaultNote } from "./running-code-labels";
import {
  RunningCodeExample,
  RunningCodeTypeText,
  useRunningCodeTypeLabel,
} from "./running-code-cells";

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
  const typeLabel = useRunningCodeTypeLabel();
  const segments = exampleSegments(item.config, new Date());

  return (
    <ListCard
      rowNo={rowNo}
      title={
        <RunningCodeTypeText type={item.type} label={typeLabel(item.type)} />
      }
      onOpen={() => onEdit(item)}
      onDelete={onDelete ? () => onDelete(item) : undefined}
    >
      {segments && (
        <ListCardRow label={t("example")}>
          <RunningCodeExample segments={segments} />
        </ListCardRow>
      )}
      {item.note && !isDefaultNote(item.note) && (
        <ListCardRow label={tfl("note")}>{item.note}</ListCardRow>
      )}
    </ListCard>
  );
}
