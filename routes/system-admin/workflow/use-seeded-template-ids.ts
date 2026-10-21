import { useMemo } from "react";
import { useLookupResource } from "@/hooks/use-lookup-resource";
import type { SeededTemplateIds } from "./wf-seeded-templates";

/** โหลดเทมเพลตระบบ `wf.*` (ช่องทางในแอป) เป็นแผนที่ code → id — ว่างระหว่างโหลดได้ */
export function useSeededTemplateIds(): SeededTemplateIds {
  const { items } = useLookupResource("notification_template", {
    search: "wf.",
    serverFilter: { type: "app" },
    perpage: 30,
  });
  return useMemo(() => {
    const map = new Map<string, string>();
    for (const it of items) {
      if (it.code?.startsWith("wf.")) map.set(it.code, it.id);
    }
    return map;
  }, [items]);
}
