import { Fragment } from "react";
import { Link } from "react-router";
import { useTranslations } from "use-intl";
import { toast } from "sonner";
import { BookOpenText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { useProfile } from "@/hooks/use-profile";
import { formatDate } from "@/lib/date-utils";
import { cn } from "@/lib/utils";
import { useAmountFormatter } from "@/hooks/use-number-formatter";
import { PERMISSIONS } from "@/constant/permissions";
import type { GoodsReceiveNote } from "@/types/goods-receive-note";
import {
  useCreateGrnApInvoice,
  useGrnJournalVouchers,
  type GrnJvView,
} from "./use-grn-journal-vouchers";

/** ปุ่ม Create AP Invoice โชว์เมื่อ GRN พร้อม post และยังไม่มีใบที่ระบบสร้าง (ใบคนสร้างไม่นับ) */
function canCreateGrnApInvoice(grn: GoodsReceiveNote): boolean {
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
  const { dateFormat } = useProfile();
  const { jv, apInvoice, kind } = view;
  // ค่าตาม enum_jv_status ของ backend · ค่าที่ไม่รู้จักแสดงค่าดิบ
  const statusKey = `jvStatus.${jv.jv_status}`;
  const statusLabel = t.has(statusKey) ? t(statusKey) : jv.jv_status;
  const totalDebit = jv.lines.reduce((s, l) => s + l.debit, 0);
  const totalCredit = jv.lines.reduce((s, l) => s + l.credit, 0);

  // คอลัมน์คำอธิบายมีเฉพาะเมื่อมีบรรทัดไหนมีคำอธิบาย — ว่างทั้งคอลัมน์บนมือถือกินที่จนยอด
  // เครดิตล้นการ์ด · กล่องแคบ (< @lg) คำอธิบายลงไปอยู่ใต้ชื่อบัญชีแทนคอลัมน์ของตัวเอง
  const hasComment = jv.lines.some((l) => l.comment);
  // w-px = กว้างเท่าเนื้อหา บัญชีรับที่เหลือ — ไม่งั้นตาราง w-full แบ่งเท่า ๆ กัน เดบิต
  // ไปลอยกลางจอห่างจากเครดิตหลายร้อย px บนจอกว้าง · min-w ให้สองคอลัมน์ตรงกันทุกการ์ด
  const amountCell =
    "w-px min-w-24 py-1.5 ps-3 text-right whitespace-nowrap tabular-nums";

  return (
    <section className="border-border/60 bg-card @container rounded-xl border p-3 text-xs">
      <header className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1">
        <Link
          to={`/general-ledger/journal-voucher/${jv.id}`}
          className="text-primary text-sm font-semibold hover:underline"
        >
          {jv.jv_no ?? t("jvNoNumber")}
        </Link>
        <Badge variant="secondary" size="xs">
          {statusLabel}
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
        {/* ข้อความธรรมดา ไม่ใช่ลิงก์ — หน้า AP invoice ยังเป็น mock บน localStorage ·
            basis-full บนกล่องแคบ = ลงบรรทัดใหม่ทั้งก้อน ไม่หักกลางวลี */}
        <span className="text-muted-foreground basis-full @lg:ms-auto @lg:basis-auto">
          {t("jvApInvoice")}: {apInvoice.doc_no}
          {jv.jv_date ? ` · ${formatDate(jv.jv_date, dateFormat)}` : ""}
        </span>
      </header>
      <table className="w-full">
        <thead>
          <tr className="text-muted-foreground border-b text-left">
            <th className="py-1.5 font-medium">{t("jvAccount")}</th>
            {hasComment && (
              <th className="hidden py-1.5 ps-3 font-medium @lg:table-cell">
                {t("jvDescription")}
              </th>
            )}
            <th className={cn(amountCell, "font-medium")}>{t("jvDebit")}</th>
            <th className={cn(amountCell, "font-medium")}>{t("jvCredit")}</th>
          </tr>
        </thead>
        <tbody>
          {jv.lines.map((l) => (
            <Fragment key={l.id}>
              {/* กล่องแคบ: คำอธิบายเป็นแถวเต็มความกว้างใต้บรรทัด — ซ้อนใต้ชื่อบัญชีในคอลัมน์
                  ~130px แล้วข้อความไทยยาวหักเป็น 4–5 บรรทัด · เส้นคั่นย้ายไปอยู่ใต้แถวคำอธิบาย */}
              <tr
                className={cn(
                  "border-b align-top",
                  l.comment && "@max-lg:border-0",
                )}
              >
                <td className="py-1.5">
                  {/* รหัสกับชื่อแยกบรรทัด — ต่อกันด้วย " - " แล้วตัดบรรทัดกลางขีดบนมือถือ */}
                  <span className="block font-medium tabular-nums">
                    {l.account_code}
                  </span>
                  {l.account_name && (
                    <span className="text-muted-foreground block break-words">
                      {l.account_name}
                    </span>
                  )}
                </td>
                {hasComment && (
                  <td className="text-muted-foreground hidden py-1.5 ps-3 break-words @lg:table-cell">
                    {l.comment}
                  </td>
                )}
                <td className={amountCell}>
                  {l.debit ? formatAmount(l.debit) : ""}
                </td>
                <td className={amountCell}>
                  {l.credit ? formatAmount(l.credit) : ""}
                </td>
              </tr>
              {l.comment && (
                <tr className="border-b @lg:hidden">
                  <td
                    colSpan={3}
                    className="text-muted-foreground pb-1.5 break-words"
                  >
                    {l.comment}
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t font-semibold">
            <td className="py-1.5">{t("jvTotal")}</td>
            {hasComment && <td className="hidden @lg:table-cell" />}
            <td className={amountCell}>{formatAmount(totalDebit)}</td>
            <td className={amountCell}>{formatAmount(totalCredit)}</td>
          </tr>
        </tfoot>
      </table>
    </section>
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
    return <ErrorState message={t("jvLoadError")} />;
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
