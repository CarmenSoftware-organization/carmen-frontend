import { useState } from "react";
import { useTranslations } from "use-intl";
import { DimensionValueInput } from "@/components/dimension/dimension-value-input";
import { LineDimensionSourceChip } from "@/components/dimension/line-dimension-source-chip";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel, FieldPlainText } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDimensionValueFormatter } from "@/hooks/use-dimension-value-formatter";
import { useGlDimensionValues } from "@/hooks/use-gl-dimensions";
import { cn } from "@/lib/utils";
import type { LineDimensionAccount } from "@/lib/line-dimension-rules";
import type { DimensionMaster } from "@/types/accounting-master";
import type { DimensionRef } from "@/types/gl-dimension";

export interface LineDimensionStripProps {
  /** dimension ที่มองเห็นแล้ว (ผ่าน `visibleLineDimensions`) */
  dimensions: DimensionMaster[];
  value: DimensionRef[];
  onChange: (next: DimensionRef[]) => void;
  /** โหมดดู — ใช้ flag ของโหมดดู ห้ามใช้ `disabled` (disabled รวม isPending) */
  readOnly: boolean;
  disabled?: boolean;
  requiredIds?: ReadonlySet<string>;
  invalidIds?: ReadonlySet<string>;
  /** ส่งมาเมื่อมี — chip ที่มาของบัญชีแสดงเฉพาะ `isDevAppEnv()` */
  accounts?: LineDimensionAccount[];
  /** ใช้ใน aria-label เช่น เลขแถว */
  rowLabel: string;
  /** ข้อความสถานะ เช่น conflict / โหลดไม่สำเร็จ */
  message?: string;
}

interface LineDimensionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dimensions: DimensionMaster[];
  value: readonly DimensionRef[];
}

/**
 * dialog "All Dimensions" แบบดูอย่างเดียว — แสดงทุก dimension ของบรรทัดพร้อมชื่อค่าเต็ม
 */
