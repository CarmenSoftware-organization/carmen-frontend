import { useGlDimensions } from "@/hooks/use-gl-dimensions";
import {
  useCoaCostCenters,
  saveCoaCostCenters,
  coaCostCentersKey,
} from "./coa-cost-centers";
import { CoaFormSkeleton, COA_SECTION_PAIR } from "./coa-form-skeleton";
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
import { FileText, FolderOpen, FolderTree, Plus, X, Tag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DiscardDialog } from "@/components/ui/discard-dialog";
import {
  Field,
  FieldInput,
  FieldLabel,
  FieldPlainText,
  FieldSelect,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SelectContent, SelectItem } from "@/components/ui/select";
import { StatusDotBadge } from "@/components/ui/status-dot-badge";
import { Switch } from "@/components/ui/switch";
import { CompactSection, FieldGrid } from "@/components/share/compact-section";
import { SettingField } from "@/components/share/setting-field";
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

// ค่ากลางของ skill carmen-blue-ui-design (values.md §Forms)
const EDIT_LABEL = "font-semibold";
const ATTR_LABEL = "text-foreground text-xs font-semibold";
const VIEW_LABEL = "text-muted-foreground text-xs";
const HELPER = "text-micro text-muted-foreground";

/** เส้นฉากโยงโหนดลูกกับระดับแม่ใน tree ของกลุ่มบัญชี */
function TreeElbow() {
  return (
    <span
      aria-hidden
      className="border-border ml-2 h-2.5 w-3 shrink-0 rounded-bl-sm border-b border-l"
    />
  );
}

/**
 * สวิตช์ + ป้าย + คำอธิบายชิดกันทางซ้าย — ไม่ดันสวิตช์ไปขอบขวาของการ์ด (จอกว้างแล้ว
 * สวิตช์จะห่างจากป้ายเป็นพันพิกเซล) และไม่มีกรอบซ้อนในการ์ด
 */
