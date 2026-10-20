import {
  createContext,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useTranslations } from "use-intl";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDatePicker,
  FieldGroup,
  FieldLabel,
  FieldSelect,
} from "@/components/ui/field";
import { SelectContent, SelectItem } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { LookupCombobox } from "@/components/lookup/lookup-combobox";
import { cn } from "@/lib/utils";
import {
  useReportListLookups,
  useReportLookupSearch,
} from "../shared/use-report";
import type { ReportPeriodMap } from "@/types/report";
import type { Report } from "@/types/report";
import {
  flattenFields,
  parseReportDialog,
  resolveNoteText,
  type DateNode,
  type DialogCell,
  type FormField,
  type LookupNode,
  type ParsedDialog,
  type SingleField,
  MAX_COLS,
} from "./parse-report-dialog";
import { COL_SPAN, GRID_COLS, MODAL_W } from "./dialog-layout";
import {
  forgetReportParams,
  loadReportParams,
  reportParamKey,
  saveReportParams,
  type RememberedReportParams,
} from "./report-param-memory";

interface ReportParamDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly report: Report | null;
  readonly buCode?: string;
  readonly onRun?: (report: Report, filters: Record<string, string>) => void;
  readonly onExport?: (report: Report, filters: Record<string, string>) => void;
  readonly busy?: boolean;
}

function resolveDateKeyword(value: string, periods?: ReportPeriodMap): string {
  const now = new Date();
  switch (value) {
    case "Today":
    case "@today":
    case "@now":
      return now.toISOString();
    case "@yesterday":
      return new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() - 1,
      ).toISOString();
    case "@tommorow":
    case "@tomorrow":
      return new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + 1,
      ).toISOString();
    case "FirstDayOfMonth":
      return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    case "LastDayOfMonth":
      return new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString();
    case "FirstDayOfYear":
      return new Date(now.getFullYear(), 0, 1).toISOString();
    case "LastDayOfYear":
      return new Date(now.getFullYear(), 11, 31).toISOString();
    case "@current_period":
      return (
        periods?.["current-period"]?.start_at ??
        new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
      );
    case "@previous_period":
      return (
        periods?.["previous-period"]?.start_at ??
        new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString()
      );
    case "@blank":
    case "@empty":
    case "@none":
      // Opt-out of the today-default: control starts empty (no date filter).
      // Used by reports with several optional date ranges (e.g. Store Requisition
      // Detail) so the user only fills the ranges they care about.
      return "";
    default:
      return value || now.toISOString();
  }
}

/**
 * ช่องเลือกที่ดึงข้อมูลจากที่อื่นใช้ดึงรายการใหม่ตอนผู้ใช้กดเปิด
 *
 * dialog ดึงรายการรอบแรกตอนเปิดอยู่แล้ว แต่ถ้าเปิด dialog ค้างไว้แล้วมีคนเพิ่มสินค้า/คลัง
 * กดช่องเลือกกี่ครั้งก็ยังเห็นรายการเดิม — กดเปิดช่องจึงดึงใหม่ทุกครั้ง
 */
const LookupRefreshContext = createContext<{
  readonly refresh: () => void;
  readonly isFetching: boolean;
}>({ refresh: () => {}, isFetching: false });

/**
 * ค่าที่กดเรียกดูครั้งล่าสุด (ภายใน 30 นาที) — control ใช้เป็นค่าตั้งต้นแทนค่าของรายงาน
 * ดู `report-param-memory.ts`
 */
const RememberedParamsContext = createContext<
  RememberedReportParams | undefined
>(undefined);

/**
 * ค่าที่จำไว้ของ control นี้ ถ้ายังเป็นตัวเลือกที่มีอยู่ — ตัวเลือกที่หายไปแล้ว
 * (เช่นงวดที่ถูกลบ) กลับไปใช้ค่าตั้งต้น
 */
function pickRemembered(
  remembered: RememberedReportParams | undefined,
  name: string,
  options: readonly { value: string }[],
): string | undefined {
  const value = remembered?.values[name];
  return value !== undefined && options.some((o) => o.value === value)
    ? value
    : undefined;
}

