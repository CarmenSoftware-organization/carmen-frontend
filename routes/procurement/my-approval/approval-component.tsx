import { useState } from "react";
import { useTranslations } from "use-intl";
import {
  ClipboardList,
  FileText,
  ShoppingCart,
  PackageOpen,
  Undo2,
  type LucideIcon,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useApprovalPending, useApprovalPendingSummary } from "./use-approval";
import { useDataGridState } from "@/hooks/use-data-grid-state";
import { useProfile } from "@/hooks/use-profile";
import { ErrorState } from "@/components/ui/error-state";
import { ListPageShell } from "@/components/share/list-page-shell";
import type { ApprovalPendingSummary } from "@/types/approval";
import ApprovalQueueList from "./approve-queue-list";
import { cn } from "@/lib/utils";
import { useListFilters } from "@/hooks/use-list-filters";
import { ListToolbar } from "@/components/list-filter/list-toolbar";
import { SaveViewDialog } from "@/components/list-filter/save-view-dialog";
import { LIST_PAGE_KEYS } from "@/constant/list-page-keys";
import type { FilterFieldDef } from "@/types/list-filter";
import { SENDBACK_FILTER_CLAUSE } from "@/constant/last-action";

const APPROVAL_FILTER_FIELDS: FilterFieldDef[] = [
  {
    key: "filter",
    labelKey: "",
    control: "custom",
    hidden: true,
    toClause: () => "",
    render: () => null,
  },
];

