import { useSearchParams } from "react-router";
import { useTranslations } from "use-intl";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PosImportHistory } from "./pos-import-history";
import type { PosBrand } from "./pos-sale-types";

const TABS = ["history", "outlets", "items"] as const;
type PosTab = (typeof TABS)[number];

function isPosTab(v: string | null): v is PosTab {
  return TABS.some((t) => t === v);
}

/**
 * แท็บงาน POS ใต้ฟอร์มตั้งค่า — ประวัติการนำเข้า / ผูกจุดขาย / ผูกรายการขาย
 *
 * แท็บปัจจุบันเก็บใน query `?tab=` (ค่าเริ่ม `history`) และคง query อื่นไว้
 * แท็บ `outlets` / `items` ยังเป็น placeholder — งานถัดไปมาแทน
 *
 * @param brand แบรนด์ POS ของหน้านี้
 * @returns React element ของแท็บงาน
 */
export function PosOperations({ brand }: { brand: PosBrand }) {
  const t = useTranslations("systemAdmin.interface.posSale.tabs");
  const [params, setParams] = useSearchParams();
  const raw = params.get("tab");
  const tab: PosTab = isPosTab(raw) ? raw : "history";

  const onTabChange = (next: string) => {
    setParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        p.set("tab", next);
        return p;
      },
      { replace: true },
    );
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
      <TabsContent value="outlets">{null}</TabsContent>
      <TabsContent value="items">{null}</TabsContent>
    </Tabs>
  );
}
