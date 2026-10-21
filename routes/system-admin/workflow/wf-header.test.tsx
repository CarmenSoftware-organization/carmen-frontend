import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IntlProvider } from "use-intl";
import { TooltipProvider } from "@/components/ui/tooltip";
import en from "@/messages/en.json";
import type { Workflow } from "@/types/workflows";

const mockAvailability = vi.fn();

vi.mock("./use-wf-mutations", () => ({
  useDeleteWorkflow: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock("./use-wf-row-mutations", () => ({
  useWfRowMutations: () => ({ pendingId: null, duplicate: vi.fn() }),
}));
vi.mock("@/hooks/use-permission-prefix", () => ({
  usePermissionPrefix: () => undefined,
}));
vi.mock("./use-wf-availability", () => ({
  useWorkflowEditAvailability: () => mockAvailability(),
}));
// DocFormHeader ใช้ useLocation กับ useProfile ด้วย ไม่ได้ใช้แค่ useNavigate
vi.mock("react-router", () => ({
  useNavigate: () => vi.fn(),
  useLocation: () => ({ pathname: "/system-admin/workflow/wf-1" }),
  Link: ({ children }: { children?: unknown }) => children,
}));
vi.mock("@/hooks/use-profile", () => ({
  useProfile: () => ({ buCode: "BLAVG" }),
}));
vi.mock("@/components/share/activity-sheet-host", () => ({
  openActivity: vi.fn(),
}));

// WfHeader วาดปุ่มผ่าน FormToolbar ซึ่งเช็ค license/permission ด้วย useCan —
// เทสต์นี้สนใจตรรกะล็อกตามเอกสารค้าง ไม่ใช่สิทธิ์ ให้ผ่านหมด
vi.mock("@/hooks/use-can", () => ({
  useCan: () => ({
    can: () => true,
    canAny: () => true,
    canAll: () => true,
    guard: (_p: unknown, fn: () => void) => fn,
    isAdmin: true,
    permissions: [],
    canWrite: true,
  }),
}));

const { WfHeader } = await import("./wf-header");

const workflow = {
  id: "wf-1",
  name: "General PR",
  workflow_type: "purchase_request",
  is_active: true,
  description: null,
} as unknown as Workflow;

const counts = (in_progress: number) => ({
  data: {
    workflow_id: "wf-1",
    workflow_type: "purchase_request",
    can_edit: true,
    can_edit_stages: in_progress === 0,
    can_delete: in_progress === 0,
    blocked_reason: in_progress === 0 ? null : "WORKFLOW_STAGE_CHANGE_BLOCKED",
    documents: { draft: 318, in_progress, done: 52, total: 370 + in_progress },
  },
});

function renderHeader(onEdit = vi.fn()) {
  render(
    <IntlProvider locale="en" messages={en}>
      <TooltipProvider>
        <WfHeader
          workflow={workflow}
          isEditing={false}
          isPending={false}
          onEdit={onEdit}
          onCancel={vi.fn()}
          formId="wf-form"
        />
      </TooltipProvider>
    </IntlProvider>,
  );
  return onEdit;
}

describe("WfHeader — สิ่งที่เอกสารดำเนินการอยู่ล็อกจริง ๆ", () => {
  beforeEach(() => mockAvailability.mockReset());

  // เดิมปุ่มนี้ถูกปิดไปด้วย ทั้งที่ชื่อ ผู้อนุมัติ และรายการสินค้าบันทึกได้ตลอด การปิดจึงกันคนออกจากงานที่ทำได้จริง
  it("เข้าโหมดแก้ได้ ถึงจะมีเอกสาร in_progress ค้างอยู่", async () => {
    mockAvailability.mockReturnValue(counts(990));
    const onEdit = renderHeader();

    await userEvent.click(screen.getByRole("button", { name: /edit/i }));

    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  // ลบทำไม่ได้จริง เพราะทำให้รายการ stage หายไปทั้งอัน เอกสารที่ค้างจะไม่มีอะไรให้เดินต่อ
  it("กดลบแล้วเด้ง dialog บอกเหตุผล แทนที่จะเปิดกล่องยืนยันลบ", async () => {
    mockAvailability.mockReturnValue(counts(990));
    renderHeader();

    await userEvent.click(screen.getByRole("button", { name: /delete/i }));

    expect(
      screen.getByText(/can’t delete this workflow yet/i),
    ).toBeInTheDocument();
    // บอกจำนวนที่ค้าง ผู้ใช้จะได้รู้ว่าต้องไปเคลียร์เท่าไร
    expect(screen.getByText(/990 document/i)).toBeInTheDocument();
  });

  it("ลบได้ตามปกติเมื่อไม่มีเอกสารค้าง", async () => {
    mockAvailability.mockReturnValue(counts(0));
    renderHeader();

    await userEvent.click(screen.getByRole("button", { name: /delete/i }));

    expect(
      screen.queryByText(/can’t delete this workflow yet/i),
    ).not.toBeInTheDocument();
  });

  // ถ้าอ่านสถานะไม่ได้ อย่าล็อกปุ่ม — ปล่อยไปตกที่การ์ดฝั่ง backend ซึ่งเป็นตัวบังคับจริง
  it.each([
    ["query ยังโหลดไม่เสร็จ", { data: undefined }],
    ["query ล้มเหลว", { data: null }],
  ])("ปล่อยให้กด Edit ได้เมื่อ %s", async (_label, result) => {
    mockAvailability.mockReturnValue(result);
    const onEdit = renderHeader();

    await userEvent.click(screen.getByRole("button", { name: /edit/i }));

    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it("แสดงจำนวนเอกสารแยกสถานะบน header", () => {
    mockAvailability.mockReturnValue(counts(990));
    renderHeader();

    expect(screen.getByText(/draft: 318/i)).toBeInTheDocument();
    expect(screen.getByText(/in progress: 990/i)).toBeInTheDocument();
    expect(screen.getByText(/done: 52/i)).toBeInTheDocument();
  });
});
