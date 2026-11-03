import { Fragment, useState } from "react";
import { Loader2 } from "lucide-react";
import { useTranslations } from "use-intl";
import {
  HistoryTimeline,
  HistoryTimelineDay,
  HistoryTimelineItem,
  type HistoryTimelineMarker,
} from "@/components/share/history-timeline";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useActivityLogByRecord,
  useActivityLogDetail,
} from "@/hooks/use-activity-log";
import { useProfile } from "@/hooks/use-profile";
import { formatDate, formatElapsed } from "@/lib/date-utils";
import {
  getLogCreatedAt,
  type ActivityChildChange,
  type ActivityFieldChange,
  type ActivityLog,
} from "@/types/activity-log";

/**
 * action → key หัวข้อใน namespace `history` (action นอกรายการนี้ตกไปที่ humanize)
 *
 * ครอบทั้ง action ของ CRUD และของ workflow เพราะ backend เขียนทั้งสองชุดลง
 * activity log เดียวกัน — เอกสารจริงส่วนใหญ่มีแถว workflow มากกว่าแถว CRUD
 * ถ้าไม่ครอบไว้ หัวข้อจะค้างเป็นภาษาอังกฤษจาก humanize แม้ผู้ใช้สลับเป็นไทย
 *
 * รายการนี้ตรงกับค่าที่ registry ของ micro-business บันทึกจริง
 * (`common/activity/activity-registry.ts`) ซึ่งเป็นสับเซตของ enum
 * `enum_activity_action` ฝั่ง DB — ค่าอย่าง `view` / `login` / `export` มีในเอนัม
 * แต่ไม่มี handler ไหนเขียนให้เอกสารหรือข้อมูลหลัก จึงไม่ต้องมีหัวข้อ
 */
const ACTION_TITLE_KEY: Record<string, string> = {
  create: "actionCreated",
  update: "actionUpdated",
  delete: "actionDeleted",
  save: "actionSaved",
  submit: "actionSubmitted",
  approve: "actionApproved",
  review: "actionReviewed",
  reject: "actionRejected",
  cancel: "actionCancelled",
  void: "actionVoided",
  print: "actionPrinted",
  comment: "actionCommented",
  file_delete: "actionFileDeleted",
};

/**
 * action ที่ทำลายข้อมูลหรือออกนอกทางปกติของ workflow — ย้อมจุด marker เป็นสีเตือน
 * เจตนาเดียวกับ `ALERT_ACTIONS` ของ workflow history (กวาดตาไทม์ไลน์แล้วเจอทันที
 * ว่ารายการนี้เคยถูกปฏิเสธ ยกเลิก หรือถูกลบอะไรไป) แต่คำศัพท์ไม่ตรงกัน — activity
 * log เก็บ action เป็นรูปฐาน (`delete` / `reject` / `cancel`) ส่วน
 * `workflow_history` เก็บเป็นรูปอดีต (`rejected` / `cancelled`) จึงก๊อปมาแปลงรูป
 * ไม่ได้ตรง ๆ
 *
 * `send_back` ไม่อยู่ในเซตนี้เพราะไม่มีใน enum ของคอลัมน์ `action` จึงไม่มีทาง
 * ถูกบันทึก — การตีกลับถูกเก็บใน `workflow_history` ซึ่งมีหน้าเฉพาะของมันอยู่แล้ว
 */
const ALERT_ACTIONS = new Set([
  "delete",
  "reject",
  "cancel",
  "void",
  "file_delete",
]);

/**
 * ฟิลด์ที่ไม่เอามาแสดง
 * - updated_at/updated_by_id/doc_version: ขยับทุกครั้งที่บันทึก ไม่ได้บอกว่าผู้ใช้
 *   แก้อะไร (ตรงกับ HOUSEKEEPING_FIELDS ฝั่ง backend ที่ไม่นับใน `has_changes`)
 * - history/workflow_history: JSON ก้อนใหญ่ที่ระบบเขียนเอง อ่านไม่รู้เรื่องใน diff
 *   และประวัติ workflow มีหน้าเฉพาะของมันอยู่แล้ว
 */
const HIDDEN_FIELDS = new Set([
  "updated_at",
  "updated_by_id",
  "doc_version",
  "history",
  "workflow_history",
]);

const ROW_NAME_FIELDS = [
  "product_name",
  "product_local_name",
  "name",
  "product_code",
  "location_name",
  "description",
];

