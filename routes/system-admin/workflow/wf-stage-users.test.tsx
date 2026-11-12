import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useForm, useFormState, useWatch } from "react-hook-form";
import { IntlProvider } from "use-intl";
import en from "@/messages/en.json";
import type { Stage, User } from "@/types/workflows";
import { WfStageUsers } from "./wf-stage-users";
import type { WorkflowCreateModel } from "./wf-form-schema";
import { DEFAULT_WORKFLOW_DATA, buildDefaultStages } from "./wf-form-schema";

const user = (id: string, first: string): User => ({
  user_id: id,
  firstname: first,
  middlename: "",
  lastname: "Carmen",
  email: `${first.toLowerCase()}@carmen.com`,
  department: { id: "d-1", name: "Dept" },
});
const ANNA = user("u-anna", "Anna");
const BEN = user("u-ben", "Ben");

function Harness({ assigned }: { assigned: User[] }) {
  const stages = buildDefaultStages();
  const middle = {
    ...stages[1],
    is_hod: false,
    assigned_users: assigned,
  } as Stage;
  const form = useForm<WorkflowCreateModel>({
    defaultValues: {
      name: "wf",
      workflow_type: "purchase_request_workflow",
      is_active: true,
      description: "",
      data: {
        ...DEFAULT_WORKFLOW_DATA,
        stages: [stages[0], middle, stages[2]],
      },
    } as WorkflowCreateModel,
  });
  // หน้าจริงคำนวณชุดนี้จาก useWatch ใน wf-stage-detail — ทำแบบเดียวกัน
  const watched = useWatch({
    control: form.control,
    name: "data.stages.1.assigned_users",
  });
  const { isDirty } = useFormState({ control: form.control });
  return (
    <>
      <WfStageUsers
        form={form}
        index={1}
        users={[ANNA, BEN]}
        isMiddle
        isDisabled={false}
        isHod={false}
        assignedUserIds={new Set((watched ?? []).map((u) => u.user_id))}
      />
      <output data-testid="dirty">{String(isDirty)}</output>
      <output data-testid="assigned">
        {(watched ?? []).map((u) => u.user_id).join(",")}
      </output>
    </>
  );
}

function renderUsers(assigned: User[] = []) {
  render(
    <IntlProvider locale="en" messages={en}>
      <Harness assigned={assigned} />
    </IntlProvider>,
  );
}

// ติ๊กเพิ่ม/เอาคนออกต้องทำให้ฟอร์ม dirty ไม่งั้นออกจากหน้าแล้วไม่มีคำเตือน "ยังไม่ได้บันทึก"
// และการแก้หายเงียบ ๆ (เจอจริงบนหน้าแก้ workflow ขณะที่แก้ช่องคำอธิบายมีคำเตือนตามปกติ)
describe("WfStageUsers — เพิ่ม/เอาผู้ใช้ออกต้องนับเป็นการแก้ฟอร์ม", () => {
  it("ติ๊กเพิ่มผู้ใช้ → ฟอร์ม dirty", async () => {
    renderUsers([ANNA]);
    expect(screen.getByTestId("dirty")).toHaveTextContent("false");

    await userEvent.click(screen.getByRole("checkbox", { name: /Ben Carmen/ }));

    expect(screen.getByTestId("assigned")).toHaveTextContent("u-anna,u-ben");
    expect(screen.getByTestId("dirty")).toHaveTextContent("true");
  });

  it("เอาผู้ใช้ออก → ฟอร์ม dirty", async () => {
    renderUsers([ANNA, BEN]);

    await userEvent.click(
      screen.getByRole("checkbox", { name: /Anna Carmen/ }),
    );

    expect(screen.getByTestId("assigned")).toHaveTextContent("u-ben");
    expect(screen.getByTestId("dirty")).toHaveTextContent("true");
  });

  it("กดเลือกทั้งหมดที่หัวรายการ → ฟอร์ม dirty", async () => {
    renderUsers([]);

    await userEvent.click(
      screen.getByRole("checkbox", { name: /select all/i }),
    );

    expect(screen.getByTestId("assigned")).toHaveTextContent("u-anna,u-ben");
    expect(screen.getByTestId("dirty")).toHaveTextContent("true");
  });
});
