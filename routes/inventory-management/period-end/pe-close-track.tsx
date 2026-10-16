import { Check } from "lucide-react";
import { useTranslations } from "use-intl";
import { cn } from "@/lib/utils";
import type { PeriodEndReview } from "@/types/period-end";

type StepState = "done" | "current" | "blocked" | "pending";

interface TrackStep {
  readonly key: "documents" | "counting" | "close";
  readonly state: StepState;
  readonly hint: string;
  /** 0–100 — ใช้เฉพาะขั้นนับ เพื่อให้รางของขั้นนั้นเป็นแถบความคืบหน้าในตัว */
  readonly progress?: number;
}

/* สีของรางและเลขขั้น — รางเป็นตัวบอกสถานะหลัก ข้อความใต้ขั้นใช้สี ink
   เพราะ token สถานะเป็นสีพื้น ใช้เป็นสีตัวอักษรแล้วตก WCAG AA */
const RAIL_FILL: Record<StepState, string> = {
  done: "bg-success",
  current: "bg-primary",
  blocked: "bg-warning",
  pending: "bg-transparent",
};

const MARKER: Record<StepState, string> = {
  /* เส้นขอบเหมือนขั้นอื่น ไม่ใช่พื้นทึบ — `bg-success` คู่ `text-success-foreground`
     ตก AA (button-contrast.test.ts ดักอยู่) */
  done: "border-success-ink text-success-ink",
  current: "border-primary text-primary",
  blocked: "border-warning text-warning-ink",
  pending: "border-border text-muted-foreground",
};

const HINT: Record<StepState, string> = {
  done: "text-success-ink",
  current: "text-foreground",
  blocked: "text-warning-ink",
  pending: "text-muted-foreground",
};

/**
 * ลำดับขั้นของงวดนี้ คิดจากข้อมูล review ของ backend ล้วน ๆ — ไม่ตัดสินเองว่าปิดได้
 * หรือยัง (`can_close` / `start_blocking` / `close_blocking` มาจาก backend ทั้งหมด)
 */
function buildSteps(
  review: PeriodEndReview,
  t: ReturnType<typeof useTranslations>,
): TrackStep[] {
  const isClosed = review.status !== "open";
  const roundStatus = review.physical_count_period?.status;
  const isCounting = roundStatus === "counting" || roundStatus === "completed";

  const locations = review.details.physical_count;
  const locationsDone = locations.filter(
    (l) => l.physical_count_status === "completed",
  ).length;

  const { physical_count: locationsLeft, ...docBlockers } =
    review.close_blocking;
  const docsLeft = Object.values(docBlockers).reduce((sum, n) => sum + n, 0);

  let documents: TrackStep;
  if (isCounting || isClosed) {
    documents = {
      key: "documents",
      state: "done",
      hint: t("track.documents.done"),
    };
  } else if (review.start_blocking.total > 0) {
    documents = {
      key: "documents",
      state: "blocked",
      hint: t("track.documents.blocked", {
        count: review.start_blocking.total,
      }),
    };
  } else {
    documents = {
      key: "documents",
      state: "current",
      hint: t("track.documents.ready"),
    };
  }

  let counting: TrackStep;
  if (isClosed) {
    counting = {
      key: "counting",
      state: "done",
      hint: t("track.counting.closed"),
    };
  } else if (!isCounting) {
    counting = {
      key: "counting",
      state: "pending",
      hint: t("track.counting.notStarted"),
    };
  } else if (locations.length > 0 && locationsDone === locations.length) {
    counting = {
      key: "counting",
      state: "done",
      hint: t("track.counting.done", { total: locations.length }),
      progress: 100,
    };
  } else {
    counting = {
      key: "counting",
      state: "current",
      hint: t("track.counting.progress", {
        completed: locationsDone,
        total: locations.length,
      }),
      progress:
        locations.length === 0 ? 0 : (locationsDone / locations.length) * 100,
    };
  }

  let close: TrackStep;
  if (isClosed) {
    close = { key: "close", state: "done", hint: t("track.close.done") };
  } else if (review.can_close) {
    close = { key: "close", state: "current", hint: t("track.close.ready") };
  } else {
    close = {
      key: "close",
      state: "pending",
      hint: t("track.close.waiting", {
        docs: docsLeft,
        locations: locationsLeft,
      }),
    };
  }

  return [documents, counting, close];
}

interface PeCloseTrackProps {
  readonly review: PeriodEndReview;
}

export function PeCloseTrack({ review }: PeCloseTrackProps) {
  const t = useTranslations("inventoryManagement.periodEnd");
  const steps = buildSteps(review, t);

  return (
    <ol
      aria-label={t("track.title")}
      className="grid gap-x-4 gap-y-5 sm:grid-cols-3"
    >
      {steps.map((step, index) => (
        <li
          key={step.key}
          aria-current={step.state === "current" ? "step" : undefined}
          className="min-w-0 space-y-2.5"
        >
          <div className="bg-muted h-1 overflow-hidden rounded-full">
            <div
              className={cn(
                "h-full rounded-full transition-[width] duration-500",
                RAIL_FILL[step.state],
              )}
              style={{
                width: `${step.progress ?? (step.state === "pending" ? 0 : 100)}%`,
              }}
            />
          </div>
          <div className="flex items-start gap-2.5">
            <span
              aria-hidden="true"
              className={cn(
                "text-micro inline-flex size-5 shrink-0 items-center justify-center rounded-full border font-semibold tabular-nums",
                MARKER[step.state],
              )}
            >
              {step.state === "done" ? (
                <Check className="size-3" strokeWidth={3} />
              ) : (
                index + 1
              )}
            </span>
            <div className="min-w-0">
              <p
                className={cn(
                  "text-sm leading-5 font-medium",
                  step.state === "pending"
                    ? "text-muted-foreground"
                    : "text-foreground",
                )}
              >
                {t(`track.${step.key}.title`)}
              </p>
              <p className={cn("text-xs tabular-nums", HINT[step.state])}>
                {step.hint}
              </p>
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}
