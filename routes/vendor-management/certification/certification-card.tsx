import { useTranslations } from "use-intl";
import {
  ListCard,
  ListCardAuditRows,
  ListCardRow,
  ListCardActiveRow,
} from "@/components/share/list-card";
import type { Certification } from "@/types/certification";
import { CertificationHoldings } from "./certification-holdings";

interface Props {
  readonly item: Certification;
  readonly onEdit: (item: Certification) => void;
  readonly onDelete?: (item: Certification) => void;
}

export default function CertificationCard({ item, onEdit, onDelete }: Props) {
  const tfl = useTranslations("field");
  const t = useTranslations("vendorManagement.certification");

  return (
    <ListCard
      title={item.name || "..."}
      onOpen={() => onEdit(item)}
      onDelete={onDelete ? () => onDelete(item) : undefined}
    >
      <ListCardActiveRow active={item.is_active} />
      {item.code && <ListCardRow label={tfl("code")}>{item.code}</ListCardRow>}
      {item.description && (
        <ListCardRow label={tfl("description")}>{item.description}</ListCardRow>
      )}
      <ListCardRow label={t("vendorsHolding")}>
        <CertificationHoldings item={item} />
      </ListCardRow>
      <ListCardAuditRows audit={item.audit} />
    </ListCard>
  );
}
