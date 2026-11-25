import { Fragment } from "react";
import { useTranslations } from "use-intl";
import {
  HistoryTimeline,
  HistoryTimelineDay,
  HistoryTimelineItem,
} from "@/components/share/history-timeline";
import { Badge } from "@/components/ui/badge";
import {
  unknownStatusEntry,
  type StatusConfigEntry,
} from "@/constant/status-config";
import { useProfile } from "@/hooks/use-profile";
import { formatDate, formatElapsed } from "@/lib/date-utils";

export interface WorkflowHistoryTimelineEntry {
  user: { id: string; name: string };
  action: string;
  at?: string;
  datetime?: string;
  current_stage?: string;
  next_stage?: string;
}

/**
 * action ที่ออกนอกทางปกติของ workflow — ก้าวพวกนี้เท่านั้นที่ได้ badge กับสีเตือน
 *
 * ก้าวปกติ (submitted/approved/reviewed/completed) เดาได้จากทิศทางของ stage
 * อยู่แล้ว การให้ badge ทุกแถวทำให้แถวที่มีปัญหาจริงจมหายไปกับแถวที่ไม่มีอะไร
 */
const ALERT_ACTIONS = new Set(["rejected", "sent_back", "voided", "cancelled"]);

const NO_STAGE = "-";

function entryAt(entry: WorkflowHistoryTimelineEntry): string {
  return entry.at ?? entry.datetime ?? "";
}

function stagesOf(entry: WorkflowHistoryTimelineEntry): string[] {
  return [entry.current_stage, entry.next_stage].filter(
    (stage): stage is string => !!stage && stage !== NO_STAGE,
  );
}

interface WorkflowHistoryTimelineProps {
  readonly history: WorkflowHistoryTimelineEntry[];
  readonly statusConfig: Record<string, StatusConfigEntry>;
  readonly emptyLabel: string;
  readonly requestorName?: string;
  readonly createdAt?: string;
}

/**
 * Timeline ประวัติ workflow ระดับเอกสาร — เรียงล่าสุดขึ้นบนสุด
 *
 * ลำดับความสำคัญคือ "การเปลี่ยน stage" เป็นหัวข้อ ผู้กระทำเป็นบรรทัดรอง และ
 * ช่องว่างของรางบอกว่าค้างอยู่ขั้นนั้นนานเท่าไร ซึ่งเป็นคำถามจริงของคนที่เปิด
 * หน้านี้ ("ทำไมใบนี้ยังไม่ผ่าน") ส่วน badge สงวนไว้ให้ก้าวที่ผิดปกติเท่านั้น
 * เพื่อให้แถวที่มีปัญหากระโดดออกมาแทนที่จะดังเท่ากันหมด
 *
 * ข้อมูลที่ซ้ำถูกยุบ — วันที่พิมพ์ครั้งเดียวต่อวัน และชื่อผู้กระทำแสดงเฉพาะตอน
 * เปลี่ยนคน (workflow ที่คนเดียวกดรวดเดียวเคยซ้ำชื่อทุกแถวโดยไม่บอกอะไรใหม่)
 *
 * ใช้ร่วมกันทุกโมดูลที่มี workflow ระดับเอกสาร (PR/PO/SR) — สิ่งที่ต่างกันคือชุด
 * action กับข้อความ empty เท่านั้น จึงรับมาเป็น prop ไม่ผูกกับโมดูลใดโมดูลหนึ่ง
 * (คู่กับ `ItemHistorySheet` ที่เป็นประวัติระดับรายบรรทัด)
 *
 * @param props.history - ประวัติ (เรียงเก่า→ใหม่ ตามที่ backend ส่งมา)
 * @param props.statusConfig - map action → สี/ป้ายของโมดูล
 * @param props.emptyLabel - ข้อความเมื่อไม่มีประวัติ
 * @param props.requestorName - ชื่อผู้ร้องขอ/ผู้ซื้อ แสดงเป็นแถวสุดท้าย
 * @param props.createdAt - วันที่สร้างเอกสาร แสดงในรางของแถวผู้ร้องขอ
 * @returns React element ของไทม์ไลน์ หรือข้อความว่างเมื่อไม่มีประวัติ
 * @example
 * <WorkflowHistoryTimeline
 *   history={purchaseRequest.workflow_history}
 *   statusConfig={PR_WORKFLOW_ACTION_CONFIG}
 *   emptyLabel={t("noWorkflowHistory")}
 *   requestorName={purchaseRequest.requestor_name}
 *   createdAt={purchaseRequest.audit?.created?.at}
 * />
 */