interface LookupControlProps {
  readonly node: LookupNode;
  readonly id: string;
}

interface LookupOption {
  readonly value: string;
  readonly label: string;
}

/**
 * source ที่ค้นในเครื่องอย่างเดียว — งวดมีไม่กี่แถว micro-report ไม่ค้นให้
 */
const CLIENT_SEARCH_ONLY_SOURCES = new Set(["period"]);

/** ค่าที่ "ทั้งหมด" ส่งไป — micro-data/micro-report ไม่กรองฝั่งนั้น */
const ALL = "ALL";

/**
 * ค่าตั้งต้นของช่องเลือก: ค่าที่จำไว้ (ภายใน 30 นาที) ถ้ามี ไม่งั้นตัวแรกของรายการ
 *
 * ค่าที่จำไว้อาจมาจากการค้นฝั่ง server ซึ่งไม่อยู่ในรายการตั้งต้น — ใช้ป้ายที่จำไว้แสดงบนปุ่ม
 */
function useInitialChoice(id: string, options: LookupOption[]): LookupOption {
  const remembered = useContext(RememberedParamsContext);
  const value = remembered?.values[id] || options[0].value;
  const label =
    options.find((o) => o.value === value)?.label ??
    remembered?.labels[id] ??
    "";
  return { value, label };
}

function SearchableLookupControl({
  options,
  id,
  dataSource,
}: {
  readonly options: LookupOption[];
  readonly id: string;
  readonly dataSource: string;
}) {
  const initial = useInitialChoice(id, options);
  const [choice, setChoice] = useState(initial);
  return (
    <SearchableLookupSelect
      options={options}
      id={id}
      dataSource={dataSource}
      choice={choice}
      onChoose={setChoice}
    />
  );
}

/**
 * ช่องเลือกที่ค้นหาได้ แบบ controlled — ค่าและป้ายอยู่ที่ผู้เรียก (ช่องเดี่ยว หรือคู่ From–To ที่เติมค่าให้กัน)
 */
function SearchableLookupSelect({
  options,
  id,
  dataSource,
  choice,
  onChoose,
}: {
  readonly options: LookupOption[];
  readonly id: string;
  readonly dataSource: string;
  readonly choice: LookupOption;
  readonly onChoose: (choice: LookupOption) => void;
}) {
  const { value, label } = choice;
  const { refresh, isFetching } = useContext(LookupRefreshContext);
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");

  // พิมพ์ค้นหา → ค้นทั้งตารางฝั่ง server (สด + ไม่ติดเพดาน 500 แถวของรายการตอนเปิด)
  // combobox ยังกรองผลในเครื่องซ้ำอีกชั้น ซึ่งไม่ตัดอะไรเพราะผลจาก server ตรงคำค้นอยู่แล้ว
  // แต่ถ้า micro-report/gateway ยังเป็นรุ่นที่ไม่รู้จัก search ก็ยังได้พฤติกรรมเดิม
  const canSearchServer = !CLIENT_SEARCH_ONLY_SOURCES.has(dataSource);
  const isServerSearch = canSearchServer && search.trim() !== "";
  const { data: found, isLoading: isSearching } = useReportLookupSearch({
    source: dataSource,
    search,
    enabled: isOpen && canSearchServer,
  });
  const items =
    isServerSearch && found
      ? found.map((i) => ({ value: i.code, label: i.name }))
      : options;

  return (
    <>
      <input
        type="hidden"
        name={id}
        value={value}
        data-label={label}
        readOnly
      />
      <LookupCombobox<LookupOption>
        value={value}
        onValueChange={(v, item) =>
          onChoose({
            value: v,
            label:
              item?.label ?? options.find((o) => o.value === v)?.label ?? "",
          })
        }
        defaultLabel={label}
        // กดเปิด = ดึงรายการใหม่ · โชว์ skeleton จนของใหม่มาถึง ไม่ให้เลือกจากรายการเก่า
        onOpenChange={(o) => {
          setIsOpen(o);
          if (o) refresh();
        }}
        onSearchChange={setSearch}
        isLoading={isOpen && (isFetching || (isServerSearch && isSearching))}
        items={items}
        // ระหว่างค้นหา items คือผลจาก server ซึ่งไม่มี "ทั้งหมด" — ให้ป้ายบนปุ่มหาจากรายการตั้งต้นได้
        selectedItems={options}
        getId={(o) => o.value}
        getLabel={(o) => o.label}
        getSearchValue={(o) => o.label}
        // The Product/Location fields sit in a 2-column grid, so the trigger —
        // and the default trigger-width popover — is too narrow and long
        // "code - name" labels wrapped and overlapped (fixed-height virtual rows).
        // Widen the panel and force single-line rows with ellipsis instead.
        popoverWidth="w-[min(92vw,32rem)]"
        popoverAlign="start"
        renderItem={(o) => (
          <span className="min-w-0 flex-1 truncate text-left">{o.label}</span>
        )}
        size="sm"
        className="w-full"
        modal
      />
    </>
  );
}

