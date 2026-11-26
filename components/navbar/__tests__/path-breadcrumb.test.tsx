import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { IntlProvider } from "use-intl";
import en from "@/messages/en.json";
import PathBreadcrumb from "@/components/navbar/path-breadcrumb";

const PR_ID = "1f2e3d4c-5b6a-7988-9a0b-1c2d3e4f5a6b";

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <IntlProvider locale="en" messages={en} timeZone="Asia/Bangkok">
        <PathBreadcrumb />
      </IntlProvider>
    </MemoryRouter>,
  );
}

describe("PathBreadcrumb", () => {
  it("หน้ารายการ: ชั้นสุดท้ายคือที่ที่ยืนอยู่ กดไม่ได้", () => {
    renderAt("/procurement/purchase-request");

    const crumb = screen.getByText(en.modules.purchaseRequest);
    expect(crumb).toHaveAttribute("aria-current", "page");
    expect(crumb.closest("a")).toBeNull();
  });

  // เดิม id ถูกกรองทิ้งแล้วไม่ใส่อะไรแทน "Purchase Request" เลยกลายเป็นชั้น
  // สุดท้าย = กดไม่ได้ ทั้งที่ตอนนั้นมันควรเป็นทางกลับหน้ารายการ
  it("เปิดใบอยู่: ชั้นโมดูลต้องกดกลับหน้ารายการได้", () => {
    renderAt(`/procurement/purchase-request/${PR_ID}`);

    expect(
      screen.getByRole("link", { name: en.modules.purchaseRequest }),
    ).toHaveAttribute("href", "/procurement/purchase-request");
  });

  it("segment ที่ไม่ใช่โมดูลก็ต้องแปล ไม่ใช่โผล่เป็นอังกฤษกลางประโยคไทย", () => {
    renderAt("/procurement/purchase-request/new");

    expect(screen.getByText(en.modules.new)).toBeInTheDocument();
  });

  // href ต้องประกอบจาก URL จริง ไม่ใช่ path ที่กรอง id ออกแล้ว
  it("ชั้นที่อยู่หลัง id ยังชี้ลิงก์ถูก", () => {
    renderAt(`/inventory-management/physical-count/${PR_ID}/entry`);

    expect(screen.getByText(en.modules.entry)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: en.modules.physicalCount }),
    ).toHaveAttribute("href", "/inventory-management/physical-count");
  });

  it("Accounting dashboard แสดงชื่อโมดูลครั้งเดียว ไม่ซ้ำ Dashboard > Dashboard", () => {
    renderAt("/accounts-payable");

    expect(screen.getByText(en.modules.accountsPayable)).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.queryAllByText(en.modules.apDashboard)).toHaveLength(0);
  });

  it("หน้าภายใน Accounting เริ่ม breadcrumb จากโมดูลที่เลือก", () => {
    renderAt("/accounts-receivable/invoice");

    expect(
      screen.getByRole("link", { name: en.modules.accountsReceivable }),
    ).toHaveAttribute("href", "/accounts-receivable");
    expect(screen.getByText(en.modules.arInvoice)).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.queryByText(en.modules.accounting)).toBeNull();
  });

  it("General Ledger ใช้ชื่อโมดูลเป็น breadcrumb ระดับแรก", () => {
    renderAt("/general-ledger/journal-voucher");

    expect(
      screen.getByRole("link", { name: en.modules.generalLedger }),
    ).toHaveAttribute("href", "/general-ledger");
    expect(screen.getByText(en.modules.journalVoucher)).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
});
