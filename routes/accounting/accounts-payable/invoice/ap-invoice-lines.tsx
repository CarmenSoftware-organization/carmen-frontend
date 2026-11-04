import { useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  SlidersHorizontal,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  FileCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import type { ApInvoiceLine } from "@/types/accounts-payable-mock";
import { ApDetailGrid } from "../shared/ap-detail-grid";
import { Money, ApStatusBadge } from "../shared/ap-ui";
import { addDecimal, multiplyDecimal } from "../shared/ap-decimal";

export function InvoiceLines({
  lines,
  editable,
  currency,
  rate,
  onChange,
  onConfigure,
  onMove,
  onRemove,
}: {
  lines: ApInvoiceLine[];
  editable: boolean;
  currency: string;
  rate: string;
  onChange: (index: number, patch: Partial<ApInvoiceLine>) => void;
  onConfigure: (index: number) => void;
  onMove: (index: number, direction: -1 | 1) => void;
  onRemove: (index: number) => void;
}) {
  const [matchingLineIndex, setMatchingLineIndex] = useState<number | null>(
    null,
  );
  const amount = (value: string, tone = "") => (
    <div className="grid gap-1 text-right">
      <Money value={value} currency={currency} className={tone} />
      {currency !== "THB" && (
        <Money
          value={multiplyDecimal(value, rate)}
          className="text-muted-foreground text-xs"
        />
      )}
    </div>
  );
  const field = (
    line: ApInvoiceLine,
    index: number,
    key: "description" | "unit" | "quantity" | "unit_price" | "discount",
  ) =>
    editable ? (
      <Input
        aria-label={`${key.replaceAll("_", " ")} line ${index + 1}`}
        className={
          key === "description"
            ? "min-w-48"
            : "min-w-20 text-right tabular-nums"
        }
        value={line[key]}
        onChange={(event) => {
          if (
            key === "description" ||
            key === "unit" ||
            /^\d*(\.\d*)?$/.test(event.target.value)
          )
            onChange(index, { [key]: event.target.value });
        }}
      />
    ) : (
      <span>{line[key]}</span>
    );
  return (
    <>
      <ApDetailGrid
      rows={lines}
      columns={[
        { id: "no", header: "#", cell: ({ row }) => row.index + 1 },
        {
          id: "description",
          header: "Description / Comment",
          cell: ({ row }) => (
            <div className="min-w-48 space-y-2">
              {field(row.original, row.index, "description")}
              <div className="text-muted-foreground text-xs">
                {row.original.department || "No department"} ·{" "}
                {row.original.account || "No account"}
              </div>
              <div className="text-muted-foreground text-xs">
                {row.original.dimension || "No dimensions"}
              </div>
            </div>
          ),
        },
        {
          id: "unit",
          header: "Unit",
          cell: ({ row }) => field(row.original, row.index, "unit"),
        },
        {
          id: "quantity",
          header: "Qty",
          cell: ({ row }) => field(row.original, row.index, "quantity"),
          meta: { cellClassName: "text-right" },
        },
        {
          id: "price",
          header: "Price / Unit",
          cell: ({ row }) =>
            editable
              ? field(row.original, row.index, "unit_price")
              : amount(row.original.unit_price),
          meta: { cellClassName: "text-right" },
        },
        {
          id: "subtotal",
          header: "Subtotal",
          cell: ({ row }) => amount(row.original.subtotal),
        },
        {
          id: "discount",
          header: "Discount",
          cell: ({ row }) =>
            editable
              ? field(row.original, row.index, "discount")
              : amount(
                  row.original.discount,
                  "text-rose-600 dark:text-rose-400",
                ),
        },
        {
          id: "net",
          header: "Net amount",
          cell: ({ row }) => amount(row.original.net_amount),
        },
        {
          id: "tax",
          header: "Tax",
          cell: ({ row }) => (
            <div className="space-y-1">
              {amount(
                row.original.vat_amount,
                "text-emerald-600 dark:text-emerald-400",
              )}
              <p className="text-muted-foreground text-right text-xs">
                VAT {row.original.vat_rate}% · WHT {row.original.wht_rate}%
              </p>
            </div>
          ),
        },
        {
          id: "total",
          header: "Total",
          cell: ({ row }) =>
            amount(
              addDecimal([row.original.net_amount, row.original.vat_amount]),
              "text-primary font-semibold",
            ),
        },
        {
          id: "match",
          header: "Match",
          cell: ({ row }) => (
            <button
              type="button"
              className="inline-flex cursor-pointer transition-opacity hover:opacity-80"
              onClick={() => setMatchingLineIndex(row.index)}
              title="Click to inspect 3-Way Matching (PO / GRN / Invoice)"
            >
              <ApStatusBadge value={row.original.match_status} />
            </button>
          ),
        },
        {
          id: "actions",
          header: "Action",
          cell: ({ row }) => (
            <div className="flex">
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label={`Line ${row.index + 1} details`}
                onClick={() => onConfigure(row.index)}
              >
                <SlidersHorizontal className="size-4" />
              </Button>
              {editable && (
                <>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label="Move line up"
                    disabled={row.index === 0}
                    onClick={() => onMove(row.index, -1)}
                  >
                    <ArrowUp className="size-4" />
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label="Move line down"
                    disabled={row.index === lines.length - 1}
                    onClick={() => onMove(row.index, 1)}
                  >
                    <ArrowDown className="size-4" />
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label="Delete line"
                    disabled={lines.length === 1}
                    onClick={() => onRemove(row.index)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </>
              )}
            </div>
          ),
        },
      ]}
    />
    {matchingLineIndex !== null && lines[matchingLineIndex] && (() => {
      const line = lines[matchingLineIndex];
      const poNo = line.po_no || "PO-2026-0812";
      const grnNo = line.grn_no || "GRN-2026-0815";
      const isVariance = line.match_status === "variance";
      const poQty = isVariance
        ? (Number(line.quantity) * 0.9).toFixed(2)
        : line.quantity;
      const poPrice = isVariance
        ? (Number(line.unit_price) * 0.95).toFixed(2)
        : line.unit_price;
      const grnQty = isVariance
        ? (Number(line.quantity) * 0.9).toFixed(2)
        : line.quantity;
      const billedQty = line.quantity;
      const billedPrice = line.unit_price;
      const qtyDiff = Number(billedQty) - Number(grnQty);
      const priceDiff = Number(billedPrice) - Number(poPrice);
      const hasToleranceIssue = Math.abs(qtyDiff) > 0.001 || Math.abs(priceDiff) > 0.001;

      return (
        <Dialog
          open={matchingLineIndex !== null}
          onOpenChange={(open) => !open && setMatchingLineIndex(null)}
        >
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileCheck className="size-5 text-primary" />
                3-Way Matching Verification (PO ↔ GRN ↔ AP Invoice)
              </DialogTitle>
              <DialogDescription>
                Line #{matchingLineIndex + 1}: {line.description || "Supply item"}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="grid gap-3 sm:grid-cols-3">
                {/* PO Card */}
                <div className="rounded-lg border bg-muted/20 p-3 text-xs space-y-1.5">
                  <div className="font-semibold text-sm flex items-center justify-between">
                    <span>1. Purchase Order</span>
                    <Badge variant="outline" className="text-micro-legal">{poNo}</Badge>
                  </div>
                  <div className="text-muted-foreground pt-1">Ordered Qty: <span className="font-medium text-foreground">{poQty} {line.unit}</span></div>
                  <div className="text-muted-foreground">PO Unit Price: <span className="font-medium text-foreground">{poPrice} {currency}</span></div>
                  <div className="text-muted-foreground">PO Total: <span className="font-semibold text-foreground">{(Number(poQty) * Number(poPrice)).toFixed(2)} {currency}</span></div>
                </div>

                {/* GRN Card */}
                <div className="rounded-lg border bg-muted/20 p-3 text-xs space-y-1.5">
                  <div className="font-semibold text-sm flex items-center justify-between">
                    <span>2. Goods Receipt</span>
                    <Badge variant="outline" className="text-micro-legal">{grnNo}</Badge>
                  </div>
                  <div className="text-muted-foreground pt-1">Received Qty: <span className="font-medium text-foreground">{grnQty} {line.unit}</span></div>
                  <div className="text-muted-foreground">Quality Check: <span className="font-medium text-emerald-600 dark:text-emerald-400">Accepted 100%</span></div>
                  <div className="text-muted-foreground">Store Location: <span className="font-medium text-foreground">Main Store</span></div>
                </div>

                {/* Invoice Card */}
                <div className="rounded-lg border bg-primary/5 border-primary/20 p-3 text-xs space-y-1.5">
                  <div className="font-semibold text-sm flex items-center justify-between">
                    <span>3. AP Invoice (Billed)</span>
                    <ApStatusBadge value={line.match_status} />
                  </div>
                  <div className="text-muted-foreground pt-1">Billed Qty: <span className="font-semibold text-foreground">{billedQty} {line.unit}</span></div>
                  <div className="text-muted-foreground">Billed Unit Price: <span className="font-semibold text-foreground">{billedPrice} {currency}</span></div>
                  <div className="text-muted-foreground">Billed Total: <span className="font-semibold text-primary">{line.subtotal} {currency}</span></div>
                </div>
              </div>

              {/* Variance Analysis Box */}
              {hasToleranceIssue ? (
                <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950 dark:bg-amber-950/20 dark:text-amber-200 dark:border-amber-800 space-y-2">
                  <div className="font-semibold flex items-center gap-1.5">
                    <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400 shrink-0" />
                    Tolerance Variance Detected (Exceeds 0.00% Tolerance Threshold)
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>Quantity Difference: <b className="tabular-nums">{qtyDiff > 0 ? `+${qtyDiff.toFixed(2)}` : qtyDiff.toFixed(2)} {line.unit}</b> (Billed vs GRN)</div>
                    <div>Price Difference: <b className="tabular-nums">{priceDiff > 0 ? `+${priceDiff.toFixed(2)}` : priceDiff.toFixed(2)} {currency}</b> (Billed vs PO)</div>
                  </div>
                  <p className="text-micro text-amber-800 dark:text-amber-300">
                    Policy requires GM approval or document adjustment before Submit.
                  </p>
                </div>
              ) : (
                <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-xs text-emerald-950 dark:bg-emerald-950/20 dark:text-emerald-200 dark:border-emerald-800 flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span><b>Perfect 3-Way Match:</b> PO, GRN, and Billed quantities and prices match exactly with zero variance.</span>
                </div>
              )}
            </div>

            <DialogFooter className="flex-col sm:flex-row gap-2">
              {editable && hasToleranceIssue && (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      onChange(matchingLineIndex, {
                        quantity: grnQty,
                        unit_price: poPrice,
                        match_status: "matched",
                      });
                      toast.success("Billed quantity and price synced to PO/GRN");
                      setMatchingLineIndex(null);
                    }}
                  >
                    Sync to PO/GRN
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      onChange(matchingLineIndex, {
                        match_status: "overridden",
                      });
                      toast.success("Variance acknowledged & overridden by authorized user");
                      setMatchingLineIndex(null);
                    }}
                  >
                    Acknowledge &amp; Override
                  </Button>
                </>
              )}
              {editable && !hasToleranceIssue && line.match_status !== "matched" && (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    onChange(matchingLineIndex, { match_status: "matched" });
                    toast.success("Line marked as 3-Way Matched");
                    setMatchingLineIndex(null);
                  }}
                >
                  Confirm Matched
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setMatchingLineIndex(null)}
              >
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      );
    })()}
    </>
  );
}
