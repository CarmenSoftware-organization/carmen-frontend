import { useState } from "react";
import { Sparkles } from "lucide-react";
import { useTranslations } from "use-intl";
import { useChartOfAccount, useDeleteChartOfAccount } from "./use-coa";
import type { ChartOfAccount } from "@/types/chart-of-accounts";
import { ConfigListTemplate } from "@/components/templates/config-list-template";
import { LIST_PAGE_KEYS } from "@/constant/list-page-keys";
import { Button } from "@/components/ui/button";
import { useCoaTable } from "./use-coa-table";
import { COA_FILTER_FIELDS } from "./coa-filter-fields";
import CoaCard from "./coa-card";
import { CoaImportCarmenGlButton } from "./coa-import-carmen-gl-button";
import { CoaWizardModal } from "./coa-wizard-modal";
import { CoaDeleteGuardrailDialog } from "./coa-delete-guardrail-dialog";

export default function CoaComponent() {
  const t = useTranslations("config.chartOfAccounts");
  const tfl = useTranslations("field");
  const ts = useTranslations("status");
  const [wizardOpen, setWizardOpen] = useState(false);

  return (
    <>
      <ConfigListTemplate<ChartOfAccount>
        translationNamespace="config.chartOfAccounts"
        entityNameField="code"
        useList={useChartOfAccount}
        useDelete={useDeleteChartOfAccount}
        useTable={useCoaTable}
        pageKey={LIST_PAGE_KEYS.CHART_OF_ACCOUNT}
        addPath="/config/chart-of-accounts/new"
        getEditPath={(account) => `/config/chart-of-accounts/${account.id}`}
        filterFields={COA_FILTER_FIELDS}
        extraActions={
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setWizardOpen(true)}
              className="gap-1.5"
            >
              <Sparkles className="size-4 text-primary" />
              <span>{t("wizard.button")}</span>
            </Button>
            <CoaImportCarmenGlButton />
          </div>
        }
        renderDeleteDialog={({ target, open, onOpenChange, isPending, onConfirm }) => (
          <CoaDeleteGuardrailDialog
            account={target}
            open={open}
            onOpenChange={onOpenChange}
            isPending={isPending}
            onConfirmDelete={onConfirm}
          />
        )}
        exportColumns={[
          { header: tfl("code"), value: (r) => r.code, width: 18 },
          { header: t("accountName"), value: (r) => r.description_1, width: 40 },
          {
            header: tfl("description"),
            value: (r) => r.description_2 ?? "",
            width: 40,
          },
          {
            header: tfl("category"),
            value: (r) =>
              r.category
                ? t(`accountCategory.${r.category}`)
                : t("labels.categoryUnset"),
            width: 18,
          },
          {
            header: tfl("nature"),
            value: (r) => t(`nature.${r.nature}`),
            width: 12,
          },
          {
            header: tfl("type"),
            value: (r) => t(`accountType.${r.type}`),
            width: 22,
          },
          {
            header: tfl("status"),
            value: (r) => (r.is_active ? ts("active") : ts("inactive")),
            width: 10,
          },
        ]}
        renderCard={({ item, onEdit, onDelete }) => (
          <CoaCard item={item} onEdit={onEdit} onDelete={onDelete} />
        )}
      />

      <CoaWizardModal open={wizardOpen} onOpenChange={setWizardOpen} />
    </>
  );
}
