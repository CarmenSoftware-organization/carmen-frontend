import { useCreditNoteById } from "./use-credit-note";
import { useTranslations } from "use-intl";
import { CnForm } from "./cn-form";
import { ErrorState } from "@/components/ui/error-state";
import { DocPageSkeleton } from "@/components/loader/doc-page-skeleton";

export function CnEditContent({ id }: { id: string }) {
  const tErr = useTranslations("procurement.creditNote");
  const { data: creditNote, isLoading, error, refetch } = useCreditNoteById(id);

  if (isLoading)
    return (
      <DocPageSkeleton
        ribbon="text"
        fields={[2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2]}
        toolbar
      />
    );
  if (error || !creditNote)
    return (
      <ErrorState
        error={error}
        notFoundMessage={tErr("notFound")}
        onRetry={() => refetch()}
        backTo="/procurement/credit-note"
      />
    );

  return <CnForm key={creditNote.id} creditNote={creditNote} />;
}
