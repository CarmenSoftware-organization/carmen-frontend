import {
  useGlDimensions,
  useGlDimensionValues,
} from "@/hooks/use-gl-dimensions";
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AlertTriangle,
  Ban,
  Boxes,
  ChevronDown,
  ChevronUp,
  CircleDollarSign,
  Copy,
  ExternalLink,
  FilePlus2,
  History,
  LayoutTemplate,
  ListTree,
  MoreHorizontal,
  Paperclip,
  Pencil,
  Plus,
  ReceiptText,
  Save,
  Send,
  ShieldCheck,
  Trash2,
  WandSparkles,
  X,
} from "lucide-react";
import { useLocation, useNavigate, useParams } from "react-router";
import { useTranslations } from "use-intl";
import { useQueries } from "@tanstack/react-query";
import { toast } from "sonner";
import type { FormMode } from "@/types/form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Field,
  FieldLabel,
  FieldPlainText,
  FieldSelect,
} from "@/components/ui/field";
import { SelectContent, SelectItem } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { LookupCombobox } from "@/components/lookup/lookup-combobox";
import { LookupCurrency } from "@/components/lookup/lookup-currency";
import { useChartOfAccountAll } from "@/hooks/use-chart-of-account";
import { useCurrency } from "@/hooks/use-currency";
import { useDepartment } from "@/hooks/use-department";
import { useCostCenter } from "@/hooks/use-cost-center";
import { useGlPeriods } from "@/hooks/use-accounting-master";
import { useBuCode } from "@/hooks/use-bu-code";
import { ApiError, isAppStatusErrorCode } from "@/lib/api-error";
import { useErrorToast } from "@/hooks/use-error-toast";
import { readCoaRules, coaRulesKey } from "@/lib/coa-dimension-rules";
import { visibleLineDimensions } from "./journal-line-dimensions";
import { multiplyDecimal } from "../accounts-payable/shared/ap-decimal";
import { CellAction } from "@/components/ui/cell-action";
import { SummaryFooterBar } from "@/components/ui/summary-bar";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { WorkflowTrack } from "@/components/share/workflow-track";
import { DocActionsMenu } from "@/components/share/doc-actions-menu";
import { DocFormHeader } from "@/components/share/doc-form-header";
import {
  accountingDocumentFromPath,
  accountingDetailInitialMode,
  documentsFor,
} from "./accounting-document-model";
import { BackButton } from "@/components/share/back-button";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useJournalVoucher } from "../journal-voucher/use-journal-voucher";
import {
  useCopyJournalVoucher,
  useCreateJournalVoucher,
  useJournalVoucherAction,
  useUpdateJournalVoucher,
} from "../journal-voucher/use-journal-voucher";
import type {
  JournalLineDimensionInput,
  JournalVoucherInput,
} from "@/types/journal-voucher";
import {
  isSourceGenerated,
  journalVoucherCapabilities,
  sourceLinksForJournal,
} from "../journal-voucher/journal-voucher-source";

const TAX_CODES = [
  { id: "VAT7", label: "VAT 7%" },
  { id: "NOVAT", label: "Non-VAT" },
];

const WHT_CODES = [
  { id: "NONE", label: "No WHT" },
  { id: "WHT3", label: "WHT 3%" },
  { id: "WHT5", label: "WHT 5%" },
];

const BUDGETS = [
  { id: "OPEX-ADMIN", label: "OPEX-ADMIN - Administration" },
  { id: "OPEX-ROOMS", label: "OPEX-ROOMS - Rooms" },
  { id: "CAPEX-2026", label: "CAPEX-2026 - Capital expenditure" },
];

const DIMENSIONS = [
  { id: "ADM", label: "ADM - Administration" },
  { id: "ROOM", label: "ROOM - Rooms Division" },
  { id: "FNB", label: "FNB - Food & Beverage" },
  { id: "ENG", label: "ENG - Engineering" },
  { id: "FB", label: "FB - Food & Beverage (Dept)" },
  { id: "HK", label: "HK - Housekeeping" },
  { id: "CORP", label: "CORP - Corporate" },
];

interface JournalLine {
  id: string;
  department: string;
  account: string;
  comment: string;
  debit: number;
  credit: number;
  taxCode: string;
  whtCode: string;
  budgetControlled: boolean;
  budget: string;
  dimension: string;
  dimensions?: JournalLineDimensionInput[];
  departmentLabel?: string;
  accountLabel?: string;
  currency?: string;
  exchangeRate?: number;
}

type LineDetailSection = "tax" | "budget" | "dimension";
type UtilityPanel = "attachments" | "comments" | "log";

const FORM_ID = "accounting-document-form";

const INITIAL_LINES: JournalLine[] = [
  {
    id: "line-1",
    department: "",
    account: "51001",
    comment: "Office building electricity",
    debit: 10000,
    credit: 0,
    taxCode: "VAT7",
    whtCode: "NONE",
    budgetControlled: true,
    budget: "OPEX-ADMIN",
    dimension: "ADM",
  },
  {
    id: "line-2",
    department: "",
    account: "21100",
    comment: "Utilities payable accrual",
    debit: 0,
    credit: 10000,
    taxCode: "NOVAT",
    whtCode: "WHT3",
    budgetControlled: true,
    budget: "OPEX-ADMIN",
    dimension: "ADM",
  },
];

const EMPTY_JV_LINE: JournalLine = {
  id: "line-1",
  department: "",
  account: "",
  comment: "",
  debit: 0,
  credit: 0,
  taxCode: "",
  whtCode: "NONE",
  budgetControlled: false,
  budget: "",
  dimension: "",
  dimensions: [],
  currency: "THB",
  exchangeRate: 1,
};

const optionLabel = (
  options: ReadonlyArray<{ id: string; label: string; code?: string }>,
  value: string,
) => {
  const match = options.find(
    (option) =>
      option.id === value || ("code" in option && option.code === value),
  );
  if (match) return match.label;
  if (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value,
    )
  ) {
    return "—";
  }
  return value;
};

