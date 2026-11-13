import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useForm, useFormState } from "react-hook-form";
import { IntlProvider } from "use-intl";
import en from "@/messages/en.json";
import type { Product } from "@/types/workflows";
import { CategoryCheckboxList } from "./wf-routing-category-list";
import type { WorkflowCreateModel } from "./wf-form-schema";
import { DEFAULT_WORKFLOW_DATA } from "./wf-form-schema";

const product = {
  id: "p-1",
  product_category: { id: "c-1", name: "Food" },
} as unknown as Product;

function Harness() {
  const form = useForm<WorkflowCreateModel>({
    defaultValues: {
      name: "wf",
      workflow_type: "purchase_request_workflow",
      is_active: true,
      description: "",
      data: {
        ...DEFAULT_WORKFLOW_DATA,
        products: ["p-1"],
        routing_rules: [
          {
            name: "r",
            trigger_stage: "",
            condition: { field: "category", operator: "in", value: [] },
            action: { type: "SKIP", parameters: { target_stage: "" } },
          },
        ],
      },
    } as unknown as WorkflowCreateModel,
  });
  const { isDirty } = useFormState({ control: form.control });
  return (
    <>
      <CategoryCheckboxList
        form={form}
        allProducts={[product]}
        ruleIndex={0}
        isDisabled={false}
      />
      <output data-testid="dirty">{String(isDirty)}</output>
    </>
  );
}

// ต้นเหตุเดียวกับการติ๊กผู้ใช้ใน stage: setValue ไม่ติดธง dirty เอง
describe("CategoryCheckboxList — ติ๊กหมวดต้องนับเป็นการแก้ฟอร์ม", () => {
  it("ติ๊กหมวด → ฟอร์ม dirty", async () => {
    render(
      <IntlProvider locale="en" messages={en}>
        <Harness />
      </IntlProvider>,
    );
    expect(screen.getByTestId("dirty")).toHaveTextContent("false");

    await userEvent.click(screen.getByRole("checkbox"));

    expect(screen.getByTestId("dirty")).toHaveTextContent("true");
  });
});
