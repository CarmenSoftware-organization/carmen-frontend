import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import en from "@/messages/en.json";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { CreditNoteDetail } from "@/types/credit-note";
import type { FormMode } from "@/types/form";
import { renderForm } from "@/lib/test-utils/form-characterization";

/**
 * characterization ของหัวใบลดหนี้ — จับ "ปุ่มอะไรโผล่ในโหมด/สถานะไหน" ก่อนย้ายไป
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
  usePermissionPrefix: () => "procurement.credit_note",
}));
const dispatchPermissionDenied = vi.fn();
vi.mock("@/components/permission-denied-dialog", () => ({
  dispatchPermissionDenied: (...a: unknown[]) => dispatchPermissionDenied(...a),
}));
vi.mock("./use-credit-note", async (orig) => ({
  ...(await orig<typeof import("./use-credit-note")>()),
  useCreditNoteComments: () => ({ comments: [], total: 0 }),
}));

const { CnHeader } = await import("./cn-header");

const DRAFT = {
  id: "00000000-0000-4000-8000-000000000001",
  cn_no: "CN26100001",
  doc_status: "draft",
  doc_version: 2,
} as unknown as CreditNoteDetail;

function renderHeader(
  mode: FormMode,
  opts: { creditNote?: CreditNoteDetail; isLocked?: boolean } = {},
) {
  const handlers = {
    onBack: vi.fn(),
    onEnterEdit: vi.fn(),
    onCancel: vi.fn(),
    onShowDelete: vi.fn(),
    onShowComment: vi.fn(),
  };
  renderForm(
    <TooltipProvider>
      <CnHeader
        creditNote={"creditNote" in opts ? opts.creditNote : DRAFT}
        mode={mode}
        isPending={false}
        deleteIsPending={false}
        isLocked={opts.isLocked ?? false}
        createdByName="Alice"
        {...handlers}
      />
    </TooltipProvider>,
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
});

describe("CnHeader — characterization", () => {
  it("title = เลขที่ใบ", () => {
    renderHeader("view");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "CN26100001",
    );
  });

  it("[view, draft] Edit + เมนู More — ไม่มี Delete/Save/Activity บนแถบ", async () => {
    const h = renderHeader("view");
    expect(headerButtons()).toEqual([en.common.edit, en.common.more]);
    await userEvent.click(screen.getByRole("button", { name: en.common.edit }));
    expect(h.onEnterEdit).toHaveBeenCalledTimes(1);
  });

  it("[view, locked] ไม่มี Edit", () => {
    renderHeader("view", { isLocked: true });
    expect(headerButtons()).toEqual([en.common.more]);
  });

  it("[edit, draft] Cancel · Save(submit cn-form) · Delete · More", async () => {
    const h = renderHeader("edit");
    expect(headerButtons()).toEqual([
      en.common.cancel,
      en.common.save,
      en.common.delete,
      en.common.more,
    ]);
    const save = screen.getByRole("button", { name: en.common.save });
    expect(save).toHaveAttribute("type", "submit");
    expect(save).toHaveAttribute("form", "cn-form");
    await userEvent.click(
      screen.getByRole("button", { name: en.common.delete }),
    );
    expect(h.onShowDelete).toHaveBeenCalledTimes(1);
  });

  it("[add] Cancel · Create — ไม่มี Delete/More", () => {
    renderHeader("add", { creditNote: undefined });
    expect(headerButtons()).toEqual([en.common.cancel, en.common.create]);
  });

  it("[view, ไม่มีสิทธิ์ update] Edit กดได้แต่เด้ง permission dialog", async () => {
    can.isAdmin = false;
    can.value = () => false;
    const h = renderHeader("view");
    const edit = screen.getByRole("button", { name: en.common.edit });
    expect(edit).toHaveAttribute("aria-disabled", "true");
    await userEvent.click(edit);
    expect(h.onEnterEdit).not.toHaveBeenCalled();
    expect(dispatchPermissionDenied).toHaveBeenCalledWith(
      "procurement.credit_note.update",
    );
  });
});
