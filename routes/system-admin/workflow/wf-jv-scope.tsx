import { useId } from "react";
import { useWatch, type UseFormReturn } from "react-hook-form";
import { useTranslations } from "use-intl";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useGlJvPrefixOptions } from "@/hooks/use-gl-jv-prefix-options";
import {
  JV_WORKFLOW_SOURCES,
  type JvWorkflowSource,
} from "@/constant/workflow";
import type { WorkflowCreateModel } from "./wf-form-schema";

interface WfJvScopeProps {
  readonly form: UseFormReturn<WorkflowCreateModel>;
  readonly isDisabled?: boolean;
}

const SOURCE_LABEL_KEY: Record<JvWorkflowSource, string> = {
  manual: "jvSourceManual",
  recurring: "jvSourceRecurring",
  allocation: "jvSourceAllocation",
  amortize: "jvSourceAmortize",
  reversal: "jvSourceReversal",
  closing: "jvSourceClosing",
};

/**
 * แท็บขอบเขตของ workflow ชนิด JV — เลือก prefix กับที่มาของใบที่จะเข้า workflow นี้
 *
 * แต่ละกลุ่ม "ไม่เลือกเลย = ทุกค่า" (ตรงกับฝั่ง backend ที่ถือว่าว่าง = ครอบคลุมทั้งหมด)
 * ถ้ามีสอง workflow ที่ขอบเขตทับกันได้ backend จะปฏิเสธตอนบันทึก
 * @param props - ตัวเลือกของแท็บ
 * @param props.form - ฟอร์ม workflow (อ่าน/เขียน `data.jv_scope`)
 * @param props.isDisabled - true = ดูอย่างเดียว
 * @returns เนื้อหาแท็บขอบเขต
 */
export function WfJvScope({ form, isDisabled = false }: WfJvScopeProps) {
  const t = useTranslations("systemAdmin.workflow");
  const tc = useTranslations("common");
  const uid = useId();
  const { options, isLoading } = useGlJvPrefixOptions();
  const scope = useWatch({ control: form.control, name: "data.jv_scope" });
  const prefixIds = scope?.prefix_ids ?? [];
  const sources = scope?.sources ?? [];

  const update = (next: { prefix_ids?: string[]; sources?: string[] }) => {
    form.setValue(
      "data.jv_scope",
      {
        prefix_ids: next.prefix_ids ?? prefixIds,
        sources: (next.sources ?? sources) as JvWorkflowSource[],
      },
      { shouldDirty: true },
    );
  };

  const toggle = (list: string[], value: string, checked: boolean) =>
    checked ? [...list, value] : list.filter((v) => v !== value);

  // prefix ที่ถูกปิดใช้งานไปแล้วแต่ยังค้างในขอบเขต ต้องเห็นและเอาออกได้ — ไม่ซ่อนเงียบ ๆ
  const visible = options.filter(
    (o) => o.isActive || prefixIds.includes(o.value),
  );
  const unknownIds = isLoading
    ? []
    : prefixIds.filter((id) => !options.some((o) => o.value === id));

  const prefixSummary =
    prefixIds.length === 0
      ? t("jvScopeAllPrefixes")
      : t("jvScopeSomePrefixes", { count: prefixIds.length });
  const sourceSummary =
    sources.length === 0
      ? t("jvScopeAllSources")
      : t("jvScopeSomeSources", { count: sources.length });

  return (
    <div className="space-y-6">
      <section className="space-y-2" aria-labelledby={`${uid}-prefix`}>
        <h3 id={`${uid}-prefix`} className="text-sm font-medium">
          {t("jvScopePrefixTitle")}
        </h3>
        <div className="max-h-56 space-y-1.5 overflow-y-auto rounded-md border p-3">
          {isLoading && (
            <p className="text-muted-foreground text-sm">{tc("loading")}</p>
          )}
          {!isLoading && visible.length === 0 && unknownIds.length === 0 && (
            <p className="text-muted-foreground text-sm">
              {t("jvScopeNoPrefix")}
            </p>
          )}
          {visible.map((o) => {
            const id = `${uid}-p-${o.value}`;
            return (
              <div key={o.value} className="flex items-center gap-2">
                <Checkbox
                  id={id}
                  checked={prefixIds.includes(o.value)}
                  disabled={isDisabled}
                  onCheckedChange={(c) =>
                    update({
                      prefix_ids: toggle(prefixIds, o.value, c === true),
                    })
                  }
                />
                <Label htmlFor={id} className="text-sm font-normal">
                  {o.label}
                </Label>
                {!o.isActive && (
                  <Badge variant="secondary" size="xs">
                    {t("jvScopePrefixInactive")}
                  </Badge>
                )}
              </div>
            );
          })}
          {unknownIds.map((pid) => (
            <div key={pid} className="flex items-center gap-2">
              <Checkbox
                id={`${uid}-p-${pid}`}
                checked
                disabled={isDisabled}
                onCheckedChange={() =>
                  update({ prefix_ids: toggle(prefixIds, pid, false) })
                }
              />
              <Label
                htmlFor={`${uid}-p-${pid}`}
                className="text-muted-foreground text-sm font-normal"
              >
                {t("jvScopePrefixMissing")}
              </Label>
            </div>
          ))}
        </div>
        <p className="text-muted-foreground text-xs">
          {t("jvScopePrefixHint")}
        </p>
      </section>

      <section className="space-y-2" aria-labelledby={`${uid}-source`}>
        <h3 id={`${uid}-source`} className="text-sm font-medium">
          {t("jvScopeSourceTitle")}
        </h3>
        <div className="grid gap-1.5 rounded-md border p-3 sm:grid-cols-2">
          {JV_WORKFLOW_SOURCES.map((s) => {
            const id = `${uid}-s-${s}`;
            return (
              <div key={s} className="flex items-center gap-2">
                <Checkbox
                  id={id}
                  checked={sources.includes(s)}
                  disabled={isDisabled}
                  onCheckedChange={(c) =>
                    update({ sources: toggle(sources, s, c === true) })
                  }
                />
                <Label htmlFor={id} className="text-sm font-normal">
                  {t(SOURCE_LABEL_KEY[s])}
                </Label>
              </div>
            );
          })}
        </div>
        <p className="text-muted-foreground text-xs">
          {t("jvScopeSourceHint")}
        </p>
      </section>

      <p className="bg-muted/40 rounded-md border px-3 py-2 text-sm">
        {t("jvScopeSummary", { prefix: prefixSummary, source: sourceSummary })}
      </p>
    </div>
  );
}
