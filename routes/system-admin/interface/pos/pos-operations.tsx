import { useTranslations } from "use-intl";
import { setURLParams, useURL } from "@/hooks/use-url";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PosImportHistory } from "./pos-import-history";
import { PosItemMapping } from "./pos-item-mapping";
import { PosOutletMapping } from "./pos-outlet-mapping";
import type { PosBrand } from "./pos-sale-types";

const TABS = ["history", "outlets", "items"] as const;
type PosTab = (typeof TABS)[number];

function isPosTab(v: string): v is PosTab {
  return TABS.some((t) => t === v);
}

/**
 * แท็บงาน POS ใต้ฟอร์มตั้งค่า — ประวัติการนำเข้า / ผูกจุดขาย / ผูกรายการขาย
 *
 * แท็บปัจจุบันเก็บใน query `?tab=` (ค่าเริ่ม `history`) และคง query อื่นไว้
 * ร้านที่เลือกของแท็บ `outlets` / `items` เก็บใน `?store=` (แชร์กัน) ส่วน page / perpage / search / sort
 * ล้างทุกครั้งที่สลับแท็บ — แต่ละแท็บมีจำนวนแถวต่างกัน กันค้างหน้าที่เกินช่วง
 *
 * @param brand แบรนด์ POS ของหน้านี้
 * @returns React element ของแท็บงาน
 */
export function PosOperations({ brand }: { brand: PosBrand }) {
  const t = useTranslations("systemAdmin.interface.posSale.tabs");
  const [raw] = useURL("tab");
  const tab: PosTab = isPosTab(raw) ? raw : "history";

  const onTabChange = (next: string) => {
    setURLParams({ tab: next, page: "", perpage: "", search: "", sort: "" });
  };

  return (
    <Tabs value={tab} onValueChange={onTabChange} className="mt-6">
      <TabsList>
        {TABS.map((k) => (
          <TabsTrigger key={k} value={k}>
            {t(k)}
          </TabsTrigger>
        ))}
      </TabsList>
      <TabsContent value="history">
        <PosImportHistory brand={brand} />
      </TabsContent>
      <TabsContent value="outlets">
        <PosOutletMapping brand={brand} />
      </TabsContent>
      <TabsContent value="items">
        <PosItemMapping brand={brand} />
      </TabsContent>
    </Tabs>
  );
}
