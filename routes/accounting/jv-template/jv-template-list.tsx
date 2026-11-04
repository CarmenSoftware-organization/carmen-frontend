import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { useTranslations } from "use-intl";
import { Loader2, Play, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { listReturnState } from "@/hooks/use-list-return";
import { useIsMobile } from "@/hooks/use-mobile";
import { useGridPagination } from "@/hooks/use-grid-pagination";
import { useDataGridState } from "@/hooks/use-data-grid-state";
import { useListFilters } from "@/hooks/use-list-filters";
import { useExportErrorToast } from "@/hooks/use-export-error-toast";
import { useCan } from "@/hooks/use-can";
import {
  DataGrid,
  DataGridContainer,
  DataGridScrollArea,
} from "@/components/ui/data-grid/data-grid";
import { DataGridTable } from "@/components/ui/data-grid/data-grid-table";
import { DataGridPagination } from "@/components/ui/data-grid/data-grid-pagination";
import { MultiSelectFilter } from "@/components/ui/multi-select-filter";
import { DeleteDialog } from "@/components/ui/delete-dialog";
import { ErrorState } from "@/components/ui/error-state";
import { Button } from "@/components/ui/button";
import EmptyComponent from "@/components/empty-component";
import { ListPageShell } from "@/components/share/list-page-shell";
import { listGridMaxH } from "@/components/share/list-grid-max-h";
import { DocumentListActions } from "@/components/share/document-list-actions";
import { ListToolbar } from "@/components/list-filter/list-toolbar";
import { SaveViewDialog } from "@/components/list-filter/save-view-dialog";
import { PERMISSIONS } from "@/constant/permissions";
import { cn } from "@/lib/utils";
import type { FilterFieldDef } from "@/types/list-filter";
import {
  JV_TEMPLATE_ACTIVE_OPTIONS,
  JV_TEMPLATE_PAGES,
  JV_TEMPLATE_TYPE_OPTIONS,
  jvTemplateDetailPath,
  type JvTemplatePageKind,
} from "./jv-template-config";
import type { JvTemplate } from "./jv-template-types";
import {
  jvTemplateActiveLabel,
  jvTemplateAmount,
  jvTemplateAmountLabelKey,
  jvTemplatePeriodRange,
  jvTemplateTypeLabel,
  translateOptionLabels,
} from "./jv-template-labels";
import {
  useDeleteJvTemplate,
  useExportJvTemplates,
  useJvTemplates,
} from "./use-jv-template";
import { useJvTemplateTable } from "./use-jv-template-table";
import { JvTemplateGenerateAllDialog } from "./jv-template-generate-all-dialog";
import JvTemplateCardList from "./jv-template-card-list";

const DEFAULT_SORT = "code:asc";

/**
 * หน้ารายการ template (Template / Recurring / Allocation Voucher) — โครงเดียวกับ
 * `JournalVoucherList` · หน้าชนิดเดียว (recurring/allocation) ล็อกชนิดด้วย clause
 * `template_type|string:<type>` ที่ต่อท้ายตัวกรองของผู้ใช้
 */
export default function JvTemplateList({
  kind,
}: {
  readonly kind: JvTemplatePageKind;
}) {
  const page = JV_TEMPLATE_PAGES[kind];
  const t = useTranslations("accounting.jvTemplate");
  const tc = useTranslations("common");
  const tt = useTranslations("toast");
  const navigate = useNavigate();
  const exportErrorToast = useExportErrorToast();
  const { can, canWrite } = useCan();
  const [deleteTarget, setDeleteTarget] = useState<JvTemplate | null>(null);
  const [displayMode, setDisplayMode] = useState<"list" | "grid">("list");
  const [saveViewDialogOpen, setSaveViewDialogOpen] = useState(false);
  const isMobile = useIsMobile();
  const isGridMode = isMobile || displayMode === "grid";
  const useInfiniteScroll = !!isMobile;
  const deleteTemplate = useDeleteJvTemplate();
  const { exportJvTemplates, isExporting } = useExportJvTemplates();

  const perms = PERMISSIONS.accounting.gl_jv_template;
  const canCreate = canWrite && can(perms.create);
  const canDelete = canWrite && can(perms.delete);
  const canGenerate = canWrite && can(perms.generate);
  const [generateAllOpen, setGenerateAllOpen] = useState(false);

  const { params, search, setSearch, tableConfig } = useDataGridState({
    defaultSort: DEFAULT_SORT,
  });

  const filterFields = useMemo<FilterFieldDef[]>(() => {
    const typeOptions = translateOptionLabels(JV_TEMPLATE_TYPE_OPTIONS, (k) =>
      t(`type_${k}`),
    );
    const activeOptions = translateOptionLabels(
      JV_TEMPLATE_ACTIVE_OPTIONS,
      (k) => t(k),
    );
    const fields: FilterFieldDef[] = [];
    if (kind === "all") {
      fields.push({
        key: "template_type",
        control: "custom",
        labelKey: "accounting.jvTemplate.type",
        section: "listView.sectionDocument",
        render: (value, onChange) => (
          <MultiSelectFilter
            value={value}
            onChange={onChange}
            options={typeOptions}
            className="w-full"
          />
        ),
      });
    }
    fields.push({
      key: "is_active",
      control: "custom",
      labelKey: "accounting.jvTemplate.active",
      section: "listView.sectionDocument",
      render: (value, onChange) => (
        <MultiSelectFilter
          value={value}
          onChange={onChange}
          options={activeOptions}
          className="w-full"
        />
      ),
    });
    return fields;
  }, [kind, t]);

  const lf = useListFilters({
    pageKey: page.listPageKey,
    fields: filterFields,
    defaultSort: DEFAULT_SORT,
  });

  const fixedClause = page.fixedType
    ? `template_type|string:${page.fixedType}`
    : undefined;
  const filter =
    [lf.filterParam, fixedClause].filter(Boolean).join(";") || undefined;
  const queryParams = { ...params, filter };

  const { data, isLoading, error, refetch } = useJvTemplates(queryParams, {
    enabled: !useInfiniteScroll,
  });

  const grid = useGridPagination<JvTemplate>({
    useListHook: useJvTemplates,
    params: queryParams,
    enabled: useInfiniteScroll,
  });

  const templates = useInfiniteScroll ? grid.items : (data?.data ?? []);
  const totalRecords = useInfiniteScroll
    ? grid.totalRecords
    : (data?.paginate?.total ?? 0);

  const openTemplate = (template: JvTemplate) =>
    navigate(jvTemplateDetailPath(kind, template.id), listReturnState());

  const addTemplate = () =>
    navigate(
      page.fixedType
        ? `${page.path}/new?type=${page.fixedType}`
        : `${page.path}/new`,
    );

  const handleExport = async () => {
    try {
      const count = await exportJvTemplates({
        params: queryParams,
        columns: [
          { header: t("code"), value: (r) => r.code, width: 18 },
          { header: t("name"), value: (r) => r.name, width: 32 },
          {
            header: t("type"),
            value: (r) => jvTemplateTypeLabel(t, r.template_type),
            width: 14,
          },
          {
            header: t("periodRange"),
            value: (r) => jvTemplatePeriodRange(r),
            width: 20,
          },
          ...(kind !== "recurring"
            ? [
                {
                  header: t(jvTemplateAmountLabelKey(kind)),
                  value: (r: JvTemplate) => jvTemplateAmount(r) ?? "",
                  width: 16,
                },
              ]
            : []),
          {
            header: t("frequencyMonths"),
            value: (r) =>
              r.template_type === "recurring" ? (r.frequency_months ?? "") : "",
            width: 14,
          },
          {
            header: t("active"),
            value: (r) => jvTemplateActiveLabel(t, r.is_active),
            width: 12,
          },
        ],
      });
      if (count === 0) {
        toast.warning(tc("exportNoData"));
        return;
      }
      toast.success(tc("exportSuccess", { count }));
    } catch (err) {
      exportErrorToast(err);
    }
  };

  const onDelete = canDelete ? setDeleteTarget : undefined;

  const table = useJvTemplateTable({
    kind,
    templates,
    totalRecords,
    params,
    tableConfig,
    onOpen: openTemplate,
    onDelete,
  });

  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;

  const descKey = `desc${kind === "all" ? "All" : kind === "recurring" ? "Recurring" : "Allocation"}`;

  return (
    <ListPageShell
      title={t(page.titleKey)}
      description={t(descKey)}
      count={totalRecords}
      actions={
        <DocumentListActions
          onExport={handleExport}
          isExporting={isExporting}
          onAdd={addTemplate}
          addLabel={t("add")}
          addDisabled={!canCreate}
          extraActions={
            canGenerate ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setGenerateAllOpen(true)}
              >
                <Play className="size-4" />
                {t("generateAll")}
              </Button>
            ) : undefined
          }
        />
      }
      toolbar={
        <ListToolbar
          search={search}
          onSearch={setSearch}
          lf={lf}
          fields={filterFields}
          onSaveViewClick={() => setSaveViewDialogOpen(true)}
          table={table}
          displayMode={displayMode}
          onDisplayModeChange={setDisplayMode}
          trailing={
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => (useInfiniteScroll ? grid.refetch?.() : refetch())}
              aria-label={tc("refresh")}
              title={tc("refresh")}
            >
              <RefreshCw className="size-4" />
            </Button>
          }
        />
      }
    >
      {!isGridMode && (
        <DataGrid
          table={table}
          recordCount={totalRecords}
          isLoading={isLoading}
          tableLayout={{ headerSticky: true, columnsResizable: true }}
          emptyMessage={<EmptyComponent />}
        >
          <DataGridContainer
            className={cn(
              "flex flex-col",
              listGridMaxH(lf.activeFilters.length > 0),
            )}
          >
            <DataGridScrollArea>
              <DataGridTable />
            </DataGridScrollArea>
            <DataGridPagination />
          </DataGridContainer>
        </DataGrid>
      )}

      {isGridMode && (
        <>
          <JvTemplateCardList
            kind={kind}
            items={templates}
            isLoading={useInfiniteScroll ? grid.isLoading : isLoading}
            onOpen={openTemplate}
            onDelete={onDelete}
          />
          {useInfiniteScroll && grid.hasMore && (
            <div ref={grid.sentinelRef} className="flex justify-center py-4">
              {grid.isLoadingMore && (
                <Loader2 className="text-muted-foreground size-5 animate-spin" />
              )}
            </div>
          )}
        </>
      )}

      <DeleteDialog
        open={!!deleteTarget}
        onOpenChange={(open) =>
          !open && !deleteTemplate.isPending && setDeleteTarget(null)
        }
        title={t("deleteTitle")}
        description={`${t("deleteConfirm", { code: deleteTarget?.code ?? "" })} ${t("deleteKeepsJv")}`}
        isPending={deleteTemplate.isPending}
        onConfirm={() => {
          if (!deleteTarget) return;
          deleteTemplate.mutate(deleteTarget.id, {
            onSuccess: () => {
              toast.success(tt("deleteSuccess", { entity: t("entity") }));
              setDeleteTarget(null);
            },
            onError: (err) => {
              toast.error(err instanceof Error ? err.message : String(err));
            },
          });
        }}
      />

      {canGenerate && (
        <JvTemplateGenerateAllDialog
          open={generateAllOpen}
          onOpenChange={setGenerateAllOpen}
          kind={kind}
        />
      )}

      <SaveViewDialog
        open={saveViewDialogOpen}
        onOpenChange={setSaveViewDialogOpen}
        canManageBu={lf.view.canManageBu}
        existingNames={lf.view.existingNames}
        onSave={lf.view.saveOrUpdate}
      />
    </ListPageShell>
  );
}