/** ตัวเลือกของ lookup จาก XML + รายการที่ดึงมา ("ALL" แสดงเป็นคำว่าทั้งหมดของภาษานั้น) */
function useLookupOptions(node: LookupNode): LookupOption[] {
  const tc = useTranslations("common");
  return node.items
    .map((item, idx) => ({
      value: node.values[idx] || item,
      label: item === ALL ? tc("all") : item,
    }))
    .filter((o) => o.value !== "");
}

function LookupControl({ node, id }: LookupControlProps) {
  const remembered = useContext(RememberedParamsContext);
  const options = useLookupOptions(node);

  // Data-source-backed lookups (product/location/vendor/category/...) can be
  // long → searchable combobox. Hard-coded enum lookups (Status/GroupBy/Day)
  // have few options and stay a plain select.
  if (node.dataSource && options.length > 0) {
    return (
      <SearchableLookupControl
        options={options}
        id={id}
        dataSource={node.dataSource}
      />
    );
  }

  if (options.length > 0) {
    return (
      <FieldSelect
        name={id}
        defaultValue={
          pickRemembered(remembered, id, options) ?? options[0].value
        }
        className="h-8"
      >
        <SelectContent className="max-h-[min(60vh,400px)]" position="popper">
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </FieldSelect>
    );
  }

  return (
    <FieldSelect name={id} placeholder={`(${node.dataSource})`} className="h-8">
      <SelectContent className="max-h-[min(60vh,400px)]" position="popper" />
    </FieldSelect>
  );
}

function MultiLookupControl({
  node,
  id,
}: {
  readonly node: LookupNode;
  readonly id: string;
}) {
  const tc = useTranslations("common");
  const remembered = useContext(RememberedParamsContext);
  const options = node.items
    .map((item, idx) => ({ item, value: node.values[idx] || item }))
    .filter((o) => o.value !== "");
  // empty selection = no filter (all). Submitted as a comma-joined string;
  // micro-data splits it into an IN (...) predicate.
  const [selected, setSelected] = useState<string[]>(() =>
    (remembered?.values[id] ?? "")
      .split(",")
      .filter((v) => options.some((o) => o.value === v)),
  );
  const toggle = (value: string, checked: boolean) =>
    setSelected((prev) =>
      checked ? [...prev, value] : prev.filter((v) => v !== value),
    );
  return (
    <>
      <input type="hidden" name={id} value={selected.join(",")} readOnly />
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 rounded-md border p-2">
        {options.map(({ item, value }) => (
          <label
            key={value}
            className="flex cursor-pointer items-center gap-1.5 text-sm"
          >
            <Checkbox
              checked={selected.includes(value)}
              onCheckedChange={(c) => toggle(value, c === true)}
            />
            {item === "ALL" ? tc("all") : item}
          </label>
        ))}
      </div>
    </>
  );
}

interface DateControlProps {
  readonly node: DateNode;
  readonly periods?: ReportPeriodMap;
}

