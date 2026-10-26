import { useTranslations } from "use-intl";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { setURLParams, useURL } from "@/hooks/use-url";
import { PosItemMapping } from "../shared/pos-item-mapping";
import { PosOutletMapping } from "../shared/pos-outlet-mapping";

type MappingTab = "outlets" | "items";

/**
 * Master mapping — Outlet → Location และ POS item → Recipe / Ignored
 * ค่าที่ตั้งที่นี่เป็นค่าเริ่มต้นของบรรทัดที่ยังไม่ post
 *
 * @returns React element ของมุมมอง Mapping
 */
export function ScMapping() {
  const t = useTranslations("operationPlan.salesConsumption.list.mapping");
  const [raw] = useURL("map");
  const tab: MappingTab = raw === "items" ? "items" : "outlets";

  return (
    <div className="space-y-3">
      <p className="text-muted-foreground text-sm">{t("hint")}</p>
      <Tabs
        value={tab}
        onValueChange={(v) => setURLParams({ map: v, page: "" })}
      >
        <TabsList>
          <TabsTrigger value="outlets">{t("outlets")}</TabsTrigger>
          <TabsTrigger value="items">{t("items")}</TabsTrigger>
        </TabsList>
      </Tabs>
      {tab === "outlets" ? <PosOutletMapping /> : <PosItemMapping />}
    </div>
  );
}
