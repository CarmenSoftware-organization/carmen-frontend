import { useTranslations } from "use-intl";
import { useLocationById } from "@/hooks/use-location";
import { LocationForm } from "./location-form";
import { ErrorState } from "@/components/ui/error-state";
import { ConfigFormSkeleton } from "../shared/config-form-skeleton";

export function LocationEditContent({ id }: { id: string }) {
  const tErr = useTranslations("config.location");
  const { data: location, isLoading, error, refetch } = useLocationById(id);

  if (isLoading) return <ConfigFormSkeleton fields={8} />;
  if (error || !location)
    return (
      <ErrorState
        error={error}
        notFoundMessage={tErr("notFound")}
        onRetry={() => refetch()}
        backTo="/config/location"
      />
    );

  return <LocationForm location={location} />;
}
