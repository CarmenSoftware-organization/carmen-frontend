import { Link } from "react-router";
import { useTranslations } from "use-intl";
import { toast } from "sonner";
import { BookOpenText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { ErrorState } from "@/components/ui/error-state";
import { Spinner } from "@/components/ui/spinner";
import { useCan } from "@/hooks/use-can";
import { useAmountFormatter } from "@/hooks/use-number-formatter";
import { PERMISSIONS } from "@/constant/permissions";
import type { GoodsReceiveNote } from "@/types/goods-receive-note";
import {
  useCreateGrnApInvoice,
  useGrnJournalVouchers,
  type GrnJvView,
} from "./use-grn-journal-vouchers";

/** ปุ่ม Create AP Invoice โชว์เมื่อ GRN พร้อม post และยังไม่มีใบที่ระบบสร้าง (ใบคนสร้างไม่นับ) */
export function canCreateGrnApInvoice(grn: GoodsReceiveNote): boolean {
  return (
    grn.doc_status === "committed" &&
    grn.post_type === "ap" &&
    grn.ap_auto_from_grn === true &&
    !(grn.ap_invoices ?? []).some((inv) => inv.doc_source === "grn_auto")
  );
}

function JvCard({ view }: { readonly view: GrnJvView }) {
  const t = useTranslations("procurement.goodsReceiveNote");
  const formatAmount = useAmountFormatter();
  const { jv, apInvoice, kind } = view;
  const totalDebit = jv.lines.reduce((s, l) => s + l.debit, 0);
  const totalCredit = jv.lines.reduce((s, l) => s + l.credit, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          <Link
            to={`/accounting/journal-voucher/${jv.id}`}
            className="text-primary hover:underline"
          >
            {jv.jv_no ?? t("jvNoNumber")}
          </Link>
          <Badge variant="secondary" size="xs">
            {jv.jv_status}
          </Badge>
          {kind === "voided" && (
            <Badge variant="destructive-outline" size="xs">
              {t("jvReversed")}
            </Badge>
          )}
          {kind === "reversal" && (
            <Badge variant="warning-outline" size="xs">
              {t("jvReversal")}
            </Badge>
          )}
        </CardTitle>
        <CardAction className="text-muted-foreground text-sm">
          {t("jvApInvoice")}:{" "}
          <Link
            to={`/accounting/accounts-payable/invoice/${apInvoice.id}`}
            className="text-primary hover:underline"
          >
            {apInvoice.doc_no}
          </Link>
          {jv.jv_date ? ` · ${jv.jv_date.slice(0, 10)}` : ""}
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted-foreground border-b text-left">
                <th className="py-2 pr-3 font-medium">{t("jvAccount")}</th>
                <th className="py-2 pr-3 font-medium">{t("jvDescription")}</th>
                <th className="py-2 pr-3 text-right font-medium">
                  {t("jvDebit")}
                </th>
                <th className="py-2 text-right font-medium">{t("jvCredit")}</th>
              </tr>
            </thead>
            <tbody>
              {jv.lines.map((l) => (
                <tr key={l.id} className="border-b last:border-0">
                  <td className="py-2 pr-3">
                    {[l.account_code, l.account_name]
                      .filter(Boolean)
                      .join(" - ")}
                  </td>
                  <td className="text-muted-foreground py-2 pr-3">
                    {l.comment}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">
                    {l.debit ? formatAmount(l.debit) : ""}
                  </td>
                  <td className="py-2 text-right tabular-nums">
                    {l.credit ? formatAmount(l.credit) : ""}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-semibold">
                <td className="py-2 pr-3" colSpan={2}>
                  {t("jvTotal")}
                </td>
                <td className="py-2 pr-3 text-right tabular-nums">
                  {formatAmount(totalDebit)}
                </td>
                <td className="py-2 text-right tabular-nums">
                  {formatAmount(totalCredit)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

/** แท็บ Journal Voucher ของใบรับสินค้า — อ่านอย่างเดียว */
export function GrnJournalTab({
  goodsReceiveNote,
}: {
  readonly goodsReceiveNote: GoodsReceiveNote;
}) {
  const t = useTranslations("procurement.goodsReceiveNote");
  const { can, canWrite } = useCan();
  const { active, reversed, isLoading, isError } =
    useGrnJournalVouchers(goodsReceiveNote);
  const createApInvoice = useCreateGrnApInvoice(goodsReceiveNote.id);

  const canCommit = can(PERMISSIONS.procurement.goods_received_note.commit);
  const showCreate = canCreateGrnApInvoice(goodsReceiveNote) && canCommit;

  const handleCreate = () =>
    createApInvoice.mutate(undefined, {
      onSuccess: () => toast.success(t("jvCreateSuccess")),
    });

  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Spinner />
      </div>
    );
  }

  if (isError && active.length === 0 && reversed.length === 0) {
    return (
      <ErrorState message={t("jvLoadError")} />
    );
  }

  if (active.length > 0 || reversed.length > 0) {
    return (
      <div className="space-y-3 pt-3">
        {active.map((v) => (
          <JvCard key={`${v.kind}-${v.jv.id}`} view={v} />
        ))}
        {showCreate && (
          <div className="flex justify-end">
            <Button
              type="button"
              size="sm"
              disabled={!canWrite || createApInvoice.isPending}
              onClick={handleCreate}
            >
              {t("jvCreateApInvoice")}
            </Button>
          </div>
        )}
        {reversed.length > 0 && (
          <>
            <h3 className="text-muted-foreground pt-2 text-sm font-semibold">
              {t("jvReversedSection")}
            </h3>
            {reversed.map((v) => (
              <JvCard key={`${v.kind}-${v.jv.id}`} view={v} />
            ))}
          </>
        )}
      </div>
    );
  }

  const isCommitted = goodsReceiveNote.doc_status === "committed";
  let description = t("jvEmptyNotCommitted");
  const linked = goodsReceiveNote.ap_invoices ?? [];
  if (isCommitted) {
    if (linked.length > 0) {
      description = t("jvEmptyInvoiceNoJv", {
        docNos: linked.map((inv) => inv.doc_no).join(", "),
      });
    } else {
      description =
        goodsReceiveNote.post_type === "ap"
          ? t("jvEmptyNoInvoice")
          : t("jvEmptyNotAp");
    }
  }

  return (
    <Empty className="py-10">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <BookOpenText aria-hidden="true" />
        </EmptyMedia>
        <EmptyTitle>{t("tabJournal")}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      {showCreate && (
        <EmptyContent>
          <Button
            type="button"
            size="sm"
            disabled={!canWrite || createApInvoice.isPending}
            onClick={handleCreate}
          >
            {t("jvCreateApInvoice")}
          </Button>
        </EmptyContent>
      )}
    </Empty>
  );
}
