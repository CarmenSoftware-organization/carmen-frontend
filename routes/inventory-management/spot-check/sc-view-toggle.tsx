import { History, MapPin } from "lucide-react";
import { Link } from "react-router";
import { useTranslations } from "use-intl";
import { Button } from "@/components/ui/button";
import { SC_HISTORY_PATH, SC_LIST_PATH } from "./sc-paths";

export type ScViewMode = "locations" | "history";

/** แท็บเป็นลิงก์ — URL บอกมุมมองเอง แชร์/refresh/Back ของเบราว์เซอร์ได้ครบ */
export function ScViewToggle({ view }: { readonly view: ScViewMode }) {
  const t = useTranslations("inventoryManagement.spotCheck");
  const tabs = [
    {
      key: "locations",
      to: SC_LIST_PATH,
      icon: MapPin,
      label: t("viewLocations"),
    },
    {
      key: "history",
      to: SC_HISTORY_PATH,
      icon: History,
      label: t("viewHistory"),
    },
  ] as const;
  return (
    <nav className="border-border/40 bg-card inline-flex items-center gap-0.5 rounded-full border p-0.5">
      {tabs.map(({ key, to, icon: Icon, label }) => {
        const active = view === key;
        return (
          <Button
            key={key}
            asChild
            size="sm"
            variant={active ? "default" : "ghost"}
            className="text-micro h-7 rounded-full px-3 font-semibold tracking-wide"
          >
            <Link to={to} aria-current={active ? "page" : undefined}>
              <Icon className="size-3" aria-hidden="true" />
              {label}
            </Link>
          </Button>
        );
      })}
    </nav>
  );
}