function DateControl({ node, periods }: DateControlProps) {
  const remembered = useContext(RememberedParamsContext)?.values;
  // ค่าว่างที่จำไว้ก็คือค่าที่ผู้ใช้ตั้งใจล้าง (ช่องวันที่ที่ไม่บังคับ) — ใช้ตามนั้น
  const initial =
    remembered && node.name in remembered
      ? remembered[node.name]
      : resolveDateKeyword(node.value, periods);
  // key={initial}: periods มาจาก query async — render แรก periods ว่าง ทำให้ field
  // ที่ใช้ @current_period/@previous_period ได้ initial = "" เมื่อ periods โหลดเสร็จ
  // initial เปลี่ยน → remount ด้วยค่าใหม่ (เกิดครั้งเดียวก่อนผู้ใช้แก้ เพราะ periods
  // นิ่งหลังโหลด) ไม่งั้น useState(initial) จะค้างค่าว่างตลอด
  return <DateControlInner key={initial} name={node.name} initial={initial} />;
}

function DateControlInner({
  name,
  initial,
}: {
  readonly name: string;
  readonly initial: string;
}) {
  // state drives both <FieldDatePicker> และ hidden input ที่ FormData อ่าน
  // remount ผ่าน key={initial} ที่ parent ทำให้ค่าเริ่มต้นตรงกับ periods ที่โหลดเสร็จ
  const [value, setValue] = useState(initial);
  return (
    <>
      <input type="hidden" name={name} value={value} readOnly />
      <FieldDatePicker
        value={value}
        onValueChange={setValue}
        size="sm"
        className="w-full"
      />
    </>
  );
}

interface ControlProps {
  readonly node: LookupNode | DateNode;
  readonly periods?: ReportPeriodMap;
}

function Control({ node, periods }: ControlProps) {
  if (node.type === "lookup") {
    return node.multi ? (
      <MultiLookupControl node={node} id={node.name} />
    ) : (
      <LookupControl node={node} id={node.name} />
    );
  }
  return <DateControl node={node} periods={periods} />;
}

interface FieldControlProps {
  readonly field: FormField;
  readonly periods?: ReportPeriodMap;
}

/** ช่อง From กับ To วางคู่กันในแถวเดียว */
function RangeRow({
  from,
  to,
}: {
  readonly from: ReactNode;
  readonly to: ReactNode;
}) {
  const tc = useTranslations("common");
  return (
    <div className="grid grid-cols-2 gap-2">
      <div>
        <span className="text-muted-foreground text-micro-legal">
          {tc("from")}
        </span>
        {from}
      </div>
      <div>
        <span className="text-muted-foreground text-micro-legal">
          {tc("to")}
        </span>
        {to}
      </div>
    </div>
  );
}

/** คู่ From–To ที่เป็นช่องเลือกค้นหาได้ทั้งสองฝั่ง — เติมค่าให้กันได้ (LinkedLookupRange) */
const isLinkableRange = (
  field: FormField,
): field is FormField & { from: LookupNode; to: LookupNode } =>
  field.kind === "range" &&
  field.from.type === "lookup" &&
  field.to.type === "lookup" &&
  !field.from.multi &&
  !field.to.multi &&
  !!field.from.dataSource &&
  !!field.to.dataSource;

/**
 * คู่ From–To ของช่องเลือกตัวเดียวกัน (สินค้า/คลัง/…) ที่เติมค่าให้กันครั้งแรก
 *
 * ตอนทั้งสองฝั่งเป็น "ทั้งหมด" เลือกฝั่งไหนก่อน อีกฝั่งได้ค่าเดียวกัน — ส่วนใหญ่ต้องการดูตัวเดียว
 * จะได้ไม่ต้องเลือกซ้ำ หลังจากนั้นแก้ฝั่งไหนก็ไม่ไปแตะอีกฝั่ง (From = A, To ตามเป็น A แล้วแก้ To เป็น B
 * From ยังเป็น A) จนกว่าทั้งสองฝั่งจะกลับเป็น "ทั้งหมด" อีกครั้ง — ผู้ใช้เลือกเอง หรือเปิดใหม่หลังค่าที่จำไว้
 * หมดอายุ/กดใช้ค่าเริ่มต้น เปิดมาพร้อมค่าที่จำไว้ซึ่งไม่ใช่ "ทั้งหมด" จึงยังไม่เติมให้
 *
 * ช่วงที่ได้คือ between ตามรหัส (micro-data: รหัส >= From และ <= To) ไม่ใช่แค่สองตัวที่เลือก
 */
