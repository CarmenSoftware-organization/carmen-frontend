import {
  Component as ReactComponent,
  lazy,
  Suspense,
  useEffect,
  useState,
} from "react";
import { Download, SunMoon } from "lucide-react";
import { useTheme } from "next-themes";
import { useLocale, useTranslations } from "use-intl";
import brandingDarkUrl from "@/components/icons/carmen-branding-dark.svg";
import brandingLightUrl from "@/components/icons/carmen-branding-light.svg";
import { LocaleToggle } from "@/components/locale-toggle";
import { ThemeSwitch } from "@/components/navbar/theme-switch";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { localizedSpec } from "@/lib/external-api/localized-spec";

// Scalar (~3 MB) อยู่ใน chunk นี้ chunk เดียว — หน้าอื่นของแอปไม่โหลด
const loadReference = () => import("./scalar-reference");

/** กัน chunk โหลดไม่ขึ้น (เช่น deploy ใหม่ระหว่างเปิดหน้า) ให้เหลือปุ่มลองใหม่ ไม่ใช่จอว่าง */
class ReferenceErrorBoundary extends ReactComponent<
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

/** ดาวน์โหลด spec ภาษาอังกฤษฉบับ placeholder เสมอ ไม่ว่าหน้ากำลังแสดงภาษาไหน */
function downloadSpec() {
  const blob = new Blob([JSON.stringify(localizedSpec("en"), null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "carmen-external-api-openapi.json";
  a.click();
  URL.revokeObjectURL(url);
}

function DocsHeader() {
  const t = useTranslations("developers.apiDocs");
  const tc = useTranslations("common");
  return (
    <header className="bg-background border-border/60 sticky top-0 z-50 border-b">
      <div className="flex h-12 items-center gap-3 px-4 sm:px-6">
        <img
          src={brandingLightUrl}
          alt="Carmen Blue"
          className="h-6 w-auto dark:hidden"
        />
        <img
          src={brandingDarkUrl}
          alt="Carmen Blue"
          className="hidden h-6 w-auto dark:block"
        />
        <span className="text-muted-foreground border-l pl-3 text-sm font-semibold">
          {t("brand")}
        </span>
        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={downloadSpec}
            aria-label={t("download")}
          >
            <Download aria-hidden="true" />
            <span className="hidden sm:inline">{t("download")}</span>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={tc("theme")}
              >
                <SunMoon aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <ThemeSwitch />
            </DropdownMenuContent>
          </DropdownMenu>
          <LocaleToggle />
        </div>
      </div>
    </header>
  );
}

/**
 * หน้า public `/developers/api` — เอกสาร API ขาเข้าสำหรับนักพัฒนาฝั่งลูกค้าที่ไม่มีบัญชี Carmen
 * (route อยู่นอก ProtectedShell) ภาษาและธีมตามค่าของแอป (`carmen.locale` / next-themes)
 *
 * @returns React element ของหน้าเอกสาร
 */
export function Component() {
  const t = useTranslations("developers.apiDocs");
  const locale = useLocale();
  const { resolvedTheme } = useTheme();
  // lazy() จำ promise ที่ล้มไว้ — ลองใหม่ต้องสร้างตัวใหม่ (key ใหม่ล้าง boundary ด้วย)
  const [ref, setRef] = useState(() => ({ Lazy: lazy(loadReference), key: 0 }));

  useEffect(() => {
    document.title = t("pageTitle");
  }, [t]);

  return (
    <div className="bg-background min-h-svh">
      <DocsHeader />
      <ReferenceErrorBoundary
        key={ref.key}
        fallback={
          <div className="p-6">
            <ErrorState
              message={t("loadError")}
              onRetry={() =>
                setRef((r) => ({ Lazy: lazy(loadReference), key: r.key + 1 }))
              }
            />
          </div>
        }
      >
        <Suspense
          fallback={
            <div className="space-y-4 p-6">
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-96 w-full" />
            </div>
          }
        >
          <ref.Lazy locale={locale} dark={resolvedTheme === "dark"} />
        </Suspense>
      </ReferenceErrorBoundary>
    </div>
  );
}