export function WorkflowHistoryTimeline({
  history,
  statusConfig,
  emptyLabel,
  requestorName,
  createdAt,
}: WorkflowHistoryTimelineProps) {
  const t = useTranslations("history");
  const { dateFormat } = useProfile();

  if (!history || history.length === 0) {
    return <p className="text-muted-foreground text-xs">{emptyLabel}</p>;
  }

  // Reverse เพื่อให้ล่าสุดขึ้นบนสุด
  const reversed = [...history].reverse();

  const steps = reversed.map((entry, i) => {
    // action ที่ไม่มีในแผนที่ต้องไม่ไปยืมป้ายของ action อื่น — เดิม fallback
    // เป็น `.submitted` ทำให้ action แปลก ๆ โชว์ว่า "SUBMITTED" ทั้งที่ไม่ใช่
    const config =
      statusConfig[entry.action] ?? unknownStatusEntry(entry.action);
    const at = entryAt(entry);
    // แถวที่อยู่ "ใต้" แถวนี้คือก้าวที่เก่ากว่า — ช่องว่างระหว่างสองแถวจึงเป็น
    // เวลาที่เอกสารค้างอยู่ก่อนจะถูกกระทำในแถวนี้
    const older = reversed[i + 1];
    const olderAt = older ? entryAt(older) : createdAt;
    const newer = reversed[i - 1];

    const stages = stagesOf(entry);
    const isAlert = ALERT_ACTIONS.has(entry.action);
    const title = stages.join(" → ");
    // บาง workflow ตั้งชื่อ stage สุดท้ายตรงกับชื่อ action (stage "Completed"
    // คู่กับ action `completed`) — โชว์ทั้งคู่ได้ข้อความซ้ำสองที่ในแถวเดียว
    const badgeRepeatsTitle =
      config.label.toLowerCase() === title.toLowerCase();

    return {
      key: `${entry.user.id}-${entry.action}-${i}`,
      at,
      day: formatDate(at, dateFormat),
      title,
      // ชื่อซ้ำกับแถวที่เพิ่งอ่านไปด้านบนไม่ได้บอกอะไรใหม่
      actor: newer?.user.id === entry.user.id ? "" : entry.user.name,
      isAlert,
      // badge แสดงเมื่อ stage อย่างเดียวเล่าเรื่องไม่จบ — ก้าวสุดท้ายที่ไม่มี
      // stage ถัดไปจะเหลือแค่ชื่อ stage เดี่ยว ๆ ซึ่งไม่บอกว่าเกิดอะไรขึ้น
      // ส่วนก้าวที่ผิดปกติต้องเห็นชัดเสมอไม่ว่าจะมีลูกศรหรือไม่
      showBadge: isAlert || (stages.length < 2 && !badgeRepeatsTitle),
      label: config.label,
      className: config.className,
      elapsed: olderAt ? formatElapsed(olderAt, at, t) : null,
    };
  });

  const originDay = createdAt ? formatDate(createdAt, dateFormat) : "";

  return (
    <HistoryTimeline groupByDay>
      {steps.map((step, i) => (
        <Fragment key={step.key}>
          {step.day && step.day !== steps[i - 1]?.day && (
            <HistoryTimelineDay>{step.day}</HistoryTimelineDay>
          )}
          <HistoryTimelineItem
            at={step.at}
            marker={i === 0 ? "current" : "default"}
            tone={step.isAlert ? "alert" : "default"}
            title={step.title}
            badge={
              step.showBadge ? (
                <Badge className={step.className} size="xs">
                  {step.label}
                </Badge>
              ) : undefined
            }
            elapsed={step.elapsed}
          >
            {step.actor}
          </HistoryTimelineItem>
        </Fragment>
      ))}

      {requestorName && (
        <Fragment key="origin">
          {originDay && originDay !== steps.at(-1)?.day && (
            <HistoryTimelineDay>{originDay}</HistoryTimelineDay>
          )}
          <HistoryTimelineItem
            at={createdAt ?? ""}
            marker="origin"
            title={t("documentCreated")}
          >
            {requestorName}
          </HistoryTimelineItem>
        </Fragment>
      )}
    </HistoryTimeline>
  );
}
