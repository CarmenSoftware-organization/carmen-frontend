import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, fireEvent, screen, within } from "@testing-library/react";
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

// รูปของขั้นตอนดึงแยกต่อขั้น — ป้อนเองตาม id ของขั้นแทน query
let stepImagesById: Record<string, unknown[]> = {};
vi.mock("./use-recipe-step-images", () => ({
  useRecipeStepImages: (_recipeId: string, stepId?: string) => ({
    data: stepId ? (stepImagesById[stepId] ?? []) : [],
  }),
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
  stepImagesById = {};
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

  it("ไม่มีลิงก์วิดีโอ → ไม่มี player", () => {
    const { container } = renderForm(<RecipeCookView recipe={RECIPE} />);
    expect(container.querySelector("iframe")).toBeNull();
  });
});

describe("RecipeCookView — วิดีโอของสูตร + รูปของขั้นตอน", () => {
  const R = en.operationPlan.recipe;
  const step = (id: string, n: number, videos: unknown = []) => ({
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
  const stepImg = (id: string, n: number, url: string | null) => ({
    id,
    url,
    alt_text: null,
    caption: null,
    sort_order: n,
    is_primary: n === 0,
  });
  const recipe = {
    ...RECIPE,
    video_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    preparation_steps: [
      // ขั้น 1 มีวิดีโอรายขั้นตอนของเดิมค้างอยู่ — หน้าสูตรไม่เล่นแล้ว
      step("s1", 1, [
        { provider: "youtube", token: "aqz-KE-bpKQ", sort_order: 0 },
      ]),
      step("s2", 2),
    ],
  } as unknown as Recipe;
  const stepList = (n: number) =>
    screen.queryByRole("list", {
      name: R.cookStepImages.replace("{n}", String(n)),
    });
  const goNext = () =>
    fireEvent.click(screen.getAllByRole("button", { name: R.cookNext })[0]);

  // แบบหน้าสินค้า Shopee (ผู้ใช้สั่ง 2026-11-16 "เอา video ไปใส่ใน Menu"): วิดีโอเป็นช่องแรกของแกลเลอรีรูปเมนู
  const EMBED = "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0";
  const gallery = () => screen.getByRole("list", { name: R.cookImages });
  const photo = (id: string, n: number) => ({
    id,
    alt_text: null,
    sort_order: n,
    is_primary: n === 0,
    url: `https://files.test/${id}.jpg`,
  });
  const withPhotos = {
    ...recipe,
    images: [photo("a", 0), photo("b", 1)],
  } as unknown as Recipe;

  it("วิดีโออยู่ในแกลเลอรีรูปเมนูเป็นช่องแรก เปิดหน้ามาเล่นในกรอบใหญ่ ไม่อยู่ในคอลัมน์ขั้นตอน · วิดีโอรายขั้นตอนของเดิมไม่ถูกฝัง", () => {
    const { container } = renderForm(<RecipeCookView recipe={withPhotos} />);
    const frames = container.querySelectorAll("iframe");
    expect(frames).toHaveLength(1);
    expect(frames[0]).toHaveAttribute("src", EMBED);
    expect(frames[0]).toHaveAttribute(
      "title",
      R.videoTitle.replace("{name}", RECIPE.name),
    );
    const steps = screen.getByRole("region", { name: R.stepsSection });
    expect(steps).not.toContainElement(frames[0]);
    // ช่องแรกของแถบรูปย่อ = วิดีโอ (ภาพตัวอย่างจาก YouTube) และเป็นช่องที่เปิดอยู่
    const first = gallery().querySelector("li button");
    expect(first).toHaveAccessibleName(R.cookShowVideo);
    expect(first).toHaveAttribute("aria-current", "true");
    expect(first?.querySelector("img")).toHaveAttribute(
      "src",
      "https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg",
    );
    // กรอบใหญ่กับชื่อสูตรอยู่ hero เดียวกัน (แกลเลอรีซ้าย ชื่อขวา)
    const title = screen.getByRole("heading", { level: 1, name: RECIPE.name });
    expect(
      title.parentElement?.parentElement?.firstElementChild,
    ).toContainElement(frames[0]);
  });

  it("กดรูปย่อ → กรอบใหญ่เป็นรูป (player หาย) · กดช่องวิดีโอ → กลับมาที่วิดีโอ", () => {
    const { container } = renderForm(<RecipeCookView recipe={withPhotos} />);
    fireEvent.click(
      screen.getByRole("button", {
        name: R.cookShowImage.replace("{n}", "2").replace("{total}", "2"),
      }),
    );
    expect(container.querySelector("iframe")).toBeNull();
    expect(
      screen
        .getByRole("button", {
          name: R.cookViewImage.replace("{n}", "2").replace("{total}", "2"),
        })
        .querySelector("img"),
    ).toHaveAttribute("src", "https://files.test/b.jpg");

    fireEvent.click(screen.getByRole("button", { name: R.cookShowVideo }));
    expect(container.querySelector("iframe")).toHaveAttribute("src", EMBED);
  });

  it("มีวิดีโอแต่ไม่มีรูป → แกลเลอรีมีแค่วิดีโอ ไม่มีแถบรูปย่อ", () => {
    const { container } = renderForm(<RecipeCookView recipe={recipe} />);
    expect(container.querySelector("iframe")).toHaveAttribute("src", EMBED);
    expect(screen.queryByRole("list", { name: R.cookImages })).toBeNull();
    // ยังแบ่งคอลัมน์ให้แกลเลอรีข้างชื่อสูตร
    const title = screen.getByRole("heading", { level: 1, name: RECIPE.name });
    expect(title.parentElement?.parentElement?.className).toContain(
      "grid-cols-[13rem",
    );
  });

  it("ขั้นที่มีรูป → รูปอยู่ข้างการ์ดของขั้น (นอกการ์ด) กดรูปย่อเปลี่ยนรูปใหญ่", () => {
    stepImagesById = {
      s1: [
        stepImg("a", 0, "https://files.test/s1-a.jpg"),
        stepImg("b", 1, "https://files.test/s1-b.jpg"),
        // ออก URL ไม่ได้ = ไม่แสดงรูปนั้น
        stepImg("c", 2, null),
      ],
    };
    renderForm(<RecipeCookView recipe={recipe} />);
    const list = stepList(1);
    expect(list).not.toBeNull();
    expect(list!.querySelectorAll("img")).toHaveLength(2);
    expect(list!.closest("article")).toBeNull();
    const card = screen.getByRole("article");
    expect(card).toHaveTextContent("Step 1 text");
    expect(card.parentElement).toContainElement(list);

    const big = () => card.parentElement!.querySelector(".cursor-zoom-in img");
    expect(big()).toHaveAttribute("src", "https://files.test/s1-a.jpg");
    fireEvent.click(list!.querySelectorAll("button")[1]);
    expect(big()).toHaveAttribute("src", "https://files.test/s1-b.jpg");
  });

  it("ไปขั้นที่ไม่มีรูป → ไม่มีรูปของขั้น การ์ดขั้นเต็มแถว", () => {
    stepImagesById = { s1: [stepImg("a", 0, "https://files.test/s1-a.jpg")] };
    renderForm(<RecipeCookView recipe={recipe} />);
    goNext();
    const card = screen.getByRole("article");
    expect(card).toHaveTextContent("Step 2 text");
    expect(card.parentElement!.querySelector(".cursor-zoom-in")).toBeNull();
    expect(card.parentElement!.className).not.toContain("grid-cols");
  });
});

// ปุ่มเลือกขั้นแบบเลขหน้าของ Google (ผู้ใช้สั่ง 2026-11-16): วงกลมเลขขั้นครบทุกขั้น กดข้ามไปขั้นไหนก็ได้
describe("RecipeCookView — ปุ่มเลขขั้นตอน", () => {
  const R = en.operationPlan.recipe;
  const step = (id: string, n: number) => ({
    id,
    doc_version: 1,
    sequence_no: n,
    title: `Title ${n}`,
    description: `Step ${n} text`,
    duration: null,
    temperature: null,
    temperature_unit: null,
    equipment: [],
    chef_notes: null,
    safety_warnings: null,
    videos: [],
  });
  const recipe = {
    ...RECIPE,
    preparation_steps: [
      step("s1", 1),
      step("s2", 2),
      step("s3", 3),
      step("s4", 4),
    ],
  } as unknown as Recipe;
  const pager = () => screen.getByRole("navigation", { name: R.cookStepPager });
  const goTo = (n: number) =>
    screen.getByRole("button", {
      name: R.cookGoToStep.replace("{n}", String(n)),
    });

  it("มีวงกลมเลขขั้นครบทุกขั้น ขั้นที่เปิดอยู่ถูกเน้น · ลูกศรหัวท้าย", () => {
    renderForm(<RecipeCookView recipe={recipe} />);
    const nav = pager();
    for (const n of [1, 2, 3, 4]) expect(nav).toContainElement(goTo(n));
    expect(goTo(1)).toHaveAttribute("aria-current", "step");
    expect(goTo(1)).toHaveTextContent("1");
    // ปุ่มก่อนหน้า/ถัดไปเป็นวงกลมลูกศร อยู่หัว-ท้ายของแถวเลข
    const buttons = Array.from(nav.querySelectorAll("button"));
    expect(buttons[0]).toHaveAccessibleName(R.cookPrev);
    expect(buttons[0]).toBeDisabled();
    expect(buttons.at(-1)).toHaveAccessibleName(R.cookNext);
  });

  it("กดเลขขั้นไหนก็ได้ → ข้ามไปขั้นนั้นทันที (ไม่ต้องกดถัดไปทีละขั้น)", () => {
    renderForm(<RecipeCookView recipe={recipe} />);
    fireEvent.click(goTo(3));
    expect(screen.getByRole("article")).toHaveTextContent("Step 3 text");
    expect(goTo(3)).toHaveAttribute("aria-current", "step");
    expect(goTo(1)).not.toHaveAttribute("aria-current");

    fireEvent.click(goTo(1));
    expect(screen.getByRole("article")).toHaveTextContent("Step 1 text");
  });

  it("ขั้นสุดท้าย → ปุ่มถัดไปกดไม่ได้ · ลูกศรก่อนหน้าย้อนได้ทีละขั้น", () => {
    renderForm(<RecipeCookView recipe={recipe} />);
    fireEvent.click(goTo(4));
    const nav = pager();
    expect(
      within(nav).getByRole("button", { name: R.cookNext }),
    ).toBeDisabled();
    fireEvent.click(within(nav).getByRole("button", { name: R.cookPrev }));
    expect(screen.getByRole("article")).toHaveTextContent("Step 3 text");
  });
});