export function LineDimensionDialog({
  open,
  onOpenChange,
  dimensions,
  value,
}: LineDimensionDialogProps) {
  const t = useTranslations("lineDimension");
  const tc = useTranslations("common");
  const valuesQuery = useGlDimensionValues();
  const formatDimensionValue = useDimensionValueFormatter();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("allDimensions")}</DialogTitle>
          <DialogDescription>{t("dialogDescription")}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          {dimensions.map((dimension) => {
            const ref = value.find(
              (item) => item.dimension_id === dimension.id,
            );
            const selectedValue = ref?.dimension_value_id;
            const options = (valuesQuery.data ?? []).filter(
              (v) =>
                v.dimension_id === dimension.id &&
                (v.is_active || v.id === selectedValue),
            );
            return (
              <Field key={dimension.id}>
                <FieldLabel>
                  {dimension.code} — {dimension.name}
                </FieldLabel>
                <FieldPlainText>
                  {selectedValue
                    ? (options.find((v) => v.id === selectedValue)?.name ??
                      ref?.value_code ??
                      "—")
                    : ref
                      ? formatDimensionValue(ref, dimension) || "—"
                      : "—"}
                </FieldPlainText>
              </Field>
            );
          })}
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            {tc("close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * แถบชิป dimension ต่อบรรทัดเอกสาร (หน้าตาเดียวกับ JV) — ใช้ร่วมกันทุกเอกสาร
 *
 * - โหมดแก้: lookup = Select ขนาด xs · ชนิดอื่น = `DimensionValueInput`
 * - โหมดดู (`readOnly`): ชิป outline กดแล้วเปิด dialog "All Dimensions"
 * - `requiredIds` ต่อ `*` หลัง code · `invalidIds` ใส่ `aria-invalid` + เส้น destructive
 *
 * เป็น presentational: ไม่ดึงกฎเอง ดึงเฉพาะค่าใน master ของ dimension (`useGlDimensionValues`)
 */
export function LineDimensionStrip({
  dimensions,
  value,
  onChange,
  readOnly,
  disabled = false,
  requiredIds,
  invalidIds,
  accounts,
  rowLabel,
  message,
}: LineDimensionStripProps) {
  const t = useTranslations("lineDimension");
  const valuesQuery = useGlDimensionValues();
  const formatDimensionValue = useDimensionValueFormatter();
  const [dialogOpen, setDialogOpen] = useState(false);

  const replace = (dimensionId: string, next: DimensionRef | null) =>
    onChange([
      ...value.filter((item) => item.dimension_id !== dimensionId),
      ...(next ? [next] : []),
    ]);

  const statusMessage =
    message ?? (valuesQuery.isError ? t("loadError") : undefined);

  return (
    <div className="flex flex-wrap items-center gap-1">
      {statusMessage && (
        <span className="text-destructive text-xs">{statusMessage}</span>
      )}
      {accounts?.map((account, index) => (
        <LineDimensionSourceChip
          key={`${account.movement}-${account.account_mapping_id ?? index}`}
          account={account}
        />
      ))}
      {dimensions.map((dimension) => {
        const ref = value.find((item) => item.dimension_id === dimension.id);
        const selectedValue = ref?.dimension_value_id ?? undefined;
        const isTyped =
          !!dimension.data_type && dimension.data_type !== "lookup";
        const isRequired = requiredIds?.has(dimension.id) ?? false;
        const isInvalid = invalidIds?.has(dimension.id) ?? false;
        const codeLabel = `${dimension.code}${isRequired ? "*" : ""}`;
        const invalidClass = isInvalid
          ? "border-destructive ring-destructive/30 ring-1"
          : undefined;
        const values = (valuesQuery.data ?? []).filter(
          (v) =>
            v.dimension_id === dimension.id &&
            (v.is_active || v.id === selectedValue),
        );
        const selected = values.find((v) => v.id === selectedValue);
        // ข้อความบนชิป: lookup = รหัสค่า · ชนิดอื่น = ค่าที่กรอกตามชนิด
        const chipText = !ref
          ? "—"
          : isTyped && !ref.dimension_value_id
            ? formatDimensionValue(ref, dimension) || "—"
            : (selected?.code ?? ref.value_code ?? "—");

        if (readOnly) {
          return (
            <Button
              key={dimension.id}
              type="button"
              variant="outline"
              size="xs"
              onClick={() => setDialogOpen(true)}
            >
              {codeLabel}: <span className="text-foreground">{chipText}</span>
            </Button>
          );
        }
        if (isTyped) {
          return (
            <div
              key={dimension.id}
              className={cn(
                "flex items-center gap-1",
                isInvalid &&
                  "border-destructive ring-destructive/30 rounded-md border ring-1",
              )}
              aria-invalid={isInvalid || undefined}
            >
              <span className="text-muted-foreground text-xs">
                {codeLabel}:
              </span>
              <DimensionValueInput
                dimension={dimension}
                size="xs"
                value={ref}
                disabled={disabled}
                onChange={(next) => replace(dimension.id, next)}
              />
            </div>
          );
        }
        return (
          <Select
            key={dimension.id}
            value={selectedValue ?? "none"}
            disabled={
              disabled ||
              valuesQuery.isPending ||
              valuesQuery.isError ||
              !values.length
            }
            onValueChange={(valueId) =>
              replace(
                dimension.id,
                valueId === "none"
                  ? null
                  : { dimension_id: dimension.id, dimension_value_id: valueId },
              )
            }
          >
            <SelectTrigger
              size="xs"
              aria-invalid={isInvalid || undefined}
              className={invalidClass}
              aria-label={t("lineDimensionLabel", {
                name: dimension.name,
                row: rowLabel,
              })}
            >
              <span className="text-muted-foreground">{codeLabel}:</span>
              <SelectValue>{selected?.code ?? "—"}</SelectValue>
            </SelectTrigger>
            <SelectContent position="popper">
              <SelectItem value="none">{t("clearLineDimension")}</SelectItem>
              {values.map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  {v.code === v.name ? v.code : `${v.code} — ${v.name}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      })}
      <LineDimensionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        dimensions={dimensions}
        value={value}
      />
    </div>
  );
}
