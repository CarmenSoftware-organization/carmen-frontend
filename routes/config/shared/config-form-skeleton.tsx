import { FormPageHeaderSkeleton } from "@/components/loader/form-page-skeleton";
import {
  CompactSectionSkeleton,
  FieldGrid,
} from "@/components/share/compact-section";
import { FormPageShell } from "@/components/share/form-page-shell";
import { Skeleton } from "@/components/ui/skeleton";

export function ConfigFormSkeleton({ fields }: { fields: number }) {
  return (
    <FormPageShell width="wide" header={<FormPageHeaderSkeleton />}>
      <div aria-busy="true">
        <Skeleton className="mb-2 h-8 w-32" />
        <div className="bg-card rounded-xl border p-4 shadow-sm">
          <FieldGrid>
            {Array.from({ length: fields }, (_, i) => (
              <div key={i} className="space-y-1.5">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-8 w-full" />
              </div>
            ))}
          </FieldGrid>
        </div>
        <CompactSectionSkeleton className="h-40" />
        <CompactSectionSkeleton className="h-40" />
      </div>
    </FormPageShell>
  );
}
