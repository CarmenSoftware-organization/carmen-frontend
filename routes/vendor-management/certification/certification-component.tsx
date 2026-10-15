import { lazy, Suspense } from "react";
import { useTranslations } from "use-intl";
import {
  useCertification,
  useDeleteCertification,
} from "../shared/use-certification";
import type { Certification } from "@/types/certification";
import { ConfigListTemplate } from "@/components/templates/config-list-template";
import { LIST_PAGE_KEYS } from "@/constant/list-page-keys";
import { useCertificationTable } from "./use-certification-table";
import { CERTIFICATION_FILTER_FIELDS } from "./certification-filter-fields";
import CertificationCard from "./certification-card";

// แทน next/dynamic ด้วย React.lazy (code-split dialog chunk เหมือนเดิม)
const CertificationDialog = lazy(() =>
  import("./certification-dialog").then((mod) => ({
    default: mod.CertificationDialog,
  })),
);

export default function CertificationComponent() {
  const tfl = useTranslations("field");
  const ts = useTranslations("status");
  const t = useTranslations("vendorManagement.certification");
  return (
    <ConfigListTemplate<Certification>
      translationNamespace="vendorManagement.certification"
      entityNameField="name"
      useList={useCertification}
      useDelete={useDeleteCertification}
      useTable={useCertificationTable}
      pageKey={LIST_PAGE_KEYS.CERTIFICATION}
      filterFields={CERTIFICATION_FILTER_FIELDS}
      defaultSort="code:asc"
      fixedColumnWidths
      exportColumns={[
        { header: tfl("code"), value: (r) => r.code, width: 16 },
        { header: tfl("name"), value: (r) => r.name, width: 28 },
        {
          header: tfl("description"),
          value: (r) => r.description ?? "",
          width: 36,
        },
        {
          header: t("vendorsHolding"),
          value: (r) => r.vendor_count ?? "",
          width: 12,
        },
        {
          header: t("expiringSoonCol"),
          value: (r) => r.expiring_count ?? "",
          width: 14,
        },
        {
          header: t("expiredCol"),
          value: (r) => r.expired_count ?? "",
          width: 12,
        },
        {
          header: tfl("status"),
          value: (r) => (r.is_active ? ts("active") : ts("inactive")),
          width: 10,
        },
      ]}
      renderDialog={({ open, onOpenChange, entity, readOnly }) => (
        <Suspense fallback={null}>
          <CertificationDialog
            open={open}
            onOpenChange={onOpenChange}
            certification={entity}
            readOnly={readOnly}
          />
        </Suspense>
      )}
      renderCard={({ item, onEdit, onDelete }) => (
        <CertificationCard item={item} onEdit={onEdit} onDelete={onDelete} />
      )}
    />
  );
}
