import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import en from "@/messages/en.json";
import type { StoreRequisition } from "@/types/store-requisition";
import type { FormMode } from "@/types/form";
import { renderForm } from "@/lib/test-utils/form-characterization";

/**
 * characterization ของหัวใบเบิก — จับ "ปุ่มอะไรโผล่ในโหมด/stage role ไหน" ก่อนย้ายไป
 * FormToolbar (spec 2026-10-02-form-page-shell-documents-design.md §4) ต้องเขียว
 * ทั้งก่อนและหลังย้ายโดยไม่แก้ assertion — ไม่ตรวจ variant/สีของปุ่ม
 */

const can = { value: (_p: string) => true, isAdmin: true, canWrite: true };
vi.mock("@/hooks/use-can", () => ({
  useCan: () => ({
    can: (p: string) => can.value(p),
    canAny: () => true,
    canAll: () => true,
    guard: (_p: unknown, fn: () => void) => fn,
    isAdmin: can.isAdmin,
    permissions: [],
    canWrite: can.canWrite,
  }),
}));
vi.mock("@/hooks/use-permission-prefix", () => ({
  usePermissionPrefix: () => "store_operations.store_requisition",
}));
const dispatchPermissionDenied = vi.fn();
vi.mock("@/components/permission-denied-dialog", () => ({
  dispatchPermissionDenied: (...a: unknown[]) => dispatchPermissionDenied(...a),
}));
vi.mock("./use-sr", async (orig) => ({
  ...(await orig<typeof import("./use-sr")>()),
  useStoreRequisitionComments: () => ({ comments: [], total: 0 }),
}));
vi.mock("@/hooks/use-workflow", async (orig) => ({
  ...(await orig<typeof import("@/hooks/use-workflow")>()),
  useCreatableWorkflows: () => ({
    workflows: [],
    canCreate: true,
    isLoading: false,
  }),
}));

const { SrHeader } = await import("./sr-header");

const tSr = en.storeOperation.storeRequisition;
const base = {
  id: "00000000-0000-4000-8000-000000000004",
  sr_no: "SR26100001",
  doc_version: 1,
  role: "create",
};
const DRAFT = { ...base, doc_status: "draft" } as unknown as StoreRequisition;
const VIEW_ONLY = {
  ...base,
  doc_status: "in_progress",
  role: "view_only",
} as unknown as StoreRequisition;
const WITH_HISTORY = {
  ...base,
  doc_status: "in_progress",
  role: "approve",
  workflow_previous_stage: "Create",
  workflow_current_stage: "HOD",
  workflow_next_stage: "Store",
  workflow_history: [
    {
      action: "submit",
      at: "2026-10-01T03:00:00.000Z",
      user: { id: "u1", name: "Alice" },
      current_stage: "Create",
    },
  ],
} as unknown as StoreRequisition;

function renderHeader(
  mode: FormMode,
  sr?: StoreRequisition,
  opts: { hasDepartment?: boolean; isPending?: boolean } = {},
) {
  const handlers = {
    onBack: vi.fn(),
    onEdit: vi.fn(),
    onCancel: vi.fn(),
    onDelete: vi.fn(),
    onComment: vi.fn(),
  };
  renderForm(
    <SrHeader
      storeRequisition={sr}
      mode={mode}
      isPending={opts.isPending ?? false}
      hasDepartment={opts.hasDepartment ?? true}
      isDeletePending={false}
      dateFormat="dd/MM/yyyy"
      requesterName="Alice"
      departmentName="Kitchen"
      departmentCode="KIT"
      isLoading={false}
      {...handlers}
    />,
  );
  return handlers;
}

/** ชื่อปุ่มบนแถบหัว เรียงตาม DOM (ไม่รวมปุ่มย้อนกลับ) */
function headerButtons() {
  const row = document.querySelector("h1")!.closest(".relative")!;
  return [...row.querySelectorAll("button")]
    .map((b) => b.textContent?.trim() || b.getAttribute("aria-label") || "")
    .filter((n) => n !== en.common.goBack);
}

