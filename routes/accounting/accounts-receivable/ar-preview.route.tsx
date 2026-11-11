import { Link } from "react-router";
import { useTranslations } from "use-intl";
import { ArrowRight } from "lucide-react";
import { ListPageShell } from "@/components/share/list-page-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AR_PREVIEW_PATH } from "./ar-customer-preview-store";
import { AR_INVOICE_PATH } from "./ar-invoice-model";

export function Component() {
  const t = useTranslations("accounting.arPreview");
  return (
    <ListPageShell title={t("title")} description={t("description")} mock>
      <div className="grid gap-4 sm:grid-cols-2">
        {(
          [
            ["invoice", AR_INVOICE_PATH],
            ["receipt", "/accounting/accounts-receivable/receipt"],
            ["folio", `${AR_PREVIEW_PATH}/folio`],
            ["profiles", `${AR_PREVIEW_PATH}/profiles`],
            ["contracts", `${AR_PREVIEW_PATH}/contracts`],
          ] as const
        ).map(([key, path]) => (
          <Card key={key}>
            <CardHeader>
              <CardTitle>{t(key)}</CardTitle>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" size="sm">
                <Link to={path}>
                  {t("open")}
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </ListPageShell>
  );
}
