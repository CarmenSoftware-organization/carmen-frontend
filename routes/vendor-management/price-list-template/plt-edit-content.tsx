import { useTranslations } from "use-intl";
import { usePriceListTemplateById } from "@/hooks/use-price-list-template";
import { PriceListTemplateForm } from "./plt-form";
import { ErrorState } from "@/components/ui/error-state";
import { PltFormSkeleton } from "./plt-form-skeleton";

export function PltEditContent({ id }: { id: string }) {
  const tErr = useTranslations("vendorManagement.priceListTemplate");
  const {
    data: priceListTemplate,
    isLoading,
    error,
    refetch,
  } = usePriceListTemplateById(id);

  if (isLoading) return <PltFormSkeleton />;
  if (error || !priceListTemplate)
    return (
      <ErrorState
        error={error}
        notFoundMessage={tErr("notFound")}
        onRetry={() => refetch()}
        backTo="/vendor-management/price-list-template"
      />
    );

  return <PriceListTemplateForm priceListTemplate={priceListTemplate} />;
}
