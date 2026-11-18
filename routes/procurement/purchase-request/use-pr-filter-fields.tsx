import { useMemo } from "react";
import { MultiSelectFilter } from "@/components/ui/multi-select-filter";
import { PURCHASE_REQUEST_STATUS_OPTIONS } from "@/constant/purchase-request";
import { SENDBACK_FILTER_CLAUSE } from "@/constant/last-action";
import { WORKFLOW_TYPE } from "@/types/workflows";
import type { FilterFieldDef } from "@/types/list-filter";
import { usePurchaseRequestWorkflowStages } from "./use-purchase-request";
import {
  DEPARTMENT_ENTITY,
  requesterEntity,
} from "@/components/filter/entity-sources";

export function usePrFilterFields(): FilterFieldDef[] {
  const { data: stages } = usePurchaseRequestWorkflowStages();

  return useMemo<FilterFieldDef[]>(
    () => [
      {
        // ค่า option เป็น clause เต็มต่อตัว (pr_status|string:draft) — เลือกหลายตัว
        // MultiSelectFilter join เป็น clause ซ้ำ prefix ซึ่ง gateway parse รวมเป็น
        // IN query ให้เอง (parseFilterString รองรับทั้งสอง format โดยตั้งใจ)
        key: "filter",
        control: "custom",
        labelKey: "common.status",
        section: "listView.sectionDocument",
        render: (value, onChange) => (
          <MultiSelectFilter
            value={value}
            onChange={onChange}
            options={PURCHASE_REQUEST_STATUS_OPTIONS}
            className="w-full"
          />
        ),
      },
      {
        key: "workflow_current_stage",
        control: "stage",
        labelKey: "procurement.purchaseRequest.stage",
        section: "listView.sectionDocument",
        stages: stages ?? [],
      },
      {
        key: "workflow",
        control: "workflow",
        labelKey: "field.workflow",
        section: "listView.sectionDocument",
        workflowType: WORKFLOW_TYPE.PR,
      },
      {
        // ตัวกรอง "ใบที่ถูกตีกลับ" — dropdown สองตัวเลือก (ทั้งหมด / ส่งกลับ)
        // ค่าที่เก็บคือ clause เต็มอยู่แล้ว จึงไม่ต้องประกาศ toClause
        key: "sendback",
        control: "status",
        labelKey: "common.sendBack",
        section: "listView.sectionDocument",
        options: [
          { labelKey: "common.sendBack", value: SENDBACK_FILTER_CLAUSE },
        ],
      },
      {
        // ช่วงจำนวนเงินรวม — UI ฝั่ง frontend ก่อน: toClause คืนค่าว่างไว้ไม่ให้
        // clause หลุดไป backend (QueryParams ยังไม่รู้จัก num_range เดี๋ยว 500)
        // ค่า "จริง" ใน URL/saved views ปกติ — backend รองรับเมื่อไรค่อยถอด toClause
        key: "amount",
        control: "amount-range",
        labelKey: "field.totalAmount",
        fieldKey: "base_total_amount",
        section: "listView.sectionDocument",
        toClause: () => "",
      },
      {
        key: "department",
        control: "entity",
        entity: DEPARTMENT_ENTITY,
        labelKey: "field.department",
        section: "listView.sectionPeople",
      },
      {
        key: "user_id",
        control: "entity",
        entity: requesterEntity(),
        labelKey: "common.requester",
        section: "listView.sectionPeople",
      },
      {
        key: "pr_date",
        control: "date-range",
        labelKey: "field.prDate",
        fieldKey: "pr_date",
        section: "listView.sectionDate",
      },
    ],
    [stages],
  );
}
