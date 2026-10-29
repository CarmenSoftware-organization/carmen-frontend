import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import en from "@/messages/en.json";
import type { PurchaseOrder } from "@/types/purchase-order";
import type { FormMode } from "@/types/form";
import { renderForm } from "@/lib/test-utils/form-characterization";

/**
 * characterization ของหัวใบสั่งซื้อ — จับ "ปุ่มอะไรโผล่ในโหมด/สถานะไหน" ก่อนย้ายไป
 * FormToolbar (spec 2026-10-02-form-page-shell-documents-design.md §4) ต้องเขียว
 * ทั้งก่อนและหลังย้าย — ข้อยกเว้นเดียวคือลำดับปุ่ม Close (spec §3) · ไม่ตรวจ variant/สี
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
  usePermissionPrefix: () => "procurement.purchase_order",
}));
const dispatchPermissionDenied = vi.fn();
vi.mock("@/components/permission-denied-dialog", () => ({
  dispatchPermissionDenied: (...a: unknown[]) => dispatchPermissionDenied(...a),
}));
vi.mock("../shared/use-purchase-order", async (orig) => ({
  ...(await orig<typeof import("../shared/use-purchase-order")>()),
  usePurchaseOrderComments: () => ({ comments: [], total: 0 }),
}));

const { PoHeader } = await import("./po-header");

const base = {
  id: "00000000-0000-4000-8000-000000000003",
  po_no: "PO26100001",
  po_type: "manual",
  doc_version: 1,
};
const DRAFT = { ...base, po_status: "draft" } as unknown as PurchaseOrder;
const IN_PROGRESS = {
  ...base,
  po_status: "in_progress",
} as unknown as PurchaseOrder;
const APPROVED = { ...base, po_status: "approved" } as unknown as PurchaseOrder;
const COMPLETED = {
  ...base,
  po_status: "completed",
} as unknown as PurchaseOrder;

function renderHeader(
  mode: FormMode,
  po?: PurchaseOrder,
  flags: {
    canEdit?: boolean;
    canClose?: boolean;
    terminalStatus?: boolean;
    isPending?: boolean;
  } = {},
) {
  const handlers = {
    onBack: vi.fn(),
    onCancel: vi.fn(),
    onEnterEdit: vi.fn(),
    onShowClose: vi.fn(),
    onShowComment: vi.fn(),
    onShowDelete: vi.fn(),
  };
  renderForm(
    <PoHeader
      purchaseOrder={po}
      mode={mode}
      canEdit={flags.canEdit ?? true}
      canClose={flags.canClose ?? false}
      terminalStatus={flags.terminalStatus ?? false}
      isPending={flags.isPending ?? false}
      deletePoIsPending={false}
      departmentName="Kitchen"
      buyerName="Bob"
      {...handlers}
    />,
  );
  return handlers;
}

/** ปุ่มของ DocActions ที่อยู่บนแถบเสมอ (ไม่ยุบลงเมนู ⋯ แล้ว) */
const VIEW_ACTIONS = [en.common.print, en.common.comment, en.activity.title];
const EDIT_ACTIONS = [en.common.comment, en.activity.title];

/** ชื่อปุ่มบนแถบหัว เรียงตาม DOM (ไม่รวมปุ่มย้อนกลับ) */
function headerButtons() {
  const row = document.querySelector("h1")!.closest(".relative")!;
  return [...row.querySelectorAll("button")]
    .map((b) => b.textContent?.trim() || b.getAttribute("aria-label") || "")
    .filter((n) => n !== en.common.goBack);
}

const SEND = en.procurement.purchaseOrder.sendEmail.button;

beforeEach(() => {
  vi.clearAllMocks();
  can.value = () => true;
  can.isAdmin = true;
  can.canWrite = true;
});

