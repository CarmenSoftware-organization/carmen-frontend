import { useGlDimensions } from "@/hooks/use-gl-dimensions";
import {
  useCoaCostCenters,
  saveCoaCostCenters,
  coaCostCentersKey,
} from "./coa-cost-centers";
import { FormSkeleton } from "@/components/loader/form-skeleton";
import { ErrorState } from "@/components/ui/error-state";
import {
  coaRulesKey,
  saveCoaRules,
  type CoaDimensionRule,
} from "./coa-dimension-rules";
import { useRef, useState, useMemo, useEffect } from "react";
import { Controller, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { useTranslations } from "use-intl";
import { toast } from "sonner";
import { FolderTree, Plus, X, Tag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DiscardDialog } from "@/components/ui/discard-dialog";
import {
  Field,
  FieldInput,
  FieldLabel,
  FieldSelect,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SelectContent, SelectItem } from "@/components/ui/select";
import { SettingSection } from "@/components/ui/setting-section";
import { StatusSwitch } from "@/components/ui/status-switch";
import { FormToolbar } from "@/components/share/form-toolbar";
import { FormPageShell } from "@/components/share/form-page-shell";
import { useEntityForm } from "@/hooks/use-entity-form";
import { useBuCode } from "@/hooks/use-bu-code";
import { useGlAccountGroups } from "../shared/use-gl-account-groups";
import { ApiError, isAppStatusErrorCode } from "@/lib/api-error";
import { useErrorToast } from "@/hooks/use-error-toast";
import { scrollToFirstInvalidField } from "@/lib/form-helpers";
import type { AccountGroupMaster } from "@/types/accounting-master";
import {
  ACCOUNT_CATEGORIES,
  ACCOUNT_NATURE,
  CHART_OF_ACCOUNT_TYPES,
  type AccountCategory,
  type ChartOfAccount,
} from "@/types/chart-of-accounts";
import {
  createCoaSchema,
  natureFor,
  type CoaFormValues,
} from "./coa-form-schema";
import {
  useCreateChartOfAccount,
  useDeleteChartOfAccount,
  useUpdateChartOfAccount,
} from "./use-coa";
import {
  CoaTreeSelectorModal,
  type GroupingPathNode,
} from "./coa-tree-selector-modal";
import { CoaDeleteGuardrailDialog } from "./coa-delete-guardrail-dialog";
import { CoaMultiSelect } from "./coa-multi-select";
import { CoaDimensionPreview } from "./coa-dimension-preview";
import {
  EMPTY_DIMENSION_PREVIEW,
  type DimensionPreview,
} from "./coa-dimension-preview-state";

const LIST_PATH = "/config/chart-of-accounts";
const FORM_ID = "coa-form";

function normalizeArray(val: unknown): string[] {
  if (Array.isArray(val)) return val.map(String);
  if (typeof val === "string") {
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch {
      return val
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }
  }
  return [];
}

function normalizeAttributes(val: unknown): Record<string, string> {
  if (val && typeof val === "object" && !Array.isArray(val)) {
    return val as Record<string, string>;
  }
  if (typeof val === "string") {
    try {
      const parsed = JSON.parse(val);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, string>;
      }
    } catch {
      return {};
    }
  }
  return {};
}

interface CoaFormProps {
  account?: ChartOfAccount;
  rules?: CoaDimensionRule[];
  initialEdit?: boolean;
}

export function CoaForm(props: CoaFormProps) {
  const costCenterQuery = useCoaCostCenters();
  if (!costCenterQuery.data) {
    if (costCenterQuery.isError)
      return (
        <ErrorState
          error={costCenterQuery.error}
          onRetry={() => void costCenterQuery.refetch()}
          backTo={LIST_PATH}
        />
      );
    return <FormSkeleton />;
  }
  return <CoaFormFields {...props} costCenterQuery={costCenterQuery} />;
}

