import { useState } from "react";
import { useTranslations } from "use-intl";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useGlDimensionValues } from "@/hooks/use-gl-dimensions";
import {
  localDateToYmd,
  storedTypedValue,
  ymdToLocalDate,
} from "@/lib/dimension-value";
import type { DimensionMaster } from "@/types/accounting-master";
import type { DimensionRef } from "@/types/gl-dimension";

interface DimensionValueInputProps {
  readonly dimension: DimensionMaster;
  readonly value: DimensionRef | undefined;
  /** null = ล้างค่า (เอา dimension นี้ออกจากบรรทัด) */
  readonly onChange: (next: DimensionRef | null) => void;
  readonly disabled?: boolean;
  readonly size?: "xs" | "sm";
}

const NONE = "__none__";
const TEXT_MAX = 20;
const NUMBER_TYPING = /^-?\d*(\.\d{0,5})?$/;
const NUMBER_COMPLETE = /^-?\d+(\.\d{1,5})?$/;

/**
 * ช่องกรอกค่า dimension ตามชนิดของ **master** (`dimension.data_type`):
 * lookup = Select ค่าใน master · string = Input (สูงสุด 20) · number = ตัวเลข (ติดลบได้ ทศนิยมไม่เกิน 5)
 * · date = DatePicker ตามรูปแบบวันที่ของโปรไฟล์ (เก็บ `YYYY-MM-DD`) · boolean = Select Yes/No
 *
 * แถวเก่าที่เก็บ `dimension_value_id` ไว้แต่ master ถูกเปลี่ยนชนิดแล้ว: แสดง `value_code` เดิมเป็นค่าปัจจุบัน
 * (placeholder) และคง ref เดิมไว้จนกว่าผู้ใช้จะแก้ — payload builder จึงส่ง value id เดิมกลับตามเดิม
 * พอผู้ใช้กรอกค่าใหม่ ref จะถูกแทนด้วย `value` ตามชนิดใหม่
 */
export function DimensionValueInput({
  dimension,
  value,
  onChange,
  disabled = false,
  size = "sm",
}: DimensionValueInputProps) {
  const type = dimension.data_type ?? "lookup";
  const legacyCode =
    type !== "lookup" && value?.dimension_value_id && !value.value
      ? (value.value_code ?? undefined)
      : undefined;

  const emit = (next: string | number | boolean) =>
    onChange({
      dimension_id: dimension.id,
      value: next,
      dimension_code: dimension.code,
      dimension_name: dimension.name,
      value_code: String(next),
      data_type: type,
    });

  const stored = legacyCode ? null : storedTypedValue(value ?? { dimension_id: "" });

  if (type === "lookup")
    return (
      <LookupInput
        dimension={dimension}
        value={value}
        onChange={onChange}
        disabled={disabled}
        size={size}
      />
    );
  if (type === "boolean")
    return (
      <BooleanInput
        name={dimension.name}
        current={
          legacyCode ? "" : stored === null ? NONE : String(stored === true || stored === "true")
        }
        placeholder={legacyCode}
        disabled={disabled}
        size={size}
        onSelect={(v) => (v === NONE ? onChange(null) : emit(v === "true"))}
      />
    );
  if (type === "date")
    return (
      <DateInput
        ymd={stored === null ? "" : String(stored)}
        placeholder={legacyCode}
        disabled={disabled}
        size={size}
        onPick={(ymd) => (ymd ? emit(ymd) : onChange(null))}
      />
    );
  return (
    <TypedTextInput
      numeric={type === "number"}
      name={dimension.name}
      current={stored === null ? "" : String(stored)}
      placeholder={legacyCode}
      disabled={disabled}
      size={size}
      onCommit={(v) => (v === "" ? onChange(null) : emit(v))}
    />
  );
}