function LinkedLookupRange({
  from,
  to,
}: {
  readonly from: LookupNode;
  readonly to: LookupNode;
}) {
  const fromOptions = useLookupOptions(from);
  const toOptions = useLookupOptions(to);
  // รายการมาแบบ async — ก่อนมาถึง ใช้ช่องเดิม (placeholder) แล้วค่อยเริ่ม state เมื่อมีตัวเลือกแล้ว
  if (fromOptions.length === 0 || toOptions.length === 0) {
    return (
      <RangeRow
        from={<LookupControl node={from} id={from.name} />}
        to={<LookupControl node={to} id={to.name} />}
      />
    );
  }
  return (
    <LinkedLookupRangeInner
      from={from}
      to={to}
      fromOptions={fromOptions}
      toOptions={toOptions}
    />
  );
}

function LinkedLookupRangeInner({
  from,
  to,
  fromOptions,
  toOptions,
}: {
  readonly from: LookupNode;
  readonly to: LookupNode;
  readonly fromOptions: LookupOption[];
  readonly toOptions: LookupOption[];
}) {
  const [fromChoice, setFromChoice] = useState(
    useInitialChoice(from.name, fromOptions),
  );
  const [toChoice, setToChoice] = useState(
    useInitialChoice(to.name, toOptions),
  );

  const choose =
    (side: "from" | "to") =>
    (choice: LookupOption): void => {
      // ตัดสินจากค่าก่อนเปลี่ยน: เติมให้เฉพาะตอนที่ทั้งสองฝั่งยังเป็น "ทั้งหมด"
      const isArmed = fromChoice.value === ALL && toChoice.value === ALL;
      if (side === "from") setFromChoice(choice);
      else setToChoice(choice);
      if (!isArmed || choice.value === ALL) return;
      if (side === "from") setToChoice(choice);
      else setFromChoice(choice);
    };

  return (
    <RangeRow
      from={
        <SearchableLookupSelect
          options={fromOptions}
          id={from.name}
          dataSource={from.dataSource}
          choice={fromChoice}
          onChoose={choose("from")}
        />
      }
      to={
        <SearchableLookupSelect
          options={toOptions}
          id={to.name}
          dataSource={to.dataSource}
          choice={toChoice}
          onChoose={choose("to")}
        />
      }
    />
  );
}

function FieldControl({ field, periods }: FieldControlProps) {
  if (isLinkableRange(field)) {
    return <LinkedLookupRange from={field.from} to={field.to} />;
  }
  if (field.kind === "range") {
    return (
      <RangeRow
        from={<Control node={field.from} periods={periods} />}
        to={<Control node={field.to} periods={periods} />}
      />
    );
  }
  return <Control node={field.control} periods={periods} />;
}

/** ช่องหนึ่งของ dialog: ป้าย + control — range ตัด " From" ท้ายป้ายเพราะ RangeRow มีป้าย From/To ของตัวเอง */
function ReportField({
  field,
  periods,
  className,
}: FieldControlProps & { readonly className?: string }) {
  const label =
    field.kind === "range" ? field.label.replace(/ From$/, "") : field.label;
  return (
    <Field className={className}>
      <FieldLabel className="text-xs">{label}</FieldLabel>
      <FieldControl field={field} periods={periods} />
    </Field>
  );
}

const cellKey = (cell: DialogCell): string => {
  if (cell.kind === "group") return `group-${cell.fields[0]?.control.name ?? ""}`;
  return cell.kind === "range" ? `${cell.from.name}-${cell.to.name}` : cell.control.name;
};

function collectDataSources(fields: FormField[]): string[] {
  const sources = new Set<string>();
  for (const field of fields) {
    const ctrls =
      field.kind === "range" ? [field.from, field.to] : [field.control];
    for (const ctrl of ctrls) {
      if (ctrl.type === "lookup" && ctrl.dataSource) {
        sources.add(ctrl.dataSource);
      }
    }
  }
  return [...sources];
}

