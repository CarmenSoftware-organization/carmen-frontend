import { useState } from "react";
import { Link } from "react-router";
import { useTranslations } from "use-intl";
import { X } from "lucide-react";
import { LookupCombobox } from "@/components/lookup/lookup-combobox";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useGoodsReceiveNote,
  useGoodsReceiveNoteById,
} from "@/hooks/use-goods-receive-note";
import { useLookupPagination } from "@/hooks/use-lookup-pagination";
import { useAmountFormatter } from "@/hooks/use-number-formatter";
import { compareDecimal } from "../shared/ap-decimal";
import type { InvoiceFormLine } from "./ap-invoice-form";
import type { ApInvoiceLine } from "@/types/accounts-payable";
import type { GoodsReceiveNote } from "@/types/goods-receive-note";

const DECIMAL_RE = /^\d*(\.\d*)?$/;

export function InvoiceSourceEditor({
  line,
  savedLine,
  editable,
  vendorId,
  currencyId,
  onChange,
}: {
  readonly line: InvoiceFormLine;
  readonly savedLine?: ApInvoiceLine;
  readonly editable: boolean;
  readonly vendorId: string;
  readonly currencyId: string;
  readonly onChange: (patch: Partial<InvoiceFormLine>) => void;
}) {
  const t = useTranslations(
    "accounting.accountsPayable.invoice.detail.sources",
  );
  const money = useAmountFormatter();
  const [search, setSearch] = useState("");
  const [grnId, setGrnId] = useState("");
  const lookup = useLookupPagination<GoodsReceiveNote>({
    useListHook: useGoodsReceiveNote,
    search,
    enabled: editable && !!vendorId && !!currencyId,
    filter: (grn) =>
      grn.doc_status === "committed" &&
      (grn.currency?.id ?? grn.currency_id) === currencyId,
    serverFilter: `vendor_id|string:${vendorId},currency_id|string:${currencyId},doc_status|string:committed,post_type|string:ap`,
    resetDeps: [vendorId, currencyId],
  });
  const detail = useGoodsReceiveNoteById(
    editable ? grnId || undefined : undefined,
  );
  const sources = line.carry?.sources ?? [];
  const eligibleDetail =
    detail.data?.doc_status === "committed" &&
    detail.data.post_type === "ap" &&
    detail.data.vendor?.id === vendorId &&
    (detail.data.currency?.id ?? detail.data.currency_id) === currencyId;
  const candidates =
    (eligibleDetail ? detail.data?.good_received_note_detail : [])?.flatMap(
      (group) =>
        group.items.map((item, index) => ({
          id: item.id,
          label: `${detail.data!.grn_no} · ${group.product?.name ?? group.product_sku ?? group.sequence_no} · ${index + 1}`,
          received: item.received_qty,
          productId: group.product?.id,
          unit: item.received_unit?.name ?? "",
        })),
    ) ?? [];
  const changeSources = (
    next: NonNullable<NonNullable<InvoiceFormLine["carry"]>["sources"]>,
  ) => {
    const first = savedLine?.sources.find(
      (item) =>
        item.good_received_note_detail_item_id ===
        next[0]?.good_received_note_detail_item_id,
    );
    onChange({
      carry: { ...line.carry, sources: next },
      grn_no: next.length === 0 ? null : (first?.grn_no ?? line.grn_no),
      grn_id:
        next.length === 0
          ? null
          : (first?.good_received_note_id ?? line.grn_id),
    });
  };
  return (
    <section className="space-y-3 border-t pt-4">
      <h3 className="text-sm font-semibold">{t("title")}</h3>
      {editable && (
        <>
          <Field>
            <FieldLabel>{t("selectGrn")}</FieldLabel>
            <LookupCombobox
              value={grnId}
              onValueChange={setGrnId}
              items={lookup.items}
              getId={(grn) => grn.id}
              getLabel={(grn) => grn.grn_no}
              serverSideSearch
              onSearchChange={setSearch}
              onLoadMore={lookup.loadMore}
              hasMore={lookup.hasMore}
              isLoadingMore={lookup.isLoadingMore}
              isLoading={lookup.isLoading}
              placeholder={t("selectGrn")}
              searchPlaceholder={t("searchGrn")}
              emptyTitle={t("noGrn")}
              disabled={!vendorId || !currencyId}
            />
          </Field>
          {lookup.error && (
            <ErrorState
              error={lookup.error}
              onRetry={() => void lookup.refetch()}
            />
          )}
          {detail.isLoading && grnId && <Skeleton className="h-8" />}
          {detail.isError && (
            <ErrorState
              error={detail.error}
              onRetry={() => void detail.refetch()}
            />
          )}
          {grnId && detail.data && !eligibleDetail && (
            <p role="alert" className="text-destructive text-xs">
              {t("noGrn")}
            </p>
          )}
          {candidates
            .filter(
              (item) =>
                item.received > 0 &&
                (!line.product_id || line.product_id === item.productId) &&
                !sources.some(
                  (source) =>
                    source.good_received_note_detail_item_id === item.id,
                ),
            )
            .map((item) => (
              <div
                key={item.id}
                className="flex flex-wrap items-center gap-2 text-xs"
              >
                <span className="min-w-0 flex-1">
                  {item.label} · {money(item.received)} {item.unit}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    onChange({
                      grn_no: detail.data!.grn_no,
                      grn_id: grnId,
                      source_labels: {
                        ...line.source_labels,
                        [item.id]: item.label,
                      },
                      carry: {
                        ...line.carry,
                        sources: [
                          ...sources,
                          {
                            good_received_note_detail_item_id: item.id,
                            matched_qty: String(Math.min(1, item.received)),
                          },
                        ],
                      },
                    });
                  }}
                >
                  {t("add")}
                </Button>
              </div>
            ))}
          <p className="text-muted-foreground text-xs">{t("validationNote")}</p>
        </>
      )}
      {sources.length === 0 && (
        <p className="text-muted-foreground text-xs">{t("empty")}</p>
      )}
      {sources.map((source, index) => {
        const saved = savedLine?.sources.find(
          (item) =>
            item.good_received_note_detail_item_id ===
            source.good_received_note_detail_item_id,
        );
        const unchanged =
          saved &&
          compareDecimal(saved.matched_qty, source.matched_qty || "0") === 0;
        return (
          <div
            key={source.good_received_note_detail_item_id}
            className="space-y-2 border-b pb-3 text-xs last:border-0"
          >
            <div className="flex flex-wrap items-center gap-2">
              {saved ? (
                <Link
                  className="text-primary underline"
                  to={`/procurement/goods-receive-note/${saved.good_received_note_id}`}
                >
                  {saved.grn_no}
                </Link>
              ) : (
                <span>
                  {line.source_labels[
                    source.good_received_note_detail_item_id
                  ] || t("line", { number: index + 1 })}
                </span>
              )}
              {editable && (
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  aria-label={t("remove")}
                  onClick={() =>
                    changeSources(sources.filter((item) => item !== source))
                  }
                >
                  <X className="size-4" />
                </Button>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field>
                <FieldLabel>{t("quantity")}</FieldLabel>
                {editable ? (
                  <Input
                    inputMode="decimal"
                    value={source.matched_qty}
                    aria-label={t("quantity")}
                    aria-invalid={
                      compareDecimal(source.matched_qty || "0", "0") <= 0 ||
                      undefined
                    }
                    onChange={(event) => {
                      if (DECIMAL_RE.test(event.target.value))
                        changeSources(
                          sources.map((item) =>
                            item === source
                              ? { ...item, matched_qty: event.target.value }
                              : item,
                          ),
                        );
                    }}
                  />
                ) : (
                  <span className="tabular-nums">
                    {money(Number(source.matched_qty))}
                  </span>
                )}
              </Field>
              {[
                [t("unitPrice"), unchanged ? saved.grn_unit_price : null],
                [t("amount"), unchanged ? saved.matched_amount : null],
                [t("variance"), unchanged ? saved.variance_amount : null],
              ].map(([label, value]) => (
                <Field key={label}>
                  <FieldLabel>{label}</FieldLabel>
                  <span className="tabular-nums">
                    {value == null ? "—" : money(Number(value))}
                  </span>
                </Field>
              ))}
            </div>
          </div>
        );
      })}
    </section>
  );
}
