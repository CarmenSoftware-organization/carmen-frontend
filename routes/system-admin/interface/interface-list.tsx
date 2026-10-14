import { Link } from "react-router";
import { ChevronRight } from "lucide-react";
import { useTranslations } from "use-intl";
import { ListPageShell } from "@/components/share/list-page-shell";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { AuditCell } from "@/components/share/audit-cell";
import { useProfile } from "@/hooks/use-profile";
import { cn } from "@/lib/utils";
import { useInterfaceConfigs } from "./use-interface-configs";
import {
  useInterfaceEntitlement,
  type InterfaceEntitlement,
} from "@/hooks/use-interface-entitlement";
import type { AppConfig } from "@/types/app-config";
import type { AuditEntry } from "@/types/audit";
import {
  INTERFACE_CATEGORIES,
  type BrandDef,
  type InterfaceCategoryDef,
} from "./interface-registry";

export type BrandStatus = {
  readonly brand: BrandDef;
  readonly enabled: boolean;
  readonly entitlement: InterfaceEntitlement;
  /** `false` = backend ไม่ให้อ่าน config (คีย์อยู่แค่ใน `expired_features`) สถานะจริงจึงไม่รู้ */
  readonly readable: boolean;
  /** ปลายทางที่ตั้งไว้ — `null` = ยังไม่ระบุ */
  readonly target: string | null;
  readonly updated: AuditEntry | undefined;
};

export type CategoryGroup = {
  readonly category: InterfaceCategoryDef;
  readonly brands: readonly BrandStatus[];
};

/**
 * ปลายทางของการเชื่อมต่อจาก config — ฟอร์มทั่วไปเก็บใน `endpoint` ส่วน Carmen GL เก็บใน
 * `api_server` · ค่าว่าง/ไม่ใช่ string ถือว่ายังไม่ระบุ
 */
export function connectionTarget(
  value: Record<string, unknown> | undefined,
): string | null {
  const raw = value?.endpoint ?? value?.api_server;
  return typeof raw === "string" && raw.trim() !== "" ? raw.trim() : null;
}

/**
 * จับคู่ brand ในแต่ละ category กับ config ที่มีอยู่ แล้วกรองด้วย entitlement
 *
 * brand ที่ `none` ถูกตัดออก; category ที่ไม่เหลือ brand เลยถูกตัดทั้งกลุ่ม
 * brand ที่ `expired` **ยังแสดง** พร้อมป้ายบอก — ต่างจาก `none` ที่หายไปเงียบ เพราะสองอย่างนี้
 * ผู้ใช้แก้ด้วยการกระทำคนละอย่าง (ต่ออายุ vs ซื้อเพิ่ม)
 * brand ที่ยังไม่มี row ใน app_config ถือว่า disabled — เป็นสถานะปกติ ไม่ใช่ error
 *
 * @param categories - รายการ category จาก registry
 * @param configs - app config ทั้งหมดของ BU ปัจจุบัน (มี key อื่นปนมาด้วย)
 * @param entitlementOf - ตัวตัดสินจาก `useInterfaceEntitlement`
 * @param canReadConfig - brand ที่ backend ให้อ่าน config ได้ (ค่าเริ่มต้น = ทุก brand)
 * @returns กลุ่มต่อ category (เฉพาะที่มี brand เห็นได้) เรียงตาม registry
 */
export function interfaceGroups(
  categories: readonly InterfaceCategoryDef[],
  configs: readonly AppConfig[],
  entitlementOf: (
    categoryKey: string,
    brandKey: string,
  ) => InterfaceEntitlement,
  canReadConfig: (categoryKey: string, brandKey: string) => boolean = () =>
    true,
): readonly CategoryGroup[] {
  const byKey = new Map(configs.map((c) => [c.key, c]));
  return categories
    .map((category) => ({
      category,
      brands: category.brands
        .map((brand) => {
          const row = byKey.get(brand.configKey);
          return {
            brand,
            entitlement: entitlementOf(category.key, brand.key),
            readable: canReadConfig(category.key, brand.key),
            enabled: row?.value?.enabled === true,
            target: connectionTarget(row?.value),
            updated: row?.audit?.updated ?? row?.audit?.created,
          };
        })
        .filter((row) => row.entitlement !== "none"),
    }))
    .filter((group) => group.brands.length > 0);
}

/** คอลัมน์ของแถว — ใช้ร่วมกับ skeleton ให้ความสูง/แนวตรงกันตอนโหลดเสร็จ */
const ROW_GRID =
  "grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 px-4 py-3 sm:grid-cols-[auto_minmax(0,14rem)_minmax(0,1fr)_10rem_auto] sm:gap-x-4";

