import type { ReactNode } from "react";
import { useWatch, type UseFormReturn } from "react-hook-form";
import { useTranslations } from "use-intl";
import {
  Building2,
  CalendarDays,
  Coins,
  Package,
  Pencil,
  ShoppingBag,
  Truck,
  User,
  Workflow as WorkflowIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useLocation } from "@/hooks/use-location";
import { useEntitiesByIds } from "@/hooks/use-entities-by-ids";
import type { Location } from "@/types/location";
import { useWorkflowById } from "@/hooks/use-workflow";
import { useProfile } from "@/hooks/use-profile";
import { formatDate } from "@/lib/date-utils";
import { round2 } from "@/lib/currency-utils";
import { computeLineAmounts } from "@/lib/line-pricing";
import type {
  FromPriceListFormValues,
  FromPriceListSelectedItem,
} from "./from-price-list-form-schema";

type SummaryStep = 1 | 2;

interface StepSummaryProps {
  readonly form: UseFormReturn<FromPriceListFormValues>;
  readonly onEditStep: (step: SummaryStep) => void;
}

interface SectionProps {
  readonly icon: ReactNode;
  readonly title: string;
  readonly editLabel: string;
  readonly onEdit: () => void;
  readonly children: ReactNode;
}

function Section({ icon, title, editLabel, onEdit, children }: SectionProps) {
  return (
    <section className="border-border/60 bg-card overflow-hidden rounded-lg border">
      <header className="bg-muted/30 flex items-center justify-between border-b px-4 py-2">
        <div className="text-foreground flex items-center gap-2 text-sm font-semibold">
          <span className="text-muted-foreground" aria-hidden="true">
            {icon}
          </span>
          {title}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          onClick={onEdit}
          aria-label={editLabel}
        >
          <Pencil className="size-3" aria-hidden="true" />
          {editLabel}
        </Button>
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

function DataRow({
  label,
  children,
}: {
  readonly label: string;
  readonly children: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[8rem_1fr] items-baseline gap-2 py-1 text-sm">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="text-foreground">{children}</dd>
    </div>
  );
}

export function StepSummary({ form, onEditStep }: StepSummaryProps) {
  const t = useTranslations("procurement.purchaseOrder");
  const tc = useTranslations("common");
  const tfl = useTranslations("field");
  const { dateFormat, defaultBu } = useProfile();
  const departmentName = defaultBu?.department?.name ?? "";

  const values = useWatch({ control: form.control }) as FromPriceListFormValues;
  const items = (values.items ?? []) as FromPriceListSelectedItem[];

  const { data: workflow } = useWorkflowById(values.workflow_id ?? "");
  // ชื่อคลังเฉพาะที่ item ในใบนี้เลือก (ดึงตาม id)
  const { items: locations, isLoading: locLoading } =
    useEntitiesByIds<Location>({
      useListHook: useLocation,
      ids: items.map((i) => i.location_id ?? ""),
    });
  const locationMap = new Map(locations.map((l) => [l.id, l.name]));

  const totals = (() => {
    let subTotal = 0;
    let tax = 0;
    let grand = 0;
    for (const item of items) {
      // Inc VAT: ราคา × จำนวน รวม VAT แล้ว — Subtotal ใช้ net (ไม่มีส่วนลดใน wizard)
      // เพื่อให้ Subtotal + Tax = Total
      const line = computeLineAmounts({
        price: item.price,
        qty: Number(item.order_qty) || 0,
        discRate: 0,
        isDiscAdj: false,
        discAmt: 0,
        taxRate: item.tax_rate ?? 0,
        isTaxAdj: false,
        taxAmt: 0,
        isTaxIncluded: item.is_tax_included ?? false,
      });
      subTotal += line.netAmount;
      tax += line.taxAmount;
      grand += line.totalPrice;
    }
    return {
      subTotal: round2(subTotal),
      tax: round2(tax),
      grand: round2(grand),
    };
  })();

  return (
    <div className="space-y-4">
      {/* Section 1 — Order Details */}
      <Section
        icon={<ShoppingBag className="size-4" />}
        title={t("summaryOrderDetails")}
        editLabel={tc("edit")}
        onEdit={() => onEditStep(1)}
      >
        <dl>
          <DataRow label={tfl("orderDate")}>
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays
                className="text-muted-foreground size-3.5"
                aria-hidden="true"
              />
              {values.order_date
                ? formatDate(values.order_date, dateFormat)
                : "—"}
            </span>
          </DataRow>
          <DataRow label={tfl("buyer")}>
            <span className="inline-flex items-center gap-1.5">
              <User
                className="text-muted-foreground size-3.5"
                aria-hidden="true"
              />
              {values.buyer_name || "—"}
            </span>
          </DataRow>
          <DataRow label={tfl("department")}>
            <span className="inline-flex items-center gap-1.5">
              <Building2
                className="text-muted-foreground size-3.5"
                aria-hidden="true"
              />
              {departmentName || "—"}
            </span>
          </DataRow>
          <DataRow label={tfl("workflow")}>
            <span className="inline-flex items-center gap-1.5">
              <WorkflowIcon
                className="text-muted-foreground size-3.5"
                aria-hidden="true"
              />
              {workflow?.name ?? "—"}
            </span>
          </DataRow>
          <DataRow label={tfl("deliveryDate")}>
            <span className="inline-flex items-center gap-1.5">
              <Truck
                className="text-muted-foreground size-3.5"
                aria-hidden="true"
              />
              {values.delivery_date
                ? formatDate(values.delivery_date, dateFormat)
                : "—"}
            </span>
          </DataRow>
        </dl>
      </Section>

      {/* Section 2 — Vendor */}
      <Section
        icon={<Truck className="size-4" />}
        title={t("summaryVendor")}
        editLabel={tc("edit")}
        onEdit={() => onEditStep(1)}
      >
        {values.vendor_id ? (
          <dl>
            <DataRow label={tfl("vendor")}>
              <span className="text-foreground font-semibold">
                {values.vendor_name}
              </span>
            </DataRow>
            {values.currency_code && (
              <DataRow label={tfl("currency")}>
                <span className="inline-flex items-center gap-1.5">
                  <Coins
                    className="text-muted-foreground size-3.5"
                    aria-hidden="true"
                  />
                  <span className="text-xs font-semibold">
                    {values.currency_code}
                  </span>
                </span>
              </DataRow>
            )}
          </dl>
        ) : (
          <p className="text-muted-foreground text-sm">
            {t("noVendorSelected")}
          </p>
        )}
      </Section>

      {/* Section 3 — Items */}
      <Section
        icon={<Package className="size-4" />}
        title={`${t("summaryItems")} (${items.length})`}
        editLabel={tc("edit")}
        onEdit={() => onEditStep(2)}
      >
        {items.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            {t("noProductsSelected")}
          </p>
        ) : (
          <div className="space-y-3">
            {/* แถวละสินค้า = แถวละคลัง ตั้งแต่ step เลือกสินค้าเป็นตาราง — ของเดิม
                เป็นการ์ดต่อสินค้าที่ซ้อนตารางคลังไว้ข้างใน เพราะสินค้าหนึ่งตัวมีได้
                หลายคลัง ตอนนี้เหลือคลังเดียวต่อแถว การ์ดซ้อนตารางจึงเป็นชั้นที่ไม่มี
                อะไรให้ซ้อนแล้ว */}
            <div className="overflow-hidden rounded-md border">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-muted-foreground bg-muted/20 border-b">
                    <th
                      scope="col"
                      className="text-micro-legal w-32 px-3 py-1.5 text-left font-semibold tracking-wide uppercase"
                    >
                      {t("priceListNo")}
                    </th>
                    <th
                      scope="col"
                      className="text-micro-legal px-3 py-1.5 text-left font-semibold tracking-wide uppercase"
                    >
                      {tfl("product")}
                    </th>
                    <th
                      scope="col"
                      className="text-micro-legal px-3 py-1.5 text-left font-semibold tracking-wide uppercase"
                    >
                      {tfl("location")}
                    </th>
                    <th
                      scope="col"
                      className="text-micro-legal w-24 px-3 py-1.5 text-right font-semibold tracking-wide uppercase"
                    >
                      {tfl("qty")}
                    </th>
                    <th
                      scope="col"
                      className="text-micro-legal w-32 px-3 py-1.5 text-right font-semibold tracking-wide uppercase"
                    >
                      {tfl("unitPrice")}
                    </th>
                    <th
                      scope="col"
                      className="text-micro-legal w-28 px-3 py-1.5 text-right font-semibold tracking-wide uppercase"
                    >
                      {tfl("total")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-border/40 divide-y">
                  {items.map((item, index) => {
                    const qty = Number(item.order_qty) || 0;
                    const lineTotal = computeLineAmounts({
                      price: item.price,
                      qty,
                      discRate: 0,
                      isDiscAdj: false,
                      discAmt: 0,
                      taxRate: item.tax_rate ?? 0,
                      isTaxAdj: false,
                      taxAmt: 0,
                      isTaxIncluded: item.is_tax_included ?? false,
                    }).totalPrice;
                    const locationId = item.location_id ?? "";
                    const locationName = locationId
                      ? (locationMap.get(locationId) ??
                        (item.location_name || "—"))
                      : "—";
                    return (
                      <tr key={item.pricelist_detail_id || `item-${index}`}>
                        <td className="text-muted-foreground px-3 py-1.5">
                          {item.pricelist_no || "—"}
                        </td>
                        <td className="px-3 py-1.5">
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground text-micro">
                              {item.product_code}
                            </span>
                            <span className="font-semibold">
                              {item.product_name}
                            </span>
                          </div>
                          {item.product_local_name && (
                            <p className="text-muted-foreground text-micro-legal">
                              {item.product_local_name}
                            </p>
                          )}
                        </td>
                        <td className="px-3 py-1.5">
                          {locLoading && locationId ? (
                            <Skeleton className="h-3 w-24" />
                          ) : (
                            locationName
                          )}
                        </td>
                        <td className="px-3 py-1.5 text-right tabular-nums">
                          {qty.toLocaleString()}{" "}
                          <span className="text-muted-foreground text-micro">
                            {item.order_unit_name || "—"}
                          </span>
                        </td>
                        <td className="px-3 py-1.5 text-right tabular-nums">
                          {item.price.toLocaleString()}{" "}
                          <span className="text-muted-foreground text-micro">
                            {values.currency_code || "—"}
                          </span>
                          {item.is_tax_included && (
                            <span className="text-muted-foreground text-micro-legal ml-1">
                              {tc("incVat")}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-1.5 text-right font-semibold tabular-nums">
                          {lineTotal.toLocaleString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Grand totals */}
            <div className="border-border/60 mt-2 rounded-md border border-dashed p-3">
              <dl className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">
                    {t("summarySubtotal")}
                  </dt>
                  <dd className="font-semibold tabular-nums">
                    {totals.subTotal.toLocaleString()}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">{t("summaryTax")}</dt>
                  <dd className="font-semibold tabular-nums">
                    {totals.tax.toLocaleString()}
                  </dd>
                </div>
                <div className="border-border/40 flex justify-between border-t pt-1.5 text-base">
                  <dt className="font-semibold">{t("summaryGrandTotal")}</dt>
                  <dd className="flex items-baseline gap-1.5 font-semibold tabular-nums">
                    {values.currency_code && (
                      <span className="text-muted-foreground text-xs">
                        {values.currency_code}
                      </span>
                    )}
                    {totals.grand.toLocaleString()}
                  </dd>
                </div>
              </dl>
              <p className="text-muted-foreground text-micro mt-2 inline-flex items-center gap-1">
                <Badge variant="secondary" size="xs">
                  {items.length} {tfl("products").toLowerCase()}
                </Badge>
                <span>·</span>
                <span>{values.vendor_name || "—"}</span>
              </p>
            </div>
          </div>
        )}
      </Section>
    </div>
  );
}
