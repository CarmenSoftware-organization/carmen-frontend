import { coaRulesKey, saveCoaRules, type CoaDimensionRule, type DimensionRequirement } from "./coa-dimension-rules";
import { useRef, useState, useMemo, useEffect } from "react";
import { Controller, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { useTranslations } from "use-intl";
import { toast } from "sonner";
import {
  FolderTree,
  ChevronRight,
  Plus,
  X,
  Building2,
  Layers,
  Tag,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DiscardDialog } from "@/components/ui/discard-dialog";
import { Field, FieldInput, FieldLabel, FieldSelect } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { SettingSection } from "@/components/ui/setting-section";
import { StatusSwitch } from "@/components/ui/status-switch";
import { Switch } from "@/components/ui/switch";
import { FormToolbar } from "@/components/share/form-toolbar";
import { FormPageShell } from "@/components/share/form-page-shell";
import { useEntityForm } from "@/hooks/use-entity-form";
import { useBuCode } from "@/hooks/use-bu-code";
import { useGlAccountGroups } from "../shared/use-gl-account-groups";
import { API_ENDPOINTS } from "@/constant/api-endpoints";
import { httpClient } from "@/lib/http-client";
import { ApiError, isAppStatusErrorCode } from "@/lib/api-error";
import { useErrorToast } from "@/hooks/use-error-toast";
import { cn } from "@/lib/utils";
import { scrollToFirstInvalidField } from "@/lib/form-helpers";
import type { DimensionMaster, AccountGroupMaster } from "@/types/accounting-master";
import {
  ACCOUNT_CATEGORIES,
  ACCOUNT_NATURE,
  CHART_OF_ACCOUNT_TYPES,
  type AccountCategory,
  type ChartOfAccount,
} from "@/types/chart-of-accounts";
import { createCoaSchema, natureFor, type CoaFormValues } from "./coa-form-schema";
import { useCreateChartOfAccount, useDeleteChartOfAccount, useUpdateChartOfAccount } from "./use-coa";
import { CoaTreeSelectorModal, type GroupingPathNode } from "./coa-tree-selector-modal";
import { CoaDeleteGuardrailDialog } from "./coa-delete-guardrail-dialog";

const LIST_PATH = "/config/chart-of-accounts";
const FORM_ID = "coa-form";

const DEFAULT_DEPARTMENTS = [
  { code: "GEN", nameEn: "General Administration", nameTh: "แผนกทั่วไป" },
  { code: "FO", nameEn: "Front Office", nameTh: "แผนกต้อนรับส่วนหน้า" },
  { code: "HK", nameEn: "Housekeeping", nameTh: "แผนกแม่บ้าน" },
  { code: "FB", nameEn: "Food & Beverage", nameTh: "แผนกอาหารและเครื่องดื่ม" },
  { code: "KIT", nameEn: "Kitchen", nameTh: "แผนกครัว" },
  { code: "ENG", nameEn: "Maintenance & Engineering", nameTh: "แผนกช่างและซ่อมบำรุง" },
  { code: "SPA", nameEn: "Spa & Wellness", nameTh: "แผนกสปา" },
  { code: "ACC", nameEn: "Finance & Accounting", nameTh: "แผนกการเงินและบัญชี" },
];

function normalizeArray(val: unknown): string[] {
  if (Array.isArray(val)) return val.map(String);
  if (typeof val === "string") {
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch {
      return val.split(",").map((s) => s.trim()).filter(Boolean);
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

export function CoaForm({
  account,
  rules = [],
  initialEdit = false,
}: {
  account?: ChartOfAccount;
  rules?: CoaDimensionRule[];
  initialEdit?: boolean;
}) {
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

  const groupQuery = useGlAccountGroups();
  const buCode = useBuCode();
  const queryClient = useQueryClient();
  const persisted = useRef(account ? { id: account.id, doc_version: account.doc_version } : undefined);

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
        allowed_departments: values.allowed_departments ?? null,
        department_required: Boolean(values.req_dept),
        allowed_dimensions: values.allowed_dimensions ?? null,
        dimension_required: Boolean(values.req_dim),
        attributes: values.attributes ?? null,
        grouping_path: values.grouping_path ?? null,
        is_active: values.is_active,
      };
      const result = persisted.current
        ? await update.mutateAsync({ ...persisted.current, ...payload })
        : await create.mutateAsync(payload);
      const record = (result as { data?: { id: string; doc_version: number } }).data;
      if (!record?.id || typeof record.doc_version !== "number") {
        throw new Error("API did not return the saved account ID/version");
      }
      persisted.current = record;
      try {
        await saveCoaRules(buCode, record.id, values.dimension_rules);
      } catch (error) {
        throw new Error(
          `Account saved, but dimension rules were not fully saved. Retry Save. ${error instanceof Error ? error.message : ""}`,
        );
      }
      await queryClient.invalidateQueries({ queryKey: coaRulesKey(buCode, record.id) });
    },
    // รหัสสถานะแอป (APP_READ_ONLY ฯลฯ) ต้องแปลผ่าน errorToast — `err.message` เป็นประโยค
    // default ภาษาอังกฤษของ gateway
    onError: (error) =>
      error instanceof ApiError && isAppStatusErrorCode(error.appCode)
        ? errorToast(error)
        : toast.error(error.message),
  });

  const dimensionQuery = useQuery({
    queryKey: ["accounting-master", "dimensions", buCode],
    enabled: !!buCode,
    queryFn: async (): Promise<DimensionMaster[]> => {
      const res = await httpClient.get(API_ENDPOINTS.GL_DIMENSIONS(buCode!));
      if (!res.ok) throw await ApiError.from(res, "Unable to load dimensions");
      const json = await res.json();
      return Array.isArray(json) ? json : (json.data ?? []);
    },
  });

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
          nature: account.nature || (account.category ? natureFor(account.category) : ACCOUNT_NATURE.DEBIT),
          type: account.type ?? ("" as ChartOfAccount["type"]),
          account_group_id: account.account_group?.id ?? account.account_group_id ?? "",
          req_dept: Boolean(account.department_required || (Array.isArray(account.allowed_departments) && account.allowed_departments.length > 0)),
          allowed_departments: normalizeArray(account.allowed_departments),
          req_dim: Boolean(account.dimension_required || (Array.isArray(account.allowed_dimensions) && account.allowed_dimensions.length > 0)),
          allowed_dimensions: normalizeArray(account.allowed_dimensions),
          dimension_rules: Object.fromEntries((rules ?? []).map((rule) => [rule.gl_dimension_id, rule.requirement])),
          attributes: normalizeAttributes(account.attributes),
          grouping_path: Array.isArray(account.grouping_path) ? account.grouping_path : [],
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
          req_dept: false,
          allowed_departments: [],
          req_dim: false,
          allowed_dimensions: [],
          dimension_rules: {},
          attributes: {},
          grouping_path: [],
          is_active: true,
        },
    listPath: LIST_PATH,
    isPending: save.isPending,
  });

  const { form } = f;
  useEffect(() => {
    if (account && initialEdit) {
      f.setMode("edit");
    }
  }, [account, initialEdit, f]);

  const code = form.watch("code");
  const desc1 = form.watch("description_1");
  const desc2 = form.watch("description_2");
  const category = form.watch("category");
  const nature = form.watch("nature");
  const selectedGroupId = form.watch("account_group_id");
  const groupingPath = form.watch("grouping_path") ?? [];
  const reqDept = form.watch("req_dept");
  const allowedDepts = form.watch("allowed_departments") ?? [];
  const reqDim = form.watch("req_dim");
  const attributes = form.watch("attributes") ?? {};

  // Auto-sync Nature from Category whenever Category changes (Auto Rule 1)
  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (name === "category" && value.category) {
        const expectedNature = natureFor(value.category as AccountCategory);
        if (form.getValues("nature") !== expectedNature) {
          form.setValue("nature", expectedNature, { shouldDirty: true, shouldValidate: true });
        }
      }
    });
    return () => subscription.unsubscribe();
  }, [form]);

  const allGroups = groupQuery.data;
  const groups = (allGroups ?? []).filter(
    (g) => g.category === category && (g.is_active || g.id === (account?.account_group?.id ?? account?.account_group_id)),
  );
  const groupMap = useMemo(() => new Map((allGroups ?? []).map((g) => [g.id, g])), [allGroups]);
  const nonLeafIds = useMemo(
    () => new Set((allGroups ?? []).flatMap((g) => (g.parent_id ? [g.parent_id] : []))),
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

  const handleTreeSelect = (path: GroupingPathNode[], target: AccountGroupMaster) => {
    form.setValue("account_group_id", target.id, { shouldDirty: true, shouldValidate: true });
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

  const handleDeptToggle = (code: string) => {
    const exists = allowedDepts.includes(code);
    const next = exists ? allowedDepts.filter((c) => c !== code) : [...allowedDepts, code];
    form.setValue("allowed_departments", next, { shouldDirty: true });
  };

  const handleActiveToggle = (checked: boolean) => {
    if (!checked && account?.current_balance != null && Number(account.current_balance) !== 0) {
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
    if (!values.is_active && account?.current_balance != null && Number(account.current_balance) !== 0) {
      toast.error(
        t("rules.cannotDeactivateNonZero", {
          balance: Number(account.current_balance).toLocaleString(),
          code: account.code,
        }),
      );
      return;
    }

    if (dimensionQuery.isError || dimensionQuery.isLoading) {
      toast.error("Load dimensions successfully before saving.");
      return;
    }

    f.submit(save, values, () => {
      toast.success(tt(account ? "updateSuccess" : "createSuccess", { entity: t("entity") }));
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
          badges={account && <Badge variant="secondary" size="sm" className="font-mono">{account.code}</Badge>}
        />
      }
      width="wide"
    >
      <form
        id={FORM_ID}
        className="space-y-6"
        onSubmit={form.handleSubmit(onSubmit, () => scrollToFirstInvalidField())}
      >
        {/* SECTION 1: ข้อมูลพื้นฐานรหัสบัญชี (Basic Account Information) */}
        <SettingSection first title={t("sections.general")} description={t("sections.generalDesc")}>
          <Field>
            <div className="flex h-5 items-center justify-between">
              <FieldLabel htmlFor="coa-code" required>
                {tfl("code")}
              </FieldLabel>
              {isExisting && (
                <Badge variant="secondary" size="sm" className="text-micro-legal text-amber-600 dark:text-amber-400">
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
                <span className="text-micro text-amber-600 dark:text-amber-400">
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
                    form.setValue("nature", natureFor(value as AccountCategory), { shouldDirty: true });
                    form.setValue("account_group_id", "", { shouldDirty: true });
                    form.setValue("grouping_path", [], { shouldDirty: true });
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
            <div className="flex h-8 w-full items-center justify-between rounded-md border border-input bg-muted/50 px-3 text-xs shadow-xs">
              <span className="font-medium text-foreground">
                {nature === ACCOUNT_NATURE.DEBIT
                  ? `${t("nature.debit")} (D)`
                  : nature === ACCOUNT_NATURE.CREDIT
                    ? `${t("nature.credit")} (C)`
                    : "-"}
              </span>
              <span className="rounded bg-primary/10 px-1.5 py-0.5 text-micro-legal font-semibold text-primary border border-primary/20">
                {t("rules.autoRule1")}
              </span>
            </div>
          </Field>

          <Field>
            <div className="flex h-5 items-center justify-between">
              <FieldLabel required>{tfl("type")}</FieldLabel>
              {isUsed && (
                <span className="text-micro text-amber-600 dark:text-amber-400">
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
                  placeholder={t("labels.allTypes")}
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

          <Field>
            <FieldLabel>{t("rules.activeStatusTitle")}</FieldLabel>
            <Controller
              control={form.control}
              name="is_active"
              render={({ field }) => (
                <StatusSwitch
                  id="coa-is-active"
                  checked={field.value}
                  onCheckedChange={handleActiveToggle}
                  disabled={f.isDisabled}
                />
              )}
            />
            <p className="mt-1 text-micro text-muted-foreground">
              {t("rules.activeStatusRule")}
            </p>
          </Field>
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
                variant={selectedGroupId ? "outline" : "default"}
                onClick={() => setTreeModalOpen(true)}
                className="gap-1.5"
              >
                <FolderTree className="size-4" />
                <span>{selectedGroupId ? t("labels.changeGroup") : t("labels.selectGroup")}</span>
              </Button>
            )
          }
          plain
        >
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4">
            {/* Target Account Code Card */}
            <div className="rounded-lg border border-border bg-secondary/30 p-3 space-y-0.5">
              <div className="text-micro font-semibold text-muted-foreground uppercase tracking-wider">
                {t("labels.targetAccountCode")}
              </div>
              <div className="text-sm font-mono font-bold text-primary">
                {code || "---"}
              </div>
              <div className="text-xs font-medium text-foreground truncate">
                {desc1 || "-"}
              </div>
              {desc2 && (
                <div className="text-micro text-muted-foreground truncate">
                  {desc2}
                </div>
              )}
            </div>

            {/* Hierarchical Grouping Path */}
            <div className="space-y-2">
              <div className="text-xs font-semibold text-muted-foreground">
                {t("labels.hierarchicalPath")}
              </div>
              {displayGroupingPath.length > 0 ? (
                <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-border bg-secondary/30 p-3 text-xs font-mono">
                  {displayGroupingPath.map((item, idx) => (
                    <span key={item?.code ?? idx} className="inline-flex items-center gap-1.5">
                      <span className="rounded bg-card border border-border px-2 py-0.5 font-semibold text-foreground">
                        {item?.code} {item?.name}
                      </span>
                      {idx < displayGroupingPath.length - 1 && (
                        <ChevronRight className="size-3.5 text-muted-foreground" />
                      )}
                    </span>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-border bg-secondary/20 p-4 text-center text-xs text-muted-foreground">
                  {t("labels.noGroupingSelected")}
                </div>
              )}
            </div>

            {/* Level Hierarchy Breakdown Timeline แนวตั้ง */}
            {displayGroupingPath.length > 0 && (
              <div className="space-y-3 pt-1">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {t("labels.levelBreakdown")}
                </div>

                <div className="relative pl-5 space-y-4 border-l-2 border-primary/40 ml-2">
                  {displayGroupingPath.map((node, index) => {
                    const isCurrent = index === displayGroupingPath.length - 1;
                    return (
                      <div key={node.code ?? index} className="relative flex items-start gap-3">
                        <div
                          className={cn(
                            "absolute -left-[27px] top-1 size-3.5 rounded-full border-2",
                            isCurrent
                              ? "bg-primary border-background ring-4 ring-primary/20"
                              : "bg-card border-primary/60",
                          )}
                        />
                        <div className="space-y-0.5">
                          <div className="text-micro-legal uppercase font-bold text-muted-foreground tracking-wider">
                            LEVEL {node.level}
                          </div>
                          <div className="text-xs font-mono font-bold text-foreground">
                            {node.code}
                          </div>
                          <div className="text-xs text-foreground font-medium">
                            {node.name}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Current Parent Group Card */}
            {currentGroup && (
              <div className="rounded-xl border border-primary/30 bg-primary/10 p-4 text-xs space-y-1">
                <div className="text-micro font-bold text-primary uppercase tracking-wide">
                  {t("labels.currentParentGroup")}
                </div>
                <div className="text-sm font-bold text-foreground font-mono">
                  Level {currentGroup.level} | {currentGroup.code}
                </div>
                <div className="text-xs text-foreground font-medium">
                  {currentGroup.name}
                  {currentGroup.name_local && ` (${currentGroup.name_local})`}
                </div>
              </div>
            )}
          </div>
        </SettingSection>

        {/* SECTION 3: ข้อกำหนดแผนก (Require Department Settings) */}
        <SettingSection
          title={t("sections.departments")}
          description={t("sections.departmentsDesc")}
          action={
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">
                {reqDept ? t("labels.statusOn") : t("labels.statusOff")}
              </span>
              <Controller
                control={form.control}
                name="req_dept"
                render={({ field }) => (
                  <Switch
                    id="coa-req-dept-switch"
                    checked={Boolean(field.value)}
                    disabled={f.isDisabled}
                    onCheckedChange={field.onChange}
                  />
                )}
              />
            </div>
          }
          plain
        >
          <div className="rounded-lg border border-border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex size-7 items-center justify-center rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400">
                  <Building2 className="size-4" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-foreground">
                    {t("labels.requireDepartment")}
                  </div>
                  <div className="text-micro text-muted-foreground">
                    {t("sections.departmentsDesc")}
                  </div>
                </div>
              </div>
              <Controller
                control={form.control}
                name="req_dept"
                render={({ field }) => (
                  <Switch
                    checked={Boolean(field.value)}
                    disabled={f.isDisabled}
                    onCheckedChange={field.onChange}
                  />
                )}
              />
            </div>

            {reqDept ? (
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground font-medium">
                  {t("labels.allowedDeptsLabel")}
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {DEFAULT_DEPARTMENTS.map((dept) => {
                    const checked = Array.isArray(allowedDepts) && allowedDepts.includes(dept.code);
                    return (
                      <label
                        key={dept.code}
                        className={`flex cursor-pointer items-center gap-2 rounded-lg border p-2.5 text-xs transition-colors ${
                          checked
                            ? "border-purple-500/40 bg-purple-500/10 text-purple-800 dark:text-purple-300 font-semibold"
                            : "border-border bg-card hover:bg-secondary/40"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={f.isDisabled}
                          onChange={() => handleDeptToggle(dept.code)}
                          className="size-3.5 rounded border-border text-purple-600"
                        />
                        <span className="font-mono font-bold">{dept.code}</span>
                        <span className="truncate">{dept.nameEn}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">
                {t("labels.deptDisabledNote")}
              </p>
            )}
          </div>
        </SettingSection>

        {/* SECTION 4: ข้อกำหนดการวิเคราะห์ (Require Dimension Configuration) */}
        <SettingSection
          title={t("sections.dimensions")}
          description={t("sections.dimensionsDesc")}
          action={
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">
                {reqDim ? t("labels.statusOn") : t("labels.statusOff")}
              </span>
              <Controller
                control={form.control}
                name="req_dim"
                render={({ field }) => (
                  <Switch
                    id="coa-req-dim-switch"
                    checked={Boolean(field.value)}
                    disabled={f.isDisabled}
                    onCheckedChange={field.onChange}
                  />
                )}
              />
            </div>
          }
          plain
        >
          <div className="rounded-lg border border-border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex size-7 items-center justify-center rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <Layers className="size-4" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-foreground">
                    {t("labels.requireDimension")}
                  </div>
                  <div className="text-micro text-muted-foreground">
                    {t("sections.dimensionsDesc")}
                  </div>
                </div>
              </div>
              <Controller
                control={form.control}
                name="req_dim"
                render={({ field }) => (
                  <Switch
                    checked={Boolean(field.value)}
                    disabled={f.isDisabled}
                    onCheckedChange={field.onChange}
                  />
                )}
              />
            </div>

            {reqDim ? (
              <div className="space-y-3">
                <div className="text-xs text-muted-foreground font-medium">
                  {t("labels.allowedDimsLabel")}
                </div>
                {dimensionQuery.isError && (
                  <p className="text-xs text-destructive">
                    Unable to load dimensions.
                  </p>
                )}
                <Controller
                  control={form.control}
                  name="dimension_rules"
                  render={({ field }) => (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {dimensions.map((dim) => (
                        <div
                          key={dim.id}
                          className="rounded-lg border border-border bg-secondary/20 p-3 space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-xs font-bold text-amber-600 dark:text-amber-400">
                              {dim.code}
                            </span>
                            <span className="text-xs font-medium text-foreground truncate max-w-[140px]">
                              {dim.name}
                            </span>
                          </div>
                          <Select
                            value={field.value?.[dim.id] ?? "default"}
                            disabled={f.isDisabled || dimensionQuery.isLoading || dimensionQuery.isError}
                            onValueChange={(val) => {
                              const next = { ...(field.value ?? {}) };
                              if (val === "default") delete next[dim.id];
                              else next[dim.id] = val as DimensionRequirement;
                              field.onChange(next);
                            }}
                          >
                            <SelectTrigger size="sm" className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="default">Default (no rule)</SelectItem>
                              <SelectItem value="mandatory">Mandatory</SelectItem>
                              <SelectItem value="optional">Optional</SelectItem>
                              <SelectItem value="prohibited">Prohibited</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      ))}
                      {!dimensionQuery.isLoading && !dimensionQuery.isError && dimensions.length === 0 && (
                        <p className="text-xs text-muted-foreground">No dimensions configured.</p>
                      )}
                    </div>
                  )}
                />
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">
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
        >
          <div className="space-y-4">
            {!f.isDisabled && (
              <div className="rounded-lg border border-border/70 bg-secondary/15 p-3.5">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-12 sm:items-end">
                  <div className="space-y-1.5 sm:col-span-5">
                    <label
                      htmlFor="coa-attr-key"
                      className="text-xs font-medium text-foreground"
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
                      className="h-9 bg-card text-xs"
                    />
                  </div>
                  <div className="space-y-1.5 sm:col-span-5">
                    <label
                      htmlFor="coa-attr-val"
                      className="text-xs font-medium text-foreground"
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
                      className="h-9 bg-card text-xs"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Button
                      type="button"
                      size="sm"
                      disabled={f.isDisabled || !attrKey.trim() || !attrVal.trim()}
                      onClick={handleAddAttribute}
                      className="w-full h-9 gap-1 text-xs font-semibold"
                    >
                      <Plus className="size-4" />
                      <span>{t("labels.addTag")}</span>
                    </Button>
                  </div>
                </div>
                <p className="mt-2 text-micro text-muted-foreground">
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
                      className="inline-flex items-center gap-1.5 rounded-md border border-border/80 bg-secondary/50 px-2.5 py-1.5 text-xs text-foreground shadow-xs transition-colors hover:bg-secondary/70"
                    >
                      <Tag className="size-3 text-muted-foreground shrink-0" />
                      <span className="font-semibold text-primary">{k}:</span>
                      <span className="font-mono text-foreground/90">{v}</span>
                      {!f.isDisabled && (
                        <button
                          type="button"
                          onClick={() => handleRemoveAttribute(k)}
                          className="ml-1 inline-flex size-4 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-destructive/15 hover:text-destructive focus-visible:outline-none"
                          aria-label={`Remove tag ${k}`}
                        >
                          <X className="size-3" />
                        </button>
                      )}
                    </span>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-border/70 p-4 text-center text-xs text-muted-foreground">
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
  );
}
