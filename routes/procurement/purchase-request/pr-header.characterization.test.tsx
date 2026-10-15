import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import en from "@/messages/en.json";
import type { ReactNode } from "react";
import type { PurchaseRequest } from "@/types/purchase-request";
import type { FormMode } from "@/types/form";
import { renderForm } from "@/lib/test-utils/form-characterization";

/**
 * characterization ของหัวใบขอซื้อ — จับ "ปุ่มอะไรโผล่ในโหมด/สถานะ/role ไหน" และ ribbon
 * ก่อนย้ายไป FormToolbar (spec 2026-10-02-form-page-shell-documents-design.md §4)
 * API ของ PrHeader เปลี่ยนในการย้าย (actions → props ของปุ่ม) จึงแก้ได้เฉพาะ JSX ใน
 * renderHeader — assertion ต้องเขียวทั้งก่อนและหลังโดยไม่แก้ · ไม่ตรวจ variant/สี
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
// leaf purchaseRequest ไม่มี permission (module-list.ts) → prefix จริงคือ undefined
vi.mock("@/hooks/use-permission-prefix", () => ({
  usePermissionPrefix: () => undefined,
}));
const dispatchPermissionDenied = vi.fn();
vi.mock("@/components/permission-denied-dialog", () => ({
  dispatchPermissionDenied: (...a: unknown[]) => dispatchPermissionDenied(...a),
}));
vi.mock("./use-purchase-request", async (orig) => ({
  ...(await orig<typeof import("./use-purchase-request")>()),
  usePurchaseRequestComments: () => ({ comments: [], total: 0 }),
}));
vi.mock("@/hooks/use-workflow", async (orig) => ({
  ...(await orig<typeof import("@/hooks/use-workflow")>()),
  useCreatableWorkflows: () => ({
    workflows: [],
    canCreate: true,
    isLoading: false,
  }),
}));

const { PrHeader } = await import("./pr-header");

const tPr = en.procurement.purchaseRequest;
const base = {
  id: "00000000-0000-4000-8000-000000000005",
  pr_no: "PR26100001",
  doc_version: 1,
};
const DRAFT = { ...base, pr_status: "draft" } as unknown as PurchaseRequest;
const IN_PROGRESS = {
  ...base,
  pr_status: "in_progress",
  workflow_previous_stage: "Create",
  workflow_current_stage: "HOD",
  workflow_next_stage: "Purchase",
} as unknown as PurchaseRequest;
const VOIDED = { ...base, pr_status: "voided" } as unknown as PurchaseRequest;

interface Opts {
  role?: string;
  hasHistory?: boolean;
  workflowName?: string;
  workflowField?: ReactNode;
  description?: string;
  descriptionField?: ReactNode;
  isPending?: boolean;
}

function renderHeader(mode: FormMode, pr?: PurchaseRequest, opts: Opts = {}) {
  const h = {
    onBack: vi.fn(),
    onEdit: vi.fn(),
    onCancel: vi.fn(),
    onDelete: vi.fn(),
    onComment: vi.fn(),
    onShowHistory: vi.fn(),
  };
  const role = opts.role ?? "create";
  renderForm(
    <PrHeader
      purchaseRequest={pr}
      mode={mode}
      role={role}
      isPending={opts.isPending ?? false}
      isDeletePending={false}
      onBack={h.onBack}
      onEdit={h.onEdit}
      onCancel={h.onCancel}
      onDelete={h.onDelete}
      onComment={h.onComment}
      reqName="Alice"
      departmentName="Kitchen"
      prDateDisplay="01/10/2026"
      workflowName={opts.workflowName}
      workflowField={opts.workflowField}
      description={opts.description}
      descriptionField={opts.descriptionField}
      hasHistory={opts.hasHistory}
      onShowHistory={h.onShowHistory}
    />,
  );
  return h;
}

/** แถวหัว (title + ปุ่ม) — ไม่รวม subtitle และ ribbon */
function headerRow() {
  return document.querySelector("h1")!.closest(".relative")!;
}

/** ชื่อปุ่มบนแถบหัว เรียงตาม DOM (ไม่รวมปุ่มย้อนกลับ) */
function headerButtons() {
  return [...headerRow().querySelectorAll("button")]
    .map((b) => b.textContent?.trim() || b.getAttribute("aria-label") || "")
    .filter((n) => n !== en.common.goBack);
}

beforeEach(() => {
  vi.clearAllMocks();
  can.value = () => true;
  can.isAdmin = true;
  can.canWrite = true;
});

