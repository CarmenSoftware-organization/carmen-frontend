import { Link } from "react-router";
import { useLocale, useTranslations } from "use-intl";
import { AlertTriangle, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatLocalizedDate } from "@/lib/date-utils";
import { IA_STATUS_CONFIG } from "@/constant/inventory-adjustment";
import { GRN_STATUS_CONFIG } from "@/constant/goods-receive-note";
import { SR_STATUS_CONFIG } from "@/constant/store-requisition";
import type { StatusConfig } from "@/constant/status-config";
import type {
  StartCountingBlockerKey,
  StartCountingBlockers,
  StartCountingDocument,
} from "@/types/period-end";
import { buildDocumentPath } from "./pe-document-paths";

const BLOCKER_ORDER: readonly StartCountingBlockerKey[] = [
  "grn",
  "stock_in",
  "stock_out",
  "sr",
] as const;

const STATUS_CONFIGS: Record<StartCountingBlockerKey, StatusConfig> = {
  grn: GRN_STATUS_CONFIG,
  stock_in: IA_STATUS_CONFIG,
  stock_out: IA_STATUS_CONFIG,
  sr: SR_STATUS_CONFIG,
};

const DOCUMENT_KEY = {
  grn: "grn",
  stock_in: "si",
  stock_out: "so",
  sr: "sr",
} as const;

interface Props {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly blockers: StartCountingBlockers | null;
}

/**
 * Dialog บอกว่าเปิดรอบตรวจนับไม่ได้เพราะเอกสารใดค้างอยู่ พร้อมลิงก์ไปจัดการทีละใบ
 *
 * เจตนาคือให้ผู้ใช้ทำงานต่อได้ทันที ไม่ใช่แค่บอกว่าไม่ผ่าน — เดิม 400/422 ทุกตัวจบที่ toast
 * ประโยคเดียวว่า "ข้อมูลในฟอร์มยังไม่ถูกต้อง" ซึ่งบนหน้าที่ไม่มีฟอร์มเลยอ่านไม่รู้เรื่อง
 *
 * @param props - open/onOpenChange และรายการเอกสารที่บล็อก
 * @returns Dialog ที่ลิสต์เอกสารค้างแยกตามประเภท
 * @example
 * ```tsx
 * <PeStartBlockedDialog open={!!blockers} onOpenChange={() => setBlockers(null)} blockers={blockers} />
 * ```
 */
export function PeStartBlockedDialog({ open, onOpenChange, blockers }: Props) {
  const t = useTranslations("inventoryManagement.periodEnd");
  const tc = useTranslations("common");
  const locale = useLocale();

  const groups = BLOCKER_ORDER.map((key) => ({
    key,
    documents: blockers?.documents?.[key] ?? [],
  })).filter((g) => g.documents.length > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <AlertTriangle
              className="text-warning-ink size-4 shrink-0"
              aria-hidden="true"
            />
            {t("startBlockedTitle")}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {t("startBlockedDesc", { total: blockers?.total ?? 0 })}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[55vh] space-y-3 overflow-y-auto">
          {groups.map(({ key, documents }) => (
            <section key={key} className="space-y-1.5">
              <div className="flex items-center gap-2">
                <h3 className="text-foreground text-xs font-semibold">
                  {t(`blockerModules.${key}`)}
                </h3>
                <Badge size="xs" variant="destructive">
                  {documents.length}
                </Badge>
              </div>
              <ul className="border-border/60 divide-border/40 divide-y rounded-lg border">
                {documents.map((doc) => (
                  <BlockerRow
                    key={doc.id}
                    doc={doc}
                    blockerKey={key}
                    locale={locale}
                    onNavigate={() => onOpenChange(false)}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>

        <DialogFooter>
          <Button size="sm" onClick={() => onOpenChange(false)}>
            {tc("close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface BlockerRowProps {
  readonly doc: StartCountingDocument;
  readonly blockerKey: StartCountingBlockerKey;
  readonly locale: string;
  readonly onNavigate: () => void;
}

function BlockerRow({
  doc,
  blockerKey,
  locale,
  onNavigate,
}: BlockerRowProps) {
  const status = STATUS_CONFIGS[blockerKey][doc.status];

  return (
    <li className="flex items-center justify-between gap-3 px-3 py-2">
      <Link
        to={buildDocumentPath(DOCUMENT_KEY[blockerKey], doc.id)}
        onClick={onNavigate}
        className="text-primary flex min-w-0 items-center gap-1.5 text-micro hover:underline focus-visible:underline"
      >
        <FileText className="size-3 shrink-0" aria-hidden="true" />
        <span className="truncate">{doc.no}</span>
      </Link>
      <div className="flex shrink-0 items-center gap-2">
        {status && (
          <Badge size="xs" className={status.className}>
            {status.label}
          </Badge>
        )}
        <span className="text-muted-foreground text-micro tabular-nums">
          {formatLocalizedDate(doc.date, locale)}
        </span>
      </div>
    </li>
  );
}
