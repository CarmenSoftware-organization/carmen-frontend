import {
  Controller,
  type UseFormReturn,
  type FieldPath,
} from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SettingField } from "@/components/share/setting-field";
import { cn } from "@/lib/utils";
import type { BusinessUnitConfigItem } from "@/types/business-unit";
import type { BusinessSettingFormValues } from "./company-profile-form-schema";

type Form = UseFormReturn<BusinessSettingFormValues>;
type FormName = FieldPath<BusinessSettingFormValues>;

export const CONFIG_ENUM_EMPTY = "__config_enum_empty__";

function fieldError(form: Form, name: FormName): string | undefined {
  let cur: unknown = form.formState.errors;
  for (const part of name.split(".")) {
    if (cur && typeof cur === "object") {
      cur = (cur as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  const msg = (cur as { message?: unknown } | undefined)?.message;
  return typeof msg === "string" ? msg : undefined;
}

/**
 * @param helperBelow - คำอธิบายไว้ใต้ช่องกรอก (helper text) แทนใต้ label — ใช้ในฟอร์ม
 *   company profile: คำอธิบายยาวไม่เท่ากัน ถ้าอยู่เหนือช่อง กรอบของสองช่องในแถว
 *   เดียวกันจะเหลื่อมกัน (ConfigField ของ default-setting ยังใช้แบบเหนือช่อง)
 */
function EditShell({
  label,
  description,
  htmlFor,
  fullWidth,
  helperBelow,
  children,
}: {
  readonly label: string;
  readonly description?: string;
  readonly htmlFor?: string;
  readonly fullWidth?: boolean;
  readonly helperBelow?: boolean;
  readonly children: React.ReactNode;
}) {
  const helper = description && (
    <p className="text-muted-foreground/80 text-micro leading-snug">
      {description}
    </p>
  );
  return (
    <div className={cn("min-w-0 space-y-1", fullWidth && "@md:col-span-2")}>
      <Label
        htmlFor={htmlFor}
        className="text-foreground text-xs font-semibold"
      >
        {label}
      </Label>
      {!helperBelow && helper}
      {children}
      {helperBelow && helper}
    </div>
  );
}

export function EditableField({
  editing,
  form,
  name,
  label,
  description,
  type = "text",
  displayValue,
  fullWidth,
  mono,
  maxLength,
}: {
  readonly editing: boolean;
  readonly form: Form;
  readonly name: FormName;
  readonly label: string;
  readonly description?: string;
  readonly type?: "text" | "number" | "textarea";
  readonly displayValue?: string | number | null;
  readonly fullWidth?: boolean;
  readonly mono?: boolean;
  readonly maxLength?: number;
}) {
  // โหมดดูไม่โชว์ description — ส่วนใหญ่แค่ทวน label ("Hotel Email: Contact email of
  // the hotel") ช่วยตอนกรอก แต่ตอนอ่านเป็นแค่เสียงรบกวน
  if (!editing) {
    return (
      <SettingField
        label={label}
        value={displayValue}
        mono={mono}
        fullWidth={fullWidth}
      />
    );
  }
  const error = fieldError(form, name);
  // default cap ต่อชนิด — number ไม่ cap (counter ไม่ applicable)
  const resolvedMaxLength =
    maxLength ??
    (type === "textarea" ? 256 : type === "text" ? 100 : undefined);
  return (
    <EditShell
      label={label}
      description={description}
      htmlFor={name}
      fullWidth={fullWidth}
      helperBelow
    >
      {type === "textarea" ? (
        <Textarea
          id={name}
          maxLength={resolvedMaxLength}
          {...form.register(name)}
          aria-invalid={!!error}
          className="min-h-16"
        />
      ) : (
        <Input
          id={name}
          type={type === "number" ? "number" : "text"}
          maxLength={resolvedMaxLength}
          {...form.register(name, { valueAsNumber: type === "number" })}
          aria-invalid={!!error}
          className={cn("h-8 text-sm", mono && "font-mono text-xs")}
        />
      )}
      {error && <p className="text-destructive text-xs">{error}</p>}
    </EditShell>
  );
}

/**
 * Select ผูก RHF (Controller) — คืนเฉพาะตัว control (ไม่มี label/shell)
 *
 * merge ค่าปัจจุบันเข้า options เผื่อ backend คืนค่านอกรายการ (จะได้ไม่หาย)
 */
function SelectControl({
  form,
  name,
  options,
  placeholder,
  id,
  exampleOf,
}: {
  readonly form: Form;
  readonly name: FormName;
  readonly options: readonly string[];
  readonly placeholder?: string;
  readonly id?: string;
  readonly exampleOf?: (option: string) => string | null;
}) {
  return (
    <Controller
      control={form.control}
      name={name}
      render={({ field }) => {
        const current = typeof field.value === "string" ? field.value : "";
        const merged =
          current && !options.includes(current)
            ? [current, ...options]
            : options;
        return (
          <Select value={current || undefined} onValueChange={field.onChange}>
            <SelectTrigger id={id} size="sm" className="w-full text-sm">
              <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent>
              {merged.map((o) => {
                const ex = exampleOf?.(o);
                return (
                  <SelectItem key={o} value={o} className="text-sm">
                    {o}
                    {/* ตัวอย่างโชว์เฉพาะในรายการ — ใน trigger มันโดนตัดครึ่ง
                        (Radix คัดลอก ItemText ทั้งก้อนไปแสดงที่ trigger) */}
                    {ex && (
                      <span className="text-muted-foreground text-xs tabular-nums in-data-[slot=select-value]:hidden">
                        → {ex}
                      </span>
                    )}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        );
      }}
    />
  );
}

export function SelectField({
  editing,
  form,
  name,
  label,
  description,
  options,
  placeholder,
  displayValue,
  fullWidth,
  mono,
  exampleOf,
}: {
  readonly editing: boolean;
  readonly form: Form;
  readonly name: FormName;
  readonly label: string;
  readonly description?: string;
  readonly options: readonly string[];
  readonly placeholder?: string;
  readonly displayValue?: string | null;
  readonly fullWidth?: boolean;
  readonly mono?: boolean;
  /** ตัวอย่างผลลัพธ์ของแต่ละตัวเลือก — โชว์ทั้งตอนดู (ของค่าปัจจุบัน) และใน dropdown */
  readonly exampleOf?: (option: string) => string | null;
}) {
  if (!editing) {
    return (
      <SettingField
        label={label}
        value={displayValue}
        fullWidth={fullWidth}
        mono={mono}
        example={displayValue ? exampleOf?.(displayValue) : null}
        // ช่อง pattern (mono) = โชว์ผลลัพธ์เป็นหลัก · timezone ชื่อโซนคือค่าหลักอยู่แล้ว
        specimen={mono}
      />
    );
  }
  return (
    <EditShell
      label={label}
      description={description}
      htmlFor={name}
      fullWidth={fullWidth}
      helperBelow
    >
      <SelectControl
        form={form}
        name={name}
        options={options}
        placeholder={placeholder}
        id={name}
        exampleOf={exampleOf}
      />
    </EditShell>
  );
}

/**
 * Field number-format — view แสดงสรุป, edit = locales (dropdown) + minimumIntegerDigits
 *
 * @param localeOptions - รายการ locale มาตรฐานสำหรับ dropdown
 * @param showDigits - แสดงช่อง minimumIntegerDigits หรือไม่ (default true) —
 *   ฝั่งจำนวนเงินปิดไว้ เพราะ `formatAmount` ไม่ได้อ่านค่านี้แล้ว เหลือช่องไว้ก็
 *   เป็นช่องที่กรอกไปแล้วไม่มีผลกับอะไรเลย
 */
export function NumberFormatField({
  editing,
  form,
  name,
  label,
  description,
  displayValue,
  localeOptions,
  localesPlaceholder,
  digitsPlaceholder,
  showDigits = true,
  example,
}: {
  readonly editing: boolean;
  readonly form: Form;
  readonly name: "amount_format" | "quantity_format" | "recipe_format";
  readonly label: string;
  readonly description?: string;
  readonly displayValue?: string | null;
  readonly localeOptions: readonly string[];
  readonly localesPlaceholder: string;
  readonly digitsPlaceholder: string;
  readonly showDigits?: boolean;
  /** ตัวอย่างตัวเลขที่จัดรูปแบบตามค่าปัจจุบัน (โหมดดูเท่านั้น) */
  readonly example?: string | null;
}) {
  if (!editing) {
    return (
      <SettingField
        label={label}
        value={displayValue}
        example={example}
        specimen
      />
    );
  }
  return (
    <EditShell label={label} description={description} helperBelow>
      <div className={showDigits ? "grid grid-cols-2 gap-2" : undefined}>
        <SelectControl
          form={form}
          name={`${name}.locales` as FormName}
          options={localeOptions}
          placeholder={localesPlaceholder}
        />
        {showDigits && (
          <Input
            type="number"
            {...form.register(`${name}.minimumIntegerDigits` as FormName, {
              valueAsNumber: true,
            })}
            placeholder={digitsPlaceholder}
            className="h-8"
          />
        )}
      </div>
    </EditShell>
  );
}

/**
 * รหัสเอกสารหน้าป้าย (PR, GRN, …) — กว้างขั้นต่ำเท่ารหัส 3 ตัว ป้ายของรหัส 2 กับ 3 ตัวอักษร
 * จึงเริ่มที่ระดับเดียวกันเมื่อเรียงลงมาในคอลัมน์
 */
export function ConfigCode({ code }: { readonly code: string }) {
  return (
    <span className="bg-muted text-muted-foreground text-micro min-w-7 shrink-0 rounded px-1 py-0.5 text-center font-mono font-semibold">
      {code}
    </span>
  );
}

/**
 * config หนึ่งรายการ (หน้า Default Setting) — ช่องหนึ่งของ `FieldGrid`: ป้ายบน ค่า/คอนโทรลล่าง
 * value เก็บเป็น string เสมอ: boolean → Switch, enum (มี options) → Select, อื่นๆ → text input
 *
 * คีย์ดิบ (`item.key`) ไม่โชว์แล้ว — เป็นภาษา dev ผู้ใช้อ่านไม่ออก เหลือไว้ใน `title`
 * ของป้ายให้ทีม support ชี้เมาส์ดูได้
 *
 * @param yesLabel/noLabel - ป้าย boolean ในโหมด view
 * @param label - override label ที่แสดง (เช่น i18n ของ seeded item); ไม่มี → ใช้ item.label
 * @param description - คำอธิบายสั้นใต้ป้าย
 * @param code - รหัสเอกสารหน้าแถว (เช่น "PR")
 * @param options - สำหรับ enum: รายการ {value,label} ที่ resolve แล้ว; ไม่มี → fallback text input
 * @param emptyIsDefault - enum ที่ค่าว่าง = "ใช้ค่าของระบบ" → โหมดดูแสดงค่าจาง
 *   ให้แถวที่ตั้งเองเด่นกว่า (แบบฟอร์มการพิมพ์ 12 แถวที่ส่วนใหญ่เป็นค่าระบบ)
 */
export function ConfigField({
  editing,
  form,
  index,
  item,
  yesLabel,
  noLabel,
  label,
  description,
  code,
  options,
  disabled,
  emptyIsDefault,
}: {
  readonly editing: boolean;
  readonly form: Form;
  readonly index: number;
  readonly item: BusinessUnitConfigItem;
  readonly yesLabel: string;
  readonly noLabel: string;
  readonly label?: string;
  readonly description?: string;
  readonly code?: string;
  readonly options?: readonly { value: string; label: string }[];
  readonly disabled?: boolean;
  readonly emptyIsDefault?: boolean;
}) {
  const isBool = item.datatype === "boolean";
  const isEnum = item.datatype === "enum" && options != null;
  const name = `config.${index}.value` as FormName;
  const displayLabel = label ?? item.label;

  let control: React.ReactNode;
  if (!editing) {
    let displayValue: string;
    let muted = false;
    if (isBool) {
      displayValue = item.value === "true" ? yesLabel : noLabel;
      muted = item.value !== "true";
    } else if (isEnum) {
      const lookupValue = item.value === "" ? CONFIG_ENUM_EMPTY : item.value;
      displayValue =
        options.find((o) => o.value === lookupValue)?.label ?? item.value;
      muted = !!emptyIsDefault && item.value === "";
    } else {
      displayValue = item.value;
    }
    control = (
      <span
        className={cn(
          "inline-flex items-center gap-2 text-sm",
          muted ? "text-muted-foreground" : "text-foreground font-medium",
        )}
      >
        {!muted && (
          <span
            aria-hidden
            className="bg-primary size-1.5 shrink-0 rounded-full"
          />
        )}
        {displayValue || "—"}
      </span>
    );
  } else if (isBool) {
    control = (
      <Controller
        control={form.control}
        name={name}
        render={({ field }) => (
          <Switch
            id={name}
            checked={field.value === "true"}
            onCheckedChange={(v) => field.onChange(v ? "true" : "false")}
          />
        )}
      />
    );
  } else if (isEnum) {
    control = (
      <Controller
        control={form.control}
        name={name}
        render={({ field }) => {
          const current = typeof field.value === "string" ? field.value : "";
          return (
            <Select
              value={current === "" ? CONFIG_ENUM_EMPTY : current}
              onValueChange={(v) =>
                field.onChange(v === CONFIG_ENUM_EMPTY ? "" : v)
              }
              disabled={disabled}
            >
              <SelectTrigger id={name} size="sm" className="w-full text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {options.map((o) => (
                  <SelectItem key={o.value} value={o.value} className="text-sm">
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          );
        }}
      />
    );
  } else {
    control = <Input id={name} {...form.register(name)} className="h-8" />;
  }

  // ช่องหนึ่งของ `FieldGrid` — ป้ายบน ค่า/คอนโทรลล่าง (เดิมเป็นแถวเต็มความกว้าง ป้ายชิดซ้าย
  // ค่าชิดขวา บนจอกว้างค่าจึงลอยห่างจากป้ายเป็นคืบ)
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1.5">
        {code && <ConfigCode code={code} />}
        <Label
          htmlFor={editing ? name : undefined}
          title={item.key}
          className={cn(
            "min-w-0 text-xs",
            editing
              ? "text-foreground font-semibold"
              : "text-muted-foreground font-normal",
          )}
        >
          {displayLabel}
        </Label>
      </div>
      {/* max-w-sm: ช่องในกริด auto-fit ที่มีไม่กี่รายการกว้างได้หลายร้อย px — คอนโทรลต้องไม่ยืดตาม
          (จอกว้างขึ้น = คอลัมน์เพิ่ม ไม่ใช่ช่องกรอกกว้างขึ้น) ใน `FieldGrid` ปกติช่องแคบกว่านี้อยู่แล้ว */}
      <div className={cn("max-w-sm", editing ? "mt-1" : "mt-0.5")}>
        {control}
      </div>
      {description && (
        <p className="text-muted-foreground/80 text-micro mt-1 leading-snug">
          {description}
        </p>
      )}
    </div>
  );
}
