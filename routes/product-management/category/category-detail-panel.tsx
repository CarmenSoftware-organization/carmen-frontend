import { ChevronRight, History, Pencil, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "use-intl";
import { openActivity } from "@/components/share/activity-sheet-host";
import { CompactSection, FieldGrid } from "@/components/share/compact-section";
import { SettingField } from "@/components/share/setting-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { NODE_TYPE, type CategoryNode } from "@/types/category";
import { useNodeAccountCodes } from "./use-node-account-codes";

interface Stats {
  readonly cats: number;
  readonly subs: number;
  readonly igs: number;
  readonly products: number | undefined;
}

interface Props {
  /** แถวที่เลือก — undefined = ยังไม่เลือก แผงแสดงภาพรวมทั้งต้นไม้ */
  readonly node: CategoryNode | undefined;
  /** บรรพบุรุษจากบนสุดถึงแม่ (ไม่รวม node) — ใช้ทำ path และเทียบค่าที่สืบทอด */
  readonly ancestors: CategoryNode[];
  readonly stats: Stats;
  /** คลาสความสูงของกล่องเลื่อน — ต้องเท่ากับของต้นไม้ การ์ดสองใบจึงสูงเท่ากัน */
  readonly scrollClassName: string;
  readonly onSelect: (node: CategoryNode) => void;
  readonly onAdd: (node: CategoryNode) => void;
  readonly onEdit: (node: CategoryNode) => void;
  readonly onDelete: (node: CategoryNode) => void;
}

const pct = (v: number | undefined | null) =>
  v === undefined || v === null ? undefined : `${Number(v)}%`;

/**
 * แผงรายละเอียดข้างต้นไม้ — ขึ้นเฉพาะเมื่อกล่องของหน้ากว้างพอ (ดู category-component)
 * ใช้ที่ว่างท้ายแถวบน Full HD/4K ให้เป็นข้อมูลของแถวที่เลือก: ค่าตั้ง (บอกว่าสืบทอดหรือตั้งเอง)
 * บัญชี และรายการย่อยที่คลิกไล่ลงไปได้
 */
export function CategoryDetailPanel({
  node,
  ancestors,
  stats,
  scrollClassName,
  onSelect,
  onAdd,
  onEdit,
  onDelete,
}: Props) {
  const t = useTranslations("productManagement.category");
  const tc = useTranslations("common");
  const tfl = useTranslations("field");
  const tp = useTranslations("productManagement.product");
  const ts = useTranslations("status");
  const tActivity = useTranslations("activity");

  const NODE_LABEL = {
    [NODE_TYPE.CATEGORY]: t("nodeCategory"),
    [NODE_TYPE.SUBCATEGORY]: t("nodeSubcategory"),
    [NODE_TYPE.ITEM_GROUP]: t("nodeItemGroup"),
  };

  // account_codes มาจาก GET รายตัวเท่านั้น — โหลดของแถวที่เลือก (แผงไม่ mount = ไม่ยิง)
  const accounts = useNodeAccountCodes(node);
  const parent = ancestors.at(-1);

  return (
    <div className="bg-card flex min-w-0 flex-col rounded-md border">
      {/* แถบหัว สูงเท่าแถบสถิติของต้นไม้ (h-9) — path ของแถวที่เลือก */}
      <div className="text-muted-foreground flex h-9 min-w-0 items-center gap-1 border-b px-3 text-xs">
        {node ? (
          <>
            <span className="text-foreground/80 shrink-0 font-semibold">
              {NODE_LABEL[node.type]}
            </span>
            {ancestors.map((a) => (
              <span key={a.id} className="flex min-w-0 items-center gap-1">
                <ChevronRight aria-hidden className="size-3 shrink-0" />
                <button
                  type="button"
                  className="hover:text-foreground truncate"
                  onClick={() => onSelect(a)}
                >
                  {a.code} {a.name}
                </button>
              </span>
            ))}
          </>
        ) : (
          <span className="text-foreground/80 font-semibold">
            {t("overview")}
          </span>
        )}
      </div>

      <ScrollArea className={scrollClassName}>
        <div className="p-4">
          {node ? (
            <>
              {/* ชื่อ + ปุ่ม — ปุ่มรองเป็นไอคอน ปุ่มแก้ไขเก็บป้าย บรรทัดเดียวเสมอ */}
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex min-w-0 items-baseline gap-2">
                    <span className="text-muted-foreground shrink-0 text-sm font-semibold tabular-nums">
                      {node.code}
                    </span>
                    <h2 className="truncate text-base font-semibold tracking-tight">
                      {node.name}
                    </h2>
                    {!node.is_active && (
                      <Badge variant="secondary" size="xs" className="shrink-0">
                        {ts("inactive")}
                      </Badge>
                    )}
                  </div>
                  {node.description && (
                    <p className="text-muted-foreground mt-1 text-xs break-words">
                      {node.description}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {node.type !== NODE_TYPE.ITEM_GROUP && (
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      onClick={() => onAdd(node)}
                      title={t("addChild")}
                      aria-label={t("addChild")}
                    >
                      <Plus />
                    </Button>
                  )}
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    onClick={() => openActivity(node.id, node.name)}
                    title={tActivity("title")}
                    aria-label={tActivity("title")}
                  >
                    <History />
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    className="hover:text-destructive"
                    onClick={() => onDelete(node)}
                    title={tc("delete")}
                    aria-label={tc("delete")}
                  >
                    <Trash2 />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onEdit(node)}
                  >
                    <Pencil />
                    {tc("edit")}
                  </Button>
                </div>
              </div>

              <CompactSection title={t("detailSettings")} frameless>
                <FieldGrid>
                  <InheritField
                    label={tfl("taxProfile")}
                    value={node.tax_profile_name}
                    parentValue={parent?.tax_profile_name}
                    differs={
                      parent &&
                      (node.tax_profile_id ?? null) !==
                        (parent.tax_profile_id ?? null)
                    }
                  />
                  <InheritField
                    label={tfl("priceDeviation")}
                    value={pct(node.price_deviation_limit)}
                    parentValue={pct(parent?.price_deviation_limit)}
                    differs={
                      parent &&
                      pct(node.price_deviation_limit) !==
                        pct(parent.price_deviation_limit)
                    }
                  />
                  <InheritField
                    label={tfl("qtyDeviation")}
                    value={pct(node.qty_deviation_limit)}
                    parentValue={pct(parent?.qty_deviation_limit)}
                    differs={
                      parent &&
                      pct(node.qty_deviation_limit) !==
                        pct(parent.qty_deviation_limit)
                    }
                  />
                  <InheritField
                    label={tp("usedInRecipe")}
                    value={node.is_used_in_recipe ? tc("yes") : tc("no")}
                    parentValue={
                      parent?.is_used_in_recipe ? tc("yes") : tc("no")
                    }
                    differs={
                      parent &&
                      !!node.is_used_in_recipe !== !!parent.is_used_in_recipe
                    }
                  />
                  <InheritField
                    label={tp("soldDirectly")}
                    value={node.is_sold_directly ? tc("yes") : tc("no")}
                    parentValue={
                      parent?.is_sold_directly ? tc("yes") : tc("no")
                    }
                    differs={
                      parent &&
                      !!node.is_sold_directly !== !!parent.is_sold_directly
                    }
                  />
                </FieldGrid>
              </CompactSection>

              <CompactSection title={t("detailAccounts")} frameless>
                <FieldGrid>
                  {(["inventory", "direct"] as const).map((type) => {
                    const entry = accounts.codes?.find(
                      (c) => c.account_type === type,
                    );
                    const label =
                      type === "inventory"
                        ? t("inventoryAccount")
                        : t("directAccount");
                    if (accounts.isLoading || !accounts.codes) {
                      return (
                        <SettingField
                          key={type}
                          label={label}
                          value={accounts.isError ? undefined : "…"}
                        />
                      );
                    }
                    return (
                      <SettingField
                        key={type}
                        label={label}
                        value={entry?.account_code}
                        mono
                        // ไม่ได้ตั้งเอง: ชั้นล่างสืบทอดจากชั้นบน (หมวดบนสุดไม่มีที่ให้สืบทอด)
                        example={
                          entry
                            ? entry.account_name
                            : node.type !== NODE_TYPE.CATEGORY
                              ? t("cascadeInherit")
                              : undefined
                        }
                      />
                    );
                  })}
                </FieldGrid>
              </CompactSection>

              <CompactSection
                title={t("detailChildren")}
                frameless
                count={node.children?.length}
                description={
                  node.product_count !== undefined &&
                  t("nProducts", { count: node.product_count })
                }
              >
                {node.children?.length ? (
                  <FieldGrid size="item">
                    {node.children.map((child) => (
                      <button
                        key={child.id}
                        type="button"
                        onClick={() => onSelect(child)}
                        className="hover:bg-accent/50 -mx-2 flex min-w-0 items-baseline gap-2 rounded px-2 py-1 text-left"
                      >
                        <span className="text-muted-foreground text-micro shrink-0 tabular-nums">
                          {child.code}
                        </span>
                        <span className="min-w-0 truncate text-xs">
                          {child.name}
                        </span>
                        {child.product_count !== undefined && (
                          <span className="text-muted-foreground text-micro-legal shrink-0 tabular-nums">
                            {t("nProducts", { count: child.product_count })}
                          </span>
                        )}
                      </button>
                    ))}
                  </FieldGrid>
                ) : (
                  <div className="text-muted-foreground/60 text-xs">—</div>
                )}
              </CompactSection>
            </>
          ) : (
            <>
              <FieldGrid>
                <SettingField label={t("nodeCategory")} value={stats.cats} />
                <SettingField label={t("nodeSubcategory")} value={stats.subs} />
                <SettingField label={t("nodeItemGroup")} value={stats.igs} />
                <SettingField label={t("colProducts")} value={stats.products} />
              </FieldGrid>
              <p className="text-muted-foreground mt-4 text-xs">
                {t("selectHint")}
              </p>
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

/** ค่าตั้งที่ไหลจากชั้นบน — บรรทัดรองบอกว่าเหมือนหรือต่างจากชั้นบน (ชั้นบนสุดไม่มีบรรทัดรอง) */
function InheritField({
  label,
  value,
  parentValue,
  differs,
}: {
  readonly label: string;
  readonly value: string | undefined;
  readonly parentValue: string | undefined;
  readonly differs: boolean | undefined;
}) {
  const t = useTranslations("productManagement.category");
  const caption =
    differs === undefined
      ? undefined
      : differs
        ? t("differsFromParent", { value: parentValue ?? "—" })
        : t("sameAsParent");
  return <SettingField label={label} value={value} example={caption} />;
}
