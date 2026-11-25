import { CELL_SUB_CLASS } from "@/components/ui/data-grid/cell-text";
import { useTranslations } from "use-intl";
import { useState } from "react";
import {
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Mail,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { CellAction } from "@/components/ui/cell-action";
import { DeleteDialog } from "@/components/ui/delete-dialog";
import { cn } from "@/lib/utils";
import { RfpSendEmailDialog } from "./rfp-send-email-dialog";
import { NameWithSubtext } from "@/components/share/name-with-sub-text";

const EMPTY = <span className={cn(CELL_SUB_CLASS, "italic")}>—</span>;

export function VendorNameCell({
  name,
  code,
}: {
  readonly name?: string | null;
  readonly code?: string | null;
}) {
  "use no memo";
  if (!name) return EMPTY;
  return <NameWithSubtext primary={name} secondary={code || undefined} />;
}

export function ContactValue({
  value,
  href,
}: {
  readonly value?: string | null;
  readonly href?: string;
}) {
  "use no memo";
  if (!value) return EMPTY;
  if (href)
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-foreground hover:text-primary block truncate text-xs transition-colors"
      >
        {value}
      </a>
    );
  return (
    <span className="text-foreground block truncate text-xs">{value}</span>
  );
}

export function EmailValue({ value }: { readonly value?: string | null }) {
  "use no memo";
  if (!value) return EMPTY;
  return (
    <a
      href={`mailto:${value}`}
      title={`Send email to ${value}`}
      aria-label={`Send email to ${value}`}
      className="text-primary/90 hover:text-primary group flex min-w-0 items-center gap-1.5 text-xs underline-offset-2 transition-colors hover:underline"
    >
      <span className="min-w-0 truncate">{value}</span>
    </a>
  );
}

export function SubmissionStatusBadge({
  hasSubmitted,
}: {
  readonly hasSubmitted: boolean;
}) {
  const t = useTranslations("vendorManagement.requestPriceList");
  return (
    <span
      className={cn(
        "text-micro-eyebrow inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold tracking-widest uppercase",
        hasSubmitted
          ? "bg-success/15 text-success-foreground"
          : "bg-muted text-muted-foreground",
      )}
    >
      {hasSubmitted ? (
        <CheckCircle2 className="size-2.5" />
      ) : (
        <span className="size-1.5 rounded-full bg-current opacity-70" />
      )}
      {hasSubmitted ? t("statusSubmitted") : t("statusPending")}
    </span>
  );
}

export function PricelistCell({
  pricelist,
}: {
  readonly pricelist: { id: string; no: string; name?: string } | null;
}) {
  "use no memo";
  const t = useTranslations("vendorManagement.requestPriceList");
  if (!pricelist) return EMPTY;
  return (
    <CellAction
      title={t("viewPricelist")}
      onClick={() =>
        window.open(
          `/vendor-management/price-list/${pricelist.id}`,
          "_blank",
          "noopener,noreferrer",
        )
      }
      className="truncate"
    >
      {pricelist.no}
    </CellAction>
  );
}

export function VendorActionsCell({
  urlToken,
  email,
  rfpId,
  vendorId,
  vendorName,
  contactPerson,
  rfpName,
  startDate,
  endDate,
  isDisabled,
  onRemove,
}: {
  readonly urlToken?: string;
  readonly email?: string | null;
  readonly rfpId?: string;
  readonly vendorId?: string;
  readonly vendorName: string;
  readonly contactPerson?: string | null;
  readonly rfpName: string;
  readonly startDate?: string | null;
  readonly endDate?: string | null;
  readonly isDisabled: boolean;
  readonly onRemove: () => void;
}) {
  "use no memo";
  const t = useTranslations("vendorManagement.requestPriceList");
  const td = useTranslations("delete");
  const [copied, setCopied] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [showEmail, setShowEmail] = useState(false);

  const vendorUrl = urlToken ? `${window.location.origin}/pl/${urlToken}` : "";

  const handleCopyUrl = () => {
    if (!vendorUrl) return;
    navigator.clipboard.writeText(vendorUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenUrl = () => {
    if (!urlToken) return;
    window.open(`/pl/${urlToken}`, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="flex items-center justify-end gap-0.5">
      {urlToken && (
        <>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={handleCopyUrl}
            title={t("vendors.copyUrl")}
            aria-label={t("vendors.copyUrl")}
            className="text-muted-foreground hover:text-foreground rounded-lg"
          >
            {copied ? <Check className="text-success-ink" /> : <Copy />}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={handleOpenUrl}
            title={t("vendors.openUrl")}
            aria-label={t("vendors.openUrl")}
            className="text-muted-foreground hover:text-foreground rounded-lg"
          >
            <ExternalLink />
          </Button>
        </>
      )}

      {/* ขึ้นทุกแถวและกดได้เสมอ — ที่อยู่ผู้รับกับลิงก์เติมให้เท่าที่มี ที่เหลือ
          ผู้ใช้พิมพ์เองในโปรแกรมอีเมลได้ */}
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        onClick={() => setShowEmail(true)}
        title={t("vendors.emailUrl")}
        aria-label={t("vendors.emailUrl")}
        className="text-muted-foreground hover:text-foreground rounded-lg"
      >
        <Mail />
      </Button>
      {!isDisabled && (
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={t("vendors.removeVendor")}
          onClick={() => setShowDelete(true)}
          className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg"
        >
          <Trash2 />
        </Button>
      )}

      {/* mount เฉพาะตอนเปิดจริง — dialog ยิง useEmailProfiles ทันทีที่ mount
          ไม่งั้นทุกแถวในตารางจะยิงตามจำนวนผู้ขายตั้งแต่เปิดหน้า */}
      {showEmail && (
        <RfpSendEmailDialog
          open={showEmail}
          onOpenChange={setShowEmail}
          rfpId={rfpId}
          vendorId={vendorId}
          vendorName={vendorName}
          vendorEmail={email}
          contactPerson={contactPerson}
          rfpName={rfpName}
          startDate={startDate}
          endDate={endDate}
          vendorUrl={vendorUrl}
        />
      )}

      <DeleteDialog
        open={showDelete}
        onOpenChange={setShowDelete}
        title={t("vendors.removeVendor")}
        description={td("confirmNamed", { name: vendorName })}
        onConfirm={() => {
          onRemove();
          setShowDelete(false);
        }}
      />
    </div>
  );
}