beforeEach(() => {
  vi.clearAllMocks();
  can.value = () => true;
  can.isAdmin = true;
  can.canWrite = true;
});

describe("SrHeader — characterization", () => {
  it("title = เลขที่ใบ", () => {
    renderHeader("view", DRAFT);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "SR26100001",
    );
  });

  it("[view, role create] Edit · More", async () => {
    const h = renderHeader("view", DRAFT);
    expect(headerButtons()).toEqual([en.common.edit, en.common.more]);
    await userEvent.click(screen.getByRole("button", { name: en.common.edit }));
    expect(h.onEdit).toHaveBeenCalledTimes(1);
  });

  it("[view, role view_only] ไม่มี Edit", () => {
    renderHeader("view", VIEW_ONLY);
    expect(headerButtons()).toEqual([en.common.more]);
  });

  it("[edit, draft] Cancel · Save · Delete · More", async () => {
    const h = renderHeader("edit", DRAFT);
    expect(headerButtons()).toEqual([
      en.common.cancel,
      en.common.save,
      en.common.delete,
      en.common.more,
    ]);
    const save = screen.getByRole("button", { name: en.common.save });
    expect(save).toHaveAttribute("type", "submit");
    expect(save).toHaveAttribute("form", "store-requisition-form");
    expect(save).toBeEnabled();
    await userEvent.click(
      screen.getByRole("button", { name: en.common.delete }),
    );
    expect(h.onDelete).toHaveBeenCalledTimes(1);
  });

  it("[edit, ไม่มีแผนก] Save ถูกปิดพร้อมเหตุผล", () => {
    renderHeader("edit", DRAFT, { hasDepartment: false });
    const save = screen.getByRole("button", { name: en.common.save });
    expect(save).toBeDisabled();
    expect(save).toHaveAttribute("title", tSr.noDepartment);
  });

  it("[add] Cancel · Save — ไม่มี Delete/More · title = ชื่อหน้า", () => {
    renderHeader("add");
    expect(headerButtons()).toEqual([en.common.cancel, en.common.save]);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      tSr.title,
    );
  });

  it("[add, กำลังบันทึก] ปุ่ม Save ขึ้น Saving… ตามป้าย ไม่ใช่ Creating…", () => {
    renderHeader("add", undefined, { isPending: true });
    expect(screen.getByRole("button", { name: en.form.saving })).toBeDisabled();
    expect(screen.queryByText(en.form.creating)).not.toBeInTheDocument();
  });

  it("[view, ไม่มีสิทธิ์] Edit ยังกดได้ — key ของ SR ไม่อยู่ใน catalog จึงไม่ gate", async () => {
    can.isAdmin = false;
    can.value = () => false;
    const h = renderHeader("view", DRAFT);
    await userEvent.click(screen.getByRole("button", { name: en.common.edit }));
    expect(h.onEdit).toHaveBeenCalledTimes(1);
    expect(dispatchPermissionDenied).not.toHaveBeenCalled();
  });

  it("[view, มีประวัติ] ปุ่มขั้นตอนเปิด history Sheet ที่หัวถืออยู่", async () => {
    renderHeader("view", WITH_HISTORY);
    await userEvent.click(
      screen.getByRole("button", { name: en.common.workflowHistoryHint }),
    );
    const sheet = await screen.findByRole("dialog");
    expect(
      within(sheet).getAllByText(tSr.tabWorkflowHistory).length,
    ).toBeGreaterThan(0);
  });

  it("[edit, license หมดอายุ] Save/Delete ถูกปิดพร้อมเหตุผล license", () => {
    can.canWrite = false;
    renderHeader("edit", DRAFT);
    for (const name of [en.common.save, en.common.delete]) {
      const b = screen.getByRole("button", { name });
      expect(b).toBeDisabled();
      expect(b).toHaveAttribute("title", en.license.writeDisabledTitle);
    }
  });
});
