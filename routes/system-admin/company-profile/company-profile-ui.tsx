import {
  Controller,
  type UseFormReturn,
  type FieldPath,
} from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { FieldPlainText } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
 * กรอบของค่าในโหมดดู — ขนาด/เส้นเท่า input ของโหมดแก้ กด Edit แล้ว layout ไม่กระโดด
 */
const VIEW_BOX_CLASS =
  "bg-muted/50 min-h-8 w-full rounded-md border px-3 py-1.5 text-sm";

/**
 * ช่องแบบอ่านอย่างเดียว — ค่าอยู่ในกรอบ `VIEW_BOX_CLASS`
 *
 * @param example - ตัวอย่างผลลัพธ์ของค่า (เช่น pattern วันที่ → วันนี้ในรูปแบบนั้น)
 *   แสดงจาง ๆ ต่อท้ายค่า
 */
export function SettingField({
  label,
  value,
  description,
  mono,
  fullWidth,
  example,
  children,
}: {
  readonly label: string;
  readonly value?: string | number | null;
  readonly description?: string;
  readonly mono?: boolean;
  readonly fullWidth?: boolean;
  readonly example?: string | null;
  readonly children?: React.ReactNode;
}) {
  const isEmpty =
    children == null && (value === null || value === undefined || value === "");
  return (
    <div className={cn("min-w-0 space-y-1", fullWidth && "sm:col-span-2")}>
      <div className="text-foreground text-xs font-semibold">{label}</div>
      {description && (
        <p className="text-muted-foreground/80 text-micro leading-snug">
          {description}
        </p>
      )}
      {children ?? (
        <FieldPlainText
          className={cn(
            VIEW_BOX_CLASS,
            "flex flex-wrap items-center gap-x-2 break-words",
            mono && "font-mono text-xs",
            isEmpty && "text-muted-foreground/60",
          )}
        >
          {isEmpty ? null : (
            <>
              <span className="min-w-0">{value}</span>
              {example && (
                <span className="text-muted-foreground font-sans text-xs font-normal tabular-nums">
                  → {example}
                </span>
              )}
            </>
          )}
        </FieldPlainText>
      )}
    </div>
  );
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
    <div className={cn("min-w-0 space-y-1", fullWidth && "sm:col-span-2")}>
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
      <SettingField label={label} value={displayValue} example={example} />
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
 * Field ของ config หนึ่งรายการ — label มาจาก backend, value เก็บเป็น string เสมอ
 *
 * boolean → Switch, enum (มี options) → Select, อื่นๆ → text input. view แสดงค่าปัจจุบัน
 *
 * @param yesLabel/noLabel - ป้าย boolean ในโหมด view
 * @param label - override label ที่แสดง (เช่น i18n ของ seeded item); ไม่มี → ใช้ item.label
 * @param options - สำหรับ enum: รายการ {value,label} ที่ resolve แล้ว; ไม่มี → fallback text input
 */
export function ConfigField({
  editing,
  form,
  index,
  item,
  yesLabel,
  noLabel,
  label,
  options,
  disabled,
}: {
  readonly editing: boolean;
  readonly form: Form;
  readonly index: number;
  readonly item: BusinessUnitConfigItem;
  readonly yesLabel: string;
  readonly noLabel: string;
  readonly label?: string;
  readonly options?: readonly { value: string; label: string }[];
  readonly disabled?: boolean;
}) {
  const isBool = item.datatype === "boolean";
  const isEnum = item.datatype === "enum" && options != null;
  const name = `config.${index}.value` as FormName;
  const displayLabel = label ?? item.label;

  if (!editing) {
    let displayValue: string;
    if (isBool) {
      displayValue = item.value === "true" ? yesLabel : noLabel;
    } else if (isEnum) {
      const lookupValue = item.value === "" ? CONFIG_ENUM_EMPTY : item.value;
      displayValue =
        options.find((o) => o.value === lookupValue)?.label ?? item.value;
    } else {
      displayValue = item.value;
    }
    return (
      <SettingField
        label={displayLabel}
        description={item.key}
        value={displayValue}
      />
    );
  }

  if (isBool) {
    return (
      <EditShell label={displayLabel} description={item.key}>
        <Controller
          control={form.control}
          name={name}
          render={({ field }) => (
            <Switch
              checked={field.value === "true"}
              onCheckedChange={(v) => field.onChange(v ? "true" : "false")}
            />
          )}
        />
      </EditShell>
    );
  }

  if (isEnum) {
    return (
      <EditShell label={displayLabel} description={item.key} htmlFor={name}>
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
                    <SelectItem
                      key={o.value}
                      value={o.value}
                      className="text-sm"
                    >
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            );
          }}
        />
      </EditShell>
    );
  }

  return (
    <EditShell label={displayLabel} description={item.key} htmlFor={name}>
      <Input {...form.register(name)} className="h-8" />
    </EditShell>
  );
}
