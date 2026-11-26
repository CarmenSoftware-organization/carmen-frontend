import { useTranslations } from "use-intl";
import { NameWithSubtext } from "@/components/share/name-with-sub-text";
import { cn } from "@/lib/utils";
import type { PriceListTemplate } from "@/types/price-list-template";

type ProductRef = NonNullable<PriceListTemplate["products"]>[number];

interface PltItemGroupedViewProps {
  readonly products: readonly ProductRef[];
}

export function PltItemGroupedView({ products }: PltItemGroupedViewProps) {
  const t = useTranslations("vendorManagement.priceListTemplate");
  const tf = useTranslations("field");
  return (
    // คอลัมน์ข้อมูลกว้างเท่าเนื้อหา (w-px) ให้ MOQ/หน่วยอยู่ติดชื่อสินค้า หมายเหตุรับที่เหลือ —
    // เดิมทุกคอลัมน์แบ่งความกว้างกัน จอกว้างแล้ว MOQ ห่างชื่อสินค้าเกือบเต็มจอ
    // กล่องแคบ (< @3xl = ความกว้างขั้นต่ำของตารางแบบไม่ห่อ ~734px) ชื่อสินค้าห่อบรรทัดได้ ตารางจึงไม่ล้นกรอบ
    <div className="border-border/60 bg-card @container w-full overflow-x-auto rounded-xl border">
      <table className="text-foreground w-full border-collapse text-xs">
        <thead>
          <tr className="bg-muted/60 text-muted-foreground border-border/60 border-b">
            <Th className="w-px text-center">#</Th>
            <Th className="text-left @3xl:w-px @3xl:pr-10">{t("product")}</Th>
            <Th className="w-px text-right @3xl:pr-6">{t("moq")}</Th>
            <Th className="w-px text-left @3xl:pr-10">{t("unit")}</Th>
            <Th className="text-left @3xl:w-full">{tf("note")}</Th>
          </tr>
        </thead>
        <tbody>
          {products.map((product, gi) => {
            const tiers =
              product.moq && product.moq.length > 0
                ? [...product.moq].sort(
                    (a, b) => (Number(a.qty) || 0) - (Number(b.qty) || 0),
                  )
                : [
                    {
                      qty: 0,
                      unit_id: product.default_order.unit?.id ?? "",
                      unit_name: product.default_order.unit?.name ?? "",
                      note: "",
                    },
                  ];
            const orderUnitId = product.default_order.unit?.id;

            return tiers.map((tier, ti) => {
              const isFirst = ti === 0;
              const isLast = ti === tiers.length - 1;
              const tierClass = cn(
                "py-1 align-middle",
                isLast && "border-border/50 border-b",
              );
              const qty = Number(tier.qty) || 0;
              return (
                <tr key={`${product.id}-${ti}`}>
                  {isFirst && (
                    <>
                      <Td
                        rowSpan={tiers.length}
                        className="border-border/50 text-muted-foreground border-b text-center align-middle tabular-nums"
                      >
                        {gi + 1}
                      </Td>
                      <Td
                        rowSpan={tiers.length}
                        // NameWithSubtext เป็น truncate (nowrap) — กล่องแคบปลดให้ห่อบรรทัด ตารางจะได้ไม่ล้นกรอบ
                        className="border-border/50 border-b align-middle @3xl:pr-10 [&_p]:break-words [&_p]:whitespace-normal @3xl:[&_p]:whitespace-nowrap"
                      >
                        <NameWithSubtext
                          primary={product.product?.name ?? ""}
                          secondary={
                            product.product?.local_name ??
                            product.product?.code ??
                            undefined
                          }
                        />
                      </Td>
                    </>
                  )}
                  <Td
                    className={cn(
                      "text-right tabular-nums",
                      qty === 0 && "text-muted-foreground italic",
                      "@3xl:pr-6",
                      tierClass,
                    )}
                  >
                    {qty || "—"}
                  </Td>
                  <Td
                    className={cn(
                      "@3xl:pr-10 @3xl:whitespace-nowrap",
                      tierClass,
                    )}
                  >
                    <span className="flex flex-wrap items-center gap-x-1.5 @3xl:flex-nowrap">
                      {tier.unit_name || "—"}
                      {orderUnitId && tier.unit_id === orderUnitId && (
                        <span className="text-muted-foreground text-micro-legal">
                          · {tf("orderUnit")}
                        </span>
                      )}
                    </span>
                  </Td>
                  <Td className={cn("text-muted-foreground", tierClass)}>
                    {tier.note || "—"}
                  </Td>
                </tr>
              );
            });
          })}
        </tbody>
      </table>
    </div>
  );
}

function Th({
  className,
  children,
}: {
  readonly className?: string;
  readonly children: React.ReactNode;
}) {
  return (
    <th
      className={cn(
        "px-2 py-2 font-medium whitespace-nowrap @3xl:px-3",
        className,
      )}
    >
      {children}
    </th>
  );
}

function Td({
  className,
  rowSpan,
  children,
}: {
  readonly className?: string;
  readonly rowSpan?: number;
  readonly children: React.ReactNode;
}) {
  return (
    <td rowSpan={rowSpan} className={cn("px-2 py-2 @3xl:px-3", className)}>
      {children}
    </td>
  );
}
