import { useTranslations } from "use-intl";
import { ChevronRight } from "lucide-react";
import type { ApWorkflowFields } from "@/types/accounts-payable";

export function ApWorkflowStatus({
  document,
}: {
  readonly document?: ApWorkflowFields | null;
}) {
  const t = useTranslations("accounting.accountsPayable.ui");
  if (!document?.workflow_id) return null;
  return (
    <div
      className="flex flex-wrap items-center gap-2 border-b pb-3 text-xs"
      aria-label={t("workflow")}
    >
      <span className="text-muted-foreground">
        {document.workflow_name || t("workflow")}
      </span>
      {document.workflow_previous_stage && (
        <>
          <span>{document.workflow_previous_stage}</span>
          <ChevronRight className="text-muted-foreground size-3" />
        </>
      )}
      <span className="font-semibold">
        {document.workflow_current_stage || "—"}
      </span>
      {document.workflow_next_stage && (
        <>
          <ChevronRight className="text-muted-foreground size-3" />
          <span className="text-muted-foreground">
            {document.workflow_next_stage}
          </span>
        </>
      )}
    </div>
  );
}
