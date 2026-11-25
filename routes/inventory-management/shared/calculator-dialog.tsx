import { useEffect, useState } from "react";
import { Calculator, Plus, Minus, Trash2 } from "lucide-react";
import { useTranslations } from "use-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useProductAvailableUnits } from "@/hooks/use-product-units";
import { cn } from "@/lib/utils";

interface CalcRow {
  id: number;
  qty: number;
  unitId: string;
}

interface CalculatorDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly productId: string;
  readonly productName: string;
  readonly baseUnitName: string;
  readonly onConfirm: (total: number) => void;
}

let rowId = 0;

export function CalculatorDialog({
  open,
  onOpenChange,
  productId,
  productName,
  baseUnitName,
  onConfirm,
}: CalculatorDialogProps) {
  const t = useTranslations("inventoryManagement.entryDialogs");
  const tc = useTranslations("common");
  const { data: units = [] } = useProductAvailableUnits(
    open ? productId : undefined,
  );

  const [rows, setRows] = useState<CalcRow[]>([]);

  // Reset rows when dialog opens
  useEffect(() => {
    if (open) {
      rowId = 0;
      setRows([{ id: ++rowId, qty: 0, unitId: "" }]);
    }
  }, [open]);

  // Set default unit when units load
  useEffect(() => {
    if (units.length > 0 && rows.length > 0 && !rows[0].unitId) {
      const baseUnit = units.find(
        (u) => u.name.toLowerCase() === baseUnitName.toLowerCase(),
      );
      const defaultUnitId = baseUnit?.id ?? units[0].id;
      setRows((prev) =>
        prev.map((r) =>
          r.unitId === "" ? { ...r, unitId: defaultUnitId } : r,
        ),
      );
    }
  }, [units, rows, baseUnitName]);

  const unitMap = new Map<string, { name: string; conversion: number }>();
  for (const u of units)
    unitMap.set(u.id, { name: u.name, conversion: u.conversion });

  const addRow = () => {
    const baseUnit = units.find(
      (u) => u.name.toLowerCase() === baseUnitName.toLowerCase(),
    );
    setRows((prev) => [
      ...prev,
      { id: ++rowId, qty: 0, unitId: baseUnit?.id ?? units[0]?.id ?? "" },
    ]);
  };

  const removeRow = (id: number) => {
    setRows((prev) =>
      prev.length > 1 ? prev.filter((r) => r.id !== id) : prev,
    );
  };

  const updateQty = (id: number, value: number) => {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, qty: value } : r)),
    );
  };

  const updateUnit = (id: number, unitId: string) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, unitId } : r)));
  };

  const increment = (id: number) => {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, qty: r.qty + 1 } : r)),
    );
  };

  const decrement = (id: number) => {
    setRows((prev) =>
      prev.map((r) =>
        r.id === id ? { ...r, qty: Math.max(0, r.qty - 1) } : r,
      ),
    );
  };

  const total = rows.reduce((sum, r) => {
    const conv = unitMap.get(r.unitId)?.conversion ?? 1;
    return sum + r.qty * conv;
  }, 0);

  const handleConfirm = () => {
    onConfirm(total);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-hidden p-0 sm:max-w-md">
        <div className="p-5">
          <DialogHeader className="space-y-2">
            <div className="flex items-start gap-3">
              <div className="bg-muted text-primary flex size-9 shrink-0 items-center justify-center rounded-lg">
                <Calculator className="size-4.5" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1 space-y-0.5">
                <DialogTitle className="text-foreground text-sm leading-tight font-semibold tracking-tight">
                  {productName}
                </DialogTitle>
                <DialogDescription className="text-muted-foreground text-micro leading-relaxed">
                  {t("calculatorDesc")}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        {/* Body */}
        <div className="max-h-[50vh] space-y-2 overflow-y-auto px-5 py-3">
          {rows.map((row) => {
            const unitInfo = unitMap.get(row.unitId);
            const converted = row.qty * (unitInfo?.conversion ?? 1);
            const isBaseUnit =
              unitInfo?.name?.toLowerCase() === baseUnitName.toLowerCase();

            return (
              <div
                key={row.id}
                className="border-border/60 bg-card hover:border-primary/40 group relative space-y-1.5 rounded-xl border p-2 transition-colors"
              >
                <div className="flex items-center gap-1.5">
                  {/* Decrement */}
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => decrement(row.id)}
                    aria-label={t("decrease")}
                    disabled={row.qty <= 0}
                    className="hover:bg-primary/10 hover:text-primary text-muted-foreground size-8 shrink-0 rounded-full"
                  >
                    <Minus className="size-4" />
                  </Button>

                  {/* Qty input — large tabular */}
                  <div className="relative flex-1">
                    <Input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step="any"
                      value={row.qty || ""}
                      onChange={(e) =>
                        updateQty(
                          row.id,
                          Number.parseFloat(e.target.value) || 0,
                        )
                      }
                      placeholder="0"
                      className="border-border/40 focus-visible:border-primary bg-card h-9 rounded-lg border text-center text-base font-semibold tabular-nums shadow-none focus-visible:ring-0"
                    />
                  </div>

                  {/* Increment */}
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => increment(row.id)}
                    aria-label={t("increase")}
                    className="hover:bg-primary/10 hover:text-primary text-muted-foreground size-8 shrink-0 rounded-full"
                  >
                    <Plus className="size-4" />
                  </Button>

                  {/* Unit select */}
                  <Select
                    value={row.unitId}
                    onValueChange={(v) => updateUnit(row.id, v)}
                  >
                    <SelectTrigger
                      className={cn(
                        "border-border/40 bg-card text-micro h-8 w-20 shrink-0 rounded-md font-semibold tracking-wide shadow-none",
                        isBaseUnit &&
                          "border-primary/50 bg-primary/10 text-primary",
                      )}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {units.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Remove */}
                  {rows.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => removeRow(row.id)}
                      aria-label={t("removeRow")}
                      className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0 rounded-full opacity-0 transition-opacity group-hover:opacity-100"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  )}
                </div>

                {/* Conversion preview */}
                {!isBaseUnit && row.qty > 0 && (
                  <div className="text-muted-foreground border-border/40 text-micro-legal flex items-center justify-end border-t pt-1.5 pr-1 tabular-nums">
                    {t("convertedTo", {
                      value: converted.toFixed(2),
                      unit: baseUnitName,
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {/* Add row */}
          <button
            type="button"
            onClick={addRow}
            className="border-primary/40 hover:border-primary hover:bg-primary/5 text-primary text-micro flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed py-2 font-semibold tracking-wide uppercase transition-all"
          >
            <Plus className="size-3.5" />
            {t("addAnotherUnit")}
          </button>
        </div>

        {/* Total */}
        <div className="px-5 pb-3">
          <div className="bg-primary text-primary-foreground flex items-center justify-between gap-3 rounded-lg p-3">
            <div className="text-primary-foreground/75 text-micro-eyebrow font-semibold tracking-widest uppercase">
              {t("calcTotal")}
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl leading-none font-semibold tracking-tight tabular-nums">
                {total.toFixed(2)}
              </span>
              <span className="text-primary-foreground/75 text-xs font-semibold">
                {baseUnitName}
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="border-border/40 bg-card/40 flex-row gap-2 border-t px-5 py-3 backdrop-blur-sm sm:gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            {tc("cancel")}
          </Button>
          <Button size="sm" onClick={handleConfirm} disabled={total <= 0}>
            {t("useThisTotal")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