export default function ApprovalComponent() {
  const t = useTranslations("procurement.approval");
  const tc = useTranslations("common");
  const { dateFormat } = useProfile();

  const SUMMARY_CARDS: {
    key: keyof ApprovalPendingSummary;
    label: string;
    icon: LucideIcon;
    // class เต็มเป็น string คงที่ — Tailwind สแกนเจอเฉพาะ class ที่เขียนครบในซอร์ส
    // เดิมประกอบเป็น `bg-${color}/10` ทำให้ PR / SR ไม่มีสีเลย
    iconClassName: string;
  }[] = [
    {
      key: "total",
      label: t("totalPending"),
      icon: ClipboardList,
      iconClassName: "bg-primary/10 text-primary",
    },
    {
      key: "pr",
      label: t("purchaseRequest"),
      icon: FileText,
      iconClassName: "bg-info/10 text-info-ink",
    },
    {
      key: "po",
      label: t("purchaseOrder"),
      icon: ShoppingCart,
      iconClassName: "bg-warning/10 text-warning-ink",
    },
    {
      key: "sr",
      label: t("storeRequisition"),
      icon: PackageOpen,
      iconClassName: "bg-success/10 text-success-ink",
    },
  ];

  const { params, search, setSearch, filter, setFilter, tableConfig } =
    useDataGridState({
      defaultPerpage: 10,
      // ตรงกับ MY_PENDING_DEFAULT_SORT ของ backend (เอกสารที่รอนานสุดขึ้นก่อน)
      // ประกาศไว้ฝั่งนี้ด้วยเพื่อให้หัวคอลัมน์โชว์ลูกศรตั้งแต่เปิดหน้า และการคลิก
      // สลับ asc↔desc ได้ตลอด ไม่ตกไปอยู่สถานะ "ไม่เรียง" ที่มองไม่ออกว่าต่างกัน
      defaultSort: "doc_date:asc",
    });

  // filter ประกอบจากสองส่วนที่เลือกได้อิสระต่อกัน — ประเภทเอกสาร กับ "เฉพาะใบที่ถูก
  // ตีกลับ" · backend รวม clause ที่คั่นด้วย ";" เป็น AND
  const activeType = filter?.match(/doc_type:(\w+)/)?.[1] ?? "total";
  const sendBackOnly = !!filter?.includes(SENDBACK_FILTER_CLAUSE);

  const applyFilter = (type: string, sendBack: boolean) => {
    setFilter(
      [
        type === "total" ? "" : `doc_type:${type}`,
        sendBack ? SENDBACK_FILTER_CLAUSE : "",
      ]
        .filter(Boolean)
        .join(";"),
    );
  };

  const handleCardClick = (key: keyof ApprovalPendingSummary) => {
    applyFilter(key, sendBackOnly);
  };

  const [saveViewDialogOpen, setSaveViewDialogOpen] = useState(false);

  const lf = useListFilters({
    pageKey: LIST_PAGE_KEYS.APPROVAL,
    fields: APPROVAL_FILTER_FIELDS,
  });

  const { data, isLoading, error, refetch } = useApprovalPending(params);
  const { data: summary, isLoading: summaryLoading } =
    useApprovalPendingSummary();
  // endpoint สรุปนับแค่ตามประเภท — จำนวนใบที่ถูกตีกลับจึงอ่านจาก paginate.total
  // ของรายการที่กรองแล้ว (perpage 1 พอ ไม่ได้ใช้แถว) · อยู่ใต้ query key เดียวกับ
  // รายการ จึงถูก invalidate พร้อมกันเมื่ออนุมัติหรือตีกลับ
  const { data: sendBackData } = useApprovalPending({
    page: 1,
    perpage: 1,
    filter: SENDBACK_FILTER_CLAUSE,
  });
  const sendBackCount = sendBackData?.paginate.total ?? 0;

  const items = data?.data ?? [];
  // จำนวนจริงของรายการที่เข้าเงื่อนไข มาจาก backend ที่กรองและแบ่งหน้าให้แล้ว
  // เดิมต้องเดาจากการ์ดสรุปหรือ items.length เพราะรายการไม่ได้ถูกแบ่งหน้าจริง
  const totalRecords = data?.paginate.total ?? 0;

  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;

  return (
    <ListPageShell
      title={t("title")}
      description={t("desc")}
      toolbar={
        <ListToolbar
          search={search}
          // ค้นหาและ filter ประเภทเอกสารทำที่ SQL ทั้งคู่ จึงใช้ร่วมกันได้ตรง ๆ
          // เดิมต้องล้าง filter ทิ้งตอนค้น เพราะทั้งสองทำฝั่ง client บนข้อมูลหน้าแรก
          onSearch={setSearch}
          lf={lf}
          fields={APPROVAL_FILTER_FIELDS}
          onSaveViewClick={() => setSaveViewDialogOpen(true)}
        />
      }
    >
      {/* แถบกรองตามประเภท — ตัวเลขคือจำนวนที่รอ คลิกเพื่อกรองตาราง */}
      <div className="flex flex-wrap gap-2" role="group">
        {SUMMARY_CARDS.map((card) => {
          const Icon = card.icon;
          if (summaryLoading) {
            return <Skeleton key={card.key} className="h-9 w-40 rounded-md" />;
          }
          const active = activeType === card.key;
          return (
            <button
              type="button"
              key={card.key}
              className={cn(
                "bg-card flex h-9 cursor-pointer items-center gap-2 rounded-md border pr-3 pl-1.5 text-left transition-colors",
                active
                  ? "border-primary ring-primary ring-1"
                  : "hover:bg-accent",
              )}
              onClick={() => handleCardClick(card.key)}
              aria-pressed={active}
            >
              <span
                className={cn(
                  "flex size-6 items-center justify-center rounded",
                  card.iconClassName,
                )}
              >
                <Icon className="size-3.5" />
              </span>
              <span
                className={cn(
                  "text-xs",
                  active ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {card.label}
              </span>
              <span className="text-sm font-semibold tabular-nums">
                {summary?.[card.key] ?? 0}
              </span>
            </button>
          );
        })}

        <span aria-hidden className="bg-border mx-1 h-6 w-px self-center" />

        {/* ใบที่ถูกตีกลับมาหาฉัน — ใช้ร่วมกับตัวกรองประเภทได้ (เช่น PO ที่ถูกตีกลับ)
            ไฮไลต์ตัวเลขเมื่อมีค้าง เพราะเป็นงานที่ต้องรีบแก้ก่อนใบใหม่ */}
        <button
          type="button"
          className={cn(
            "bg-card flex h-9 cursor-pointer items-center gap-2 rounded-md border pr-3 pl-1.5 text-left transition-colors",
            sendBackOnly
              ? "border-primary ring-primary ring-1"
              : "hover:bg-accent",
          )}
          onClick={() => applyFilter(activeType, !sendBackOnly)}
          aria-pressed={sendBackOnly}
        >
          <span className="flex size-6 items-center justify-center rounded bg-[var(--status-review)]">
            <Undo2 className="size-3.5 text-[var(--status-review-fg)]" />
          </span>
          <span
            className={cn(
              "text-xs",
              sendBackOnly ? "text-foreground" : "text-muted-foreground",
            )}
          >
            {tc("sendBack")}
          </span>
          <span
            className={cn(
              "text-sm font-semibold tabular-nums",
              sendBackCount > 0 && "text-destructive",
            )}
          >
            {sendBackCount}
          </span>
        </button>
      </div>

      <ApprovalQueueList
        items={items}
        totalRecords={totalRecords}
        isLoading={isLoading}
        dateFormat={dateFormat}
        params={params}
        tableConfig={tableConfig}
      />

      <SaveViewDialog
        open={saveViewDialogOpen}
        onOpenChange={setSaveViewDialogOpen}
        canManageBu={lf.view.canManageBu}
        existingNames={lf.view.existingNames}
        onSave={lf.view.saveOrUpdate}
      />
    </ListPageShell>
  );
}
