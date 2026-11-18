import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { IntlProvider } from "use-intl";
import en from "@/messages/en.json";
import type { PurchaseRequestTemplate } from "@/types/purchase-request";
import { setRuntimeConfigForTests } from "@/lib/runtime-config";
import { PrtForm } from "./prt-form";

// FormToolbar → useCan() → useLicense() reads runtime config — without this it
// throws "Runtime config not loaded" on every render. enforced defaults to
// false here (shadow mode); this test only cares about layout, not license.
beforeEach(() => {
  setRuntimeConfigForTests({ BACKEND_URL: "", X_APP_ID: "app-1" });
});

const template: PurchaseRequestTemplate = {
  id: "prt-1",
  name: "Weekly Produce",
  description: "Standing order for the kitchen",
  workflow: { id: "wf-1", name: "PR Approval" },
  info: {},
  is_active: true,
  doc_version: 1,
  purchase_request_template_detail: [],
};

function renderForm(props: { template?: PurchaseRequestTemplate } = {}) {
  const qc = new QueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <IntlProvider locale="en" messages={en}>
        <MemoryRouter>
          <PrtForm {...props} />
        </MemoryRouter>
      </IntlProvider>
    </QueryClientProvider>,
  );
}

// The toolbar title repeats the template name, so assert on the plain-text
// slots themselves rather than on page-wide text matches.
const plainTexts = () =>
  Array.from(document.querySelectorAll('[data-slot="field-plain-text"]')).map(
    (el) => el.textContent,
  );

describe("PrtForm — document header layout", () => {
  // ช่องหัวใบอยู่ใน ribbon ของการ์ดหัวเอกสาร (ทรง PR) — ไม่มีการ์ด General แยกแล้ว
  it("renders only the Items section heading with its resolved description", () => {
    renderForm();

    const prt = en.procurement.purchaseRequestTemplate;
    expect(
      screen.getByRole("heading", { name: en.field.items }),
    ).toBeInTheDocument();
    // asserts the i18n key resolved — a missing key would render the path
    expect(screen.getByText(prt.itemsDesc)).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: en.field.general }),
    ).toBeNull();
  });

  it("renders the general inputs in add mode", () => {
    renderForm();
    expect(document.getElementById("prt-name")).not.toBeNull();
    expect(document.getElementById("prt-description")).not.toBeNull();
    expect(plainTexts()).toEqual([]);
  });
});

describe("PrtForm — view mode", () => {
  // ชื่อแม่แบบอยู่ที่ title ของการ์ดหัวเอกสาร สถานะอยู่ที่ badge — ribbon จึงเหลือ
  // Workflow + Description เป็นข้อความ (ทรงเดียวกับหัวเอกสาร PR)
  it("shows workflow and description as plain text, the name as the title", () => {
    renderForm({ template });

    expect(plainTexts()).toEqual([
      "PR Approval",
      "Standing order for the kitchen",
    ]);
    expect(
      screen.getByRole("heading", { name: "Weekly Produce" }),
    ).toBeInTheDocument();
    expect(document.getElementById("prt-name")).toBeNull();
    expect(document.getElementById("prt-description")).toBeNull();
  });

  it("falls back to an em dash for an empty description", () => {
    renderForm({ template: { ...template, description: "" } });
    // SettingField วาดค่าว่างเป็นขีดจาง ไม่ใช่ช่อง plain text
    expect(plainTexts()).toEqual(["PR Approval"]);
    expect(screen.getByText("—")).toBeInTheDocument();
  });
});