function humanize(value: string): string {
  return value
    .split("_")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * ชื่อตารางลูก → หัวข้อที่ผู้ใช้อ่านรู้เรื่อง เช่น `tb_purchase_request_detail`
 * → `Detail` โดยตัด `tb_` และชื่อเอกสารแม่ที่ซ้ำอยู่ข้างหน้าออก (ผู้ใช้ไม่รู้จัก
 * ชื่อตารางจริง และรู้อยู่แล้วว่ากำลังดูเอกสารใบไหน)
 * @param relation - ชื่อ relation จาก diff
 * @param entityType - entity_type ของ log ใช้ตัดคำนำหน้าที่ซ้ำ
 * @returns หัวข้อของบล็อกตารางลูก
 */
function relationLabel(relation: string, entityType: string): string {
  const parent = entityType.replace(/^tb_/, "");
  const name = relation.replace(/^tb_/, "");
  const stripped = name.startsWith(`${parent}_`)
    ? name.slice(parent.length + 1)
    : name;
  return humanize(stripped || name);
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/**
 * ชื่อเรียกแถวลูกให้คนอ่านรู้ว่าเป็นแถวไหน เช่น `#2 · Coffee Beans`
 * diff ของแถวที่ถูกแก้ให้มาแค่ id กับฟิลด์ที่เปลี่ยน จึงต้องหาแถวจริงใน snapshot
 * มาตั้งชื่อ ไม่งั้นผู้ใช้เห็นแค่ตัวเลขที่เปลี่ยนโดยไม่รู้ว่าของรายการไหน
 * @param row - แถวจาก snapshot (undefined ได้ถ้าหาไม่เจอ)
 * @param fallbackId - id ของแถว ใช้เมื่อไม่มีฟิลด์ชื่อให้อ่าน
 * @returns ข้อความสั้นสำหรับหัวแถว
 */
function rowLabelOf(
  row: Record<string, unknown> | undefined,
  fallbackId: string,
): string {
  const sequence = row?.sequence_no;
  const name = ROW_NAME_FIELDS.map((key) => row?.[key]).find(
    (value) => typeof value === "string" && value.trim(),
  );
  const parts: string[] = [];
  if (sequence !== null && sequence !== undefined && sequence !== "")
    parts.push(`#${String(sequence)}`);
  if (name) parts.push(String(name));
  return parts.length ? parts.join(" · ") : fallbackId.slice(0, 8);
}

function indexRows(
  snapshot: Record<string, unknown> | null,
  relation: string,
): Map<string, Record<string, unknown>> {
  const rows = snapshot?.[relation];
  const byId = new Map<string, Record<string, unknown>>();
  if (!Array.isArray(rows)) return byId;
  for (const row of rows) {
    if (row && typeof row === "object" && typeof row.id === "string")
      byId.set(row.id, row as Record<string, unknown>);
  }
  return byId;
}

function actorNameOf(log: ActivityLog): string {
  const fullName = [
    log.actor_firstname,
    log.actor_middlename,
    log.actor_lastname,
  ]
    .filter(Boolean)
    .join(" ");
  return fullName || log.actor_username || "—";
}

/**
 * ชื่อไฟล์ของ action `file_delete` — อ่านจาก `meta_data.file_name`
 * ถ้า gateway ไม่ส่ง meta_data มาให้ตกไปใช้ description (ข้อความที่ backend เขียนไว้)
 * action อื่นไม่แสดงอะไรเพิ่ม เพราะ description ของมันเผยชื่อตารางภายใน
 */
function fileNameOf(log: ActivityLog): string | null {
  if (log.action?.toLowerCase() !== "file_delete") return null;
  const name = log.meta_data?.file_name;
  if (typeof name === "string" && name.trim()) return name;
  return log.description?.trim() || null;
}

function FieldChangeRow({ change }: { change: ActivityFieldChange }) {
  return (
    <div className="text-micro grid grid-cols-[minmax(0,9rem)_1fr] gap-2 py-0.5">
      <span className="text-muted-foreground truncate" title={change.field}>
        {humanize(change.field)}
      </span>
      <span className="min-w-0 break-words">
        <span className="text-muted-foreground line-through">
          {formatValue(change.old)}
        </span>
        <span className="mx-1">→</span>
        <span className="font-medium">{formatValue(change.new)}</span>
      </span>
    </div>
  );
}

function RowMarkLine({ mark, label }: { mark: string; label: string }) {
  return (
    <p className="text-micro py-0.5">
      <span className="text-muted-foreground mr-1">{mark}</span>
      {label}
    </p>
  );
}

function ChildChangeBlock({
  child,
  label,
  rowsById,
}: {
  child: ActivityChildChange;
  label: string;
  rowsById: Map<string, Record<string, unknown>>;
}) {
  const t = useTranslations("activity");
  const counts = [
    { label: t("added"), n: child.added.length },
    { label: t("removed"), n: child.removed.length },
    { label: t("updated"), n: child.updated.length },
  ].filter((c) => c.n > 0);

  // แถวที่เหลือแต่ฟิลด์ที่ซ่อนอยู่แล้ว = ไม่มีอะไรให้ดู
  const updated = child.updated
    .map((row) => ({
      ...row,
      fields: row.fields.filter((f) => !HIDDEN_FIELDS.has(f.field)),
    }))
    .filter((row) => row.fields.length > 0);

  return (
    <div className="space-y-1">
      <p className="text-micro font-semibold">
        {label}{" "}
        <span className="text-muted-foreground font-normal">
          {counts.map((c) => `${c.label} ${c.n}`).join(" · ")}
        </span>
      </p>

      {child.added.map((row, i) => (
        <RowMarkLine
          key={`added-${String(row.id ?? i)}`}
          mark="+"
          label={rowLabelOf(row, String(row.id ?? ""))}
        />
      ))}

      {child.removed.map((row, i) => (
        <RowMarkLine
          key={`removed-${String(row.id ?? i)}`}
          mark="−"
          label={rowLabelOf(row, String(row.id ?? ""))}
        />
      ))}

      {updated.map((row) => (
        <div key={row.id} className="border-muted border-l-2 pl-2">
          <p className="text-micro font-medium">
            {rowLabelOf(rowsById.get(row.id), row.id)}
          </p>
          {row.fields.map((f) => (
            <FieldChangeRow key={f.field} change={f} />
          ))}
        </div>
      ))}
    </div>
  );
}

function ActivityChanges({ logId }: { logId: string }) {
  const t = useTranslations("activity");
  const { data, isLoading, isError } = useActivityLogDetail(logId);

  if (isLoading)
    return (
      <p className="text-muted-foreground text-micro flex items-center gap-2 py-2">
        <Loader2 className="size-3 animate-spin" />
      </p>
    );

  if (isError || !data)
    return <p className="text-destructive text-micro py-2">{t("loadError")}</p>;

  const fields = data.changes.fields.filter((f) => !HIDDEN_FIELDS.has(f.field));

  if (!fields.length && !data.changes.children.length)
    return (
      <p className="text-muted-foreground text-micro py-2">{t("noChanges")}</p>
    );

  return (
    <div className="space-y-2 py-2">
      {fields.length > 0 && (
        <div>
          {fields.map((f) => (
            <FieldChangeRow key={f.field} change={f} />
          ))}
        </div>
      )}
      {data.changes.children.map((child) => (
        <ChildChangeBlock
          key={child.relation}
          child={child}
          label={relationLabel(child.relation, data.entity_type)}
          rowsById={indexRows(data.new_data, child.relation)}
        />
      ))}
    </div>
  );
}

interface ActivitySheetProps {
  readonly entityId: string | undefined;
  readonly label?: string;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}

/**
 * Sheet แสดงประวัติกิจกรรมของรายการเดียวเป็นไทม์ไลน์ เรียงล่าสุดขึ้นก่อน
 * แตะที่แถวเพื่อกางดูว่าฟิลด์ไหนและแถวลูกใดเปลี่ยนไป (โหลด diff ตอนกางเท่านั้น
 * เพราะ snapshot ของเอกสารมีขนาดใหญ่) เปิดได้ทีละแถว
 *
 * ใช้ได้กับทุก entity ที่ backend บันทึกกิจกรรมให้ — ทั้งเอกสารธุรกรรมและข้อมูลหลัก
 * โดยไม่ต้องบอกว่าเป็นตารางไหน เพราะ `useActivityLogByRecord` ยิงด้วย entity id
 * ล้วน (UUID ไม่ซ้ำข้ามตาราง) และชื่อตารางลูกที่ใช้ตั้งหัวข้อ diff อ่านจาก
 * `entity_type` ที่มากับ response รายตัวอยู่แล้ว
 *
 * ใช้ไทม์ไลน์ชุดเดียวกับ workflow history เพราะในหน้าเอกสารผู้ใช้เปิดทั้งสอง sheet
 * จากแถบเดียวกัน — คนละภาษาภาพในหน้าเดียวอ่านสะดุด
 *
 * ปกติไม่เรียกตรง ๆ — เรียกผ่าน `openActivity()` ของ `activity-sheet-host` แทน
 * @param props - คุณสมบัติของ sheet
 * @param props.entityId - รหัสของรายการที่จะดูประวัติ
 * @param props.label - เลขที่เอกสารหรือชื่อรายการ ใช้แสดงในคำอธิบายหัว sheet
 * @param props.open - สถานะเปิด/ปิดของ sheet
 * @param props.onOpenChange - callback เมื่อสถานะเปิด/ปิดเปลี่ยน
 * @returns React element ของ activity sheet
 * @example
 * <ActivitySheet
 *   entityId={purchaseOrder?.id}
 *   label={purchaseOrder?.po_no}
 *   open={open}
 *   onOpenChange={setOpen}
 * />
 */
export function ActivitySheet({
  entityId,
  label,
  open,
  onOpenChange,
}: ActivitySheetProps) {
  const t = useTranslations("activity");
  // key หัวข้อกับข้อความช่วงเวลาเป็นคำของไทม์ไลน์ ไม่ใช่ศัพท์ของ activity
  // จึงอยู่คนละ namespace กับ `t`
  const tHistory = useTranslations("history");
  const { dateFormat } = useProfile();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // fetch ต่อเมื่อ sheet เปิด — ผู้ใช้ส่วนใหญ่ไม่เคยกดปุ่มนี้
  const { data, isLoading, isError } = useActivityLogByRecord(
    open ? entityId : undefined,
    { perpage: 50 },
  );

  // backend เรียงเก่า→ใหม่ แต่คนอ่านอยากเห็นสิ่งที่เพิ่งทำก่อน
  const logs = [...(data?.data ?? [])].reverse();

  const steps = logs.map((log, i) => {
    const action = log.action?.toLowerCase() ?? "";
    const at = getLogCreatedAt(log);
    // แถวที่อยู่ "ใต้" แถวนี้คือกิจกรรมที่เก่ากว่า — ช่องว่างระหว่างสองแถวคือ
    // เวลาที่เอกสารถูกปล่อยไว้ก่อนจะถูกแตะอีกครั้ง
    const older = logs[i + 1];
    const titleKey = ACTION_TITLE_KEY[action];
    // create คือจุดกำเนิดเอกสารเสมอ จึงชนะ current แม้จะเป็นแถวล่าสุด
    const marker: HistoryTimelineMarker =
      action === "create" ? "origin" : i === 0 ? "current" : "default";

    return {
      id: log.id,
      at,
      day: formatDate(at, dateFormat),
      // action ที่ไม่รู้จักต้องไม่ไปยืมหัวข้อของ action อื่น
      title: titleKey ? tHistory(titleKey) : humanize(log.action ?? ""),
      actor: actorNameOf(log),
      fileName: fileNameOf(log),
      marker,
      tone: ALERT_ACTIONS.has(action)
        ? ("alert" as const)
        : ("default" as const),
      elapsed: older
        ? formatElapsed(getLogCreatedAt(older), at, tHistory)
        : null,
    };
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full overflow-hidden sm:max-w-xl lg:max-w-2xl"
      >
        <SheetHeader className="space-y-1">
          <SheetTitle className="text-sm">{t("title")}</SheetTitle>
          <SheetDescription className="text-xs">
            {label ? `${label} · ${t("description")}` : t("description")}
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="min-h-0 flex-1 px-4 pb-4">
          {isLoading && (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          )}

          {isError && (
            <p className="text-destructive text-xs">{t("loadError")}</p>
          )}

          {!isLoading && !isError && steps.length === 0 && (
            <p className="text-muted-foreground text-xs">{t("empty")}</p>
          )}

          {steps.length > 0 && (
            <HistoryTimeline groupByDay>
              {steps.map((step, i) => (
                <Fragment key={step.id}>
                  {step.day && step.day !== steps[i - 1]?.day && (
                    <HistoryTimelineDay>{step.day}</HistoryTimelineDay>
                  )}
                  {/* ไม่แสดง log.description — backend สร้างเป็น
                      "update on tb_purchase_request (uuid)" ซึ่งเผยชื่อตาราง
                      ภายในและไม่ได้บอกอะไรเกินจากหัวข้อ */}
                  <HistoryTimelineItem
                    at={step.at}
                    marker={step.marker}
                    tone={step.tone}
                    title={step.title}
                    elapsed={step.elapsed}
                    open={expandedId === step.id}
                    onOpenChange={(next) =>
                      setExpandedId(next ? step.id : null)
                    }
                    // Radix ไม่ mount เนื้อหาของ CollapsibleContent ตอนหุบ
                    // ActivityChanges จึงยังไม่ยิง request จนกว่าจะกาง — snapshot
                    // ของเอกสารก้อนใหญ่ ยิงทุกแถวตอนเปิด sheet ไม่ไหว
                    // (activity-sheet.test.tsx ล็อกพฤติกรรมนี้ไว้)
                    expandable={<ActivityChanges logId={step.id} />}
                  >
                    {step.actor}
                    {step.fileName && (
                      <span className="block break-words">{step.fileName}</span>
                    )}
                  </HistoryTimelineItem>
                </Fragment>
              ))}
            </HistoryTimeline>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