function CoaFormFields({
  account,
  rules = [],
  initialEdit = false,
  costCenterQuery,
}: CoaFormProps & { costCenterQuery: ReturnType<typeof useCoaCostCenters> }) {
  const navigate = useNavigate();
  const t = useTranslations("config.chartOfAccounts");
  const tfl = useTranslations("field");
  const tv = useTranslations("validation");
  const tt = useTranslations("toast");
  const errorToast = useErrorToast();

  const create = useCreateChartOfAccount();
  const update = useUpdateChartOfAccount();
  const remove = useDeleteChartOfAccount();

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [treeModalOpen, setTreeModalOpen] = useState(false);
  const [attrKey, setAttrKey] = useState("");
  const [attrVal, setAttrVal] = useState("");
  const [dimensionPreviews, setDimensionPreviews] = useState<
    Record<string, DimensionPreview>
  >({});
  const hasDimensionPreview = Object.keys(dimensionPreviews).length > 0;

  const groupQuery = useGlAccountGroups();
  const buCode = useBuCode();
  const queryClient = useQueryClient();
  const persisted = useRef(
    account ? { id: account.id, doc_version: account.doc_version } : undefined,
  );

  const save = useMutation({
    mutationFn: async (values: CoaFormValues) => {
      if (!buCode) throw new Error("Select a business unit first");
      const payload = {
        code: values.code,
        description_1: values.description_1,
        description_2: values.description_2 || null,
        category: values.category,
        nature: values.nature,
        type: values.type,
        account_group_id: values.account_group_id || null,
        is_require_cost_center: Boolean(values.req_cost_center),
        allowed_dimensions: values.allowed_dimensions ?? null,
        dimension_required: Boolean(values.req_dim),
        attributes: values.attributes ?? null,
        grouping_path: values.grouping_path ?? null,
        is_active: values.is_active,
      };
      const result = persisted.current
        ? await update.mutateAsync({ ...persisted.current, ...payload })
        : await create.mutateAsync(payload);
      const record = (result as { data?: { id: string; doc_version: number } })
        .data;
      if (!record?.id || typeof record.doc_version !== "number") {
        throw new Error("API did not return the saved account ID/version");
      }
      persisted.current = record;
      try {
        const saved = await saveCoaCostCenters(
          buCode,
          record.id,
          values.allowed_cost_center_codes ?? [],
          Boolean(values.req_cost_center),
        );
        queryClient.setQueryData(coaCostCentersKey(buCode), saved);
      } catch (error) {
        throw new Error(
          `Account saved, but Cost Center configuration was not fully saved. Retry Save. ${error instanceof Error ? error.message : ""}`,
        );
      }
      try {
        // สวิตช์ปิด = ไม่มีกฎ dimension เลย — ลบกฎที่มีอยู่ทิ้ง (เก็บค่าในฟอร์มไว้เผื่อเปิดกลับก่อนบันทึก)
        await saveCoaRules(
          buCode,
          record.id,
          values.req_dim ? values.dimension_rules : {},
        );
      } catch (error) {
        throw new Error(
          `Account saved, but dimension rules were not fully saved. Retry Save. ${error instanceof Error ? error.message : ""}`,
        );
      }
      await queryClient.invalidateQueries({
        queryKey: coaRulesKey(buCode, record.id),
      });
    },
    // รหัสสถานะแอป (APP_READ_ONLY ฯลฯ) ต้องแปลผ่าน errorToast — `err.message` เป็นประโยค
    // default ภาษาอังกฤษของ gateway
    onError: (error) =>
      error instanceof ApiError && isAppStatusErrorCode(error.appCode)
        ? errorToast(error)
        : toast.error(error.message),
  });

  const dimensionQuery = useGlDimensions();

  const f = useEntityForm<CoaFormValues>({
    entity: account,
    serverFieldErrors: { CHART_OF_ACCOUNTS_DUPLICATE_CODE: "code" },
    resolver: zodResolver(createCoaSchema(tv, tfl)) as Resolver<CoaFormValues>,
    defaultValues: account
      ? {
          code: account.code ?? "",
          description_1: account.description_1 ?? "",
          description_2: account.description_2 ?? "",
          category: account.category ?? ("" as AccountCategory),
          nature:
            account.nature ||
            (account.category
              ? natureFor(account.category)
              : ACCOUNT_NATURE.DEBIT),
          type: account.type ?? ("" as ChartOfAccount["type"]),
          account_group_id:
            account.account_group?.id ?? account.account_group_id ?? "",
          req_cost_center: account.is_require_cost_center ?? false,
          allowed_cost_center_codes: (costCenterQuery.data ?? [])
            .filter((item) =>
              item.accounts.some(
                (entry) => entry.chart_of_accounts_id === account.id,
              ),
            )
            .map((item) => item.code),
          // backend ไม่เก็บสถานะสวิตช์ — มีกฎอยู่ = เปิด
          req_dim: (rules ?? []).some(
            (rule) => rule.requirement !== "prohibited",
          ),
          allowed_dimensions: normalizeArray(account.allowed_dimensions),
          dimension_rules: Object.fromEntries(
            (rules ?? [])
              .filter((rule) => rule.requirement !== "prohibited")
              .map((rule) => [rule.gl_dimension_id, rule.requirement]),
          ),
          attributes: normalizeAttributes(account.attributes),
          grouping_path: Array.isArray(account.grouping_path)
            ? account.grouping_path
            : [],
          is_active: account.is_active ?? true,
        }
      : {
          code: "",
          description_1: "",
          description_2: "",
          category: "" as AccountCategory,
          nature: ACCOUNT_NATURE.DEBIT,
          type: "" as ChartOfAccount["type"],
          account_group_id: "",
          req_cost_center: false,
          allowed_cost_center_codes: [],
          req_dim: false,
          allowed_dimensions: [],
          dimension_rules: {},
          attributes: {},
          grouping_path: [],
          is_active: true,
        },
    listPath: LIST_PATH,
    isPending: save.isPending,
    extraDirty: hasDimensionPreview,
    onResetExtra: () => setDimensionPreviews({}),
  });

  const { form } = f;
  useEffect(() => {
    if (account && initialEdit) {
      f.setMode("edit");
    }
  }, [account, initialEdit, f]);

  const category = form.watch("category");
  const nature = form.watch("nature");
  const selectedGroupId = form.watch("account_group_id");
  const groupingPath = form.watch("grouping_path") ?? [];
  const reqCostCenter = form.watch("req_cost_center");
  const allowedCostCenters = form.watch("allowed_cost_center_codes") ?? [];
  const selectedCostCenterCodes = new Set(allowedCostCenters);
  const masterCostCenterCodes = new Set(
    (costCenterQuery.data ?? []).map((item) => item.code),
  );
  const costCenters = (costCenterQuery.data ?? []).filter(
    (item) =>
      item.is_active !== false || selectedCostCenterCodes.has(item.code),
  );
  const missingCostCenterCodes = allowedCostCenters.filter(
    (code) => !masterCostCenterCodes.has(code),
  );
  const costCenterOptions = [
    ...costCenters,
    ...missingCostCenterCodes.map((code) => ({
      code,
      name: costCenterQuery.isSuccess ? t("labels.unavailableCostCenter") : "",
    })),
  ];
  const reqDim = form.watch("req_dim");
  const attributes = form.watch("attributes") ?? {};
  const dimensionRules = form.watch("dimension_rules") ?? {};
  const selectedDimensionIds = Object.entries(dimensionRules)
    .filter(([, requirement]) => requirement !== "prohibited")
    .map(([id]) => id);

  const selectedDimensionSet = new Set(selectedDimensionIds);

  // Auto-sync Nature from Category whenever Category changes (Auto Rule 1)
  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (name === "category" && value.category) {
        const expectedNature = natureFor(value.category as AccountCategory);
        if (form.getValues("nature") !== expectedNature) {
          form.setValue("nature", expectedNature, {
            shouldDirty: true,
            shouldValidate: true,
          });
        }
      }
    });
    return () => subscription.unsubscribe();
  }, [form]);

  const allGroups = groupQuery.data;
  const groups = (allGroups ?? []).filter(
    (g) =>
      g.category === category &&
      (g.is_active ||
        g.id === (account?.account_group?.id ?? account?.account_group_id)),
  );
  const groupMap = useMemo(
    () => new Map((allGroups ?? []).map((g) => [g.id, g])),
    [allGroups],
  );
  const nonLeafIds = useMemo(
    () =>
      new Set(
        (allGroups ?? []).flatMap((g) => (g.parent_id ? [g.parent_id] : [])),
      ),
    [allGroups],
  );
  const currentGroup = selectedGroupId ? groupMap.get(selectedGroupId) : null;

  const dimensions = (dimensionQuery.data ?? []).filter(
    (d) => d.is_active || rules.some((r) => r.gl_dimension_id === d.id),
  );

  const isExisting = Boolean(account && account.code);
  const isUsed = Boolean(account?.is_used);
  // บัญชีเก่าที่ category ยังเป็น null ต้องเลือกได้แม้ถูกใช้แล้ว — backend ไม่ยอมบันทึก
  // ถ้า category เดิมเป็น null และไม่ส่งมา ล็อกไว้ = บัญชีนั้นแก้ไม่ได้อีกเลย
  const categoryLocked = isUsed && account?.category != null;

  const computeAncestry = (target: AccountGroupMaster): GroupingPathNode[] => {
    const path: GroupingPathNode[] = [];
    let curr: AccountGroupMaster | undefined = target;
    const visited = new Set<string>();
    while (curr && !visited.has(curr.id)) {
      visited.add(curr.id);
      path.unshift({ code: curr.code, name: curr.name, level: curr.level });
      curr = curr.parent_id ? groupMap.get(curr.parent_id) : undefined;
    }
    return path;
  };

  const handleTreeSelect = (
    path: GroupingPathNode[],
    target: AccountGroupMaster,
  ) => {
    form.setValue("account_group_id", target.id, {
      shouldDirty: true,
      shouldValidate: true,
    });
    form.setValue("grouping_path", path, { shouldDirty: true });
  };

  const handleAddAttribute = () => {
    if (!attrKey.trim() || !attrVal.trim()) return;
    const next = { ...attributes, [attrKey.trim()]: attrVal.trim() };
    form.setValue("attributes", next, { shouldDirty: true });
    setAttrKey("");
    setAttrVal("");
  };

  const handleRemoveAttribute = (key: string) => {
    const next = { ...attributes };
    delete next[key];
    form.setValue("attributes", next, { shouldDirty: true });
  };

  const handleActiveToggle = (checked: boolean) => {
    if (
      !checked &&
      account?.current_balance != null &&
      Number(account.current_balance) !== 0
    ) {
      toast.error(
        t("rules.cannotDeactivateNonZero", {
          balance: Number(account.current_balance).toLocaleString(),
          code: account.code,
        }),
      );
      return;
    }
    form.setValue("is_active", checked, { shouldDirty: true });
  };

  const onSubmit = (values: CoaFormValues) => {
    if (hasDimensionPreview) {
      toast.error(t("dimensionPreview.saveUnavailable"));
      return;
    }

    if (
      !values.is_active &&
      account?.current_balance != null &&
      Number(account.current_balance) !== 0
    ) {
      toast.error(
        t("rules.cannotDeactivateNonZero", {
          balance: Number(account.current_balance).toLocaleString(),
          code: account.code,
        }),
      );
      return;
    }

    if (
      reqCostCenter &&
      (costCenterQuery.isError || costCenterQuery.isLoading)
    ) {
      toast.error(t("labels.costCentersLoadBeforeSave"));
      return;
    }

    if (dimensionQuery.isError || dimensionQuery.isLoading) {
      toast.error("Load dimensions successfully before saving.");
      return;
    }

    f.submit(save, values, () => {
      toast.success(
        tt(account ? "updateSuccess" : "createSuccess", {
          entity: t("entity"),
        }),
      );
      if (account) f.backToList();
      else navigate(LIST_PATH, { replace: true, ...f.returnState });
    });
  };

  const displayGroupingPath: GroupingPathNode[] =
    groupingPath.length > 0
      ? groupingPath
      : currentGroup
        ? computeAncestry(currentGroup)
        : [];

  return (
    <div className="-mx-4 sm:mx-0">
      <FormPageShell
        header={
          <FormToolbar
            entity={account?.description_1 || t("entity")}
            mode={f.mode}
            formId={FORM_ID}
            isPending={save.isPending}
            onBack={f.handleBack}
            onCancel={f.handleCancel}
            onEdit={f.handleEdit}
            onDelete={account ? () => setDeleteOpen(true) : undefined}
            deleteIsPending={remove.isPending}
            badges={
              account && (
                <Badge variant="secondary" size="sm" className="font-mono">
                  {account.code}
                </Badge>
              )
            }
          />
        }
      >
        <form
          id={FORM_ID}
          className="space-y-6"
          onSubmit={form.handleSubmit(onSubmit, () =>
            scrollToFirstInvalidField(),
          )}
        >
          {/* SECTION 1: ข้อมูลพื้นฐานรหัสบัญชี (Basic Account Information) */}
          <SettingSection
            first
            wide
            title={t("sections.general")}
            description={t("sections.generalDesc")}
          >
            <div className="grid min-w-0 gap-6 sm:grid-cols-2">
              <Field>
                <div className="flex h-5 items-center justify-between">
                  <FieldLabel htmlFor="coa-code" required>
                    {tfl("code")}
                  </FieldLabel>
                  {isExisting && (
                    <Badge variant="secondary" size="sm">
                      {t("rules.codeLocked")}
                    </Badge>
                  )}
                </div>
                <FieldInput
                  id="coa-code"
                  maxLength={50}
                  disabled={f.isDisabled || isExisting}
                  placeholder={t("codePlaceholder")}
                  error={form.formState.errors.code?.message}
                  className="font-mono"
                  {...form.register("code")}
                />
              </Field>

              <Field>
                <div className="flex h-5 items-center">
                  <FieldLabel htmlFor="coa-description-1" required>
                    {t("descriptionEnglish")}
                  </FieldLabel>
                </div>
                <FieldInput
                  id="coa-description-1"
                  maxLength={150}
                  disabled={f.isDisabled}
                  placeholder={t("accountNamePlaceholder")}
                  error={form.formState.errors.description_1?.message}
                  {...form.register("description_1")}
                />
              </Field>

              <Field>
                <div className="flex h-5 items-center">
                  <FieldLabel htmlFor="coa-description-2">
                    {t("descriptionThai")}
                  </FieldLabel>
                </div>
                <FieldInput
                  id="coa-description-2"
                  maxLength={150}
                  disabled={f.isDisabled}
                  placeholder="เช่น รายได้ค่าห้องพัก"
                  {...form.register("description_2")}
                />
              </Field>

              <Field>
                <div className="flex h-5 items-center justify-between">
                  <FieldLabel required>{tfl("category")}</FieldLabel>
                  {categoryLocked && (
                    <span className="text-micro text-warning-ink">
                      {t("rules.fieldLockedUsed")}
                    </span>
                  )}
                </div>
                <Controller
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FieldSelect
                      value={field.value || undefined}
                      onValueChange={(value) => {
                        field.onChange(value);
                        form.setValue(
                          "nature",
                          natureFor(value as AccountCategory),
                          { shouldDirty: true },
                        );
                        form.setValue("account_group_id", "", {
                          shouldDirty: true,
                        });
                        form.setValue("grouping_path", [], {
                          shouldDirty: true,
                        });
                      }}
                      disabled={f.isDisabled || categoryLocked}
                      error={form.formState.errors.category?.message}
                      placeholder={t("labels.selectCategory")}
                    >
                      <SelectContent>
                        {ACCOUNT_CATEGORIES.map((val) => (
                          <SelectItem key={val} value={val}>
                            {t(`accountCategory.${val}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </FieldSelect>
                  )}
                />
              </Field>

              <Field>
                <div className="flex h-5 items-center justify-between">
                  <FieldLabel required>{tfl("nature")}</FieldLabel>
                </div>
                {/* Hidden input for react-hook-form value binding */}
                <input type="hidden" {...form.register("nature")} />
                <div className="border-input bg-muted/50 flex h-8 w-full items-center justify-between rounded-md border px-3 text-xs shadow-xs">
                  <span className="text-foreground font-medium">
                    {!category
                      ? "—"
                      : nature === ACCOUNT_NATURE.DEBIT
                        ? `${t("nature.debit")} (D)`
                        : nature === ACCOUNT_NATURE.CREDIT
                          ? `${t("nature.credit")} (C)`
                          : "-"}
                  </span>
                </div>
                <p className="text-micro text-muted-foreground">
                  {t("rules.natureAutoDesc")}
                </p>
              </Field>

              <Field>
                <div className="flex h-5 items-center justify-between">
                  <FieldLabel required>{tfl("type")}</FieldLabel>
                  {isUsed && (
                    <span className="text-micro text-warning-ink">
                      {t("rules.fieldLockedUsed")}
                    </span>
                  )}
                </div>
                <Controller
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FieldSelect
                      value={field.value || undefined}
                      onValueChange={field.onChange}
                      disabled={f.isDisabled || isUsed}
                      error={form.formState.errors.type?.message}
                      placeholder={t("labels.selectType")}
                    >
                      <SelectContent>
                        {CHART_OF_ACCOUNT_TYPES.map((val) => (
                          <SelectItem key={val} value={val}>
                            {t(`accountType.${val}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </FieldSelect>
                  )}
                />
              </Field>

              <Field className="sm:col-span-2">
                <Controller
                  control={form.control}
                  name="is_active"
                  render={({ field }) => (
                    <StatusSwitch
                      id="coa-is-active"
                      checked={field.value}
                      onCheckedChange={handleActiveToggle}
                      disabled={f.isDisabled}
                      label={t("rules.activeStatusTitle")}
                      description={t("rules.activeStatusRule")}
                      hideBadge
                    />
                  )}
                />
              </Field>
            </div>
          </SettingSection>

          {/* SECTION 2: ระดับหมวดบัญชีคุม (Account Code Grouping Path) */}
          <SettingSection
            title={t("sections.grouping")}
            description={t("sections.groupingDesc")}
            action={
              !f.isDisabled && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setTreeModalOpen(true)}
                  className="gap-1.5"
                >
                  <FolderTree className="size-4" />
                  <span>
                    {selectedGroupId
                      ? t("labels.changeGroup")
                      : t("labels.selectGroup")}
                  </span>
                </Button>
              )
            }
            plain
            wide
          >
            {displayGroupingPath.length > 0 ? (
              <ol
                className="space-y-3"
                aria-label={t("labels.hierarchicalPath")}
              >
                {displayGroupingPath.map((node, index) => (
                  <li
                    key={node.code}
                    className="flex min-w-0 items-start gap-3 text-xs"
                  >
                    <Badge
                      variant={
                        index === displayGroupingPath.length - 1
                          ? "secondary"
                          : "outline"
                      }
                      size="sm"
                      className="shrink-0 font-mono"
                    >
                      L{node.level}
                    </Badge>
                    <div className="min-w-0 break-words">
                      <span className="mr-2 font-mono font-semibold">
                        {node.code}
                      </span>
                      <span>{node.name}</span>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-muted-foreground text-xs">
                {t("labels.noGroupingSelected")}
              </p>
            )}
          </SettingSection>

          {/* Cost Center configuration */}
          <SettingSection title={t("sections.costCenters")} plain wide>
            <div className="space-y-4">
              <Controller
                control={form.control}
                name="req_cost_center"
                render={({ field }) => (
                  <StatusSwitch
                    id="coa-req-cost-center-switch"
                    checked={Boolean(field.value)}
                    disabled={f.isDisabled}
                    onCheckedChange={field.onChange}
                    label={t("labels.requireCostCenter")}
                    description={t("sections.costCentersDesc")}
                    hideBadge
                  />
                )}
              />

              {reqCostCenter ? (
                <div className="space-y-2">
                  <div className="text-muted-foreground text-xs font-medium">
                    {t("labels.allowedCostCentersLabel")}
                  </div>
                  {costCenterQuery.isLoading && (
                    <p role="status" className="text-muted-foreground text-xs">
                      {t("labels.loadingCostCenters")}
                    </p>
                  )}
                  {costCenterQuery.isError && (
                    <div
                      role="alert"
                      className="flex flex-wrap items-center gap-2 text-xs"
                    >
                      <span className="text-destructive">
                        {t("labels.costCentersLoadError")}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => void costCenterQuery.refetch()}
                      >
                        {t("labels.retryCostCenters")}
                      </Button>
                    </div>
                  )}
                  {costCenterQuery.isSuccess &&
                    costCenterOptions.length === 0 && (
                      <p className="text-muted-foreground text-xs">
                        {t("labels.noCostCenters")}
                      </p>
                    )}
                  <CoaMultiSelect
                    label={t("labels.costCentersPicker")}
                    options={costCenterOptions.map((item) => ({
                      value: item.code,
                      code: item.code,
                      name: item.name,
                    }))}
                    value={allowedCostCenters}
                    onChange={(codes) =>
                      form.setValue("allowed_cost_center_codes", codes, {
                        shouldDirty: true,
                      })
                    }
                    disabled={
                      save.isPending ||
                      costCenterQuery.isLoading ||
                      costCenterQuery.isError
                    }
                    readOnly={f.isView}
                  />
                </div>
              ) : (
                <p className="text-muted-foreground text-xs">
                  {t("labels.costCenterDisabledNote")}
                </p>
              )}
            </div>
          </SettingSection>

          {/* SECTION 4: ข้อกำหนดการวิเคราะห์ (Require Dimension Configuration) */}
          <SettingSection title={t("sections.dimensions")} plain wide>
            <div className="space-y-4">
              <Controller
                control={form.control}
                name="req_dim"
                render={({ field }) => (
                  <StatusSwitch
                    id="coa-req-dim-switch"
                    checked={Boolean(field.value)}
                    disabled={f.isDisabled}
                    onCheckedChange={field.onChange}
                    label={t("labels.requireDimension")}
                    description={t("sections.dimensionsDesc")}
                    hideBadge
                  />
                )}
              />

              {(reqDim || hasDimensionPreview) && (
                <div className="bg-muted flex flex-wrap items-start justify-between gap-2 rounded-md p-3">
                  <p className="text-muted-foreground min-w-0 flex-1 text-xs">
                    {t("dimensionPreview.previewNotice")}
                  </p>
                  {hasDimensionPreview && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={save.isPending}
                      onClick={() => setDimensionPreviews({})}
                    >
                      {t("dimensionPreview.clearPreview")}
                    </Button>
                  )}
                </div>
              )}
              {reqDim ? (
                <div className="space-y-3">
                  <div className="text-muted-foreground text-xs font-medium">
                    {t("labels.allowedDimsLabel")}
                  </div>
                  {dimensionQuery.isError && (
                    <p className="text-destructive text-xs">
                      Unable to load dimensions.
                    </p>
                  )}
                  <CoaMultiSelect
                    label={t("labels.allowedDimsLabel")}
                    options={dimensions.map((item) => ({
                      value: item.id,
                      code: item.code,
                      name: item.name,
                    }))}
                    value={selectedDimensionIds}
                    onChange={(ids) => {
                      form.setValue(
                        "dimension_rules",
                        Object.fromEntries(
                          ids.map((id) => [
                            id,
                            dimensionRules[id] ?? "mandatory",
                          ]),
                        ),
                        { shouldDirty: true },
                      );
                      const selected = new Set(ids);
                      setDimensionPreviews((previous) =>
                        Object.fromEntries(
                          Object.entries(previous).filter(([id]) =>
                            selected.has(id),
                          ),
                        ),
                      );
                    }}
                    disabled={
                      save.isPending ||
                      dimensionQuery.isLoading ||
                      dimensionQuery.isError
                    }
                    readOnly={f.isView}
                  />

                  {dimensions
                    .filter((item) => selectedDimensionSet.has(item.id))
                    .map((dimension) => (
                      <CoaDimensionPreview
                        key={dimension.id}
                        dimension={dimension}
                        value={
                          dimensionPreviews[dimension.id] ??
                          EMPTY_DIMENSION_PREVIEW
                        }
                        readOnly={f.isView}
                        onChange={(next) =>
                          setDimensionPreviews((previous) => {
                            const result = { ...previous };
                            if (
                              next.allowedValueIds.length === 0 &&
                              !next.defaultValueId
                            )
                              delete result[dimension.id];
                            else result[dimension.id] = next;
                            return result;
                          })
                        }
                      />
                    ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-xs">
                  {t("labels.dimDisabledNote")}
                </p>
              )}
            </div>
          </SettingSection>

          {/* SECTION 5: คุณลักษณะอ้างอิงเพิ่มเติม (Attribute Tags) */}
          <SettingSection
            title={t("sections.attributes")}
            description={t("sections.attributesDesc")}
            count={Object.keys(attributes).length}
            plain
            wide
          >
            <div className="space-y-4">
              {!f.isDisabled && (
                <div className="space-y-2">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:items-end">
                    <div className="min-w-0 space-y-1.5">
                      <label
                        htmlFor="coa-attr-key"
                        className="text-foreground text-xs font-medium"
                      >
                        {t("labels.tagKey")}
                      </label>
                      <Input
                        id="coa-attr-key"
                        placeholder={t("labels.keyPlaceholder")}
                        value={attrKey}
                        disabled={f.isDisabled}
                        onChange={(e) => setAttrKey(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleAddAttribute();
                          }
                        }}
                        className="bg-card h-9 text-xs"
                      />
                    </div>
                    <div className="min-w-0 space-y-1.5">
                      <label
                        htmlFor="coa-attr-val"
                        className="text-foreground text-xs font-medium"
                      >
                        {t("labels.tagValue")}
                      </label>
                      <Input
                        id="coa-attr-val"
                        placeholder={t("labels.valuePlaceholder")}
                        value={attrVal}
                        disabled={f.isDisabled}
                        onChange={(e) => setAttrVal(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleAddAttribute();
                          }
                        }}
                        className="bg-card h-9 text-xs"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <Button
                        type="button"
                        size="sm"
                        disabled={
                          f.isDisabled || !attrKey.trim() || !attrVal.trim()
                        }
                        onClick={handleAddAttribute}
                        className="gap-1.5"
                      >
                        <Plus className="size-4" />
                        <span>{t("labels.addTag")}</span>
                      </Button>
                    </div>
                  </div>
                  <p className="text-micro text-muted-foreground mt-2">
                    {t("labels.attributeHint")}
                  </p>
                </div>
              )}

              <div>
                {Object.keys(attributes).length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(attributes).map(([k, v]) => (
                      <span
                        key={k}
                        className="bg-muted text-foreground inline-flex max-w-full items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs"
                      >
                        <Tag className="text-muted-foreground size-3 shrink-0" />
                        <span className="min-w-0 font-semibold break-all">
                          {k}:
                        </span>
                        <span className="min-w-0 font-mono break-all">{v}</span>
                        {!f.isDisabled && (
                          <button
                            type="button"
                            onClick={() => handleRemoveAttribute(k)}
                            className="text-muted-foreground hover:bg-destructive/15 hover:text-destructive focus-visible:outline-ring ml-1 inline-flex size-4 items-center justify-center rounded-sm transition-colors focus-visible:outline-2"
                            aria-label={`Remove tag ${k}`}
                          >
                            <X className="size-3" />
                          </button>
                        )}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="text-muted-foreground text-xs">
                    {t("labels.noAttributes")}
                  </div>
                )}
              </div>
            </div>
          </SettingSection>
        </form>

        <DiscardDialog {...f.discard.dialogProps} variant="warning" />
        <DiscardDialog
          open={f.navGuard.isOpen}
          onOpenChange={(open) => {
            if (!open) f.navGuard.cancel();
          }}
          onConfirm={f.navGuard.confirm}
          onCancel={f.navGuard.cancel}
          variant="warning"
        />

        {/* Delete Guardrail Dialog */}
        <CoaDeleteGuardrailDialog
          account={account ?? null}
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          isPending={remove.isPending}
          onConfirmDelete={(acc) => {
            remove.mutate(acc.id, {
              onSuccess: () => {
                toast.success(tt("deleteSuccess", { entity: t("entity") }));
                f.backToList();
              },
            });
          }}
        />

        {/* Account Code Grouping Tree Selector Modal */}
        <CoaTreeSelectorModal
          open={treeModalOpen}
          onOpenChange={setTreeModalOpen}
          category={category}
          groups={groups}
          nonLeafIds={nonLeafIds}
          currentGroupId={selectedGroupId}
          onSelect={handleTreeSelect}
        />
      </FormPageShell>
    </div>
  );
}