function StatusDot({ enabled }: { readonly enabled: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "size-2 shrink-0 rounded-full",
        enabled
          ? "bg-success ring-success/20 ring-4"
          : "border-muted-foreground/50 border",
      )}
    />
  );
}

export default function InterfaceList() {
  const t = useTranslations("systemAdmin.interface");
  const { dateTimeFormat } = useProfile();
  const { entitlementOf, canReadConfig } = useInterfaceEntitlement();
  const { data, isLoading, isError, refetch } = useInterfaceConfigs();

  const groups = interfaceGroups(
    INTERFACE_CATEGORIES,
    data ?? [],
    entitlementOf,
    canReadConfig,
  );

  return (
    <ListPageShell title={t("title")} description={t("desc")}>
      {isError && (
        <ErrorState message={t("loadError")} onRetry={() => refetch()} />
      )}

      {!isError && isLoading && (
        <div className="divide-y rounded-lg border">
          {[0, 1].map((i) => (
            <div key={i} className={ROW_GRID}>
              <Skeleton className="size-2 rounded-full" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="hidden h-3 w-48 sm:block" />
            </div>
          ))}
        </div>
      )}

      {!isError && !isLoading && groups.length === 0 && (
        <p className="text-muted-foreground text-sm">{t("empty")}</p>
      )}

      {!isError && !isLoading && groups.length > 0 && (
        <div className="space-y-6">
          {groups.map(({ category, brands }) => {
            const Icon = category.icon;
            const enabledCount = brands.filter((b) => b.enabled).length;
            const headingId = `interface-${category.key}`;
            return (
              <section key={category.key} aria-labelledby={headingId}>
                <div className="mb-2 flex items-center gap-2">
                  <span className="bg-muted text-muted-foreground flex size-6 items-center justify-center rounded-md">
                    <Icon className="size-3.5" aria-hidden="true" />
                  </span>
                  <h2 id={headingId} className="text-sm font-semibold">
                    {t(`${category.key}.title`)}
                  </h2>
                  <span className="text-muted-foreground ml-auto text-xs tabular-nums">
                    {t("enabledCount", {
                      enabled: enabledCount,
                      total: brands.length,
                    })}
                  </span>
                </div>
                <ul className="bg-card divide-y overflow-hidden rounded-lg border">
                  {brands.map(
                    ({
                      brand,
                      enabled,
                      entitlement,
                      readable,
                      target,
                      updated,
                    }) => (
                      <li key={brand.key}>
                        <Link
                          to={`/system-admin/interface/${category.key}/${brand.key}`}
                          className={cn(
                            ROW_GRID,
                            "group hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:ring-ring transition-colors focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset",
                          )}
                        >
                          <StatusDot enabled={enabled} />
                          <span className="flex min-w-0 flex-col">
                            <span className="flex min-w-0 items-center gap-2">
                              <span className="truncate text-sm font-medium">
                                {t(`${category.key}.brand.${brand.key}`)}
                              </span>
                              {entitlement === "expired" && (
                                <Badge variant="warning-light" size="xs">
                                  {t("expiredBadge")}
                                </Badge>
                              )}
                            </span>
                            {/* อ่าน config ไม่ได้ = ไม่รู้สถานะจริง ป้าย "หมดอายุ" บอกพอแล้ว
                                อย่าเดาว่า Disabled */}
                            {readable && (
                              <span
                                className={cn(
                                  "text-xs",
                                  enabled
                                    ? "text-success-ink"
                                    : "text-muted-foreground",
                                )}
                              >
                                {enabled
                                  ? t("statusEnabled")
                                  : t("statusDisabled")}
                              </span>
                            )}
                          </span>
                          <span
                            className={cn(
                              "hidden min-w-0 truncate text-xs sm:block",
                              target
                                ? "text-foreground font-mono"
                                : "text-muted-foreground",
                            )}
                            title={target ?? undefined}
                          >
                            <span className="sr-only">{t("target")}: </span>
                            {readable ? (target ?? t("notConfigured")) : "—"}
                          </span>
                          <span className="hidden min-w-0 sm:block">
                            <span className="sr-only">{t("updated")}: </span>
                            <AuditCell
                              entry={updated}
                              dateTimeFormat={dateTimeFormat}
                            />
                          </span>
                          <ChevronRight
                            className="text-muted-foreground group-hover:text-foreground size-4 transition-colors"
                            aria-hidden="true"
                          />
                        </Link>
                      </li>
                    ),
                  )}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </ListPageShell>
  );
}
