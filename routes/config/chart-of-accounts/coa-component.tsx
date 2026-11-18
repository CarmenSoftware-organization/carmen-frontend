import { useState } from "react";
import { Sparkles } from "lucide-react";
import { useTranslations } from "use-intl";
import { useChartOfAccount, useDeleteChartOfAccount } from "./use-coa";
import type { ChartOfAccount } from "@/types/chart-of-accounts";
import { ConfigListTemplate } from "@/components/templates/config-list-template";
import { LIST_PAGE_KEYS } from "@/constant/list-page-keys";
import { Button } from "@/components/ui/button";
import { LIST_HEADER_LABEL_HIDE } from "@/components/share/list-page-shell";
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
        fixedColumnWidths
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
          // ไม่ห่อด้วย flex-wrap — ปุ่มต้องอยู่แถวเดียวกับ Export/Print/New
          // หัวแคบ (< @4xl ของ list-header) ปุ่มรองเหลือไอคอน ปุ่มหลัก New เก็บป้าย
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setWizardOpen(true)}
              className="gap-1.5"
              title={t("wizard.button")}
            >
              <Sparkles className="text-primary size-4" />
              <span className={LIST_HEADER_LABEL_HIDE}>
                {t("wizard.button")}
              </span>
            </Button>
            <CoaImportCarmenGlButton />
          </>
        }
        renderDeleteDialog={({
          target,
          open,
          onOpenChange,
          isPending,
          onConfirm,
        }) => (
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
          {
            header: t("accountName"),
            value: (r) => r.description_1,
            width: 40,
          },
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
        renderCard={({ item, onEdit, onDelete, rowNo }) => (
          <CoaCard rowNo={rowNo} item={item} onEdit={onEdit} onDelete={onDelete} />
        )}
      />

      <CoaWizardModal open={wizardOpen} onOpenChange={setWizardOpen} />
    </>
  );
}