describe("PoHeader — characterization", () => {
  it("title = เลขที่ใบ", () => {
    renderHeader("view", DRAFT);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "PO26100001",
    );
  });

  it("[view, draft] Edit · Delete · Actions", async () => {
    const h = renderHeader("view", DRAFT);
    expect(headerButtons()).toEqual([
      en.common.edit,
      en.common.delete,
      ...VIEW_ACTIONS,
    ]);
    await userEvent.click(screen.getByRole("button", { name: en.common.edit }));
    expect(h.onEnterEdit).toHaveBeenCalledTimes(1);
    await userEvent.click(
      screen.getByRole("button", { name: en.common.delete }),
    );
    expect(h.onShowDelete).toHaveBeenCalledTimes(1);
  });

  it("[view, approved + canClose] Edit · Delete · Close · Send · Actions", async () => {
    const h = renderHeader("view", APPROVED, { canClose: true });
    expect(headerButtons()).toEqual([
      en.common.edit,
      en.common.delete,
      en.common.close,
      SEND,
      ...VIEW_ACTIONS,
    ]);
    await userEvent.click(
      screen.getByRole("button", { name: en.common.close }),
    );
    expect(h.onShowClose).toHaveBeenCalledTimes(1);
  });

  it("[view, in_progress + canClose] ไม่มี Close (เฉพาะ approved/sent)", () => {
    renderHeader("view", IN_PROGRESS, { canEdit: false, canClose: true });
    expect(headerButtons()).toEqual([...VIEW_ACTIONS]);
  });

  it("[view, completed + terminal] Send · Actions — ไม่มี Edit/Delete", () => {
    renderHeader("view", COMPLETED, { canEdit: false, terminalStatus: true });
    expect(headerButtons()).toEqual([SEND, ...VIEW_ACTIONS]);
  });

  it("[edit, draft] Cancel · Save · Delete · Actions", async () => {
    const h = renderHeader("edit", DRAFT);
    expect(headerButtons()).toEqual([
      en.common.cancel,
      en.common.save,
      en.common.delete,
      ...EDIT_ACTIONS,
    ]);
    const save = screen.getByRole("button", { name: en.common.save });
    expect(save).toHaveAttribute("type", "submit");
    expect(save).toHaveAttribute("form", "po-form");
    await userEvent.click(
      screen.getByRole("button", { name: en.common.cancel }),
    );
    expect(h.onCancel).toHaveBeenCalledTimes(1);
  });

  it("[add] Cancel · Save — ป้าย Save ไม่ใช่ Create · title = ชื่อ entity", () => {
    renderHeader("add");
    expect(headerButtons()).toEqual([en.common.cancel, en.common.save]);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      en.procurement.purchaseOrder.entity,
    );
  });

  it("[add, กำลังบันทึก] ปุ่ม Save ขึ้น Saving… ตามป้าย ไม่ใช่ Creating…", () => {
    renderHeader("add", undefined, { isPending: true });
    expect(screen.getByRole("button", { name: en.form.saving })).toBeDisabled();
    expect(screen.queryByText(en.form.creating)).not.toBeInTheDocument();
  });

  it("[view, ไม่มีสิทธิ์] Edit ยังกดได้ — key ของ PO ไม่อยู่ใน catalog จึงไม่ gate", async () => {
    can.isAdmin = false;
    can.value = () => false;
    const h = renderHeader("view", DRAFT);
    await userEvent.click(screen.getByRole("button", { name: en.common.edit }));
    expect(h.onEnterEdit).toHaveBeenCalledTimes(1);
    expect(dispatchPermissionDenied).not.toHaveBeenCalled();
  });

  it("[view, license หมดอายุ] Edit/Delete ถูกปิดพร้อมเหตุผล — Close ไม่ถูกปิด", () => {
    can.canWrite = false;
    renderHeader("view", APPROVED, { canClose: true });
    for (const name of [en.common.edit, en.common.delete]) {
      const b = screen.getByRole("button", { name });
      expect(b).toBeDisabled();
      expect(b).toHaveAttribute("title", en.license.writeDisabledTitle);
    }
    expect(screen.getByRole("button", { name: en.common.close })).toBeEnabled();
  });
});