function TypedTextInput({
  numeric,
  name,
  current,
  placeholder,
  disabled,
  size,
  onCommit,
}: {
  readonly numeric: boolean;
  readonly name: string;
  readonly current: string;
  readonly placeholder?: string;
  readonly disabled: boolean;
  readonly size: "xs" | "sm";
  readonly onCommit: (value: string) => void;
}) {
  const t = useTranslations("dimensionValue");
  // draft = ข้อความระหว่างพิมพ์ (เช่น "-" หรือ "1.") ที่ยังไม่เป็นตัวเลขสมบูรณ์ — null = แสดงค่าจริง
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <Input
      size={size}
      type="text"
      inputMode={numeric ? "decimal" : undefined}
      maxLength={numeric ? undefined : TEXT_MAX}
      hideCounter
      aria-label={name}
      placeholder={placeholder ?? (numeric ? t("enterNumber") : t("enterText"))}
      disabled={disabled}
      value={draft ?? current}
      onBlur={() => setDraft(null)}
      onChange={(e) => {
        const text = e.target.value;
        if (!numeric) {
          onCommit(text);
          return;
        }
        if (!NUMBER_TYPING.test(text)) return;
        setDraft(text);
        if (text === "") onCommit("");
        else if (NUMBER_COMPLETE.test(text)) onCommit(text);
      }}
    />
  );
}

function BooleanInput({
  name,
  current,
  placeholder,
  disabled,
  size,
  onSelect,
}: {
  readonly name: string;
  readonly current: string;
  readonly placeholder?: string;
  readonly disabled: boolean;
  readonly size: "xs" | "sm";
  readonly onSelect: (value: string) => void;
}) {
  const t = useTranslations("dimensionValue");
  const common = useTranslations("common");
  return (
    <Select value={current} disabled={disabled} onValueChange={onSelect}>
      <SelectTrigger size={size} aria-label={name}>
        <SelectValue placeholder={placeholder ?? t("notSelected")} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>{t("notSelected")}</SelectItem>
        <SelectItem value="true">{common("yes")}</SelectItem>
        <SelectItem value="false">{common("no")}</SelectItem>
      </SelectContent>
    </Select>
  );
}

function DateInput({
  ymd,
  placeholder,
  disabled,
  size,
  onPick,
}: {
  readonly ymd: string;
  readonly placeholder?: string;
  readonly disabled: boolean;
  readonly size: "xs" | "sm";
  readonly onPick: (ymd: string) => void;
}) {
  const t = useTranslations("dimensionValue");
  // DatePicker ทำงานกับ ISO string — ส่งเที่ยงคืนตามเวลาเครื่องเข้าไป แล้วแปลงกลับด้วย getter ของเครื่อง
  // เพื่อไม่ให้วันเลื่อนข้าม timezone
  const local = ymd ? ymdToLocalDate(ymd) : undefined;
  return (
    <DatePicker
      size={size}
      value={local?.toISOString()}
      placeholder={placeholder ?? t("pickDate")}
      disabled={disabled}
      onValueChange={(iso) => onPick(iso ? localDateToYmd(new Date(iso)) : "")}
    />
  );
}

function LookupInput({
  dimension,
  value,
  onChange,
  disabled,
  size,
}: Required<Pick<DimensionValueInputProps, "disabled" | "size">> &
  Omit<DimensionValueInputProps, "disabled" | "size">) {
  const t = useTranslations("dimensionValue");
  const values = useGlDimensionValues();
  const current = value?.dimension_value_id ?? undefined;
  return (
    <Select
      value={current ?? NONE}
      disabled={disabled || values.isLoading}
      onValueChange={(id) => {
        if (id === NONE) {
          onChange(null);
          return;
        }
        onChange({
          dimension_id: dimension.id,
          dimension_value_id: id,
          dimension_code: dimension.code,
          dimension_name: dimension.name,
          value_code: values.data?.find((item) => item.id === id)?.code,
          data_type: "lookup",
        });
      }}
    >
      <SelectTrigger size={size} aria-label={dimension.name}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>{t("notSelected")}</SelectItem>
        {(values.data ?? [])
          .filter(
            (item) =>
              item.dimension_id === dimension.id &&
              (item.is_active || item.id === current),
          )
          .map((item) => (
            <SelectItem key={item.id} value={item.id}>
              {item.code} · {item.name}
            </SelectItem>
          ))}
      </SelectContent>
    </Select>
  );
}