describe("PrHeader — characterization", () => {
  it("title = เลขที่ใบ", () => {
    renderHeader("view", DRAFT);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "PR26100001",
    );
  });

  it("[view, draft, create] Edit · Delete · More", async () => {
    const h = renderHeader("view", DRAFT);
    expect(headerButtons()).toEqual([
      en.common.edit,
      en.common.delete,
      en.common.more,
    ]);
    await userEvent.click(screen.getByRole("button", { name: en.common.edit }));
    expect(h.onEdit).toHaveBeenCalledTimes(1);
    await userEvent.click(
      screen.getByRole("button", { name: en.common.delete }),
    );
    expect(h.onDelete).toHaveBeenCalledTimes(1);
  });

  it("[view, in_progress, approve] Edit · More — ไม่มี Delete (เฉพาะ draft)", () => {
    renderHeader("view", IN_PROGRESS, { role: "approve" });
    expect(headerButtons()).toEqual([en.common.edit, en.common.more]);
  });

  it("[view, view_only] More อย่างเดียว", () => {
    renderHeader("view", IN_PROGRESS, { role: "view_only" });
    expect(headerButtons()).toEqual([en.common.more]);
  });

  it("[view, voided] ไม่มี Edit", () => {
    renderHeader("view", VOIDED);
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
    expect(save).toHaveAttribute("form", "purchase-request-form");
    await userEvent.click(
      screen.getByRole("button", { name: en.common.cancel }),
    );
    expect(h.onCancel).toHaveBeenCalledTimes(1);
  });

  it("[add] Cancel · Save — ป้าย Save ไม่ใช่ Create · title = ชื่อหน้า", () => {
    renderHeader("add");
    expect(headerButtons()).toEqual([en.common.cancel, en.common.save]);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      tPr.title,
    );
  });

  it("[add, กำลังบันทึก] ปุ่ม Save ขึ้น Saving… ตามป้าย ไม่ใช่ Creating…", () => {
    renderHeader("add", undefined, { isPending: true });
    expect(screen.getByRole("button", { name: en.form.saving })).toBeDisabled();
    expect(screen.queryByText(en.form.creating)).not.toBeInTheDocument();
  });

  it("ribbon: โหมดอ่านโชว์ workflow + description เป็นช่อง disabled ใต้แถวหัว", () => {
    renderHeader("view", DRAFT, {
      workflowName: "PR Standard",
      description: "Need for event",
    });
    const wf = screen.getByDisplayValue("PR Standard");
    const desc = screen.getByDisplayValue("Need for event");
    expect(wf).toBeDisabled();
    expect(desc).toBeDisabled();
    expect(headerRow().contains(wf)).toBe(false);
  });

  it("ribbon: ช่องที่แก้ได้ส่งเป็น node มาวางแทนช่อง disabled", () => {
    renderHeader("edit", DRAFT, {
      workflowField: <span>WF-FIELD</span>,
      descriptionField: <span>DESC-FIELD</span>,
    });
    expect(screen.getByText("WF-FIELD")).toBeInTheDocument();
    expect(screen.getByText("DESC-FIELD")).toBeInTheDocument();
  });

  it("[view, มีประวัติ] ปุ่มขั้นตอนเรียก onShowHistory", async () => {
    const h = renderHeader("view", IN_PROGRESS, {
      role: "approve",
      hasHistory: true,
    });
    await userEvent.click(
      screen.getByRole("button", { name: en.common.workflowHistoryHint }),
    );
    expect(h.onShowHistory).toHaveBeenCalledTimes(1);
  });

  it("[view, ไม่มีสิทธิ์] Edit ยังกดได้ — leaf ไม่มี permission จึงไม่ gate", async () => {
    can.isAdmin = false;
    can.value = () => false;
    const h = renderHeader("view", DRAFT);
    await userEvent.click(screen.getByRole("button", { name: en.common.edit }));
    expect(h.onEdit).toHaveBeenCalledTimes(1);
    expect(dispatchPermissionDenied).not.toHaveBeenCalled();
  });

  it("[view, license หมดอายุ] Edit/Delete ถูกปิดพร้อมเหตุผล license", () => {
    can.canWrite = false;
    renderHeader("view", DRAFT);
    for (const name of [en.common.edit, en.common.delete]) {
      const b = screen.getByRole("button", { name });
      expect(b).toBeDisabled();
      expect(b).toHaveAttribute("title", en.license.writeDisabledTitle);
    }
  });
});
