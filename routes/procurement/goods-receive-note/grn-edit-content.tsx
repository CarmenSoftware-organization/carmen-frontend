import { useTranslations } from "use-intl";
import { useGoodsReceiveNoteById } from "@/hooks/use-goods-receive-note";
import { GrnForm } from "./grn-form";
import { ErrorState } from "@/components/ui/error-state";
import { DocPageSkeleton } from "@/components/loader/doc-page-skeleton";

export function GrnEditContent({ id }: { id: string }) {
  const t = useTranslations("procurement.goodsReceiveNote");
  const {
    data: goodsReceiveNote,
    isLoading,
    error,
    refetch,
  } = useGoodsReceiveNoteById(id);

  if (isLoading)
    return <DocPageSkeleton fields={[2, 1, 1, 1, 1, 1, 1, 1, 2]} />;
  if (error || !goodsReceiveNote)
    return (
      <ErrorState
        error={error}
        notFoundMessage={t("notFound")}
        onRetry={() => refetch()}
        backTo="/procurement/goods-receive-note"
      />
    );

  return (
    <GrnForm key={goodsReceiveNote.id} goodsReceiveNote={goodsReceiveNote} />
  );
}