function needsPeriods(fields: FormField[]): boolean {
  for (const field of fields) {
    const ctrls =
      field.kind === "range" ? [field.from, field.to] : [field.control];
    for (const ctrl of ctrls) {
      if (
        ctrl.type === "date" &&
        (ctrl.value === "@current_period" || ctrl.value === "@previous_period")
      ) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Dialog รับพารามิเตอร์การเรียกใช้งานรายงาน build ฟิลด์จาก XML dialog ของ
 * report template ดึง lookup + period ผ่าน `useReportListLookups`
 *
 * Form-state ใช้ native `<form>` + `FormData` (เก็บค่าได้ง่ายแบบ XML-driven
 * dynamic) ไม่ใช้ RHF เพราะ field list มาแบบ runtime จาก XML
 *
 * @param props - open, onOpenChange, report, onRun
 * @returns React element
 */
export function ReportParamDialog({
  open,
  onOpenChange,
  report,
  buCode,
  onRun,
  onExport,
  busy,
}: ReportParamDialogProps) {
  const tc = useTranslations("common");
  const t = useTranslations("report");
  const formRef = useRef<HTMLFormElement>(null);
  // เปลี่ยน key ของ form = remount ทุก control ให้กลับไปอ่านค่าตั้งต้นใหม่ (ปุ่มค่าเริ่มต้น)
  const [formKey, setFormKey] = useState(0);

  const memoryKey = report
    ? reportParamKey(buCode ?? "", report._templateId ?? String(report.Id))
    : undefined;
  // อ่าน localStorage ครั้งเดียวตอนเปิด (หรือเปลี่ยนรายงาน) แล้วถือไว้ใน state — control ใช้แค่ใน
  // useState ตั้งต้น การแก้ระหว่างเปิดจึงไม่ถูกทับ และปุ่มค่าเริ่มต้นล้างได้จริง (ถ้าคำนวณสดทุก render
  // React Compiler จะ memo ผลไว้ตาม open/memoryKey แล้วค่าที่ลบไปแล้วจะกลับมา)
  const openKey = open && memoryKey ? memoryKey : null;
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [remembered, setRemembered] = useState<RememberedReportParams>();
  if (openKey !== loadedFor) {
    setLoadedFor(openKey);
    setRemembered(openKey ? loadReportParams(openKey) : undefined);
  }

  const dialogXml = report?.Dialog;
  const parsed: ParsedDialog =
    !dialogXml || dialogXml.trim().length === 0
      ? { cols: 1, cells: [], notes: [] }
      : parseReportDialog(dialogXml);
  const fields: FormField[] = flattenFields(parsed.cells);

  const sources = collectDataSources(fields);
  const includePeriods = needsPeriods(fields);

  // dialog นี้ mount ค้างไว้ตลอด — ผูก enabled กับ open ให้ทุกครั้งที่เปิดดึงรายการใหม่
  // (สินค้า/คลังที่คนอื่นเพิ่งเพิ่มต้องขึ้นโดยไม่ต้อง refresh หน้า)
  const {
    data: lookupResult,
    refetch: refetchLookups,
    isFetching: isFetchingLookups,
  } = useReportListLookups({
    sources,
    includePeriods,
    enabled: open,
  });
  const lookupData = lookupResult?.data ?? {};
  const periods = lookupResult?.periods ?? {};

  // Inject lookup data into fields
  const injectLookup = (ctrl: LookupNode | DateNode): LookupNode | DateNode => {
    if (ctrl.type !== "lookup") return ctrl;
    const ds = ctrl.dataSource;
    if (!ds) return ctrl;
    const items = lookupData[ds];
    if (!items || items.length === 0) return ctrl;
    // Period is a single-period selection (business rule): no "ALL" option, and the
    // newest period — first in the DESC-ordered list — becomes the default (options[0]).
    const includeAll = ds !== "period";
    return {
      ...ctrl,
      items: includeAll
        ? ["ALL", ...items.map((i) => i.name)]
        : items.map((i) => i.name),
      values: includeAll
        ? ["ALL", ...items.map((i) => i.code)]
        : items.map((i) => i.code),
    };
  };
  const enrichField = (field: FormField): FormField =>
    field.kind === "range"
      ? { ...field, from: injectLookup(field.from), to: injectLookup(field.to) }
      : { ...field, control: injectLookup(field.control) };
  const enrichedCells: DialogCell[] = parsed.cells.map((cell) =>
    cell.kind === "group"
      ? {
          ...cell,
          fields: cell.fields.map(
            (f): SingleField => ({ ...f, control: injectLookup(f.control) }),
          ),
        }
      : enrichField(cell),
  );

  const collectFilters = (): Record<string, string> => {
    const filters: Record<string, string> = {};
    const labels: Record<string, string> = {};
    if (formRef.current) {
      const formData = new FormData(formRef.current);
      for (const [key, value] of formData.entries()) {
        filters[key] = value.toString();
      }
      for (const input of formRef.current.querySelectorAll<HTMLInputElement>(
        "input[data-label]",
      )) {
        if (input.dataset.label) labels[input.name] = input.dataset.label;
      }
    }
    if (memoryKey) saveReportParams(memoryKey, { values: filters, labels });
    return filters;
  };

  const handleSubmit = () => {
    if (!report || !onRun) return;
    onRun(report, collectFilters());
  };

  const handleExportClick = () => {
    if (!report || !onExport) return;
    onExport(report, collectFilters());
  };

  if (!report) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "flex max-h-[90dvh] flex-col gap-3 p-4",
          MODAL_W[parsed.cols],
        )}
      >
        <DialogHeader className="shrink-0 gap-0 pb-1">
          <DialogTitle className="text-sm">{report.ReportName}</DialogTitle>
          {remembered && (
            <p className="text-muted-foreground text-xs">
              {t("rememberedParams")}
            </p>
          )}
        </DialogHeader>

        <LookupRefreshContext.Provider
          value={{
            refresh: () => void refetchLookups(),
            isFetching: isFetchingLookups,
          }}
        >
          <RememberedParamsContext.Provider value={remembered}>
            <form
              key={formKey}
              ref={formRef}
              className="min-h-0 flex-1 overflow-y-auto pr-1"
            >
              {enrichedCells.length === 0 ? (
                <p className="text-muted-foreground text-xs">
                  {t("noFiltersConfigured")}
                </p>
              ) : (
                <FieldGroup
                  className={cn("grid grid-cols-1 gap-3", GRID_COLS[parsed.cols])}
                >
                  {enrichedCells.map((cell) =>
                    cell.kind === "group" ? (
                      <div
                        key={cellKey(cell)}
                        role={cell.label ? "group" : undefined}
                        aria-labelledby={cell.label ? `${cellKey(cell)}-heading` : undefined}
                        className={cn("space-y-2", COL_SPAN[cell.colSpan])}
                      >
                        {cell.label && (
                          <p id={`${cellKey(cell)}-heading`} className="text-sm font-medium">
                            {cell.label}
                          </p>
                        )}
                        <div
                          className={cn(
                            "grid grid-cols-1 gap-3",
                            GRID_COLS[Math.min(cell.fields.length, MAX_COLS)],
                          )}
                        >
                          {cell.fields.map((f) => (
                            <ReportField key={f.control.name} field={f} periods={periods} />
                          ))}
                        </div>
                      </div>
                    ) : (
                      <ReportField
                        key={cellKey(cell)}
                        field={cell}
                        periods={periods}
                        className={COL_SPAN[cell.colSpan]}
                      />
                    ),
                  )}
                </FieldGroup>
              )}
              {parsed.notes.map((note) => (
                <p key={note} className="text-muted-foreground mt-3 text-xs">
                  {resolveNoteText(note)}
                </p>
              ))}
            </form>
          </RememberedParamsContext.Provider>
        </LookupRefreshContext.Provider>

        <DialogFooter className="shrink-0 pt-1">
          {remembered && memoryKey && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="sm:mr-auto"
              onClick={() => {
                forgetReportParams(memoryKey);
                setRemembered(undefined);
                setFormKey((k) => k + 1);
              }}
            >
              {t("resetParams")}
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            {tc("cancel")}
          </Button>
          {report._hasExport && onExport && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={handleExportClick}
            >
              {t("exportData")}
            </Button>
          )}
          {report._allowRun !== false && (
            <Button
              type="button"
              size="sm"
              disabled={busy}
              onClick={handleSubmit}
            >
              {t("runReport")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
