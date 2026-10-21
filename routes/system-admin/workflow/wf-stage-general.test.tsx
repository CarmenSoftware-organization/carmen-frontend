import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useForm } from "react-hook-form";
import { IntlProvider } from "use-intl";
import en from "@/messages/en.json";
import { WfStageGeneral } from "./wf-stage-general";
import type { WorkflowCreateModel } from "./wf-form-schema";
import { DEFAULT_WORKFLOW_DATA, buildDefaultStages } from "./wf-form-schema";
import type { Stage } from "@/types/workflows";

function makeStage(is_show_signature: boolean, name: string) {
  return { ...buildDefaultStages()[1], name, is_show_signature };
}

/**
 * stage ที่ "ไม่มี" key is_show_signature เลย (ไม่ใช่แค่ตั้งเป็น undefined) —
 * จำลอง workflow เก่าที่บันทึกไว้ก่อนมี feature นี้ ซึ่ง field.value จะเป็น
 * undefined จริง ๆ ตอน render ผ่าน react-hook-form Controller
 */
function makeStageWithoutSignatureKey(name: string) {
  const { is_show_signature: _is_show_signature, ...rest } =
    buildDefaultStages()[1];
  return { ...rest, name };
}

function Harness({
  stages,
  index,
  nameDisabled = false,
}: {
  stages: Stage[];
  index: number;
  nameDisabled?: boolean;
}) {
  const form = useForm<WorkflowCreateModel>({
    defaultValues: {
      name: "wf",
      workflow_type: "purchase_request_workflow",
      is_active: true,
      description: "",
      data: { ...DEFAULT_WORKFLOW_DATA, stages },
    } as WorkflowCreateModel,
  });
  return (
    <WfStageGeneral
      form={form}
      index={index}
      isFirst={false}
      isDisabled={false}
      isNameDisabled={nameDisabled}
    />
  );
}

function renderStage(stages: Stage[], index: number, nameDisabled = false) {
  render(
    <IntlProvider locale="en" messages={en}>
      <Harness stages={stages} index={index} nameDisabled={nameDisabled} />
    </IntlProvider>,
  );
}

const label = en.systemAdmin.workflow.showSignatureInReport;

describe("WfStageGeneral — ช่องชื่อ stage ตอนโครงถูกล็อก", () => {
  // เอกสารที่กำลังเดินอยู่เก็บชื่อ stage ไว้แล้วใช้ค้นหาทุกครั้งที่ทำ action เปลี่ยนชื่อเมื่อไรมันหาไม่เจอ
  // และเดินต่อไม่ได้เลย — ช่องนี้จึงต้องปิด ทั้งที่ช่องอื่นของ stage เดียวกันยังกรอกได้
  it("ปิดเฉพาะช่องชื่อ ช่อง SLA ในฟอร์มเดียวกันยังกรอกได้", () => {
    renderStage([makeStage(false, "HOD")], 0, true);

    expect(screen.getByDisplayValue("HOD")).toBeDisabled();
    // ช่อง SLA อยู่ในฟอร์มเดียวกัน แต่ไม่ได้ถูกอ่านตอนเอกสารนำทาง จึงต้องยังกรอกได้
    expect(screen.getByDisplayValue("0")).not.toBeDisabled();
  });

  it("เปิดช่องชื่อตามปกติเมื่อไม่มีอะไรล็อก", () => {
    renderStage([makeStage(false, "HOD")], 0, false);

    expect(screen.getByDisplayValue("HOD")).not.toBeDisabled();
  });
});

describe("WfStageGeneral — show signature in report", () => {
  it("ติ๊ก checkbox แล้วสถานะเปลี่ยนเป็น checked", async () => {
    const user = userEvent.setup();
    renderStage([makeStage(false, "A")], 0);

    const cb = screen.getByRole("switch", { name: label });
    expect(cb).not.toBeChecked();

    await user.click(cb);
    expect(cb).toBeChecked();
  });

  it("ครบ 5 แล้ว stage ที่ยังไม่ติ๊กถูก disable และขึ้นข้อความอธิบาย", () => {
    const stages = [
      makeStage(true, "A"),
      makeStage(true, "B"),
      makeStage(true, "C"),
      makeStage(true, "D"),
      makeStage(true, "E"),
      makeStage(false, "F"),
    ];
    renderStage(stages, 5);

    expect(screen.getByRole("switch", { name: label })).toBeDisabled();
    expect(
      screen.getByText(en.systemAdmin.workflow.signatureLimitReached),
    ).toBeInTheDocument();
  });

  it("ครบ 5 แล้ว stage ที่ติ๊กไว้แล้วยังปลดได้", async () => {
    const user = userEvent.setup();
    const stages = [
      makeStage(true, "A"),
      makeStage(true, "B"),
      makeStage(true, "C"),
      makeStage(true, "D"),
      makeStage(true, "E"),
    ];
    renderStage(stages, 0);

    const cb = screen.getByRole("switch", { name: label });
    expect(cb).toBeEnabled();

    await user.click(cb);
    expect(cb).not.toBeChecked();
  });

  it("stage เก่าที่ไม่มี key is_show_signature เลย ต้อง render เป็น unchecked, ติ๊กได้ตามปกติ, และไม่ทำให้ checkbox กลายเป็น uncontrolled", async () => {
    const user = userEvent.setup();
    // ถ้า guard `?? false` หลุดไป (field.value ยังเป็น undefined ตอน mount) Radix
    // Checkbox จะเริ่มแบบ uncontrolled แล้วสลับมาเป็น controlled ทันทีที่ค่าจริง
    // ถูกเซ็ต (เช่นตอนคลิก) — Radix เตือนการสลับโหมดนี้ด้วย console.warn เสมอ
    // การจับ warning นี้คือสิ่งที่พิสูจน์ว่า checkbox ยังผูกกับ form state ตั้งแต่ต้น
    // ไม่ใช่แค่ "กดแล้ว checked" ซึ่ง Radix ทำให้ดูถูกต้องแม้ตอน uncontrolled ก็ตาม
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    renderStage([makeStageWithoutSignatureKey("A")], 0);

    const cb = screen.getByRole("switch", { name: label });
    expect(cb).not.toBeChecked();

    await user.click(cb);
    expect(cb).toBeChecked();
    expect(warnSpy).not.toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  it("ยังไม่ครบ 5 ต้องไม่ขึ้นข้อความ signatureLimitReached", () => {
    const stages = [makeStage(true, "A"), makeStage(false, "B")];
    renderStage(stages, 1);

    expect(
      screen.queryByText(en.systemAdmin.workflow.signatureLimitReached),
    ).not.toBeInTheDocument();
  });
});
