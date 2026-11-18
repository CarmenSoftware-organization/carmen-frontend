import { useTranslations } from "use-intl";
import {
  useCnReasonConfig,
  useDeleteCnReasonConfig,
} from "./use-cn-reason-config";
import type { CnReason } from "@/types/cn-reason";
import { ConfigListTemplate } from "@/components/templates/config-list-template";
import { LIST_PAGE_KEYS } from "@/constant/list-page-keys";
import { CreditNoteReasonDialog } from "./credit-note-reason-dialog";
import { useCreditNoteReasonTable } from "./use-credit-note-reason-table";
import { CREDIT_NOTE_REASON_FILTER_FIELDS } from "./credit-note-reason-filter-fields";
import CreditNoteReasonCard from "./credit-note-reason-card";

export default function CreditNoteReasonComponent() {
  const tfl = useTranslations("field");
  const ts = useTranslations("status");
  return (
    <ConfigListTemplate<CnReason>
      fixedColumnWidths
      translationNamespace="config.creditNoteReason"
      entityNameField="name"
      useList={useCnReasonConfig}
      useDelete={useDeleteCnReasonConfig}
      useTable={useCreditNoteReasonTable}
      pageKey={LIST_PAGE_KEYS.CREDIT_NOTE_REASON}
      filterFields={CREDIT_NOTE_REASON_FILTER_FIELDS}
      defaultSort="name:asc"
      exportColumns={[
        { header: tfl("name"), value: (r) => r.name, width: 28 },
        {
          header: tfl("description"),
          value: (r) => r.description ?? "",
          width: 40,
        },
        {
          header: tfl("status"),
          value: (r) => (r.is_active ? ts("active") : ts("inactive")),
          width: 10,
        },
      ]}
      renderDialog={({ open, onOpenChange, entity, readOnly }) => (
        <CreditNoteReasonDialog
          open={open}
          onOpenChange={onOpenChange}
          reason={entity}
          readOnly={readOnly}
        />
      )}
      renderCard={({ item, onEdit, onDelete, rowNo }) => (
        <CreditNoteReasonCard rowNo={rowNo} item={item} onEdit={onEdit} onDelete={onDelete} />
      )}
    />
  );
}