export default function AccountingDocumentDetail() {
  "use no memo";
  const pathname = useLocation().pathname;
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const t = useTranslations("accounting.documents");
  const tc = useTranslations("common");
  const errorToast = useErrorToast();
  const config = accountingDocumentFromPath(pathname);
  const isJournalVoucher = config.kind === "journalVoucher";
  const isGlVoucher =
    isJournalVoucher ||
    config.kind === "templateVoucher" ||
    config.kind === "recurringVoucher" ||
    config.kind === "allocationVoucher";
  const buCode = useBuCode();
  const dimensionQuery = useGlDimensions(isGlVoucher);
  const dimensionValuesQuery = useGlDimensionValues(isGlVoucher);
  const usesVoucherDetailPattern =
    isGlVoucher ||
    config.kind === "arInvoice" ||
    config.kind === "arReceipt" ||
    config.kind === "assetRegister" ||
    config.kind === "assetDisposal";
  const isValidId = Boolean(id && id !== "new" && id !== "undefined");
  const journalQuery = useJournalVoucher(
    isJournalVoucher && isValidId ? id : undefined,
  );
  const createJournal = useCreateJournalVoucher();
  const updateJournal = useUpdateJournalVoucher();
  const submitJournal = useJournalVoucherAction("submit");
  const voidJournal = useJournalVoucherAction("void");
  const reverseJournal = useJournalVoucherAction("reverse");
  const copyJournal = useCopyJournalVoucher();
  const journal = journalQuery.data;
  const sourceGenerated = journal ? isSourceGenerated(journal) : false;
  const journalCapabilities = journal
    ? journalVoucherCapabilities(journal)
    : null;
  const sourceLink = journal
    ? sourceLinksForJournal(journal).find((link) => link.href)
    : undefined;
  const hasWorkflowApproval =
    (config.kind === "journalVoucher" && !sourceGenerated) ||
    config.kind === "arInvoice" ||
    config.kind === "arReceipt";
  const hasInlineApproval =
    config.kind === "recurringVoucher" || config.kind === "allocationVoucher";
  const documents = useMemo(() => documentsFor(config), [config]);
  const document = documents.find((item) => item.id === id) ?? documents[0];
  const isNew = id === "new";
  const { data: coaData } = useChartOfAccountAll();
  const accountById = useMemo(
    () =>
      new Map(
        (coaData ?? []).flatMap(
          (account) =>
            [
              [account.id, account],
              [account.code, account],
            ] as const,
        ),
      ),
    [coaData],
  );
  const accounts = useMemo(() => {
    const list = coaData ?? [];
    return list
      .filter((a) => a.is_active)
      .map((a) => ({
        id: a.id || a.code,
        code: a.code,
        label: `${a.code} - ${a.description_1}`,
        category: a.category,
      }));
  }, [coaData]);

  const { data: deptData } = useDepartment({ perpage: 100 });
  const { data: costCenterData } = useCostCenter({ perpage: 100 });
  const { data: currencyData } = useCurrency(
    { perpage: 100 },
    { enabled: isGlVoucher },
  );
  const currencyIdFor = (value?: string) =>
    currencyData?.data.find(
      (currency) => currency.id === value || currency.code === value,
    )?.id ??
    value ??
    "";
  const currencyCodeFor = (value?: string) =>
    currencyData?.data.find(
      (currency) => currency.id === value || currency.code === value,
    )?.code ??
    value ??
    "THB";
  const departments = useMemo(() => {
    const ccList = (costCenterData?.data ?? []).filter(
      (c) => c.is_active !== false,
    );
    if (isGlVoucher) {
      return ccList.map((c) => ({
        id: c.id,
        code: c.code,
        label: `${c.code} - ${c.name}`,
      }));
    }
    const list = deptData?.data ?? [];
    return list
      .filter((d) => d.is_active !== false)
      .map((d) => ({
        id: d.id,
        code: d.code,
        label: `${d.code} - ${d.name}`,
      }));
  }, [costCenterData?.data, deptData?.data, isGlVoucher]);
  const number = isNew
    ? t("autoNumber")
    : (journal?.display_no ?? document.number);
  const [mode, setMode] = useState<FormMode>(() =>
    accountingDetailInitialMode(id),
  );
  const isView = mode === "view" || sourceGenerated;
  const editActivatedAtRef = useRef(0);
  const [documentStatus, setDocumentStatus] = useState<string>(
    isNew ? "Draft" : document.status,
  );
  const [utilityPanel, setUtilityPanel] = useState<UtilityPanel | null>(null);
  const [journalConfirmation, setJournalConfirmation] = useState<
    "void" | "reverse" | null
  >(null);
  const [comments, setComments] = useState<string[]>([
    "Generated from the AP posting source.",
  ]);
  const [commentDraft, setCommentDraft] = useState("");
  const [values, setValues] = useState({
    prefix: isJournalVoucher
      ? isNew
        ? "AJ"
        : (journal?.prefix ?? "JV")
      : config.prefix,
    date: isNew ? new Date().toISOString().slice(0, 10) : document.date,
    description: isNew ? "" : document.description,
    party: isNew ? "" : document.party,
    schedulePost: false,
    scheduleDate: isNew ? new Date().toISOString().slice(0, 10) : document.date,
    autoReverse: false,
    reverseDate: "",
  });
  const [lines, setLines] = useState<JournalLine[]>(() =>
    isNew && isGlVoucher ? [{ ...EMPTY_JV_LINE }] : INITIAL_LINES,
  );
  const editSnapshotRef = useRef<{
    values: typeof values;
    lines: JournalLine[];
  } | null>(null);

  const [syncedCoaFirstId, setSyncedCoaFirstId] = useState<string | null>(null);
  const firstAvailableCoaId = coaData?.[0]?.id ?? null;
  if (
    isNew &&
    !isJournalVoucher &&
    firstAvailableCoaId &&
    syncedCoaFirstId !== firstAvailableCoaId
  ) {
    setSyncedCoaFirstId(firstAvailableCoaId);
    const activeCoas = coaData!.filter((a) => a.is_active);
    const first = activeCoas[0] ?? coaData![0];
    const second = activeCoas[1] ?? coaData![1] ?? first;
    setLines((prev) => {
      const isPlaceholder =
        prev.length >= 2 &&
        (prev[0].account === "51001" ||
          !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
            prev[0].account,
          ));
      if (isPlaceholder) {
        return [
          {
            ...prev[0],
            account: first.id,
            accountLabel: `${first.code} - ${first.description_1}`,
          },
          {
            ...prev[1],
            account: second.id,
            accountLabel: `${second.code} - ${second.description_1}`,
          },
          ...prev.slice(2),
        ];
      }
      return prev;
    });
  }

  useEffect(() => {
    if (departments.length === 0) return;
    setLines((prev) => {
      let changed = false;
      const updated = prev.map((l) => {
        if (
          l.department &&
          (!l.departmentLabel ||
            l.departmentLabel === "—" ||
            l.departmentLabel === l.department)
        ) {
          const found = departments.find(
            (d) => d.id === l.department || d.code === l.department,
          );
          if (found && found.label !== l.departmentLabel) {
            changed = true;
            return { ...l, departmentLabel: found.label };
          }
        }
        return l;
      });
      return changed ? updated : prev;
    });
  }, [departments, journal]);

  const [selectedLineIds, setSelectedLineIds] = useState<string[]>([]);
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  const [dimensionDraft, setDimensionDraft] = useState<
    JournalLineDimensionInput[]
  >([]);
  const lineAccountIds = [
    ...new Set(
      lines
        .map((line) => accountById.get(line.account)?.id)
        .filter((id): id is string => !!id),
    ),
  ];
  const dimensionRuleQueries = useQueries({
    queries: lineAccountIds.map((accountId) => ({
      queryKey: coaRulesKey(buCode, accountId),
      enabled: isGlVoucher && !!buCode,
      queryFn: () => readCoaRules(buCode!, accountId),
    })),
  });
  const dimensionRules = dimensionRuleQueries.flatMap(
    (query) => query.data ?? [],
  );
  const [lineDetailSection, setLineDetailSection] =
    useState<LineDetailSection>("tax");

  const glPeriodsQuery = useGlPeriods();
  const currentPeriod = useMemo(() => {
    const docDate = values.date;
    return glPeriodsQuery.data?.find(
      (p) => docDate >= p.start_date && docDate <= p.end_date,
    );
  }, [glPeriodsQuery.data, values.date]);

  const isPeriodLocked =
    currentPeriod?.status === "closed" || currentPeriod?.status === "locked";

  // โหลด journal เสร็จ (หรือเปลี่ยนตัว) → เติมค่าลงฟอร์ม ทำตอน render แทน effect
  // เพื่อไม่ให้ render สองรอบ (react.dev/learn/you-might-not-need-an-effect)
  const [syncedJournal, setSyncedJournal] = useState<typeof journal>();
  if (journal && !isNew && journal !== syncedJournal) {
    setSyncedJournal(journal);
    setDocumentStatus(
      journal.jv_status
        .split("_")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" "),
    );
    setValues({
      prefix: journal.prefix ?? "JV",
      date: (journal.jv_date ?? journal.journal_date).slice(0, 10),
      description: journal.description,
      party: journal.source_no ?? "",
      schedulePost: journal.schedule_post,
      scheduleDate:
        journal.scheduled_post_at?.slice(0, 10) ??
        journal.journal_date.slice(0, 10),
      autoReverse: journal.auto_reverse,
      reverseDate: journal.reverse_date?.slice(0, 10) ?? "",
    });
    setLines(
      journal.lines.map((line) => {
        const deptId = line.department_id ?? "";
        const matchedDept = departments.find(
          (d) => d.id === deptId || d.code === deptId,
        );
        const resolvedDeptLabel = matchedDept
          ? matchedDept.label
          : line.department_code
            ? `${line.department_code} - ${line.department_name ?? ""}`
            : undefined;

        return {
          id: line.id,
          department: deptId,
          departmentLabel: resolvedDeptLabel,
          account: line.account_id,
          accountLabel: line.account_code
            ? `${line.account_code} - ${line.account_name ?? ""}`
            : line.account_id,
          comment: line.comment ?? "",
          debit: Number(line.debit),
          credit: Number(line.credit),
          taxCode: "",
          whtCode: "NONE",
          budgetControlled: false,
          budget: "",
          dimension: "",
          dimensions: line.dimension,
          currency: line.currency_id,
          exchangeRate: Number(line.exchange_rate),
        };
      }),
    );
    setSelectedLineIds([]);
    setMode("view");
  }
  const selectedLine = lines.find((line) => line.id === selectedLineId);
  const allLinesSelected =
    lines.length > 0 && selectedLineIds.length === lines.length;
  const someLinesSelected = selectedLineIds.length > 0 && !allLinesSelected;

  const resetForm = () => {
    setValues({
      prefix: isJournalVoucher
        ? isNew
          ? "AJ"
          : (journal?.prefix ?? "JV")
        : config.prefix,
      date: isNew ? new Date().toISOString().slice(0, 10) : document.date,
      description: isNew ? "" : document.description,
      party: isNew ? "" : document.party,
      schedulePost: false,
      scheduleDate: isNew
        ? new Date().toISOString().slice(0, 10)
        : document.date,
      autoReverse: false,
      reverseDate: "",
    });
    setLines(isGlVoucher ? [{ ...EMPTY_JV_LINE }] : INITIAL_LINES);
    setSelectedLineIds([]);
  };

  const addLine = useCallback(() => {
    const defaultDept = isGlVoucher ? undefined : departments[0];
    setLines((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        department: defaultDept?.id ?? "",
        departmentLabel: defaultDept?.label,
        account: "",
        comment: "",
        debit: 0,
        credit: 0,
        taxCode: "",
        whtCode: "NONE",
        budgetControlled: false,
        budget: "",
        dimension: "",
        dimensions: [],
        currency: "THB",
        exchangeRate: 1,
      },
    ]);
  }, [departments, isGlVoucher]);

  const autoBalanceEntry = useCallback(() => {
    if (
      isGlVoucher &&
      !lines.some((line) => line.account && (line.debit > 0 || line.credit > 0))
    )
      return;
    const curDebit = lines.reduce(
      (sum, line) =>
        sum +
        (isGlVoucher
          ? Number(
              multiplyDecimal(
                String(line.debit),
                String(line.exchangeRate ?? 1),
              ),
            )
          : line.debit),
      0,
    );
    const curCredit = lines.reduce(
      (sum, line) =>
        sum +
        (isGlVoucher
          ? Number(
              multiplyDecimal(
                String(line.credit),
                String(line.exchangeRate ?? 1),
              ),
            )
          : line.credit),
      0,
    );
    const diff = curDebit - curCredit;
    if (Math.abs(diff) < (isGlVoucher ? 0.01 : 0.005)) {
      toast.info("ยอดเดบิตและเครดิตสมดุลแล้ว (Already balanced)");
      return;
    }
    setLines((current) => {
      const last = current[current.length - 1];
      if (last && last.debit === 0 && last.credit === 0) {
        return current.map((line, idx) =>
          idx === current.length - 1
            ? {
                ...line,
                ...(isGlVoucher ? { currency: "THB", exchangeRate: 1 } : {}),
                debit: diff < 0 ? Number(Math.abs(diff).toFixed(2)) : 0,
                credit: diff > 0 ? Number(diff.toFixed(2)) : 0,
              }
            : line,
        );
      }
      return [
        ...current,
        {
          id: crypto.randomUUID(),
          department: current[current.length - 1]?.department ?? "",
          account: "",
          comment: "Balancing line",
          debit: diff < 0 ? Number(Math.abs(diff).toFixed(2)) : 0,
          credit: diff > 0 ? Number(diff.toFixed(2)) : 0,
          taxCode: "",
          whtCode: "NONE",
          budgetControlled: false,
          budget: "",
          dimension: "",
          ...(isGlVoucher
            ? { dimensions: [], currency: "THB", exchangeRate: 1 }
            : {}),
        },
      ];
    });
    toast.success("คำนวณและปรับยอดให้สมดุลแล้ว (Auto balanced)");
  }, [lines, isGlVoucher]);

  useEffect(() => {
    if (isView) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.altKey && event.key.toLowerCase() === "a") {
        event.preventDefault();
        addLine();
      } else if (event.altKey && event.key.toLowerCase() === "b") {
        event.preventDefault();
        autoBalanceEntry();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [addLine, autoBalanceEntry, isView]);

  const updateLine = (lineId: string, patch: Partial<JournalLine>) => {
    setLines((current) =>
      current.map((line) =>
        line.id === lineId
          ? {
              ...line,
              ...patch,
              ...(isGlVoucher && patch.debit && patch.debit > 0
                ? { credit: 0 }
                : {}),
              ...(isGlVoucher && patch.credit && patch.credit > 0
                ? { debit: 0 }
                : {}),
            }
          : line,
      ),
    );
  };

  const moveLine = (lineId: string, offset: -1 | 1) => {
    setLines((current) => {
      const index = current.findIndex((line) => line.id === lineId);
      const targetIndex = index + offset;
      if (index < 0 || targetIndex < 0 || targetIndex >= current.length) {
        return current;
      }
      const reordered = [...current];
      [reordered[index], reordered[targetIndex]] = [
        reordered[targetIndex],
        reordered[index],
      ];
      return reordered;
    });
  };

  const openLineDetail = (lineId: string, section: LineDetailSection) => {
    if (isGlVoucher && section === "dimension") {
      setDimensionDraft(
        structuredClone(
          lines.find((line) => line.id === lineId)?.dimensions ?? [],
        ),
      );
    }
    setSelectedLineId(lineId);
    setLineDetailSection(section);
  };

  const handleCancel = () => {
    if (mode === "add") {
      navigate(config.path);
      return;
    }
    if (isGlVoucher && editSnapshotRef.current) {
      setValues(editSnapshotRef.current.values);
      setLines(editSnapshotRef.current.lines);
      setSelectedLineIds([]);
      setSelectedLineId(null);
      editSnapshotRef.current = null;
    } else {
      resetForm();
    }
    setMode("view");
  };

  const startEdit = () => {
    editSnapshotRef.current = {
      values: { ...values },
      lines: structuredClone(lines),
    };
    editActivatedAtRef.current = performance.now();
    setMode("edit");
  };

  const handleSave = async (intent: "draft" | "submit") => {
    if (
      isJournalVoucher &&
      (glPeriodsQuery.isPending || glPeriodsQuery.isError)
    ) {
      toast.error("ยังตรวจสอบงวดบัญชีจาก API ไม่ได้ กรุณาลองใหม่อีกครั้ง");
      return;
    }
    if (isPeriodLocked) {
      toast.error(
        `ไม่สามารถบันทึกได้ เนื่องจากงวดบัญชี ${currentPeriod?.fiscal_year ?? ""}-P${currentPeriod?.period_number ?? ""} ถูกปิดแล้ว (${currentPeriod?.status})`,
      );
      return;
    }
    if (
      mode === "edit" &&
      performance.now() - editActivatedAtRef.current < 500
    ) {
      return;
    }
    if (isJournalVoucher) {
      if (
        !isNew &&
        journal &&
        (lines.length !== journal.lines.length ||
          lines.some((line, index) => {
            const saved = journal.lines[index];
            return (
              !saved ||
              line.id !== saved.id ||
              line.account !== saved.account_id ||
              line.department !== (saved.department_id ?? "") ||
              line.comment !== (saved.comment ?? "") ||
              currencyIdFor(line.currency ?? "THB") !== saved.currency_id ||
              Number(line.exchangeRate ?? 1) !== Number(saved.exchange_rate) ||
              Number(line.debit) !== Number(saved.debit) ||
              Number(line.credit) !== Number(saved.credit) ||
              JSON.stringify(line.dimensions ?? []) !==
                JSON.stringify(saved.dimension ?? [])
            );
          }))
      ) {
        toast.error(
          "API ยังไม่รองรับการแก้ไขบรรทัด JV หลังสร้าง กรุณาสร้าง JV ใหม่",
        );
        return;
      }
      if (coaData && coaData.length === 0) {
        toast.error(
          "ไม่สามารถบันทึกได้ เนื่องจากยังไม่มีผังบัญชี (Chart of Accounts) ในหน่วยธุรกิจนี้ กรุณาไปตั้งค่าผังบัญชีก่อนค่ะ",
        );
        return;
      }

      if (lines.length < 2) {
        toast.error("เอกสาร Journal Voucher ต้องมีรายการอย่างน้อย 2 บรรทัด");
        return;
      }

      const hasEmptyAccount = lines.some((l) => !l.account);
      if (hasEmptyAccount) {
        toast.error("กรุณาระบุผังบัญชี (Chart of Accounts) ให้ครบทุกบรรทัด");
        return;
      }

      if (
        lines.some(
          (line) =>
            !Number.isFinite(line.exchangeRate) ||
            (line.exchangeRate ?? 1) <= 0,
        )
      ) {
        toast.error("กรุณาระบุ Rate มากกว่า 0 ให้ครบทุกบรรทัด");
        return;
      }
      if (
        intent === "submit" &&
        dimensionRuleQueries.some((query) => query.isPending)
      ) {
        toast.error("กรุณารอโหลดกฎ Dimension ก่อน Submit");
        return;
      }
      if (
        intent === "submit" &&
        (dimensionQuery.isError ||
          dimensionValuesQuery.isError ||
          dimensionRuleQueries.some((query) => query.isError))
      ) {
        toast.error(
          "ยังโหลด Dimension master ไม่สำเร็จ กรุณาลองใหม่ก่อน Submit",
        );
        return;
      }
      if (
        intent === "submit" &&
        lines.some(
          (line) =>
            (accountById.get(line.account)?.dimension_required &&
              !line.dimensions?.length) ||
            dimensionRules.some(
              (rule) =>
                rule.chart_of_accounts_id ===
                  accountById.get(line.account)?.id &&
                rule.requirement === "mandatory" &&
                !line.dimensions?.some(
                  (item) =>
                    item.dimension_id === rule.gl_dimension_id &&
                    item.dimension_value_id,
                ),
            ),
        )
      ) {
        toast.error("กรุณาระบุ Dimension ที่บังคับก่อน Submit");
        return;
      }
      if (intent === "submit" && !isBalanced) {
        toast.error(
          `ยอด Base Debit (${totalBaseDebit.toFixed(2)}) และ Base Credit (${totalBaseCredit.toFixed(2)}) ต้องสมดุลก่อน Submit`,
        );
        return;
      }
      const input: JournalVoucherInput = {
        journal_type: journal?.journal_type ?? "general",
        prefix: values.prefix || journal?.prefix || "JV",
        journal_date: values.date,
        description: values.description,
        note: journal?.note ?? null,
        functional_currency_id: journal?.functional_currency_id ?? "THB",
        source_system: "general_ledger",
        source_type: "manual",
        source_id: null,
        source_no: null,
        schedule_post: values.schedulePost,
        scheduled_post_at: values.schedulePost ? values.scheduleDate : null,
        auto_reverse: values.autoReverse,
        reverse_date: values.autoReverse ? values.reverseDate : null,
        lines: lines.map((line) => ({
          account_id: line.account,
          department_id: line.department || null,
          comment: line.comment || null,
          currency_id: currencyIdFor(line.currency ?? "THB"),
          exchange_rate: String(line.exchangeRate ?? 1),
          rate_date: null,
          rate_type: null,
          rate_source: null,
          debit: line.debit.toFixed(2),
          credit: line.credit.toFixed(2),
          dimension: isJournalVoucher
            ? (line.dimensions ?? [])
            : line.dimension
              ? [
                  {
                    dimension_id: line.dimension,
                    dimension_value_id: line.dimension,
                  },
                ]
              : [],
        })),
      };
      try {
        const saved = isNew
          ? (await createJournal.mutateAsync(input)).data
          : (
              await updateJournal.mutateAsync({
                ...input,
                id: journal!.id,
                doc_version: journal!.doc_version,
              })
            ).data;
        const targetId = saved?.id ?? (isNew ? undefined : journal?.id);
        if (!targetId || targetId === "undefined") {
          throw new Error("Invalid voucher ID received from server");
        }
        if (intent === "submit")
          await submitJournal.mutateAsync({
            id: targetId,
            doc_version: saved.doc_version,
          });
        setMode("view");
        toast.success(intent === "draft" ? t("draftSaved") : t("submitted"));
        navigate(`${config.path}/${targetId}`, { replace: true });
      } catch (error) {
        if (error instanceof ApiError && isAppStatusErrorCode(error.appCode)) {
          errorToast(error);
          return;
        }
        toast.error(
          error instanceof Error
            ? error.message
            : "Unable to save Journal Voucher",
        );
      }
      return;
    }
    if (mode === "add") {
      setDocumentStatus(intent === "draft" ? "Draft" : "Pending");
      setMode("view");
      navigate(`${config.path}/${documents[0].id}`, { replace: true });
      return;
    }
    setDocumentStatus(intent === "draft" ? "Draft" : "Pending");
    setMode("view");
    toast.success(intent === "draft" ? t("draftSaved") : t("submitted"));
  };

  const handleCopy = async () => {
    if (isJournalVoucher && journal) {
      try {
        const copied = (await copyJournal.mutateAsync(journal.id)).data;
        navigate(`${config.path}/${copied.id}`);
        toast.success(t("copiedToNew"));
      } catch (error) {
        if (error instanceof ApiError && isAppStatusErrorCode(error.appCode)) {
          errorToast(error);
          return;
        }
        toast.error(
          error instanceof Error
            ? error.message
            : "Unable to copy Journal Voucher",
        );
      }
      return;
    }
    navigate(`${config.path}/new`);
    setDocumentStatus("Draft");
    setMode("add");
    toast.success(t("copiedToNew"));
  };

  const handleNew = () => {
    setValues((current) => ({ ...current, description: "", party: "" }));
    setLines(isGlVoucher ? [{ ...EMPTY_JV_LINE }] : INITIAL_LINES);
    setSelectedLineIds([]);
    setDocumentStatus("Draft");
    setMode("add");
    navigate(`${config.path}/new`);
  };

  const applyTemplate = () => {
    if (isGlVoucher && isView) startEdit();
    setValues((current) => ({
      ...current,
      description: t("templateDescription"),
    }));
    setLines(INITIAL_LINES);
    setMode(isNew ? "add" : "edit");
    toast.success(t("templateApplied"));
  };

  const applyAiSuggestion = () => {
    if (isGlVoucher && isView) startEdit();
    setValues((current) => ({
      ...current,
      description: t("suggestedDescription"),
    }));
    setLines((current) =>
      current.map((line, index) => ({
        ...line,
        comment: index === 0 ? t("suggestedDebitComment") : line.comment,
      })),
    );
    setMode(isNew ? "add" : "edit");
    toast.success(t("suggestionApplied"));
  };

  const deleteSelectedLines = () => {
    setLines((current) =>
      current.filter((line) => !selectedLineIds.includes(line.id)),
    );
    setSelectedLineIds([]);
    toast.success(t("rowsDeleted"));
  };

  const totalDebit = lines.reduce((sum, line) => sum + line.debit, 0);
  const totalCredit = lines.reduce((sum, line) => sum + line.credit, 0);
  const baseAmount = (amount: number, rate: number) =>
    Number(multiplyDecimal(String(amount), String(rate), 2));
  const totalBaseDebit = lines.reduce(
    (sum, line) => sum + baseAmount(line.debit, line.exchangeRate ?? 1),
    0,
  );
  const totalBaseCredit = lines.reduce(
    (sum, line) => sum + baseAmount(line.credit, line.exchangeRate ?? 1),
    0,
  );
  const variance = Math.abs(
    (isGlVoucher ? totalBaseDebit : totalDebit) -
      (isGlVoucher ? totalBaseCredit : totalCredit),
  );
  const transactionCount = lines.filter(
    (line) => line.account && (line.debit > 0 || line.credit > 0),
  ).length;
  const isBalanced =
    (isGlVoucher ? transactionCount > 0 : lines.length > 0) &&
    variance < (isGlVoucher ? 0.01 : 0.005);
  const summaryMetrics = [
    { label: t("totalTransDebit"), value: totalDebit, color: "text-primary" },
    {
      label: t("totalTransCredit"),
      value: totalCredit,
      color: "text-success-foreground",
    },
    {
      label: t("totalBaseDebit"),
      value: totalBaseDebit,
      color: "text-primary",
    },
    {
      label: t("totalBaseCredit"),
      value: totalBaseCredit,
      color: "text-success-foreground",
    },
    {
      label: t("variance"),
      value: variance,
      color: isBalanced ? "text-muted-foreground" : "text-destructive",
    },
  ];
  const entryTitle = isGlVoucher ? t("journalEntryDetails") : t("entryDetails");
  const sourceLabel = isJournalVoucher
    ? journal?.source_type === "manual"
      ? "Manual"
      : (journal?.source_no ?? journal?.source_id ?? "—")
    : "AP-102934";

  if (isJournalVoucher && journalQuery.isLoading) {
    return <Skeleton className="h-[70vh] rounded-lg" />;
  }
  if (isJournalVoucher && journalQuery.isError) {
    return (
      <ErrorState
        error={journalQuery.error}
        message="Unable to load Journal Voucher"
        onRetry={() => void journalQuery.refetch()}
      />
    );
  }
  if (isJournalVoucher && !isNew && !journal) {
    return (
      <ErrorState
        notFoundMessage="Journal Voucher not found"
        backTo="/accounting/journal-voucher"
      />
    );
  }

  return (
    <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col gap-4">
      {usesVoucherDetailPattern ? (
        <DocFormHeader
          title={number}
          // JV อ่าน API จริง (useJournalVoucher) — ชนิดอื่นยังเป็น documentsFor()
          mock={!isJournalVoucher}
          backLabel={t("back")}
          onBack={() => navigate(config.path)}
          actions={
            isView ? (
              <>
                {(!isJournalVoucher ||
                  journalCapabilities?.can_edit_accounting_fields) && (
                  <Button
                    type="button"
                    size="sm"
                    disabled={documentStatus === "Voided"}
                    onClick={startEdit}
                  >
                    <Pencil className="size-4" aria-hidden="true" />
                    {tc("edit")}
                  </Button>
                )}
                {isJournalVoucher && journalCapabilities?.can_void && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setJournalConfirmation("void")}
                  >
                    {t("void")}
                  </Button>
                )}
                {isJournalVoucher && journalCapabilities?.can_reverse && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setJournalConfirmation("reverse")}
                  >
                    Reverse
                  </Button>
                )}
                {!isJournalVoucher && documentStatus !== "Voided" && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setDocumentStatus("Voided");
                      toast.success(t("voided"));
                    }}
                  >
                    {t("void")}
                  </Button>
                )}
                {isJournalVoucher ? (
                  <DocActionsMenu
                    onDuplicate={
                      !sourceGenerated ? () => void handleCopy() : undefined
                    }
                    onComment={() => setUtilityPanel("comments")}
                    commentCount={comments.length}
                    activity={{ id: journal?.id ?? document.id, label: number }}
                  />
                ) : (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button type="button" size="sm" variant="outline">
                        <MoreHorizontal className="size-4" />
                        {tc("more")}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={handleNew}>
                        <FilePlus2 className="size-4" />
                        {t("new")}
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => void handleCopy()}>
                        <Copy className="size-4" />
                        {t("copy")}
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={applyTemplate}>
                        <LayoutTemplate className="size-4" />
                        {t("template")}
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={applyAiSuggestion}>
                        <WandSparkles className="size-4" />
                        {t("aiSuggest")}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={() => setUtilityPanel("attachments")}
                      >
                        <Paperclip className="size-4" />
                        {t("attachments")}
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => setUtilityPanel("log")}>
                        <History className="size-4" />
                        {t("log")}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCancel}
                >
                  <X className="size-4" aria-hidden="true" />
                  {tc("cancel")}
                </Button>
                <Button
                  type="submit"
                  form={FORM_ID}
                  size="sm"
                  data-intent="draft"
                  disabled={
                    isPeriodLocked ||
                    (isJournalVoucher
                      ? createJournal.isPending || updateJournal.isPending
                      : !isBalanced)
                  }
                  title={
                    isPeriodLocked ? "Period is closed or locked" : undefined
                  }
                >
                  <Save className="size-4" aria-hidden="true" />
                  {tc("save")}
                </Button>
                {!isNew && isJournalVoucher && (
                  <DocActionsMenu
                    onComment={() => setUtilityPanel("comments")}
                    commentCount={comments.length}
                    activity={{ id: journal?.id ?? document.id, label: number }}
                  />
                )}
                {!isJournalVoucher && (!isGlVoucher || !isNew) && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button type="button" size="sm" variant="outline">
                        <MoreHorizontal className="size-4" />
                        {tc("more")}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onSelect={() => setUtilityPanel("attachments")}
                      >
                        <Paperclip className="size-4" />
                        {t("attachments")}
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => setUtilityPanel("log")}>
                        <History className="size-4" />
                        {t("log")}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </>
            )
          }
        />
      ) : (
        <header
          className={
            isJournalVoucher
              ? "flex flex-wrap items-center justify-between gap-2"
              : "bg-card flex flex-wrap items-center justify-between gap-2 rounded-lg border p-2"
          }
        >
          <div className="flex flex-wrap items-center gap-1">
            <BackButton
              onClick={() => navigate(config.path)}
              label={t("back")}
            />
            {!isJournalVoucher && (
              <span className="bg-border mx-1 h-5 w-px" aria-hidden="true" />
            )}
            {isJournalVoucher && (
              <h1 className="max-w-sm min-w-0 truncate text-lg font-semibold tracking-tight sm:text-xl">
                {number}
              </h1>
            )}
            {(!isJournalVoucher || !isView) && (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleNew}
                >
                  <FilePlus2 className="size-4" aria-hidden="true" />
                  {t("new")}
                </Button>
                {!sourceGenerated && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleCopy}
                  >
                    <Copy className="size-4" aria-hidden="true" />
                    {t("copy")}
                  </Button>
                )}
                {!sourceGenerated && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={applyTemplate}
                  >
                    <LayoutTemplate className="size-4" aria-hidden="true" />
                    {t("template")}
                  </Button>
                )}
                {!isNew &&
                  documentStatus !== "Voided" &&
                  (!isJournalVoucher || journalCapabilities?.can_void) && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => {
                        setDocumentStatus("Voided");
                        setMode("view");
                        toast.success(t("voided"));
                      }}
                    >
                      <Ban className="size-4" aria-hidden="true" />
                      {t("void")}
                    </Button>
                  )}
                <span
                  className="bg-border mx-1 hidden h-5 w-px sm:block"
                  aria-hidden="true"
                />
                {!sourceGenerated && (
                  <Button
                    type="button"
                    variant="warning"
                    size="sm"
                    onClick={applyAiSuggestion}
                  >
                    <WandSparkles className="size-4" aria-hidden="true" />
                    {t("aiSuggest")}
                  </Button>
                )}
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1">
            {!isJournalVoucher && sourceLink?.href && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => navigate(sourceLink.href!)}
              >
                <ExternalLink className="size-4" aria-hidden="true" />
                Open source
              </Button>
            )}
            {(!isJournalVoucher || !isView) && (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setUtilityPanel("attachments")}
                >
                  <Paperclip className="size-4" aria-hidden="true" />
                  {t("attachments")}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setUtilityPanel("log")}
                >
                  <History className="size-4" aria-hidden="true" />
                  {t("log")}
                </Button>
                <span className="bg-border mx-1 h-5 w-px" aria-hidden="true" />
              </>
            )}
            {isView ? (
              !sourceGenerated &&
              (!isJournalVoucher ||
                journalCapabilities?.can_edit_accounting_fields) && (
                <Button
                  type="button"
                  size="sm"
                  disabled={documentStatus === "Voided"}
                  onClick={startEdit}
                >
                  <Pencil className="size-4" aria-hidden="true" />
                  {tc("edit")}
                </Button>
              )
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCancel}
                >
                  <X className="size-4" aria-hidden="true" />
                  {tc("cancel")}
                </Button>
                <Button
                  type="submit"
                  form={FORM_ID}
                  variant="outline"
                  size="sm"
                  data-intent="draft"
                  disabled={
                    isJournalVoucher
                      ? createJournal.isPending || updateJournal.isPending
                      : !isBalanced
                  }
                  aria-describedby={
                    !isBalanced ? "journal-balance-status" : undefined
                  }
                >
                  <Save className="size-4" aria-hidden="true" />
                  {t("saveDraft")}
                </Button>
                <Button
                  type="submit"
                  form={FORM_ID}
                  size="sm"
                  data-intent="submit"
                  disabled={!isBalanced}
                  aria-describedby={
                    !isBalanced ? "journal-balance-status" : undefined
                  }
                >
                  <Send className="size-4" aria-hidden="true" />
                  {t("submit")}
                </Button>
              </>
            )}
            {isJournalVoucher && isView && (
              <DocActionsMenu
                onComment={() => setUtilityPanel("comments")}
                commentCount={comments.length}
                activity={{ id: journal?.id ?? document.id, label: number }}
              />
            )}
          </div>
        </header>
      )}

      <form
        id={FORM_ID}
        className={
          usesVoucherDetailPattern
            ? "flex min-h-0 flex-1 flex-col gap-4"
            : "space-y-4"
        }
        onSubmit={(event) => {
          event.preventDefault();
          const intent = (
            event.nativeEvent as SubmitEvent
          ).submitter?.getAttribute("data-intent");
          void handleSave(intent === "draft" ? "draft" : "submit");
        }}
      >
        {isJournalVoucher && !isView && coaData && coaData.length === 0 && (
          <div className="flex flex-col gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 sm:flex-row sm:items-center sm:justify-between dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
            <div className="flex items-center gap-2">
              <AlertTriangle className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <span>
                ยังไม่พบผังบัญชี (Chart of Accounts) ในหน่วยธุรกิจนี้ —
                การบันทึก Journal Voucher ต้องใช้ผังบัญชีอย่างน้อย 2 บัญชี
              </span>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="shrink-0 gap-1 bg-white hover:bg-amber-100 dark:bg-amber-900/40"
              onClick={() => navigate("/config/chart-of-accounts")}
            >
              <Plus className="size-3.5" />
              ไปสร้างผังบัญชี
            </Button>
          </div>
        )}

        <Card
          className={
            usesVoucherDetailPattern
              ? "gap-3 border-0 bg-transparent py-0 shadow-none"
              : "gap-3 py-4"
          }
        >
          <CardContent
            className={`grid gap-4 sm:grid-cols-2 ${
              usesVoucherDetailPattern ? "px-0" : "px-4"
            } ${
              config.kind === "journalVoucher" ||
              config.kind === "financialReports"
                ? "lg:grid-cols-6"
                : "lg:grid-cols-8"
            }`}
          >
            <Field>
              <FieldLabel>{t("prefix")}</FieldLabel>
              {config.kind === "journalVoucher" && !isView ? (
                <FieldSelect
                  value={values.prefix}
                  onValueChange={(prefix) =>
                    setValues((current) => ({ ...current, prefix }))
                  }
                  className="h-8 text-sm"
                >
                  <SelectContent>
                    <SelectItem value="AJ">AJ - Adjustment Voucher</SelectItem>
                    <SelectItem value="RV">RV - Receipt Voucher</SelectItem>
                    <SelectItem value="PV">PV - Payment Voucher</SelectItem>
                    <SelectItem value="JV">
                      JV - General Journal Voucher
                    </SelectItem>
                  </SelectContent>
                </FieldSelect>
              ) : (
                <FieldPlainText>
                  {values.prefix
                    ? `${values.prefix} - ${t(`${config.kind}.single`)}`
                    : t(`${config.kind}.single`)}
                </FieldPlainText>
              )}
            </Field>
            <Field>
              <FieldLabel>{t("number")}</FieldLabel>
              <FieldPlainText className="tabular-nums">{number}</FieldPlainText>
            </Field>
            <Field>
              <FieldLabel>{t("date")}</FieldLabel>
              <DatePicker
                value={values.date}
                onValueChange={(date) =>
                  setValues((current) => ({ ...current, date }))
                }
                readOnly={isView}
                hideClear
                className="w-full"
              />
            </Field>
            <Field className="sm:col-span-2 lg:col-span-3">
              <FieldLabel htmlFor="document-description">
                {t("description")}
              </FieldLabel>
              {isView ? (
                <FieldPlainText>{values.description}</FieldPlainText>
              ) : (
                <Input
                  id="document-description"
                  size="sm"
                  value={values.description}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                />
              )}
            </Field>
            {config.kind !== "journalVoucher" && (
              <>
                <Field className="sm:col-span-2 lg:col-span-2">
                  <FieldLabel htmlFor="document-party">{t("party")}</FieldLabel>
                  {isView ? (
                    <FieldPlainText>{values.party}</FieldPlainText>
                  ) : (
                    <Input
                      id="document-party"
                      size="sm"
                      value={values.party}
                      onChange={(event) =>
                        setValues((current) => ({
                          ...current,
                          party: event.target.value,
                        }))
                      }
                    />
                  )}
                </Field>
                {config.kind === "financialReports" && (
                  <Field>
                    <FieldLabel>{t("approval")}</FieldLabel>
                    <FieldPlainText>{t("pendingController")}</FieldPlainText>
                  </Field>
                )}
                {config.kind === "financialReports" && (
                  <>
                    <Field>
                      <FieldLabel>{t("source")}</FieldLabel>
                      <FieldPlainText className="tabular-nums">
                        AP-102934
                      </FieldPlainText>
                    </Field>
                    <Field>
                      <FieldLabel>{t("status")}</FieldLabel>
                      <div className="flex min-h-8 items-center">
                        <Badge
                          variant={
                            documentStatus === "Voided"
                              ? "destructive"
                              : documentStatus === "Pending"
                                ? "secondary"
                                : "outline"
                          }
                        >
                          {documentStatus}
                        </Badge>
                      </div>
                    </Field>
                  </>
                )}
              </>
            )}
          </CardContent>
          {config.kind !== "financialReports" && (
            <CardContent
              className={`flex flex-wrap items-center gap-x-3 gap-y-2 border-t pt-3 ${
                usesVoucherDetailPattern ? "px-0" : "px-4"
              }`}
            >
              {config.kind === "journalVoucher" && (
                <>
                  <div className="flex min-h-8 min-w-52 items-center gap-3">
                    <Checkbox
                      id="schedule-post"
                      aria-label={t("schedulePost")}
                      checked={values.schedulePost}
                      disabled={isView}
                      onCheckedChange={(checked) =>
                        setValues((current) => ({
                          ...current,
                          schedulePost: checked === true,
                        }))
                      }
                    />
                    <FieldLabel htmlFor="schedule-post" className="shrink-0">
                      {t("schedulePost")}
                    </FieldLabel>
                    {values.schedulePost && (
                      <DatePicker
                        value={values.scheduleDate}
                        onValueChange={(scheduleDate) =>
                          setValues((current) => ({ ...current, scheduleDate }))
                        }
                        readOnly={isView}
                        hideClear
                        className="ml-auto w-28"
                      />
                    )}
                  </div>

                  <span
                    className="bg-border hidden h-8 w-px lg:block"
                    aria-hidden="true"
                  />

                  <div className="flex min-h-8 min-w-52 items-center gap-3">
                    <Checkbox
                      id="auto-reverse"
                      aria-label={t("autoReverse")}
                      checked={values.autoReverse}
                      disabled={isView}
                      onCheckedChange={(checked) =>
                        setValues((current) => ({
                          ...current,
                          autoReverse: checked === true,
                        }))
                      }
                    />
                    <FieldLabel htmlFor="auto-reverse" className="shrink-0">
                      {t("autoReverse")}
                    </FieldLabel>
                    {values.autoReverse && (
                      <DatePicker
                        value={values.reverseDate}
                        onValueChange={(reverseDate) =>
                          setValues((current) => ({ ...current, reverseDate }))
                        }
                        readOnly={isView}
                        hideClear
                        className="ml-auto w-28"
                      />
                    )}
                  </div>

                  <span
                    className="bg-border hidden h-8 w-px lg:block"
                    aria-hidden="true"
                  />
                </>
              )}

              {hasInlineApproval && (
                <>
                  <div className="flex min-h-8 items-center gap-3 text-xs">
                    <span className="text-muted-foreground">
                      {t("approval")}
                    </span>
                    <span className="font-medium">
                      {t("pendingController")}
                    </span>
                  </div>
                  <span
                    className="bg-border hidden h-8 w-px xl:block"
                    aria-hidden="true"
                  />
                </>
              )}

              {hasWorkflowApproval && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-label={t("approvalWorkflow")}
                      className="gap-0.5 px-1.5"
                    >
                      <span className="bg-success text-micro-legal flex size-5 items-center justify-center rounded-full font-semibold text-black">
                        ✓
                      </span>
                      <span className="bg-success/60 h-px w-2" />
                      <span className="bg-primary text-primary-foreground text-micro-legal flex size-5 items-center justify-center rounded-full font-semibold">
                        2
                      </span>
                      <span className="bg-border h-px w-2" />
                      <span className="bg-muted text-muted-foreground text-micro-legal flex size-5 items-center justify-center rounded-full border font-semibold">
                        3
                      </span>
                      <span className="sr-only">{t("approvalController")}</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent
                    side="top"
                    align="end"
                    className="w-80 max-w-[calc(100vw-2rem)] p-3"
                  >
                    <p className="mb-2 text-xs font-medium">
                      {t("approvalWorkflow")}
                    </p>
                    <WorkflowTrack
                      previousStage={t("approvalPrepared")}
                      currentStage={t("approvalController")}
                      nextStage={t("approvalApproved")}
                    />
                  </TooltipContent>
                </Tooltip>
              )}

              {hasWorkflowApproval && (
                <span
                  className="bg-border hidden h-8 w-px xl:block"
                  aria-hidden="true"
                />
              )}

              {sourceGenerated && journal && (
                <div className="flex min-h-8 flex-wrap items-center gap-2 text-xs">
                  <ShieldCheck
                    className="text-primary size-4"
                    aria-hidden="true"
                  />
                  <span className="font-medium">
                    Source-generated · Read-only
                  </span>
                  <span className="text-muted-foreground">
                    v{journal.source_version ?? "—"} ·{" "}
                    {journal.event_type ?? "—"}
                    {journal.posting_rule_code
                      ? ` · ${journal.posting_rule_code}`
                      : ""}
                  </span>
                </div>
              )}

              <div className="ml-auto flex min-h-8 items-center gap-3 text-xs">
                <span className="text-muted-foreground">{t("source")}</span>
                {sourceLink?.href ? (
                  <CellAction onClick={() => navigate(sourceLink.href!)}>
                    {sourceLabel}
                  </CellAction>
                ) : (
                  <span className="font-medium tabular-nums">
                    {sourceLabel}
                  </span>
                )}
                <span className="bg-border h-4 w-px" aria-hidden="true" />
                <span className="text-muted-foreground">{t("status")}</span>
                <Badge
                  variant={
                    documentStatus === "Voided"
                      ? "destructive"
                      : documentStatus === "Pending"
                        ? "secondary"
                        : "outline"
                  }
                >
                  {documentStatus}
                </Badge>
              </div>
            </CardContent>
          )}
        </Card>

        <Card
          className={`gap-3 ${
            usesVoucherDetailPattern
              ? "border-0 bg-transparent py-0 shadow-none"
              : "py-4"
          } ${
            usesVoucherDetailPattern
              ? "min-h-80 flex-1"
              : config.kind === "financialReports"
                ? "h-[calc(100dvh-25rem)] min-h-64"
                : "h-[calc(100dvh-21rem)] min-h-80"
          }`}
        >
          <CardHeader className={usesVoucherDetailPattern ? "px-0" : "px-4"}>
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <ListTree className="text-primary size-4" aria-hidden="true" />
                {entryTitle}
              </CardTitle>
              {isPeriodLocked && (
                <Badge variant="destructive" className="gap-1 text-xs">
                  🔒 งวดบัญชี {currentPeriod?.fiscal_year}-P
                  {currentPeriod?.period_number} ปิดแล้ว (
                  {currentPeriod?.status})
                </Badge>
              )}
            </div>
            {!isView && (
              <CardAction className="flex flex-wrap items-center gap-2">
                {!isBalanced && (!isGlVoucher || transactionCount > 0) && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={autoBalanceEntry}
                    title="ปรับยอดให้สมดุลอัตโนมัติ (Alt+B)"
                  >
                    Auto Balance
                    <kbd className="bg-muted-foreground/20 text-micro-legal ml-1 rounded px-1">
                      Alt+B
                    </kbd>
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={selectedLineIds.length === 0}
                  onClick={deleteSelectedLines}
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                  {tc("delete")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={addLine}
                  title={t("addRowShortcut")}
                >
                  <Plus className="size-4" aria-hidden="true" />
                  {t("addRow")}
                  <kbd className="bg-primary-foreground/15 text-micro-legal rounded px-1">
                    Alt+A
                  </kbd>
                </Button>
              </CardAction>
            )}
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col px-0">
            <div className="min-h-0 flex-1 overflow-auto border-y">
              <table className="w-full min-w-5xl text-xs">
                <thead className="bg-muted sticky top-0 z-10 border-b">
                  <tr>
                    <th className="h-10 w-16 px-2">
                      <div className="flex items-center justify-center gap-2">
                        <Checkbox
                          aria-label={t("selectAllRows")}
                          checked={
                            allLinesSelected
                              ? true
                              : someLinesSelected
                                ? "indeterminate"
                                : false
                          }
                          onCheckedChange={(checked) =>
                            setSelectedLineIds(
                              checked ? lines.map((line) => line.id) : [],
                            )
                          }
                        />
                        <span className="text-muted-foreground min-w-4 text-center">
                          #
                        </span>
                      </div>
                    </th>
                    <th className="h-10 px-3 text-left font-medium">
                      {isGlVoucher ? t("accountCode") : t("department")}
                    </th>
                    <th className="h-10 px-3 text-left font-medium">
                      {isGlVoucher ? t("costCenter") : t("chartOfAccount")}
                    </th>
                    <th className="h-10 px-3 text-left font-medium">
                      {t("comment")}
                    </th>
                    <th className="h-10 px-3 text-left font-medium">
                      {isGlVoucher ? "Cur." : t("currency")}
                    </th>
                    <th className="h-10 px-3 text-right font-medium">
                      {t("rate")}
                    </th>
                    <th className="h-10 px-3 text-right font-medium">
                      {t("debit")}
                    </th>
                    <th className="h-10 px-3 text-right font-medium">
                      {t("credit")}
                    </th>
                    <th className="h-10 px-3 text-right font-medium">
                      <span className="sr-only">{tc("rowActions")}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, lineIndex) => {
                    const isSelected = selectedLineIds.includes(line.id);
                    const lineAccount = accountById.get(line.account);
                    const visibleDimensions = visibleLineDimensions(
                      dimensionQuery.data ?? [],
                      lineAccount,
                      dimensionRules,
                      line.dimensions ?? [],
                    );
                    return (
                      <Fragment key={line.id}>
                        <tr className={isSelected ? "bg-muted/30" : undefined}>
                          <td className="h-12 w-16 px-2">
                            <div className="flex items-center justify-center gap-2">
                              <Checkbox
                                aria-label={t("selectRow", { id: line.id })}
                                checked={isSelected}
                                onCheckedChange={(checked) =>
                                  setSelectedLineIds((current) =>
                                    checked
                                      ? [...current, line.id]
                                      : current.filter((id) => id !== line.id),
                                  )
                                }
                              />
                              <span className="text-muted-foreground min-w-4 text-center tabular-nums">
                                {lineIndex + 1}
                              </span>
                            </div>
                          </td>
                          <td className="h-12 px-3">
                            {isGlVoucher ? (
                              isView ? (
                                (line.accountLabel ??
                                optionLabel(accounts, line.account))
                              ) : (
                                <LookupCombobox
                                  value={line.account}
                                  onValueChange={(account) =>
                                    updateLine(line.id, {
                                      account,
                                      department: "",
                                      departmentLabel: undefined,
                                      dimensions: [],
                                    })
                                  }
                                  items={accounts}
                                  getId={(option) => option.id}
                                  getLabel={(option) => option.label}
                                  placeholder={t("selectAccount")}
                                  searchPlaceholder={t("searchAccount")}
                                  className="min-w-52"
                                />
                              )
                            ) : isView ? (
                              line.departmentLabel &&
                              line.departmentLabel !== "—" &&
                              line.departmentLabel !== line.department ? (
                                line.departmentLabel
                              ) : line.department ? (
                                optionLabel(departments, line.department)
                              ) : (
                                "—"
                              )
                            ) : (
                              <LookupCombobox
                                value={line.department}
                                onValueChange={(department) => {
                                  const match = departments.find(
                                    (d) => d.id === department,
                                  );
                                  updateLine(line.id, {
                                    department,
                                    departmentLabel: match?.label,
                                  });
                                }}
                                items={departments}
                                getId={(option) => option.id}
                                getLabel={(option) => option.label}
                                placeholder={t("selectDepartment")}
                                searchPlaceholder={t("searchDepartment")}
                                className="min-w-44"
                              />
                            )}
                          </td>
                          <td className="h-12 px-3 font-medium">
                            {isGlVoucher ? (
                              isView ? (
                                line.departmentLabel &&
                                line.departmentLabel !== "—" &&
                                line.departmentLabel !== line.department ? (
                                  line.departmentLabel
                                ) : line.department ? (
                                  optionLabel(departments, line.department)
                                ) : (
                                  t("costCenterUnassigned")
                                )
                              ) : (
                                <LookupCombobox
                                  value={line.department}
                                  onValueChange={(department) => {
                                    const match = departments.find(
                                      (d) => d.id === department,
                                    );
                                    updateLine(line.id, {
                                      department,
                                      departmentLabel: match?.label,
                                    });
                                  }}
                                  items={departments}
                                  getId={(option) => option.id}
                                  getLabel={(option) => option.label}
                                  placeholder={t("selectCostCenter")}
                                  searchPlaceholder={t("searchCostCenter")}
                                  className="min-w-44"
                                />
                              )
                            ) : isView ? (
                              (line.accountLabel ??
                              optionLabel(accounts, line.account))
                            ) : (
                              <LookupCombobox
                                value={line.account}
                                onValueChange={(account) =>
                                  updateLine(line.id, { account })
                                }
                                items={accounts}
                                getId={(option) => option.id}
                                getLabel={(option) => option.label}
                                placeholder={t("selectAccount")}
                                searchPlaceholder={t("searchAccount")}
                                className="min-w-52"
                              />
                            )}
                          </td>
                          <td className="h-12 px-3">
                            {isView ? (
                              line.comment
                            ) : (
                              <Input
                                size="sm"
                                value={line.comment}
                                onChange={(event) =>
                                  updateLine(line.id, {
                                    comment: event.target.value,
                                  })
                                }
                                className="min-w-48"
                              />
                            )}
                          </td>
                          <td className="h-12 px-3">
                            {isGlVoucher && !isView ? (
                              <LookupCurrency
                                value={currencyIdFor(line.currency ?? "THB")}
                                onValueChange={(currency) =>
                                  updateLine(line.id, { currency })
                                }
                                size="sm"
                              />
                            ) : (
                              currencyCodeFor(line.currency)
                            )}
                          </td>
                          <td className="h-12 px-3 text-right tabular-nums">
                            {isGlVoucher && !isView ? (
                              <Input
                                type="number"
                                min={0.00001}
                                step={0.00001}
                                size="sm"
                                value={line.exchangeRate ?? 1}
                                onChange={(event) =>
                                  updateLine(line.id, {
                                    exchangeRate: Number(event.target.value),
                                  })
                                }
                                className="min-w-24 text-right tabular-nums"
                              />
                            ) : (
                              (line.exchangeRate ?? 1)
                            )}
                          </td>
                          <td className="h-12 px-3 text-right tabular-nums">
                            {isView ? (
                              line.debit.toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                              })
                            ) : (
                              <Input
                                type="number"
                                min={0}
                                step="0.01"
                                size="sm"
                                value={line.debit}
                                onChange={(event) =>
                                  updateLine(line.id, {
                                    debit: Number(event.target.value),
                                  })
                                }
                                onKeyDown={(event) => {
                                  if (event.key === "Enter") {
                                    event.preventDefault();
                                    if (lineIndex === lines.length - 1) {
                                      addLine();
                                    }
                                  }
                                }}
                                className="min-w-28 text-right tabular-nums"
                              />
                            )}
                          </td>
                          <td className="h-12 px-3 text-right tabular-nums">
                            {isView ? (
                              line.credit.toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                              })
                            ) : (
                              <Input
                                type="number"
                                min={0}
                                step="0.01"
                                size="sm"
                                value={line.credit}
                                onChange={(event) =>
                                  updateLine(line.id, {
                                    credit: Number(event.target.value),
                                  })
                                }
                                onKeyDown={(event) => {
                                  if (event.key === "Enter") {
                                    event.preventDefault();
                                    if (lineIndex === lines.length - 1) {
                                      addLine();
                                    }
                                  }
                                }}
                                className="min-w-28 text-right tabular-nums"
                              />
                            )}
                          </td>
                          <td
                            rowSpan={2}
                            className="w-16 border-l px-1 align-middle"
                          >
                            <div className="mx-auto flex w-fit flex-wrap items-center justify-center gap-1 p-1">
                              {!isGlVoucher && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-xs"
                                  aria-label={t("taxDetail")}
                                  title={t("taxDetail")}
                                  onClick={() => openLineDetail(line.id, "tax")}
                                >
                                  <ReceiptText
                                    className="size-4"
                                    aria-hidden="true"
                                  />
                                </Button>
                              )}
                              {!isGlVoucher && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-xs"
                                  aria-label={t("checkBudget")}
                                  title={t("checkBudget")}
                                  onClick={() =>
                                    openLineDetail(line.id, "budget")
                                  }
                                >
                                  <CircleDollarSign
                                    className="size-4"
                                    aria-hidden="true"
                                  />
                                </Button>
                              )}
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-xs"
                                aria-label={t("allDimensions")}
                                title={t("allDimensions")}
                                onClick={() =>
                                  openLineDetail(line.id, "dimension")
                                }
                              >
                                <Boxes className="size-4" aria-hidden="true" />
                              </Button>
                              {!isView && lines.length > 1 && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-xs"
                                  aria-label={t("removeRow")}
                                  onClick={() => {
                                    setLines((current) =>
                                      current.filter(
                                        (candidate) => candidate.id !== line.id,
                                      ),
                                    );
                                    setSelectedLineIds((current) =>
                                      current.filter((id) => id !== line.id),
                                    );
                                  }}
                                >
                                  <Trash2 className="size-4" />
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                        <tr
                          className={`bg-muted/20 border-b ${isSelected ? "bg-muted/40" : ""}`}
                        >
                          <td className="w-16 px-2 py-0.5">
                            {!isView && (
                              <div className="bg-muted/40 mx-auto flex w-fit rounded-md border p-0.5">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-xs"
                                  className="size-5 rounded-sm"
                                  disabled={lineIndex === 0}
                                  aria-label={t("moveRowUp", {
                                    row: lineIndex + 1,
                                  })}
                                  onClick={() => moveLine(line.id, -1)}
                                >
                                  <ChevronUp aria-hidden="true" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-xs"
                                  className="size-5 rounded-sm"
                                  disabled={lineIndex === lines.length - 1}
                                  aria-label={t("moveRowDown", {
                                    row: lineIndex + 1,
                                  })}
                                  onClick={() => moveLine(line.id, 1)}
                                >
                                  <ChevronDown aria-hidden="true" />
                                </Button>
                              </div>
                            )}
                          </td>
                          <td colSpan={4} className="px-3 py-0.5">
                            <div className="flex flex-wrap items-center gap-1">
                              {isGlVoucher &&
                                (dimensionQuery.isError ||
                                  dimensionValuesQuery.isError ||
                                  dimensionRuleQueries.some(
                                    (query) => query.isError,
                                  )) && (
                                  <span className="text-destructive text-xs">
                                    Unable to load dimensions
                                  </span>
                                )}
                              {isGlVoucher && !visibleDimensions.length && (
                                <span className="text-muted-foreground text-xs">
                                  {t("allDimensions")}: —
                                </span>
                              )}
                              {isGlVoucher ? (
                                visibleDimensions.map((dimension) => {
                                  const selectedValue = line.dimensions?.find(
                                    (item) =>
                                      item.dimension_id === dimension.id,
                                  )?.dimension_value_id;
                                  const values = (
                                    dimensionValuesQuery.data ?? []
                                  ).filter(
                                    (value) =>
                                      value.dimension_id === dimension.id &&
                                      (value.is_active ||
                                        value.id === selectedValue),
                                  );
                                  const selected = values.find(
                                    (value) => value.id === selectedValue,
                                  );
                                  return (
                                    <Button
                                      key={dimension.id}
                                      type="button"
                                      variant="outline"
                                      size="xs"
                                      onClick={() =>
                                        openLineDetail(line.id, "dimension")
                                      }
                                    >
                                      {dimension.code}:{" "}
                                      <span className="text-foreground">
                                        {selected?.code ?? "—"}
                                      </span>
                                    </Button>
                                  );
                                })
                              ) : (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="xs"
                                  onClick={() =>
                                    openLineDetail(line.id, "dimension")
                                  }
                                >
                                  {t("dimension")}:{" "}
                                  {optionLabel(DIMENSIONS, line.dimension) ||
                                    "-"}
                                </Button>
                              )}
                              {!isGlVoucher && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="xs"
                                  onClick={() => openLineDetail(line.id, "tax")}
                                >
                                  {t("taxCode")}:{" "}
                                  {optionLabel(TAX_CODES, line.taxCode) || "-"}
                                </Button>
                              )}
                              {!isGlVoucher && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="xs"
                                  onClick={() =>
                                    openLineDetail(line.id, "budget")
                                  }
                                >
                                  {t("budget")}:{" "}
                                  {optionLabel(BUDGETS, line.budget) || "-"}
                                </Button>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-0.5" />
                          <td className="px-3 py-0.5 text-right tabular-nums">
                            <span className="text-muted-foreground text-micro-legal block">
                              {t("baseDebit")}
                            </span>
                            <span className="text-primary font-semibold">
                              {(isGlVoucher
                                ? baseAmount(line.debit, line.exchangeRate ?? 1)
                                : line.debit
                              ).toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                              })}
                            </span>
                          </td>
                          <td className="px-3 py-0.5 text-right tabular-nums">
                            <span className="text-muted-foreground text-micro-legal block">
                              {t("baseCredit")}
                            </span>
                            <span className="text-success-foreground font-semibold">
                              {(isGlVoucher
                                ? baseAmount(
                                    line.credit,
                                    line.exchangeRate ?? 1,
                                  )
                                : line.credit
                              ).toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                              })}
                            </span>
                          </td>
                        </tr>
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {usesVoucherDetailPattern ? (
              <div id="journal-balance-status" aria-live="polite">
                <SummaryFooterBar
                  hasRecord
                  className={
                    isGlVoucher
                      ? "[&>div:first-child]:min-w-0 [&>div:first-child]:flex-wrap"
                      : undefined
                  }
                  items={summaryMetrics.map((metric) => ({
                    key: metric.label,
                    label: metric.label,
                    value: metric.value.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                    }),
                    valueClassName: metric.color,
                  }))}
                >
                  {isGlVoucher && (
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge variant="outline" size="sm">
                        {t("rowCount", { count: transactionCount })}
                      </Badge>
                      <Badge
                        variant={
                          isBalanced ? "success-light" : "destructive-light"
                        }
                        size="sm"
                      >
                        {isBalanced ? t("balanced") : t("unbalanced")}
                      </Badge>
                    </div>
                  )}
                  {!isView && (
                    <div className="flex shrink-0 gap-2">
                      <Button
                        type="submit"
                        form={FORM_ID}
                        size="sm"
                        data-intent="submit"
                        disabled={isPeriodLocked || !isBalanced}
                        title={
                          isPeriodLocked
                            ? "Period is closed or locked"
                            : undefined
                        }
                        aria-describedby={
                          !isBalanced ? "journal-balance-status" : undefined
                        }
                      >
                        <Send className="size-4" aria-hidden="true" />
                        {t("submit")}
                      </Button>
                    </div>
                  )}
                </SummaryFooterBar>
              </div>
            ) : (
              <div
                id="journal-balance-status"
                className={`flex shrink-0 items-center justify-between gap-4 overflow-x-auto border-b px-3 py-2 font-medium ${
                  isBalanced ? "bg-success/10" : "bg-destructive/10"
                }`}
                aria-live="polite"
              >
                <div className="flex shrink-0 items-center gap-2">
                  <Badge variant="outline" size="sm">
                    {t("rowCount", { count: lines.length })}
                  </Badge>
                  <Badge
                    variant={isBalanced ? "success-light" : "destructive-light"}
                    size="sm"
                  >
                    {isBalanced ? t("balanced") : t("unbalanced")}
                  </Badge>
                </div>
                <div className="grid min-w-[40rem] shrink-0 grid-cols-5 divide-x">
                  {summaryMetrics.map((metric) => (
                    <div
                      key={metric.label}
                      className="grid justify-items-end gap-0.5 px-3"
                    >
                      <span className="text-muted-foreground text-micro-legal font-medium">
                        {metric.label}
                      </span>
                      <span
                        className={`${metric.color} font-semibold tabular-nums`}
                      >
                        {metric.value.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </form>

      <ConfirmDialog
        open={journalConfirmation !== null}
        onOpenChange={(open) => !open && setJournalConfirmation(null)}
        title={
          journalConfirmation === "reverse"
            ? "Reverse Journal Voucher?"
            : "Void Journal Voucher?"
        }
        description="This action changes the Journal Voucher status."
        confirmText={journalConfirmation === "reverse" ? "Reverse" : "Void"}
        isPending={voidJournal.isPending || reverseJournal.isPending}
        onConfirm={() => {
          if (!journal || !journalConfirmation) return;
          const action = journalConfirmation;
          const mutation = action === "void" ? voidJournal : reverseJournal;
          mutation.mutate(
            { id: journal.id, doc_version: journal.doc_version },
            {
              onSuccess: () => {
                setJournalConfirmation(null);
                toast.success(
                  action === "void" ? t("voided") : "Journal Voucher reversed",
                );
              },
              // รหัสสถานะแอปต้องแปลผ่าน errorToast — message เป็นประโยค default ของ gateway
              onError: (error) =>
                error instanceof ApiError && isAppStatusErrorCode(error.appCode)
                  ? errorToast(error)
                  : toast.error(error.message),
            },
          );
        }}
      />
      <Sheet
        open={!isGlVoucher && !!selectedLine}
        onOpenChange={(open) => !open && setSelectedLineId(null)}
      >
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader className="pr-12">
            <div>
              <SheetTitle>
                {t(
                  lineDetailSection === "tax"
                    ? "taxDetail"
                    : lineDetailSection === "budget"
                      ? "checkBudget"
                      : "allDimensions",
                )}
              </SheetTitle>
              <SheetDescription>
                {isJournalVoucher && lineDetailSection === "dimension"
                  ? "Select accounting dimensions for this journal line."
                  : t("lineDetailsDescription")}
              </SheetDescription>
            </div>
          </SheetHeader>
          {selectedLine && (
            <div className="grid gap-5 px-4 pb-6">
              {!(isJournalVoucher && lineDetailSection === "dimension") && (
                <div className="grid gap-5">
                  <Field>
                    <FieldLabel>
                      {isJournalVoucher ? t("costCenter") : t("department")}
                    </FieldLabel>
                    {isView ? (
                      <FieldPlainText>
                        {selectedLine.departmentLabel &&
                        selectedLine.departmentLabel !== "—" &&
                        selectedLine.departmentLabel !== selectedLine.department
                          ? selectedLine.departmentLabel
                          : selectedLine.department
                            ? optionLabel(departments, selectedLine.department)
                            : isJournalVoucher
                              ? t("costCenterUnassigned")
                              : "—"}
                      </FieldPlainText>
                    ) : (
                      <LookupCombobox
                        value={selectedLine.department}
                        onValueChange={(department) => {
                          const match = departments.find(
                            (d) => d.id === department,
                          );
                          updateLine(selectedLine.id, {
                            department,
                            departmentLabel: match ? match.label : undefined,
                          });
                        }}
                        items={departments}
                        getId={(option) => option.id}
                        getLabel={(option) => option.label}
                        placeholder={
                          isJournalVoucher
                            ? t("selectCostCenter")
                            : t("selectDepartment")
                        }
                        searchPlaceholder={
                          isJournalVoucher
                            ? t("searchCostCenter")
                            : t("searchDepartment")
                        }
                        className="w-full"
                      />
                    )}
                  </Field>
                  <Field>
                    <FieldLabel>{t("chartOfAccount")}</FieldLabel>
                    {isView ? (
                      <FieldPlainText>
                        {optionLabel(accounts, selectedLine.account)}
                      </FieldPlainText>
                    ) : (
                      <LookupCombobox
                        value={selectedLine.account}
                        onValueChange={(account) =>
                          updateLine(selectedLine.id, { account })
                        }
                        items={accounts}
                        getId={(option) => option.id}
                        getLabel={(option) => option.label}
                        placeholder={t("selectAccount")}
                        searchPlaceholder={t("searchAccount")}
                        className="w-full"
                      />
                    )}
                  </Field>
                  <Field>
                    <FieldLabel>{t("comment")}</FieldLabel>
                    {isView ? (
                      <FieldPlainText>{selectedLine.comment}</FieldPlainText>
                    ) : (
                      <Input
                        size="sm"
                        value={selectedLine.comment}
                        onChange={(event) =>
                          updateLine(selectedLine.id, {
                            comment: event.target.value,
                          })
                        }
                      />
                    )}
                  </Field>
                  <div className="grid grid-cols-2 gap-4">
                    <Field>
                      <FieldLabel>{t("debit")}</FieldLabel>
                      {isView ? (
                        <FieldPlainText className="tabular-nums">
                          {selectedLine.debit.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                          })}{" "}
                          THB
                        </FieldPlainText>
                      ) : (
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          size="sm"
                          value={selectedLine.debit}
                          onChange={(event) =>
                            updateLine(selectedLine.id, {
                              debit: Number(event.target.value),
                            })
                          }
                          className="text-right tabular-nums"
                        />
                      )}
                    </Field>
                    <Field>
                      <FieldLabel>{t("credit")}</FieldLabel>
                      {isView ? (
                        <FieldPlainText className="tabular-nums">
                          {selectedLine.credit.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                          })}{" "}
                          THB
                        </FieldPlainText>
                      ) : (
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          size="sm"
                          value={selectedLine.credit}
                          onChange={(event) =>
                            updateLine(selectedLine.id, {
                              credit: Number(event.target.value),
                            })
                          }
                          className="text-right tabular-nums"
                        />
                      )}
                    </Field>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Field>
                      <FieldLabel>{t("currency")}</FieldLabel>
                      {isView ? (
                        <FieldPlainText>
                          {selectedLine.currency ?? "THB"}
                        </FieldPlainText>
                      ) : (
                        <LookupCurrency
                          value={selectedLine.currency ?? "THB"}
                          onValueChange={(curr) =>
                            updateLine(selectedLine.id, { currency: curr })
                          }
                          size="sm"
                        />
                      )}
                    </Field>
                    <Field>
                      <FieldLabel>Exchange Rate</FieldLabel>
                      {isView ? (
                        <FieldPlainText className="tabular-nums">
                          {selectedLine.exchangeRate ?? 1}
                        </FieldPlainText>
                      ) : (
                        <Input
                          type="number"
                          min={0.0001}
                          step={0.0001}
                          size="sm"
                          value={selectedLine.exchangeRate ?? 1}
                          onChange={(event) =>
                            updateLine(selectedLine.id, {
                              exchangeRate: Number(event.target.value) || 1,
                            })
                          }
                          className="text-right tabular-nums"
                        />
                      )}
                    </Field>
                  </div>
                </div>
              )}

              {lineDetailSection === "tax" && (
                <section className="grid gap-4 border-t pt-5">
                  <h3 className="text-sm font-semibold">{t("taxWhtConfig")}</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <Field>
                      <FieldLabel>{t("taxCode")}</FieldLabel>
                      {isView ? (
                        <FieldPlainText>
                          {optionLabel(TAX_CODES, selectedLine.taxCode)}
                        </FieldPlainText>
                      ) : (
                        <LookupCombobox
                          value={selectedLine.taxCode}
                          onValueChange={(taxCode) =>
                            updateLine(selectedLine.id, { taxCode })
                          }
                          items={TAX_CODES}
                          getId={(option) => option.id}
                          getLabel={(option) => option.label}
                          placeholder={t("selectTaxCode")}
                          searchPlaceholder={t("searchTaxCode")}
                          className="w-full"
                        />
                      )}
                    </Field>
                    <Field>
                      <FieldLabel>{t("whtCode")}</FieldLabel>
                      {isView ? (
                        <FieldPlainText>
                          {optionLabel(WHT_CODES, selectedLine.whtCode)}
                        </FieldPlainText>
                      ) : (
                        <LookupCombobox
                          value={selectedLine.whtCode}
                          onValueChange={(whtCode) =>
                            updateLine(selectedLine.id, { whtCode })
                          }
                          items={WHT_CODES}
                          getId={(option) => option.id}
                          getLabel={(option) => option.label}
                          placeholder={t("selectWhtCode")}
                          searchPlaceholder={t("searchWhtCode")}
                          className="w-full"
                        />
                      )}
                    </Field>
                  </div>
                </section>
              )}

              {lineDetailSection === "budget" && (
                <section className="grid gap-4 border-t pt-5">
                  <h3 className="text-sm font-semibold">
                    {t("budgetControl")}
                  </h3>
                  <div className="flex min-h-8 items-center justify-between gap-4">
                    <FieldLabel htmlFor="budget-control">
                      {t("applyBudgetControl")}
                    </FieldLabel>
                    {isView ? (
                      <Badge
                        variant={
                          selectedLine.budgetControlled
                            ? "secondary"
                            : "outline"
                        }
                      >
                        {selectedLine.budgetControlled ? tc("yes") : tc("no")}
                      </Badge>
                    ) : (
                      <Switch
                        id="budget-control"
                        checked={selectedLine.budgetControlled}
                        onCheckedChange={(budgetControlled) =>
                          updateLine(selectedLine.id, { budgetControlled })
                        }
                      />
                    )}
                  </div>
                  <Field>
                    <FieldLabel>{t("budget")}</FieldLabel>
                    {isView ? (
                      <FieldPlainText>
                        {optionLabel(BUDGETS, selectedLine.budget)}
                      </FieldPlainText>
                    ) : (
                      <LookupCombobox
                        value={selectedLine.budget}
                        onValueChange={(budget) =>
                          updateLine(selectedLine.id, { budget })
                        }
                        items={BUDGETS}
                        getId={(option) => option.id}
                        getLabel={(option) => option.label}
                        placeholder={t("selectBudget")}
                        searchPlaceholder={t("searchBudget")}
                        disabled={!selectedLine.budgetControlled}
                        className="w-full"
                      />
                    )}
                  </Field>
                </section>
              )}

              {lineDetailSection === "dimension" && (
                <section className="grid gap-4 border-t pt-5">
                  <h3 className="text-sm font-semibold">{t("dimension")}</h3>
                  <Field>
                    <FieldLabel>{t("dimension")}</FieldLabel>
                    {isView ? (
                      <FieldPlainText>
                        {optionLabel(DIMENSIONS, selectedLine.dimension)}
                      </FieldPlainText>
                    ) : (
                      <LookupCombobox
                        value={selectedLine.dimension}
                        onValueChange={(dimension) =>
                          updateLine(selectedLine.id, { dimension })
                        }
                        items={DIMENSIONS}
                        getId={(option) => option.id}
                        getLabel={(option) => option.label}
                        placeholder={t("selectDimension")}
                        searchPlaceholder={t("searchDimension")}
                        className="w-full"
                      />
                    )}
                  </Field>
                </section>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      <Dialog
        open={isGlVoucher && !!selectedLine}
        onOpenChange={(open) => !open && setSelectedLineId(null)}
      >
        <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("allDimensions")}</DialogTitle>
            <DialogDescription>
              Select accounting dimensions for this journal line.
            </DialogDescription>
          </DialogHeader>
          {selectedLine && (
            <div className="grid gap-4 sm:grid-cols-2">
              {visibleLineDimensions(
                dimensionQuery.data ?? [],
                accountById.get(selectedLine.account),
                dimensionRules,
                dimensionDraft,
              ).map((dimension) => {
                const selectedValue = dimensionDraft.find(
                  (item) => item.dimension_id === dimension.id,
                )?.dimension_value_id;
                const options = (dimensionValuesQuery.data ?? []).filter(
                  (value) =>
                    value.dimension_id === dimension.id &&
                    (value.is_active || value.id === selectedValue),
                );
                return (
                  <Field key={dimension.id}>
                    <FieldLabel>
                      {dimension.code} — {dimension.name}
                    </FieldLabel>
                    {isView ? (
                      <FieldPlainText>
                        {options.find((value) => value.id === selectedValue)
                          ?.name ?? "—"}
                      </FieldPlainText>
                    ) : (
                      <FieldSelect
                        value={selectedValue ?? "none"}
                        onValueChange={(valueId) =>
                          setDimensionDraft((current) => [
                            ...current.filter(
                              (item) => item.dimension_id !== dimension.id,
                            ),
                            ...(valueId === "none"
                              ? []
                              : [
                                  {
                                    dimension_id: dimension.id,
                                    dimension_value_id: valueId,
                                  },
                                ]),
                          ])
                        }
                      >
                        <SelectContent>
                          <SelectItem value="none">—</SelectItem>
                          {options.map((value) => (
                            <SelectItem key={value.id} value={value.id}>
                              {value.code} — {value.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </FieldSelect>
                    )}
                  </Field>
                );
              })}
            </div>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setSelectedLineId(null)}
            >
              {tc("cancel")}
            </Button>
            {!isView && selectedLine && (
              <Button
                type="button"
                onClick={() => {
                  updateLine(selectedLine.id, { dimensions: dimensionDraft });
                  setSelectedLineId(null);
                }}
              >
                Apply
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet
        open={!!utilityPanel}
        onOpenChange={(open) => !open && setUtilityPanel(null)}
      >
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>
              {utilityPanel === "attachments"
                ? t("attachments")
                : utilityPanel === "comments"
                  ? "Comments"
                  : t("log")}
            </SheetTitle>
            <SheetDescription>
              {utilityPanel === "attachments"
                ? t("attachmentsDescription")
                : utilityPanel === "comments"
                  ? "Notes and discussion for this Journal Voucher."
                  : t("logDescription")}
            </SheetDescription>
          </SheetHeader>

          {utilityPanel === "attachments" ? (
            <div className="grid gap-3 px-4 pb-6">
              <label className="border-border hover:bg-accent flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed p-6 text-sm font-medium transition-colors">
                <Paperclip className="size-4" aria-hidden="true" />
                {t("uploadAttachment")}
                <input
                  type="file"
                  className="sr-only"
                  onChange={(event) => {
                    if (!event.target.files?.length) return;
                    toast.success(
                      t("attachmentAdded", {
                        name: event.target.files[0].name,
                      }),
                    );
                    event.target.value = "";
                  }}
                />
              </label>
              {["JV2607-0002.pdf", "utility-invoice.pdf"].map((file) => (
                <div
                  key={file}
                  className="flex items-center justify-between gap-3 rounded-md border p-3"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <Paperclip
                      className="text-muted-foreground size-4 shrink-0"
                      aria-hidden="true"
                    />
                    <span className="truncate text-sm">{file}</span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label={tc("delete")}
                    onClick={() => toast.success(t("attachmentRemoved"))}
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </Button>
                </div>
              ))}
            </div>
          ) : utilityPanel === "comments" ? (
            <div className="grid gap-4 px-4 pb-6">
              <div className="grid gap-3">
                {comments.map((comment, index) => (
                  <div
                    key={`${comment}-${index}`}
                    className="rounded-lg border p-3"
                  >
                    <p className="text-sm">{comment}</p>
                  </div>
                ))}
              </div>
              <Textarea
                value={commentDraft}
                placeholder="Add a comment"
                onChange={(event) => setCommentDraft(event.target.value)}
              />
              <Button
                type="button"
                size="sm"
                className="justify-self-end"
                disabled={!commentDraft.trim()}
                onClick={() => {
                  setComments((current) => [...current, commentDraft.trim()]);
                  setCommentDraft("");
                  toast.success("Comment added");
                }}
              >
                <Send className="size-4" />
                Add comment
              </Button>
            </div>
          ) : (
            <ol className="grid gap-4 px-4 pb-6">
              {[
                [t("logCreated"), "07 Jul 2026 · 09:14"],
                [t("logUpdated"), "07 Jul 2026 · 09:28"],
                [t("logReviewed"), "07 Jul 2026 · 10:02"],
              ].map(([label, time]) => (
                <li key={label} className="flex gap-3">
                  <span
                    className="bg-primary mt-1.5 size-2 shrink-0 rounded-full"
                    aria-hidden="true"
                  />
                  <div>
                    <p className="text-sm font-medium">{label}</p>
                    <p className="text-muted-foreground text-xs">{time}</p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
