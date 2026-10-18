import { Component, lazy, Suspense, useState } from "react";
import { BookOpen, ChevronDown } from "lucide-react";
import { useTranslations } from "use-intl";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ErrorState } from "@/components/ui/error-state";
import { SettingSection } from "@/components/ui/setting-section";
import { Skeleton } from "@/components/ui/skeleton";
import { PERMISSIONS } from "@/constant/permissions";
import { useCan } from "@/hooks/use-can";
import { useInterfaceEntitlement } from "@/hooks/use-interface-entitlement";
import { cn } from "@/lib/utils";
import {
  externalApiBaseUrl,
  externalApiRoot,
  useBuApiKey,
} from "./use-bu-api-key";

// Swagger UI (~1.5 MB) + openapi.json + CSS อยู่ใน chunk นี้ทั้งหมด — โหลดเมื่อกดเปิดเท่านั้น
const loadDocs = () => import("./external-api-docs");

/** กัน chunk เอกสารโหลดไม่ขึ้น (เช่น deploy ใหม่ระหว่างเปิดหน้า) ไม่ให้ลามไปทั้งหน้า config */
class DocsErrorBoundary extends Component<
  { readonly fallback: React.ReactNode; readonly children: React.ReactNode },
  { readonly failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/**
 * ส่วน "API documentation" ของหน้า Accounting → External — เอกสาร API ขาเข้า (Swagger UI)
 * พร้อมตัวอย่าง curl ที่เติม URL และ Client ID ของ BU ให้
 *
 * - เห็นได้เมื่อมีสิทธิ์ `system_admin.bu_api_key.view` และใบ INF ของ External อ่านได้
 *   (กติกาเดียวกับส่วน API Access) — ไม่ต้องมีกุญแจก่อน เป็นเอกสารอ่านอย่างเดียว
 * - ปิดไว้ก่อนเสมอ Swagger UI ถูก import แบบ lazy ตอนกดเปิดครั้งแรก
 * - ใช้ query กุญแจตัวเดียวกับ API Access (queryKey เดียวกัน ไม่ยิงซ้ำ) และไม่แตะ secret
 *
 * @returns React element ของ section หรือ null เมื่อไม่มีสิทธิ์ดู
 */
export function ExternalApiDocsSection() {
  const t = useTranslations("systemAdmin.interface.export.apiDocs");
  const { can } = useCan();
  const { canReadConfig } = useInterfaceEntitlement();
  const [open, setOpen] = useState(false);
  // lazy() จำ promise ที่ล้มไว้ — ลองใหม่ต้องสร้างตัวใหม่ (key ใหม่ล้าง boundary ด้วย)
  const [docs, setDocs] = useState(() => ({ Lazy: lazy(loadDocs), key: 0 }));
  const retry = () =>
    setDocs((d) => ({ Lazy: lazy(loadDocs), key: d.key + 1 }));

  const canView = can(PERMISSIONS.system_admin.bu_api_key.view);
  const readable = canReadConfig("export", "external");
  const query = useBuApiKey(canView && readable);

  if (!canView || !readable) return null;

  const root = externalApiRoot(externalApiBaseUrl(query.data));
  const clientId = query.data?.exists ? query.data.client_id : null;

  return (
    // wide + frameless: เอกสารยาวมาก ถ้าอยู่คอลัมน์ขวา 2/3 คอลัมน์ซ้ายจะว่างตลอดความยาว
    // และกล่องกระดาษของ Swagger มีกรอบของตัวเองอยู่แล้ว ห่อการ์ดอีกชั้น = การ์ดซ้อนการ์ด
    <Collapsible open={open} onOpenChange={setOpen} className="mt-8">
      <SettingSection
        title={t("title")}
        description={t("desc")}
        first
        wide
        frameless
        action={
          <CollapsibleTrigger asChild>
            <Button type="button" variant="outline" size="sm">
              <BookOpen aria-hidden="true" />
              {open ? t("hide") : t("show")}
              <ChevronDown
                aria-hidden="true"
                className={cn("transition-transform", open && "rotate-180")}
              />
            </Button>
          </CollapsibleTrigger>
        }
      >
        <CollapsibleContent>
          <DocsErrorBoundary
            key={docs.key}
            fallback={<ErrorState message={t("loadError")} onRetry={retry} />}
          >
            <Suspense fallback={<Skeleton className="h-64 w-full" />}>
              <docs.Lazy root={root} clientId={clientId} />
            </Suspense>
          </DocsErrorBoundary>
        </CollapsibleContent>
      </SettingSection>
    </Collapsible>
  );
}
