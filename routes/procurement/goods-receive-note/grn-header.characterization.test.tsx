import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import en from "@/messages/en.json";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { GoodsReceiveNote } from "@/types/goods-receive-note";
import type { FormMode } from "@/types/form";
import { renderForm } from "@/lib/test-utils/form-characterization";

/**
 * characterization ของหัวใบรับของ — จับ "ปุ่มอะไรโผล่ในโหมด/สถานะไหน" ก่อนย้ายไป
 * FormToolbar (spec 2026-10-02-form-page-shell-documents-design.md §4) ต้องเขียว
 * ทั้งก่อนและหลังย้ายโดยไม่แก้ assertion — ไม่ตรวจ variant/สีของปุ่ม
 */

const can = { value: (_p: string) => true, isAdmin: true };
vi.mock("@/hooks/use-can", () => ({
  useCan: () => ({
    can: (p: string) => can.value(p),
    canAny: () => true,
    canAll: () => true,
    guard: (_p: unknown, fn: () => void) => fn,
    isAdmin: can.isAdmin,
    permissions: [],
    canWrite: true,
  }),
}));
vi.mock("@/hooks/use-permission-prefix", () => ({
  usePermissionPrefix: () => "procurement.goods_received_note",
}));
const dispatchPermissionDenied = vi.fn();
vi.mock("@/components/permission-denied-dialog", () => ({
  dispatchPermissionDenied: (...a: unknown[]) => dispatchPermissionDenied(...a),
}));
vi.mock("@/hooks/use-goods-receive-note", async (orig) => ({
  ...(await orig<typeof import("@/hooks/use-goods-receive-note")>()),
  useGoodsReceiveNoteComments: () => ({ comments: [], total: 0 }),
}));

const { GrnHeader } = await import("./grn-header");

const base = {
  id: "00000000-0000-4000-8000-000000000002",
  grn_no: "GRN26100001",
  doc_type: "purchase_order",
  doc_version: 1,
  ap_invoices: [],
};
const DRAFT = { ...base, doc_status: "draft" } as unknown as GoodsReceiveNote;
const SAVED = { ...base, doc_status: "saved" } as unknown as GoodsReceiveNote;
const VOID = { ...base, doc_status: "voided" } as unknown as GoodsReceiveNote;
const AP_LOCKED = {
  ...base,
  doc_status: "committed",
  ap_invoices: [{ doc_no: "AP26100001" }],
} as unknown as GoodsReceiveNote;

function renderHeader(mode: FormMode, grn?: GoodsReceiveNote) {
  const handlers = {
    onBack: vi.fn(),
    onEnterEdit: vi.fn(),
    onCancel: vi.fn(),
    onShowComment: vi.fn(),
    onShowDelete: vi.fn(),
    onSaveDraft: vi.fn(),
    onSave: vi.fn(),
  };
  renderForm(
    <TooltipProvider>
      <GrnHeader
        goodsReceiveNote={grn}
        mode={mode}
        isPending={false}
        isCommitted={grn?.doc_status === "committed"}
        isVoid={grn?.doc_status === "voided"}
        deleteIsPending={false}
        receivedByName="Bob"
        departmentName="Kitchen"
        {...handlers}
      />
    </TooltipProvider>,
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

beforeEach(() => {
  vi.clearAllMocks();
  can.value = () => true;
  can.isAdmin = true;
});

describe("GrnHeader — characterization", () => {
  it("title = เลขที่ใบ", () => {
    renderHeader("view", DRAFT);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "GRN26100001",
    );
  });

  it("[view, draft] Edit + Actions", async () => {
    const h = renderHeader("view", DRAFT);
    expect(headerButtons()).toEqual([en.common.edit, ...VIEW_ACTIONS]);
    await userEvent.click(screen.getByRole("button", { name: en.common.edit }));
    expect(h.onEnterEdit).toHaveBeenCalledTimes(1);
  });

  it("[view, voided] ไม่มี Edit", () => {
    renderHeader("view", VOID);
    expect(headerButtons()).toEqual([...VIEW_ACTIONS]);
  });

  it("[view, committed + AP] Edit ถูกปิด", async () => {
    const h = renderHeader("view", AP_LOCKED);
    const edit = screen.getByRole("button", { name: en.common.edit });
    expect(edit).toBeDisabled();
    await userEvent.click(edit);
    expect(h.onEnterEdit).not.toHaveBeenCalled();
  });

  it("[edit, draft] Cancel · Save Draft · Save · Delete · Actions", async () => {
    const h = renderHeader("edit", DRAFT);
    expect(headerButtons()).toEqual([
      en.common.cancel,
      en.common.saveDraft,
      en.common.save,
      en.common.delete,
      ...EDIT_ACTIONS,
    ]);
    const save = screen.getByRole("button", { name: en.common.save });
    expect(save).toHaveAttribute("type", "button");
    await userEvent.click(save);
    expect(h.onSave).toHaveBeenCalledTimes(1);
    await userEvent.click(
      screen.getByRole("button", { name: en.common.saveDraft }),
    );
    expect(h.onSaveDraft).toHaveBeenCalledTimes(1);
  });

  it("[edit, saved] Cancel · Save · Actions — ไม่มี Save Draft/Delete", () => {
    renderHeader("edit", SAVED);
    expect(headerButtons()).toEqual([
      en.common.cancel,
      en.common.save,
      ...EDIT_ACTIONS,
    ]);
  });

  it("[add] Cancel · Save Draft · Create", () => {
    renderHeader("add");
    expect(headerButtons()).toEqual([
      en.common.cancel,
      en.common.saveDraft,
      en.common.create,
    ]);
  });

  it("[view, ไม่มีสิทธิ์ update] Edit กดได้แต่เด้ง permission dialog", async () => {
    can.isAdmin = false;
    can.value = () => false;
    const h = renderHeader("view", DRAFT);
    const edit = screen.getByRole("button", { name: en.common.edit });
    expect(edit).toHaveAttribute("aria-disabled", "true");
    await userEvent.click(edit);
    expect(h.onEnterEdit).not.toHaveBeenCalled();
    expect(dispatchPermissionDenied).toHaveBeenCalledWith(
      "procurement.goods_received_note.update",
    );
  });
});
