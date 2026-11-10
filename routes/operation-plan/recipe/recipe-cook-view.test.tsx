import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, fireEvent, screen } from "@testing-library/react";
import en from "@/messages/en.json";
import type { Recipe } from "@/types/recipe";
import { renderForm } from "@/lib/test-utils/form-characterization";

// ปุ่ม Print — hook จริงยิง query business unit เอง ตัดออกแล้วจับแค่ว่าเรียกพิมพ์อะไร
const print = vi.fn();
vi.mock("@/hooks/use-print-document", () => ({
  usePrintDocument: () => ({ print, isPrinting: false }),
}));
// หน่วยของ yield โหลดจาก API — หน้านี้ใช้แค่ชื่อ ไม่เกี่ยวกับปุ่ม Print
vi.mock("@/hooks/use-unit", () => ({
  useUnitById: () => ({ data: undefined }),
}));
let canWrite = true;
vi.mock("@/hooks/use-can", () => ({
  useCan: () => ({ can: () => canWrite, canWrite }),
}));
// รูปแบบการพิมพ์อ่านจาก config ของ BU (Default Setting → Recipe) — ป้อน config เองแทน query
let buConfig: {
  key: string;
  label: string;
  datatype: string;
  value: string;
}[] = [];
vi.mock("@/hooks/use-profile", () => ({
  useProfile: () => ({ defaultBu: { id: "bu-1" } }),
}));
vi.mock("@/hooks/use-business-unit", () => ({
  useBusinessUnit: () => ({ data: { config: buConfig } }),
}));

const { RecipeCookView } = await import("./recipe-cook-view");

// หน้าโหมดทำอาหารอ่านแค่ชื่อ รหัส เวลา ขั้นตอน วัตถุดิบ — ใส่เท่าที่ใช้แล้ว cast
const RECIPE = {
  id: "rec-1",
  code: "RCP-001",
  name: "Beef & Pork Meatball Mix",
  base_yield: 1,
  base_yield_unit: "",
  prep_time: 10,
  cook_time: 20,
  allergens: null,
  preparation_steps: [],
  ingredients: [],
} as unknown as Recipe;

beforeEach(() => {
  vi.clearAllMocks();
  canWrite = true;
  buConfig = [];
});

describe("RecipeCookView — ปุ่ม Print", () => {
  it("พิมพ์ Recipe Card Report ของสูตรนี้สูตรเดียว", async () => {
    renderForm(<RecipeCookView recipe={RECIPE} />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: en.common.print }));
    });

    expect(print).toHaveBeenCalledWith("RECIPE", {
      documentId: undefined,
      templateId: "4f71576d-397e-43d4-8394-d475f6ad9520",
      filters: {
        CategoryFrom: "ALL",
        CategoryTo: "ALL",
        RecipeFrom: "RCP-001",
        RecipeTo: "RCP-001",
        Status: "ALL",
        PrintSingle: true,
        // QR บนกระดาษพากลับมาหน้าสูตรนี้
        RecordType: "recipe",
        RecordId: "rec-1",
      },
    });
  });

  it("พิมพ์ด้วย template ที่ BU เลือกใน Default Setting → แบบฟอร์มการพิมพ์ → Recipe", async () => {
    buConfig = [
      {
        key: "print-form.recipe",
        label: "",
        datatype: "enum",
        value: "1553adcf-admin-made-form",
      },
    ];
    renderForm(<RecipeCookView recipe={RECIPE} />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: en.common.print }));
    });

    expect(print).toHaveBeenCalledWith(
      "RECIPE",
      expect.objectContaining({
        templateId: "1553adcf-admin-made-form",
        filters: expect.objectContaining({
          RecipeFrom: "RCP-001",
          PrintSingle: true,
        }),
      }),
    );
  });

  it("คนที่แก้สูตรไม่ได้ก็ยังพิมพ์ได้ (ไม่มีปุ่ม Edit)", () => {
    canWrite = false;
    renderForm(<RecipeCookView recipe={RECIPE} />);
    expect(screen.getByRole("button", { name: en.common.print })).toBeEnabled();
    expect(screen.queryByText(en.operationPlan.recipe.editRecipe)).toBeNull();
  });
});

describe("RecipeCookView — วิดีโอของสูตร", () => {
  const playerTitle = en.operationPlan.recipe.videoTitle.replace(
    "{name}",
    RECIPE.name,
  );

  it("มีลิงก์ YouTube → ฝัง player ของ youtube-nocookie บนสุดของคอลัมน์ขั้นตอน", () => {
    renderForm(
      <RecipeCookView
        recipe={{
          ...RECIPE,
          video_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        }}
      />,
    );
    const player = screen.getByTitle(playerTitle);
    expect(player.tagName).toBe("IFRAME");
    expect(player).toHaveAttribute(
      "src",
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0",
    );
    // YouTube ต้องรู้ origin ของหน้าที่ฝัง ไม่งั้น player ขึ้น Error 153
    expect(player).toHaveAttribute(
      "referrerpolicy",
      "strict-origin-when-cross-origin",
    );
    // ก่อนกล่อง "ยังไม่มีขั้นตอน" — วิดีโอเห็นก่อนเสมอ
    const steps = screen.getByRole("region", {
      name: en.operationPlan.recipe.stepsSection,
    });
    expect(steps.firstElementChild).toContainElement(player);
  });

  it.each([
    ["ไม่มีฟิลด์ (backend เก่า)", undefined],
    ["null", null],
    ["ไม่ใช่ลิงก์ YouTube", "https://vimeo.com/76979871"],
  ])("%s → ไม่มี player", (_label, videoUrl) => {
    const { container } = renderForm(
      <RecipeCookView recipe={{ ...RECIPE, video_url: videoUrl }} />,
    );
    expect(container.querySelector("iframe")).toBeNull();
  });
});
