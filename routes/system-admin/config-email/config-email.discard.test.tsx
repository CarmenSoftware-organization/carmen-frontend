import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import en from "@/messages/en.json";
import {
  fakeMutation,
  renderForm,
} from "@/lib/test-utils/form-characterization";

const upsertMut = fakeMutation();

const SAVED = {
  value: {
    smtp: {
      host: "smtp.old",
      port: 587,
      username: "user",
      password: "secret",
      from: "noreply@carmen.test",
    },
    recipients: ["admin@carmen.test"],
    cc: [],
    subject_prefix: "[Carmen Blue]",
  },
};

vi.mock("@/hooks/use-app-config", () => ({
  useAppConfigByKey: () => ({ data: SAVED, isLoading: false }),
  useUpsertAppConfig: () => upsertMut,
  useTestEmail: () => fakeMutation(),
}));

const ConfigEmailComponent = (await import("./config-email-component")).default;

function browserWouldWarn(): boolean {
  const e = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(e);
  return e.defaultPrevented;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ConfigEmailComponent — โหลดค่าที่บันทึกไว้", () => {
  it("เปิดหน้ามาต้องเห็น SMTP host ที่เคยตั้งไว้ ไม่ใช่ช่องว่าง", () => {
    renderForm(<ConfigEmailComponent />);
    const host = screen.getByPlaceholderText(
      "smtp.gmail.com",
    ) as HTMLInputElement;
    expect(host.value).toBe("smtp.old");
  });
});

describe("ConfigEmailComponent — กันข้อมูลหายตอนออกจากหน้า", () => {
  it("ยังไม่แก้อะไร ปิดแท็บได้เงียบ ๆ", () => {
    renderForm(<ConfigEmailComponent />);
    expect(browserWouldWarn()).toBe(false);
  });

  it("แก้แล้วยังไม่เซฟ ปิดแท็บต้องโดนเตือน", async () => {
    renderForm(<ConfigEmailComponent />);
    await userEvent.type(
      screen.getByPlaceholderText("smtp.gmail.com"),
      "-changed",
    );
    expect(browserWouldWarn()).toBe(true);
  });

  it("เซฟแล้วเลิกเตือน", async () => {
    renderForm(<ConfigEmailComponent />);
    await userEvent.type(
      screen.getByPlaceholderText("smtp.gmail.com"),
      "-changed",
    );
    await act(async () => {
      await userEvent.click(
        screen.getByRole("button", { name: new RegExp(en.common.save) }),
      );
    });

    expect(upsertMut.mutate).toHaveBeenCalledTimes(1);
    expect(browserWouldWarn()).toBe(false);
  });
});
