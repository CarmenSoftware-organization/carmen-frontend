import { useTranslations } from "use-intl";
import { Building, ClipboardList, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import EmptyComponent from "@/components/empty-component";
import { LocationTypeLabel } from "@/components/share/location-type-label";
import { NameWithSubtext } from "@/components/share/name-with-sub-text";
import { cn } from "@/lib/utils";
import { GRN_PO_STATUS_CONFIG } from "@/constant/goods-receive-note";
import { useProfile } from "@/hooks/use-profile";
import { formatDate } from "@/lib/date-utils";
import { formatCurrency } from "@/lib/currency-utils";
import type { PoForGrn } from "@/types/purchase-order";
import type { INVENTORY_TYPE } from "@/constant/location";
import { selectableDetailIds, usableLocations } from "./grn-po-usable";

interface GrnPoSelectListProps {
  readonly poList: readonly PoForGrn[];
  readonly isLoading: boolean;
  readonly selected: ReadonlySet<string>;
  readonly onChange: (next: Set<string>) => void;
}

/**
 * เลือกใบสั่งซื้อและรายการที่จะรับ — ติ๊กได้สองระดับ (ทั้งใบ / รายบรรทัด)
 *
 * ใช้ทั้งขั้นที่ 2 ของ wizard สร้างจากใบสั่งซื้อ และ dialog เพิ่มใบสั่งซื้อในฟอร์ม —
 * สองทางนั้นเลือกของชุดเดียวกัน จะให้หน้าตาคนละอย่างไม่ได้
 *
 * ยังเป็นลิสต์ซ้อนลิสต์ ไม่ใช่ DataGrid เพราะการติ๊กสองระดับที่หัวใบคุมลูกทั้งก้อน
 * ไม่ใช่สิ่งที่ตารางแบนทำได้ — ตารางต้องกางแถวย่อยซึ่งกลับไปเป็นของเดิมที่เพิ่ง
 * เลิกใช้ในตารางสินค้า
 */
export function GrnPoSelectList({
  poList,
  isLoading,
  selected,
  onChange,
}: GrnPoSelectListProps) {
  const t = useTranslations("procurement.goodsReceiveNote");
  const tfl = useTranslations("field");
  const { dateFormat } = useProfile();

  // ติ๊กได้เฉพาะรายการที่หลังบ้านอนุญาต — ทุกที่ที่นับ/กวาด ใช้ชุดนี้ชุดเดียว
  // ไม่ใช่ไล่เช็ค can_use ซ้ำในแต่ละที่แล้วหลุดไปจุดใดจุดหนึ่ง
  const allDetailIds = selectableDetailIds(poList);
  const selectableSet = new Set(allDetailIds);

  const toggleDetail = (id: string) => {
    if (!selectableSet.has(id)) return;
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  };

  const togglePo = (po: PoForGrn) => {
    const ids = po.po_detail
      .map((d) => d.id)
      .filter((id) => selectableSet.has(id));
    if (ids.length === 0) return;
    const next = new Set(selected);
    if (ids.every((id) => next.has(id))) ids.forEach((id) => next.delete(id));
    else ids.forEach((id) => next.add(id));
    onChange(next);
  };

  const isAllSelected =
    allDetailIds.length > 0 && allDetailIds.every((id) => selected.has(id));
  const isSomeSelected = !isAllSelected && selected.size > 0;

  const toggleAll = () =>
    onChange(isAllSelected ? new Set() : new Set(allDetailIds));

  const poChecked = (po: PoForGrn) => {
    const ids = po.po_detail
      .map((d) => d.id)
      .filter((id) => selectableSet.has(id));
    const count = ids.filter((id) => selected.has(id)).length;
    if (count === 0) return false;
    if (count === ids.length) return true;
    return "indeterminate" as const;
  };

  if (isLoading) {
    return (
      <div className="flex min-h-60 items-center justify-center">
        <Loader2 className="text-muted-foreground size-6 animate-spin" />
      </div>
    );
  }

  if (poList.length === 0) {
    return (
      <div className="rounded-lg border border-dashed py-12">
        <EmptyComponent
          icon={ClipboardList}
          title={t("noPo")}
          description={t("noPoDesc")}
        />
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border">
      <label className="hover:bg-muted/40 flex cursor-pointer items-center gap-2.5 border-b px-4 py-2.5 transition-colors">
        <Checkbox
          checked={
            isAllSelected || (isSomeSelected && "indeterminate") || false
          }
          onCheckedChange={toggleAll}
        />
        <span className="text-foreground text-xs font-medium">
          {tfl("selectAll")}
        </span>
        <span className="text-muted-foreground text-micro">
          {t("poCount", { count: poList.length })} · {allDetailIds.length}{" "}
          {tfl("items").toLowerCase()}
        </span>
        {selected.size > 0 && (
          <Badge
            variant="primary-light"
            size="xs"
            className="ml-auto tabular-nums"
          >
            {t("nSelected", { count: selected.size })}
          </Badge>
        )}
      </label>

      {/* คอลัมน์ตัวเลขกว้างตายตัวรวม ~24rem — จอแคบกว่านั้นชื่อสินค้า (flex-1)
          ถูกบีบเหลือ 0 จนหายทั้งคอลัมน์ จึงตั้งความกว้างขั้นต่ำแล้วให้เลื่อนแนวนอน
          แทน หัวคอลัมน์อยู่ในกล่องเดียวกันจึงเลื่อนไปพร้อมแถว */}
      <div className="overflow-x-auto">
        <div className="min-w-[34rem]">
          {/* หัวคอลัมน์ — ของเดิมมีแต่ตัวเลขเปล่า ๆ เดาไม่ออกว่าอันไหนจำนวน อันไหน
          ราคา อันไหนยอดรวม · ระยะซ้าย/ความกว้างตรงกับแถวรายการทุกช่อง */}
          <div className="text-muted-foreground bg-secondary flex items-center gap-2.5 border-b py-2 pr-4 pl-10 text-xs font-semibold tracking-wide uppercase">
            <span className="w-4 shrink-0" aria-hidden="true" />
            <span className="min-w-0 flex-1">{tfl("product")}</span>
            <span className="w-14 shrink-0 text-right">{tfl("quantity")}</span>
            <span className="w-10 shrink-0 text-center">{tfl("unit")}</span>
            <span className="w-20 shrink-0 text-right">{tfl("price")}</span>
            <span className="w-24 shrink-0 text-right">{tfl("amount")}</span>
          </div>

          <div className="max-h-[26rem] overflow-y-auto">
            {poList.map((po) => (
              <div key={po.id} className="border-b last:border-b-0">
                <label className="bg-muted/40 flex cursor-pointer items-center gap-2.5 px-4 py-2">
                  <Checkbox
                    checked={poChecked(po)}
                    disabled={
                      !po.po_detail.some((d) => selectableSet.has(d.id))
                    }
                    onCheckedChange={() => togglePo(po)}
                  />
                  <span className="text-foreground text-xs font-medium">
                    {po.po_no}
                  </span>
                  {po.grn_status && (
                    <Badge
                      size="xs"
                      className={GRN_PO_STATUS_CONFIG[po.grn_status]?.className}
                    >
                      {po.grn_status.toUpperCase().replaceAll("_", " ")}
                    </Badge>
                  )}
                  <span className="text-muted-foreground text-micro">
                    {formatDate(po.order_date, dateFormat)}
                  </span>
                  <span className="ml-auto text-xs font-semibold tabular-nums">
                    {formatCurrency(
                      po.po_detail.reduce((sum, d) => sum + d.net_amount, 0),
                    )}{" "}
                    <span className="text-muted-foreground font-normal">
                      {po.currency_code}
                    </span>
                  </span>
                </label>

                {po.po_detail.map((d) => {
                  const checked = selected.has(d.id);
                  const locations = usableLocations(po, d);
                  // ใช้ไม่ได้ = ยังเห็นอยู่ในรายการ แต่ติ๊กไม่ได้และทำให้จางลง —
                  // ซ่อนทิ้งแล้วผู้ใช้จะหาของที่รู้ว่าอยู่ใน PO ใบนี้ไม่เจอ
                  const usable = selectableSet.has(d.id);
                  return (
                    <div key={d.id}>
                      <label
                        className={cn(
                          "flex items-center gap-2.5 border-t py-2 pr-4 pl-10 transition-colors",
                          usable ? "cursor-pointer" : "opacity-50",
                          checked && "bg-primary/5",
                          usable && !checked && "hover:bg-muted/20",
                        )}
                      >
                        <Checkbox
                          checked={checked}
                          disabled={!usable}
                          onCheckedChange={() => toggleDetail(d.id)}
                        />
                        {/* ชื่อสินค้ากับชื่อไทยซ้อนกันสองบรรทัด แทนรหัสที่วางนำหน้าชื่อ —
                        รหัสเป็นตัวเลขล้วนที่ไม่มีใครอ่านตอนกวาดหาของ แต่กินที่หน้า
                        ชื่อจริงทุกแถว · ใช้คอมโพเนนต์เดียวกับที่ตารางสินค้าใช้ */}
                        <div className="min-w-0 flex-1 text-xs">
                          <NameWithSubtext
                            primary={d.product_name ?? ""}
                            secondary={d.product_local_name ?? ""}
                          />
                        </div>
                        <span className="w-14 shrink-0 text-right text-xs tabular-nums">
                          {d.order_qty}
                        </span>
                        <span className="text-muted-foreground text-micro w-10 shrink-0 text-center">
                          {d.order_unit_name}
                        </span>
                        <span className="w-20 shrink-0 text-right text-xs tabular-nums">
                          {formatCurrency(d.price)}
                        </span>
                        <span className="w-24 shrink-0 text-right text-xs font-semibold tabular-nums">
                          {formatCurrency(d.net_amount)}
                        </span>
                      </label>

                      {/* คลังที่ของจะเข้า — รายการหนึ่งกระจายได้หลายคลัง และแต่ละคลัง
                    จะกลายเป็นหนึ่งแถวในใบรับสินค้า ไม่โชว์ไว้ผู้ใช้จะไม่รู้ว่า
                    ติ๊กรายการเดียวแล้วได้กี่แถว · ประเภทคลังใช้ป้ายของกลาง
                    (ไอคอนไม่มีสี) ตัวเดียวกับที่หน้าอื่นใช้ */}
                      {locations.map((loc) => (
                        <div
                          key={loc.location_id}
                          className="text-muted-foreground flex items-center gap-2.5 border-t py-1.5 pr-4 pl-16"
                        >
                          {/* ไอคอนแทนคำว่า "คลัง" — Building คือไอคอนของ field.location
                          ทั้งแอป (ดูตารางไอคอนใน list-filter-menu) คลังที่นี่คือ
                          สถานที่เก็บของ ไม่ใช่หมุดบนแผนที่ */}
                          <Building
                            className="size-3.5 shrink-0"
                            aria-label={tfl("location")}
                          />
                          {/* รหัสคลังลงไปเป็นบรรทัดล่างของชื่อ ทรงเดียวกับชื่อสินค้า —
                          ขึ้นต้นแถวด้วยรหัสแล้วชื่อคลังของทุกแถวจะเยื้องไม่ตรงกัน
                          ทั้งที่ชื่อคือของที่คนกวาดตาหา */}
                          <div className="text-foreground min-w-0 flex-1 text-xs">
                            <NameWithSubtext
                              primary={loc.location_name ?? ""}
                              secondary={loc.location_code ?? ""}
                            />
                          </div>
                          <LocationTypeLabel
                            type={loc.location_type as INVENTORY_TYPE}
                            className="text-micro shrink-0"
                          />
                          {/* ไม่ตรึงความกว้างให้ไปเรียงกับคอลัมน์ของแถวรายการ — แถวคลัง
                          เป็นคนละชุดคอลัมน์ ตัวเลขที่ไปนั่งใต้หัว "จำนวนเงิน"
                          จะหลอกหนักกว่าไม่มีหัวเสียอีก · ติดป้ายกับหน่วยไว้กับ
                          ตัวเลขเองแทน อ่านจบในบรรทัดโดยไม่ต้องเงยไปดูหัวตาราง */}
                          <span className="shrink-0 text-xs tabular-nums">
                            <span className="text-micro-legal me-1 tracking-wide uppercase">
                              {tfl("received")}
                            </span>
                            {loc.remain_qty ?? loc.order_qty}{" "}
                            <span className="text-micro">
                              {d.order_unit_name}
                            </span>
                          </span>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
