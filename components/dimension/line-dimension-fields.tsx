import { useTranslations } from "use-intl";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useGlDimensions,
  useGlDimensionValues,
} from "@/hooks/use-gl-dimensions";
import type { DimensionRef } from "@/types/gl-dimension";

interface LineDimensionFieldsProps {
  readonly value: readonly DimensionRef[];
  readonly onChange: (next: DimensionRef[]) => void;
  readonly disabled?: boolean;
}

const NONE = "__none__";

/**
 * ช่องเลือก dimension ต่อบรรทัดเอกสาร — หนึ่ง Select ต่อหนึ่ง dimension (ค่าเดียว)
 * รูปแบบเดียวกับ `InvoiceDimensions` ของ AP invoice แต่ควบคุมผ่าน value/onChange
 */
export function LineDimensionFields({
  value,
  onChange,
  disabled = false,
}: LineDimensionFieldsProps) {
  const ui = useTranslations("accounting.accountsPayable.ui");
  const dimensions = useGlDimensions();
  const values = useGlDimensionValues();

  if (dimensions.isError || values.isError)
    return (
      <div role="alert" className="text-destructive text-xs">
        {ui("dimensionLoadError")}
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => {
            void dimensions.refetch();
            void values.refetch();
          }}
        >
          {ui("retry")}
        </Button>
      </div>
    );

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] gap-3">
      {(dimensions.data ?? [])
        .filter(
          (dimension) =>
            dimension.is_active ||
            value.some((item) => item.dimension_id === dimension.id),
        )
        .map((dimension) => {
          const current = value.find(
            (item) => item.dimension_id === dimension.id,
          )?.dimension_value_id;
          return (
            <Field key={dimension.id}>
              <FieldLabel className="text-muted-foreground text-xs">
                {dimension.name}
              </FieldLabel>
              <Select
                value={current ?? NONE}
                disabled={disabled || dimensions.isLoading || values.isLoading}
                onValueChange={(id) => {
                  const next = value.filter(
                    (item) => item.dimension_id !== dimension.id,
                  );
                  if (id !== NONE)
                    next.push({
                      dimension_id: dimension.id,
                      dimension_value_id: id,
                    });
                  onChange(next);
                }}
              >
                <SelectTrigger size="sm" aria-label={dimension.name}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>{ui("noDimension")}</SelectItem>
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
            </Field>
          );
        })}
    </div>
  );
}
