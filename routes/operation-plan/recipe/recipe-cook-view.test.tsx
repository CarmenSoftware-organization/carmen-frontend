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

describe("RecipeCookView — รูปของสูตร", () => {
  const img = (id: string, sort: number, alt: string | null = null) => ({
    id,
    alt_text: alt,
    sort_order: sort,
    is_primary: sort === 0,
    url: `https://files.test/${id}.jpg`,
  });
  const label = (
    key: "cookViewImage" | "cookShowImage",
    n: number,
    total = 3,
  ) =>
    en.operationPlan.recipe[key]
      .replace("{n}", String(n))
      .replace("{total}", String(total));
  // b เป็นรูปหลักแต่อยู่ลำดับที่ 2 — รูปใหญ่ต้องเริ่มที่รูปหลัก แถบรูปเรียงตาม sort_order
  const IMAGES = [
    { ...img("c", 2), is_primary: false },
    { ...img("b", 1, "Plated"), is_primary: true },
    { ...img("a", 0), is_primary: false },
  ];
  const heroSrc = (n: number) =>
    screen
      .getByRole("button", { name: label("cookViewImage", n) })
      .querySelector("img")
      ?.getAttribute("src");

  it("รูปใหญ่เริ่มที่รูปหลัก + แถบรูปย่อทั้งหมดข้างใต้ เรียงตาม sort_order อยู่ซ้ายของ hero คู่กับชื่อสูตร ก่อนคอลัมน์ขั้นตอน", () => {
    renderForm(<RecipeCookView recipe={{ ...RECIPE, images: IMAGES }} />);
    expect(heroSrc(2)).toBe("https://files.test/b.jpg");

    const strip = screen.getByRole("list", {
      name: en.operationPlan.recipe.cookImages,
    });
    expect(
      Array.from(strip.querySelectorAll("img")).map((el) =>
        el.getAttribute("src"),
      ),
    ).toEqual([
      "https://files.test/a.jpg",
      "https://files.test/b.jpg",
      "https://files.test/c.jpg",
    ]);
    // hero แบบหน้าสินค้า: รูปอยู่ช่องแรก (ซ้าย) ชื่อสูตรอยู่ช่องถัดไป (ขวา) ในกริดเดียวกัน
    const title = screen.getByRole("heading", { level: 1, name: RECIPE.name });
    const hero = title.parentElement?.parentElement;
    expect(hero?.firstElementChild).toContainElement(strip);
    expect(hero?.lastElementChild).toContainElement(title);
    // รูปไม่อยู่ในคอลัมน์ขั้นตอนแล้ว และมาก่อนคอลัมน์นั้น
    const steps = screen.getByRole("region", {
      name: en.operationPlan.recipe.stepsSection,
    });
    expect(steps).not.toContainElement(strip);
    expect(
      strip.compareDocumentPosition(steps) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("กดรูปย่อ → เปลี่ยนรูปใหญ่ ไม่เปิด popup", () => {
    renderForm(<RecipeCookView recipe={{ ...RECIPE, images: IMAGES }} />);
    const thumb = screen.getByRole("button", {
      name: label("cookShowImage", 3),
    });
    fireEvent.click(thumb);

    expect(heroSrc(3)).toBe("https://files.test/c.jpg");
    expect(thumb).toHaveAttribute("aria-current", "true");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("กดรูปใหญ่ → popup เปิดรูปขนาดใหญ่พร้อมแถบรูปทั้งหมด ปิดได้", () => {
    // carousel ใน popup (embla) ถาม matchMedia ตอน mount — jsdom ไม่มีให้
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
    }));
    renderForm(<RecipeCookView recipe={{ ...RECIPE, images: IMAGES }} />);
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: label("cookViewImage", 2) }),
    );

    // jsdom ไม่มี layout carousel จึงตรวจตำแหน่งเริ่มของ popup ไม่ได้ (ตรวจบนเบราว์เซอร์จริง)
    const dialog = screen.getByRole("dialog");
    for (const id of ["a", "b", "c"]) {
      expect(
        dialog.querySelectorAll(`img[src="https://files.test/${id}.jpg"]`)
          .length,
        // รูปใหญ่ใน carousel + รูปย่อในแถบด้านล่าง
      ).toBe(2);
    }

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("รูปเดียว → มีแต่รูปใหญ่ ไม่มีแถบรูปย่อ", () => {
    renderForm(
      <RecipeCookView recipe={{ ...RECIPE, images: [img("a", 0)] }} />,
    );
    expect(
      screen.getByRole("button", { name: label("cookViewImage", 1, 1) }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("list", { name: en.operationPlan.recipe.cookImages }),
    ).toBeNull();
  });

  it.each([
    ["ไม่มีฟิลด์", undefined],
    ["ว่าง", []],
  ])("%s → ไม่มีรูปบนหน้า", (_label, images) => {
    const { container } = renderForm(
      <RecipeCookView recipe={{ ...RECIPE, images } as unknown as Recipe} />,
    );
    expect(container.querySelector(".cursor-zoom-in")).toBeNull();
    expect(
      screen.queryByRole("list", { name: en.operationPlan.recipe.cookImages }),
    ).toBeNull();
  });

  it("ลิงก์วิดีโอของทั้งสูตรที่เคยบันทึกไว้ → ไม่ฝัง player แล้ว (วิดีโอมีเฉพาะรายขั้นตอน)", () => {
    const { container } = renderForm(
      <RecipeCookView
        recipe={
          {
            ...RECIPE,
            video_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
          } as unknown as Recipe
        }
      />,
    );
    expect(container.querySelector("iframe")).toBeNull();
  });
});

describe("RecipeCookView — วิดีโอของขั้นตอน", () => {
  const step = (id: string, n: number, videos: unknown) => ({
    id,
    doc_version: 1,
    sequence_no: n,
    title: null,
    description: `Step ${n} text`,
    duration: null,
    temperature: null,
    temperature_unit: null,
    equipment: [],
    chef_notes: null,
    safety_warnings: null,
    videos,
  });
  const stepTitle = (n: number) =>
    en.operationPlan.recipe.stepVideoTitle.replace("{n}", String(n));
  const recipe = {
    ...RECIPE,
    preparation_steps: [
      step("s1", 1, [
        { provider: "youtube", token: "aqz-KE-bpKQ", sort_order: 0 },
      ]),
      step("s2", 2, []),
    ],
  } as unknown as Recipe;

  it("ขั้นที่มีวิดีโอ → player อยู่ในการ์ดของขั้นนั้น ใต้คำอธิบาย", () => {
    renderForm(<RecipeCookView recipe={recipe} />);
    const player = screen.getByTitle(stepTitle(1));
    expect(player).toHaveAttribute(
      "src",
      "https://www.youtube-nocookie.com/embed/aqz-KE-bpKQ?rel=0",
    );
    const card = player.closest("article");
    expect(card).not.toBeNull();
    expect(card).toHaveTextContent("Step 1 text");
  });

  it("ไปขั้นที่ไม่มีวิดีโอ → ไม่มี player ของขั้น", () => {
    const { container } = renderForm(<RecipeCookView recipe={recipe} />);
    fireEvent.click(
      screen.getAllByRole("button", {
        name: en.operationPlan.recipe.cookNext,
      })[0],
    );
    expect(screen.getByRole("article")).toHaveTextContent("Step 2 text");
    expect(container.querySelector("iframe")).toBeNull();
  });
});
