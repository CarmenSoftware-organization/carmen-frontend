import { useTranslations } from "use-intl";
import { Badge } from "@/components/ui/badge";
import type { ApInvoice } from "@/types/accounts-payable";
import { apIsAutoFromGrn, apSettlement } from "../shared/ap-status";

const SETTLEMENT_VARIANT = {
  unpaid: "invert-light",
  partially_paid: "warning-light",
  paid: "success-light",
} as const;

/** ป้ายสถานะการชำระ (derive จาก outstanding) — เฉพาะใบ posted */
export function ApSettlementBadge({
  invoice,
}: {
  readonly invoice: ApInvoice;
}) {
  const t = useTranslations("accounting.accountsPayable.invoice");
  if (invoice.doc_status !== "posted") {
    return <span className="text-muted-foreground">—</span>;
  }
  const settlement = apSettlement(invoice);
  return (
    <Badge variant={SETTLEMENT_VARIANT[settlement]} size="xs">
      {t(`settlements.${settlement}`)}
    </Badge>
  );
}

/** ป้าย "From GRN" ของใบที่ระบบสร้างเองตอน commit GRN */
export function ApFromGrnBadge({ invoice }: { readonly invoice: ApInvoice }) {
  const t = useTranslations("accounting.accountsPayable.invoice");
  if (!apIsAutoFromGrn(invoice)) return null;
  return (
    <Badge variant="info-light" size="xs">
      {t("fromGrn")}
    </Badge>
  );
}
