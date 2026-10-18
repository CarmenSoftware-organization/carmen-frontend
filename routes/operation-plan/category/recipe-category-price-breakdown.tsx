import { AlertTriangle, CircleCheck, Info } from "lucide-react";
import { useTranslations } from "use-intl";
import { cn } from "@/lib/utils";
import { formatPct } from "../shared/recipe-category-defaults";

/**
 * สีของแต่ละส่วนในแถบ — ใช้ร่วมกับจุดสีหน้าชื่อช่องในฟอร์ม ให้ช่องกับแถบผูกกันด้วยสีเดียว
 * ลำดับ ฟ้า → อำพัน → ม่วง → เขียว ผ่าน validator ของ dataviz (CVD) บนพื้นสว่าง
 */
export const SEGMENT_COLOR = {
  food: "bg-chart-1",
  labor: "bg-chart-8",
  overhead: "bg-chart-3",
  margin: "bg-chart-7",
} as const;

type Segment = keyof typeof SEGMENT_COLOR;

/**
 * ขีดกำไรบนแถบ — ขั้นต่ำสั้นและจาง เป้าหมายยาวและเข้ม ให้แยกกันได้ด้วยรูปทรงไม่ใช่แค่สี
 * ใช้ซ้ำเป็นสัญลักษณ์หน้าชื่อช่องกำไรในฟอร์ม
 */
export const MARKER_CLASS = {
  min: "bg-muted-foreground h-2.5 w-0.5 rounded-full",
  target: "bg-foreground h-4 w-0.5 rounded-full",
} as const;

interface PriceBreakdownProps {
  readonly food: number;
  readonly labor: number;
  readonly overhead: number;
  readonly marginMin: number;
  readonly marginTarget: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * แถบแบ่งราคาขาย 100% เป็น ต้นทุนอาหาร │ ค่าแรง │ โสหุ้ย │ กำไรที่เหลือ
 *
 * ทั้งสามต้นทุนเป็น % ของราคาขาย (สมการเดียวกับ `computeRecipeCost` ของสูตร) กำไรขั้นต้น
 * จึงเท่ากับ 100 − ผลรวม — ขีดบนแถบคือตำแหน่งกำไรขั้นต่ำ/เป้าหมาย ถ้าต้นทุนกินเลยขีด
 * แปลว่าค่าที่ตั้งขัดกันเอง แถบแค่เตือน ไม่บล็อกการบันทึก
 */
export function RecipeCategoryPriceBreakdown({
  food,
  labor,
  overhead,
  marginMin,
  marginTarget,
}: PriceBreakdownProps) {
  const t = useTranslations("operationPlan.recipeCategory");

  const costs = round2(food + labor + overhead);
  const left = round2(100 - costs);
  const scale = Math.max(100, costs);
  const width = (v: number) => `${(v / scale) * 100}%`;

  const segments: { key: Segment; label: string; value: number }[] = [
    { key: "food", label: t("foodCostShort"), value: food },
    { key: "labor", label: t("laborShort"), value: labor },
    { key: "overhead", label: t("overheadShort"), value: overhead },
    { key: "margin", label: t("marginLeft"), value: Math.max(0, left) },
  ];
  const markers = (
    [
      { key: "min", value: marginMin, label: t("minMarginShort") },
      { key: "target", value: marginTarget, label: t("targetMarginShort") },
    ] as const
  ).filter((m) => m.value > 0 && m.value <= 100);

  return (
    <div className="space-y-2.5">
      <div className="relative py-1">
        <div
          role="img"
          aria-label={segments
            .map((s) => `${s.label} ${formatPct(s.value)}`)
            .join(", ")}
          className="bg-muted flex h-2.5 gap-0.5 overflow-hidden rounded-full"
        >
          {costs > 0 &&
            segments
              .filter((s) => s.value > 0)
              .map((s) => (
                <div
                  key={s.key}
                  title={`${s.label} ${formatPct(s.value)}`}
                  className={cn(
                    "h-full transition-[width] duration-300",
                    SEGMENT_COLOR[s.key],
                  )}
                  style={{ width: width(s.value) }}
                />
              ))}
        </div>
        {/* ขีดกำไร วัดจากขอบขวา (ราคาขาย 100%) ย้อนเข้ามา */}
        {markers.map((m) => (
          <div
            key={m.key}
            title={`${m.label} ${formatPct(m.value)}`}
            className={cn(
              "ring-background absolute top-1/2 -translate-x-1/2 -translate-y-1/2 ring-2 transition-[left] duration-300",
              MARKER_CLASS[m.key],
            )}
            style={{ left: width(100 - m.value) }}
          />
        ))}
      </div>

      <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        {costs <= 0 && (
          <li className="text-muted-foreground">{t("breakdownEmpty")}</li>
        )}
        {costs > 0 &&
          segments.map((s) => (
            <li key={s.key} className="flex items-center gap-1.5">
              <span
                aria-hidden
                className={cn("size-2 rounded-full", SEGMENT_COLOR[s.key])}
              />
              <span className="text-muted-foreground">{s.label}</span>
              <span className="font-medium tabular-nums">
                {formatPct(s.value)}
              </span>
            </li>
          ))}
        {markers.map((m) => (
          <li key={m.key} className="flex items-center gap-1.5">
            <span aria-hidden className={MARKER_CLASS[m.key]} />
            <span className="text-muted-foreground">{m.label}</span>
            <span className="font-medium tabular-nums">
              {formatPct(m.value)}
            </span>
          </li>
        ))}
      </ul>

      {costs > 0 && (
        <BreakdownStatus
          costs={costs}
          left={left}
          marginMin={marginMin}
          marginTarget={marginTarget}
        />
      )}
    </div>
  );
}

function BreakdownStatus({
  costs,
  left,
  marginMin,
  marginTarget,
}: {
  readonly costs: number;
  readonly left: number;
  readonly marginMin: number;
  readonly marginTarget: number;
}) {
  const t = useTranslations("operationPlan.recipeCategory");

  if (costs > 100)
    return (
      <StatusLine tone="danger" icon={AlertTriangle}>
        {t("breakdownOver", { over: formatPct(round2(costs - 100)) })}
      </StatusLine>
    );
  if (marginMin > 0 && left < marginMin)
    return (
      <StatusLine tone="warning" icon={AlertTriangle}>
        {t("breakdownBelowMin", {
          left: formatPct(left),
          min: formatPct(marginMin),
        })}
      </StatusLine>
    );
  if (marginTarget > 0 && left < marginTarget)
    return (
      <StatusLine tone="muted" icon={Info}>
        {t("breakdownBelowTarget", {
          left: formatPct(left),
          target: formatPct(marginTarget),
        })}
      </StatusLine>
    );
  if (marginTarget > 0)
    return (
      <StatusLine tone="success" icon={CircleCheck}>
        {t("breakdownMeetsTarget", {
          left: formatPct(left),
          target: formatPct(marginTarget),
        })}
      </StatusLine>
    );
  return (
    <StatusLine tone="muted" icon={Info}>
      {t("breakdownLeft", { left: formatPct(left) })}
    </StatusLine>
  );
}

const TONE = {
  danger: "text-destructive",
  warning: "text-warning-ink",
  success: "text-success-ink",
  muted: "text-muted-foreground",
} as const;

function StatusLine({
  tone,
  icon: Icon,
  children,
}: {
  readonly tone: keyof typeof TONE;
  readonly icon: typeof Info;
  readonly children: React.ReactNode;
}) {
  return (
    <p
      role="status"
      className={cn("flex items-start gap-1.5 text-xs", TONE[tone])}
    >
      <Icon className="mt-px size-3.5 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  );
}
