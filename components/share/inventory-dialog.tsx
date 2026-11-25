import { memo } from "react";
import { useTranslations } from "use-intl";
import { BoxIcon, Package } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { NameWithSubtext } from "@/components/share/name-with-sub-text";
import { formatCurrency } from "@/lib/currency-utils";
import { cn } from "@/lib/utils";
import { useProductInventory } from "@/hooks/use-product-inventory";

interface InventoryDialogProps {
  readonly buCode?: string;
  readonly locationId?: string;
  readonly productId?: string;
  readonly productName?: string;
  readonly productLocalName?: string;
  readonly unitName?: string;
  readonly icon?: "box" | "package";
  readonly className?: string;
  readonly onOnHandClick?: () => void;
  readonly onOnOrderClick?: () => void;
  /**
   * วันที่ของเอกสาร (ใบจ่ายออก) — ยอดคงเหลือเป็นยอด ณ สิ้นวันนั้น และโชว์ "ตัดได้" ถ้าไม่เท่ายอดคงเหลือ
   * (เอกสารที่ลงวันที่หลังกว่านับของบางส่วนไว้แล้ว) ไม่ส่ง = ยอดทั้งงวดแบบเดิม
   */
  readonly atDate?: string;
}

function InventoryStat({
  label,
  value,
  unitName,
  onClick,
  alert,
  muted,
}: {
  readonly label: string;
  readonly value: number;
  readonly unitName?: string;
  readonly onClick?: () => void;
  readonly alert?: boolean;
  readonly muted?: boolean;
}) {
  let labelClass = "text-info-foreground text-sm";
  if (alert) labelClass = "text-destructive text-sm";
  else if (muted) labelClass = "text-muted-foreground text-sm";

  return (
    <div>
      {onClick ? (
        <button
          type="button"
          onClick={onClick}
          className={cn(
            "cursor-pointer text-sm underline underline-offset-2 focus-visible:outline-none",
            alert ? "text-destructive" : "text-primary",
          )}
        >
          {label}
        </button>
      ) : (
        <span className={labelClass}>{label}</span>
      )}
      <p
        className={cn(
          "text-sm font-semibold tabular-nums",
          alert && "text-destructive",
        )}
      >
        {value.toLocaleString()}
        {unitName && (
          <span className="text-muted-foreground font-normal"> {unitName}</span>
        )}
      </p>
    </div>
  );
}

export const InventoryDialog = memo(function InventoryDialog({
  buCode,
  locationId,
  productId,
  productName,
  productLocalName,
  unitName,
  icon = "box",
  className,
  onOnHandClick,
  onOnOrderClick,
  atDate,
}: InventoryDialogProps) {
  const t = useTranslations("procurement.purchaseRequest");

  const { data, refetch } = useProductInventory(
    buCode || undefined,
    locationId || undefined,
    productId || undefined,
    atDate || undefined,
  );

  const {
    on_hand_qty = 0,
    on_order_qty = 0,
    re_order_qty = 0,
    re_stock_qty = 0,
    last_price,
    available_qty,
    as_of_date,
  } = data ?? {};
  const showAvailable =
    available_qty !== undefined && available_qty !== on_hand_qty;
  const pct =
    re_stock_qty > 0
      ? Math.min(Math.round((on_hand_qty / re_stock_qty) * 1000) / 10, 100)
      : 0;
  const needsReorder = !!data && on_hand_qty < re_order_qty;
  let progressColor = "bg-success";
  if (needsReorder) progressColor = "bg-destructive";
  else if (on_hand_qty < re_stock_qty) progressColor = "bg-warning";

  const Icon = icon === "package" ? Package : BoxIcon;
  const hasProduct = !!productId;

  return (
    // เปิดด้วยการคลิก ไม่ใช่ hover — ในนี้มีปุ่มให้กดต่อ (คงเหลือ/กำลังสั่ง) ซึ่ง
    // hover bubble รับไม่ไหว (หลุดง่ายระหว่างเลื่อนเมาส์เข้าไป และใช้ไม่ได้บนจอสัมผัส)
    <Dialog
      onOpenChange={(open) => {
        if (open && buCode && locationId && productId) refetch();
      }}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <DialogTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label={t("inventoryInfo")}
              className={cn(
                needsReorder ? "text-destructive" : "text-muted-foreground",
                className,
              )}
            >
              <Icon className="size-3.5" />
            </Button>
          </DialogTrigger>
        </TooltipTrigger>
        <TooltipContent>{t("inventoryInfo")}</TooltipContent>
      </Tooltip>
      <DialogContent className={hasProduct ? "sm:max-w-lg" : "sm:max-w-sm"}>
        <DialogHeader>
          <DialogTitle>{t("inventoryInfo")}</DialogTitle>
          {/* ยอดพวกนี้เป็นของสินค้าตัวไหน — กล่องเปิดจากไอคอนเล็ก ๆ ในแถว พอเปิด
              ขึ้นมาเต็มจอแล้วไม่มีอะไรบอกว่ามาจากแถวไหน ยิ่งใบที่มีสิบกว่ารายการ */}
          {hasProduct && productName && (
            <NameWithSubtext
              primary={productName}
              secondary={productLocalName}
            />
          )}
          {hasProduct && as_of_date && (
            <p className="text-muted-foreground text-micro">
              {t("asOfDate", { date: as_of_date })}
            </p>
          )}
        </DialogHeader>
        {!hasProduct && (
          <p className="text-muted-foreground text-micro">
            {t("selectProductForInventory")}
          </p>
        )}
        {hasProduct && (
          <>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-4">
              <InventoryStat
                label={t("onHand")}
                value={on_hand_qty}
                unitName={unitName}
                onClick={onOnHandClick}
                alert={needsReorder}
              />
              <InventoryStat
                label={t("onOrder")}
                value={on_order_qty}
                unitName={unitName}
                onClick={onOnOrderClick}
              />
              <InventoryStat
                label={t("reorderPt")}
                value={re_order_qty}
                unitName={unitName}
                muted
              />
              <InventoryStat
                label={t("restock")}
                value={re_stock_qty}
                unitName={unitName}
                muted
              />
              {showAvailable && (
                <InventoryStat
                  label={t("availableToIssue")}
                  value={available_qty}
                  unitName={unitName}
                  alert
                />
              )}
            </div>
            {showAvailable && (
              <p className="text-muted-foreground text-micro">
                {t("availableToIssueHint")}
              </p>
            )}

            <Progress
              value={pct}
              className="mt-2 h-1"
              indicatorClassName={progressColor}
            />
            <div className="mt-1 flex items-center justify-between text-xs">
              {needsReorder ? (
                <span className="text-destructive font-semibold">
                  {t("needsReorder")}
                </span>
              ) : (
                <span />
              )}
              <span className="text-muted-foreground tabular-nums">
                {t("stockLevel", { pct: pct.toFixed(1) })}
              </span>
            </div>

            {/* ยังไม่เคยมีของเข้าคลังนี้ = ขีด ไม่ใช่ 0.00 ซึ่งอ่านได้ว่า "ของฟรี" */}
            <p className="text-muted-foreground mt-2 text-xs">
              {t("lastPrice")}{" "}
              <span className="text-foreground font-semibold tabular-nums">
                {last_price ? formatCurrency(last_price.cost_per_unit) : "—"}
              </span>
            </p>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
});
