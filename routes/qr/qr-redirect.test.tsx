import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider, useLocation } from "react-router";
import { IntlProvider } from "use-intl";
import en from "@/messages/en.json";

const ID = "0f8c6a52-3f1e-4b6a-9d1c-2a7b5e9c4d10";

// บัญชีเป็นสมาชิก 2 BU · ตอนนี้อยู่ CARMEN-FIFO
const FIFO = {
  id: "bu-fifo",
  code: "CARMEN-FIFO",
  name: "CARMEN-FIFO",
  alias_name: "FIF",
};
const AVG = {
  id: "bu-avg",
  code: "CARMEN-AVG",
  name: "CARMEN-AVG",
  alias_name: "",
};
vi.mock("@/hooks/use-profile", () => ({
  useProfile: () => ({
    data: { business_unit: [FIFO, AVG] },
    defaultBu: FIFO,
  }),
}));
const mutateAsync = vi.fn();
vi.mock("@/hooks/use-switch-bu", () => ({
  useSwitchBu: () => ({ mutateAsync, isPending: false }),
}));

const { default: QrRedirect } = await import("./qr-redirect");

/** หน้าปลายทางทุกหน้าโชว์ path + query ที่มาถึง */
function Landed() {
  const { pathname, search } = useLocation();
  return <p data-testid="landed">{pathname + search}</p>;
}

function open(url: string) {
  const router = createMemoryRouter(
    [
      { path: "/qr/:type/:id", element: <QrRedirect /> },
      { path: "*", element: <Landed /> },
    ],
    { initialEntries: [url] },
  );
  render(
    <IntlProvider locale="en" messages={en}>
      <RouterProvider router={router} />
    </IntlProvider>,
  );
}

beforeEach(() => {
  mutateAsync.mockReset();
});

describe("QrRedirect — สแกน QR บนเอกสารที่พิมพ์", () => {
  it("เอกสารอยู่ใน BU ปัจจุบัน → ไปหน้าเอกสารเลย ไม่ถาม ไม่สลับ", async () => {
    open(`/qr/pr/${ID}?bu=CARMEN-FIFO`);
    expect(await screen.findByTestId("landed")).toHaveTextContent(
      `/procurement/purchase-request/${ID}`,
    );
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it("QR ไม่บอก BU → ไปหน้าเอกสารใน BU ปัจจุบัน", async () => {
    open(`/qr/vendor/${ID}`);
    expect(await screen.findByTestId("landed")).toHaveTextContent(
      `/vendor-management/vendor/${ID}`,
    );
  });

  it("SI ไปหน้า inventory adjustment พร้อม ?type=stock-in", async () => {
    open(`/qr/si/${ID}?bu=CARMEN-FIFO`);
    expect(await screen.findByTestId("landed")).toHaveTextContent(
      `/inventory-management/inventory-adjustment/${ID}?type=stock-in`,
    );
  });

  it("เอกสารอยู่อีก BU ที่เป็นสมาชิก → ถามก่อน แล้วสลับ BU ไปหน้าเอกสาร", async () => {
    mutateAsync.mockResolvedValue({});
    open(`/qr/grn/${ID}?bu=CARMEN-AVG`);

    expect(await screen.findByText(en.qrLink.switchTitle)).toBeInTheDocument();
    // ชื่อ BU แบบตัวเลือก BU บน navbar ("ชื่อย่อ - ชื่อ") ไม่มีชื่อย่อ = ชื่ออย่างเดียว
    expect(
      screen.getByText(
        en.qrLink.switchDescription
          .replace("{target}", "CARMEN-AVG")
          .replace("{current}", "FIF - CARMEN-FIFO"),
      ),
    ).toBeInTheDocument();
    expect(mutateAsync).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: en.qrLink.switchAndOpen }),
      );
    });

    expect(mutateAsync).toHaveBeenCalledWith("bu-avg");
    expect(await screen.findByTestId("landed")).toHaveTextContent(
      `/procurement/goods-receive-note/${ID}`,
    );
  });

  it("ไม่ยอมสลับ → ไป dashboard ไม่แตะ BU", async () => {
    open(`/qr/grn/${ID}?bu=CARMEN-AVG`);
    await screen.findByText(en.qrLink.switchTitle);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: en.common.cancel }));
    });

    expect(await screen.findByTestId("landed")).toHaveTextContent("/dashboard");
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it("สลับไม่สำเร็จ → ยังอยู่ที่ dialog (toast กลางแจ้ง error ให้แล้ว)", async () => {
    mutateAsync.mockRejectedValue(new Error("boom"));
    open(`/qr/grn/${ID}?bu=CARMEN-AVG`);
    await screen.findByText(en.qrLink.switchTitle);

    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: en.qrLink.switchAndOpen }),
      );
    });

    expect(screen.getByText(en.qrLink.switchTitle)).toBeInTheDocument();
    expect(screen.queryByTestId("landed")).toBeNull();
  });

  it("BU ที่บัญชีไม่ได้เป็นสมาชิก → บอกว่าเปิดไม่ได้", async () => {
    open(`/qr/pr/${ID}?bu=T02`);
    expect(
      await screen.findByText(en.qrLink.noAccess.replace("{bu}", "T02")),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("landed")).toBeNull();
  });

  it("QR ที่ไม่ได้ชี้ไปที่เอกสาร → บอกว่า QR นี้ใช้ไม่ได้", async () => {
    open(`/qr/eop/${ID}?bu=CARMEN-FIFO`);
    expect(await screen.findByText(en.qrLink.invalidLink)).toBeInTheDocument();
    expect(screen.queryByTestId("landed")).toBeNull();
  });
});
