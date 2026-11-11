import { useState } from "react";
import { useTranslations } from "use-intl";
import { ListCard, ListCardRow } from "@/components/share/list-card";
import { ListPageShell } from "@/components/share/list-page-shell";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function Component() {
  const t = useTranslations("accounting.arPreview");
  const [open, setOpen] = useState(false);
  return (
    <ListPageShell title={t("folio")} description={t("description")} count={1} mock>
      <div className="grid gap-4 sm:grid-cols-2">
        <ListCard title="MOCK-FOLIO-001" onOpen={() => setOpen(true)}>
          <ListCardRow label={t("customer")}>Example Travel</ListCardRow>
          <ListCardRow label={t("status")}>{t("unbilled")}</ListCardRow>
        </ListCard>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("folio")}</DialogTitle>
            <DialogDescription>{t("description")}</DialogDescription>
          </DialogHeader>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <dt>{t("reference")}</dt>
            <dd>MOCK-FOLIO-001</dd>
            <dt>{t("customer")}</dt>
            <dd>Example Travel</dd>
            <dt>{t("status")}</dt>
            <dd>{t("unbilled")}</dd>
            <dt>{t("charges")}</dt>
            <dd>3,500.00 THB</dd>
          </dl>
        </DialogContent>
      </Dialog>
    </ListPageShell>
  );
}