function SwitchRow({
  id,
  label,
  description,
  checked,
  onCheckedChange,
  disabled,
}: {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly checked: boolean;
  readonly onCheckedChange: (checked: boolean) => void;
  readonly disabled?: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        aria-label={label}
        className="mt-0.5 shrink-0"
      />
      <div className="min-w-0">
        <label htmlFor={id} className={ATTR_LABEL}>
          {label}
        </label>
        <p className="text-muted-foreground text-xs">{description}</p>
      </div>
    </div>
  );
}

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
    return <CoaFormSkeleton />;
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

  const codeValue = form.watch("code");
  const typeValue = form.watch("type");
  const isActive = form.watch("is_active");
  const natureText = !category
    ? null
    : nature === ACCOUNT_NATURE.DEBIT
      ? `${t("nature.debit")} (D)`
      : nature === ACCOUNT_NATURE.CREDIT
        ? `${t("nature.credit")} (C)`
        : null;

  const displayGroupingPath: GroupingPathNode[] =
    groupingPath.length > 0
      ? groupingPath
      : currentGroup
        ? computeAncestry(currentGroup)
        : [];

  return (
    <FormPageShell
      width="wide"
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
        className="@container"
        onSubmit={form.handleSubmit(onSubmit, () =>
          scrollToFirstInvalidField(),
        )}
      >
        {/* SECTION 1: ข้อมูลพื้นฐานรหัสบัญชี (Basic Account Information) */}
        <CompactSection
          first
          title={t("sections.general")}
          description={t("sections.generalDesc")}
        >
          {f.isView ? (
            // โหมดดู: ป้ายเงียบ + ค่าเด่น ไม่มีกรอบ (กรอบมีเฉพาะช่องที่กรอกได้จริง)
            <FieldGrid>
              <SettingField label={tfl("code")} value={codeValue} mono />
              <SettingField
                label={t("descriptionEnglish")}
                value={form.watch("description_1")}
              />
              <SettingField
                label={t("descriptionThai")}
                value={form.watch("description_2")}
              />
              <SettingField
                label={tfl("category")}
                value={category ? t(`accountCategory.${category}`) : null}
              />
              <SettingField label={tfl("nature")} value={natureText} />
              <SettingField
                label={tfl("type")}
                value={typeValue ? t(`accountType.${typeValue}`) : null}
              />
              <div className="min-w-0">
                <div className="text-muted-foreground text-xs">
                  {t("rules.activeStatusTitle")}
                </div>
                <StatusDotBadge
                  tone={isActive ? "success" : "destructive"}
                  className="mt-1"
                >
                  {tfl(isActive ? "active" : "inactive")}
                </StatusDotBadge>
              </div>
            </FieldGrid>
          ) : (
            <FieldGrid>
              <Field>
                <FieldLabel htmlFor="coa-code" required className={EDIT_LABEL}>
                  {tfl("code")}
                </FieldLabel>
                <FieldInput
                  id="coa-code"
                  maxLength={50}
                  disabled={f.isDisabled || isExisting}
                  placeholder={t("codePlaceholder")}
                  error={form.formState.errors.code?.message}
                  className="font-mono"
                  {...form.register("code")}
                />
                {/* คำเตือนล็อกอยู่ใต้ช่อง ไม่ใช่ข้างป้าย — ช่องกว้าง ~220px ข้อความยาวจะชนป้าย */}
                {isExisting && (
                  <p className={HELPER}>{t("rules.codeLocked")}</p>
                )}
              </Field>

              <Field>
                <FieldLabel
                  htmlFor="coa-description-1"
                  required
                  className={EDIT_LABEL}
                >
                  {t("descriptionEnglish")}
                </FieldLabel>
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
                <FieldLabel htmlFor="coa-description-2" className={EDIT_LABEL}>
                  {t("descriptionThai")}
                </FieldLabel>
                <FieldInput
                  id="coa-description-2"
                  maxLength={150}
                  disabled={f.isDisabled}
                  placeholder="เช่น รายได้ค่าห้องพัก"
                  {...form.register("description_2")}
                />
              </Field>

              <Field>
                <FieldLabel required className={EDIT_LABEL}>
                  {tfl("category")}
                </FieldLabel>
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
                {categoryLocked && (
                  <p className="text-micro text-warning-ink">
                    {t("rules.fieldLockedUsed")}
                  </p>
                )}
              </Field>

              {/* Nature แก้ไม่ได้ (ตามหมวดบัญชี) จึงไม่มีกรอบแม้อยู่ในโหมดแก้ */}
              <Field>
                <FieldLabel required>{tfl("nature")}</FieldLabel>
                <input type="hidden" {...form.register("nature")} />
                <FieldPlainText>{natureText}</FieldPlainText>
                <p className={HELPER}>{t("rules.natureAutoDesc")}</p>
              </Field>

              <Field>
                <FieldLabel required className={EDIT_LABEL}>
                  {tfl("type")}
                </FieldLabel>
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
                {isUsed && (
                  <p className="text-micro text-warning-ink">
                    {t("rules.fieldLockedUsed")}
                  </p>
                )}
              </Field>

              <Field>
                <FieldLabel htmlFor="coa-is-active" className={EDIT_LABEL}>
                  {t("rules.activeStatusTitle")}
                </FieldLabel>
                <div className="flex min-h-8 items-center gap-2">
                  <Switch
                    id="coa-is-active"
                    checked={isActive}
                    onCheckedChange={handleActiveToggle}
                    disabled={f.isDisabled}
                    aria-label={t("rules.activeStatusTitle")}
                  />
                  <span className="text-xs">
                    {tfl(isActive ? "active" : "inactive")}
                  </span>
                </div>
                <p className={HELPER}>{t("rules.activeStatusRule")}</p>
              </Field>
            </FieldGrid>
          )}
        </CompactSection>

        <div className={COA_SECTION_PAIR}>
          {/* SECTION 2: ระดับหมวดบัญชีคุม (Account Code Grouping Path) */}
          <CompactSection
            title={t("sections.grouping")}
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
          >
            {displayGroupingPath.length > 0 ? (
              // tree: แต่ละระดับเยื้องเข้า 20px + เส้นฉากโยงจากระดับแม่ · ใบสุดท้ายคือบัญชีนี้เอง
              <ol
                className="space-y-1.5 text-xs"
                aria-label={t("labels.hierarchicalPath")}
              >
                {displayGroupingPath.map((node, index) => (
                  <li
                    key={node.code}
                    className="flex min-w-0 items-start gap-1.5"
                    style={{ paddingLeft: Math.max(0, index - 1) * 20 }}
                  >
                    {index > 0 && <TreeElbow />}
                    <FolderOpen className="text-muted-foreground mt-0.5 size-4 shrink-0" />
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
                    <div className="min-w-0 pt-0.5 break-words">
                      <span className="mr-2 font-mono font-semibold">
                        {node.code}
                      </span>
                      <span>{node.name}</span>
                    </div>
                  </li>
                ))}
                {codeValue && (
                  <li
                    className="flex min-w-0 items-start gap-1.5"
                    style={{
                      paddingLeft: (displayGroupingPath.length - 1) * 20,
                    }}
                  >
                    <TreeElbow />
                    <FileText className="text-primary mt-0.5 size-4 shrink-0" />
                    <div className="min-w-0 pt-0.5 font-medium break-words">
                      <span className="mr-2 font-mono font-semibold">
                        {codeValue}
                      </span>
                      <span>{form.watch("description_1")}</span>
                    </div>
                  </li>
                )}
              </ol>
            ) : (
              <p className="text-muted-foreground text-xs">
                {t("labels.noGroupingSelected")}
              </p>
            )}
          </CompactSection>

          {/* SECTION 3: Cost Center configuration */}
          <CompactSection title={t("sections.costCenters")}>
            <div className="space-y-3">
              {f.isView ? (
                // สถานะเป็นชิปจุดสี — กวาดตาแล้วรู้ทันทีว่าบังคับหรือไม่ ไม่ต้องอ่านทั้งประโยค
                <StatusDotBadge tone={reqCostCenter ? "info" : "neutral"}>
                  {reqCostCenter ? t("labels.costCenterReq") : tfl("optional")}
                </StatusDotBadge>
              ) : (
                <Controller
                  control={form.control}
                  name="req_cost_center"
                  render={({ field }) => (
                    <SwitchRow
                      id="coa-req-cost-center-switch"
                      checked={Boolean(field.value)}
                      disabled={f.isDisabled}
                      onCheckedChange={field.onChange}
                      label={t("labels.requireCostCenter")}
                      description={
                        field.value
                          ? t("sections.costCentersDesc")
                          : t("labels.costCenterDisabledNote")
                      }
                    />
                  )}
                />
              )}

              {reqCostCenter && (
                <div className="max-w-md space-y-1.5">
                  <div className={f.isView ? VIEW_LABEL : ATTR_LABEL}>
                    {f.isView
                      ? t("labels.costCentersPicker")
                      : t("labels.allowedCostCentersLabel")}
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
              )}
            </div>
          </CompactSection>
        </div>

        <div className={COA_SECTION_PAIR}>
          {/* SECTION 4: ข้อกำหนดการวิเคราะห์ (Require Dimension Configuration) */}
          <CompactSection title={t("sections.dimensions")}>
            <div className="space-y-3">
              {f.isView ? (
                // สถานะเป็นชิปจุดสี — กวาดตาแล้วรู้ทันทีว่าบังคับหรือไม่ ไม่ต้องอ่านทั้งประโยค
                <StatusDotBadge tone={reqDim ? "info" : "neutral"}>
                  {reqDim ? t("labels.dimReq") : tfl("optional")}
                </StatusDotBadge>
              ) : (
                <Controller
                  control={form.control}
                  name="req_dim"
                  render={({ field }) => (
                    <SwitchRow
                      id="coa-req-dim-switch"
                      checked={Boolean(field.value)}
                      disabled={f.isDisabled}
                      onCheckedChange={field.onChange}
                      label={t("labels.requireDimension")}
                      description={
                        field.value
                          ? t("sections.dimensionsDesc")
                          : t("labels.dimDisabledNote")
                      }
                    />
                  )}
                />
              )}

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
              {reqDim && (
                <>
                  <div className="max-w-md space-y-1.5">
                    <div className={f.isView ? VIEW_LABEL : ATTR_LABEL}>
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
                  </div>

                  {/* dimension ที่เลือก = รายการหลายส่วน (ชื่อ สรุป ปุ่ม) → กริดตามความกว้างการ์ด */}
                  {selectedDimensionIds.length > 0 && (
                    <FieldGrid size="item">
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
                    </FieldGrid>
                  )}
                </>
              )}
            </div>
          </CompactSection>

          {/* SECTION 5: คุณลักษณะอ้างอิงเพิ่มเติม (Attribute Tags) */}
          <CompactSection
            title={t("sections.attributes")}
            description={t("sections.attributesDesc")}
            count={Object.keys(attributes).length}
          >
            <div className="space-y-3">
              {!f.isDisabled && (
                <FieldGrid>
                  <div className="min-w-0 space-y-1.5">
                    <label htmlFor="coa-attr-key" className={ATTR_LABEL}>
                      {t("labels.tagKey")}
                    </label>
                    <Input
                      id="coa-attr-key"
                      placeholder={t("labels.keyPlaceholder")}
                      value={attrKey}
                      onChange={(e) => setAttrKey(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddAttribute();
                        }
                      }}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="min-w-0 space-y-1.5">
                    <label htmlFor="coa-attr-val" className={ATTR_LABEL}>
                      {t("labels.tagValue")}
                    </label>
                    <Input
                      id="coa-attr-val"
                      placeholder={t("labels.valuePlaceholder")}
                      value={attrVal}
                      onChange={(e) => setAttrVal(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddAttribute();
                        }
                      }}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="self-end">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={!attrKey.trim() || !attrVal.trim()}
                      onClick={handleAddAttribute}
                      className="gap-1.5"
                    >
                      <Plus className="size-4" />
                      <span>{t("labels.addTag")}</span>
                    </Button>
                  </div>
                </FieldGrid>
              )}

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
                <p className="text-muted-foreground text-xs">
                  {t("labels.noAttributes")}
                </p>
              )}
            </div>
          </CompactSection>
        </div>
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
  );
}
