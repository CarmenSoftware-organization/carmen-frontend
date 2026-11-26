import type { LucideIcon } from "lucide-react";
import { useTranslations } from "use-intl";
import { CheckSquare, FileEdit, ListChecks } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

interface PrSelectDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly allCount: number;
  readonly pendingCount: number;
  readonly onSelectAll: () => void;
  readonly onSelectPending: () => void;
}

interface ChoiceCardProps {
  readonly icon: LucideIcon;
  readonly iconClassName: string;
  readonly title: string;
  readonly count: number;
  readonly badgeVariant: "invert-light" | "primary-light";
  readonly description: string;
  readonly onClick: () => void;
}

function ChoiceCard({
  icon: Icon,
  iconClassName,
  title,
  count,
  badgeVariant,
  description,
  onClick,
}: ChoiceCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group hover:border-primary/40 bg-card focus-visible:ring-primary/40 flex cursor-pointer flex-col items-start gap-2 rounded-xl border p-3 text-left transition-colors duration-200 focus:outline-none focus-visible:ring-2"
    >
      <Icon className={`size-5 ${iconClassName}`} />
      <div className="space-y-0.5">
        <div className="flex items-center gap-2">
          <h3 className="text-foreground text-sm font-semibold">{title}</h3>
          <Badge variant={badgeVariant} size="xs" className="tabular-nums">
            {count}
          </Badge>
        </div>
        <p className="text-muted-foreground text-xs leading-relaxed">
          {description}
        </p>
      </div>
    </button>
  );
}

export function PrSelectDialog({
  open,
  onOpenChange,
  allCount,
  pendingCount,
  onSelectAll,
  onSelectPending,
}: PrSelectDialogProps) {
  const t = useTranslations("procurement.purchaseRequest");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden p-0 sm:max-w-2xl">
        <div className="space-y-5 p-6">
          <DialogHeader>
            <DialogTitle className="text-sm">
              {t("selectItemsTitle")}
            </DialogTitle>
            <DialogDescription className="mt-1">
              {t("selectItemsDesc")}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <ChoiceCard
              icon={ListChecks}
              iconClassName="text-foreground"
              title={t("selectAllItems")}
              count={allCount}
              badgeVariant="invert-light"
              description={t("selectAllDesc")}
              onClick={onSelectAll}
            />
            <ChoiceCard
              icon={CheckSquare}
              iconClassName="text-primary"
              title={t("selectPendingOnly")}
              count={pendingCount}
              badgeVariant="primary-light"
              description={t("selectPendingDesc")}
              onClick={onSelectPending}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface PrStatusSelectDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly draftCount: number;
  readonly inProgressCount: number;
  readonly onSelectDraft: () => void;
  readonly onSelectInProgress: () => void;
}

/**
 * Dialog ถามว่าจะติ๊กทั้งหน้าเป็นใบฉบับร่าง หรือใบที่กำลังดำเนินการ
 *
 * ใบสองกลุ่มนี้ทำงานคนละอย่าง (ลบ vs อนุมัติ) จึงเลือกพร้อมกันไม่ได้
 * ใช้ตอนกด checkbox หัวตารางในหน้ารายการ PR (tab my-pending)
 *
 * @param props - draftCount, inProgressCount, open, callbacks
 * @returns React element ของ dialog
 * @example
 * <PrStatusSelectDialog open={open} onOpenChange={setOpen}
 *   draftCount={3} inProgressCount={5}
 *   onSelectDraft={selectDrafts} onSelectInProgress={selectInProgress} />
 */
export function PrStatusSelectDialog({
  open,
  onOpenChange,
  draftCount,
  inProgressCount,
  onSelectDraft,
  onSelectInProgress,
}: PrStatusSelectDialogProps) {
  const t = useTranslations("procurement.purchaseRequest");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden p-0 sm:max-w-2xl">
        <div className="space-y-5 p-6">
          <DialogHeader>
            <DialogTitle className="text-sm">
              {t("selectStatusTitle")}
            </DialogTitle>
            <DialogDescription className="mt-1">
              {t("selectStatusDesc")}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <ChoiceCard
              icon={FileEdit}
              iconClassName="text-foreground"
              title={t("selectDraft")}
              count={draftCount}
              badgeVariant="invert-light"
              description={t("selectDraftDesc")}
              onClick={onSelectDraft}
            />
            <ChoiceCard
              icon={CheckSquare}
              iconClassName="text-primary"
              title={t("selectInProgress")}
              count={inProgressCount}
              badgeVariant="primary-light"
              description={t("selectInProgressDesc")}
              onClick={onSelectInProgress}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
