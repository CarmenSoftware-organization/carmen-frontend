import { useTranslations } from "use-intl";
import { Badge } from "@/components/ui/badge";

export function ApMasterMockStatus() {
  const t = useTranslations("config.apMaster");
  return (
    <Badge variant="outline" size="sm" role="status">
      {t("mockStatus")}
    </Badge>
  );
}
