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

  it("รูปใหญ่เริ่มที่รูปหลัก + แถบรูปย่อทั้งหมดข้างใต้ เรียงตาม sort_order อยู่ช่องแรกของข้อมูลสูตร ก่อนคอลัมน์ขั้นตอน", () => {
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
    // hero แบบหน้าสินค้า: แกลเลอรีเป็นช่องแรก (ซ้าย) ของข้อมูลสูตร · ชื่อสูตรอยู่หัวหน้า (2026-11-17 จัดใหม่แบบ iPad)
    const hero = strip.parentElement?.parentElement;
    expect(hero?.firstElementChild).toContainElement(strip);
    expect(hero?.className).toContain("@lg/info:grid-cols-[15rem");
    const title = screen.getByRole("heading", { level: 1, name: RECIPE.name });
    expect(title.closest("header")).not.toBeNull();
    expect(title.closest("header")).not.toContainElement(strip);
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

  // แบบหน้าสินค้า Shopee (ผู้ใช้สั่ง 2026-11-16 "เอา video ไปใส่ใน Menu"): วิดีโออยู่ในแกลเลอรีรูปเมนู
  // เป็นช่องหลังรูปสุดท้าย (ผู้ใช้สั่งย้ายจากช่องแรก) เปิดหน้ามาที่รูปหลัก
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
  const heroPhoto = (n: number) =>
    screen
      .getByRole("button", {
        name: R.cookViewImage.replace("{n}", String(n)).replace("{total}", "2"),
      })
      .querySelector("img");

  it("วิดีโอเป็นช่องหลังรูปสุดท้ายของแกลเลอรีรูปเมนู เปิดหน้ามาที่รูปหลัก · วิดีโอรายขั้นตอนของเดิมไม่ถูกฝัง", () => {
    const { container } = renderForm(<RecipeCookView recipe={withPhotos} />);
    expect(container.querySelector("iframe")).toBeNull();
    expect(heroPhoto(1)).toHaveAttribute("src", "https://files.test/a.jpg");

    const slots = Array.from(gallery().querySelectorAll("li button"));
    expect(slots).toHaveLength(3);
    const last = slots.at(-1);
    expect(last).toHaveAccessibleName(R.cookShowVideo);
    expect(last).toHaveAttribute("aria-current", "false");
    expect(last?.querySelector("img")).toHaveAttribute(
      "src",
      "https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg",
    );
    expect(slots[0]).toHaveAttribute("aria-current", "true");
  });

  it("กดช่องวิดีโอ → เล่นในกรอบใหญ่ (นอกคอลัมน์ขั้นตอน) · กดรูปย่อ → กลับเป็นรูป", () => {
    const { container } = renderForm(<RecipeCookView recipe={withPhotos} />);
    fireEvent.click(screen.getByRole("button", { name: R.cookShowVideo }));
    const frames = container.querySelectorAll("iframe");
    expect(frames).toHaveLength(1);
    expect(frames[0]).toHaveAttribute("src", EMBED);
    expect(frames[0]).toHaveAttribute(
      "title",
      R.videoTitle.replace("{name}", RECIPE.name),
    );
    const steps = screen.getByRole("region", { name: R.stepsSection });
    expect(steps).not.toContainElement(frames[0]);
    // กรอบใหญ่อยู่แกลเลอรีเดียวกับแถบรูปย่อ (ช่องแรกของข้อมูลสูตร)
    expect(gallery().parentElement).toContainElement(frames[0]);

    fireEvent.click(
      screen.getByRole("button", {
        name: R.cookShowImage.replace("{n}", "2").replace("{total}", "2"),
      }),
    );
    expect(container.querySelector("iframe")).toBeNull();
    expect(heroPhoto(2)).toHaveAttribute("src", "https://files.test/b.jpg");
  });

  it("จอกว้าง: ขั้นตอนซ้าย (ตรึงไว้) ข้อมูลสูตรขวา · iPad แนวตั้ง: ข้อมูลสูตรบน ขั้นตอนคู่วัตถุดิบ · มือถือข้อมูลสูตรอยู่บน", () => {
    renderForm(<RecipeCookView recipe={withPhotos} />);
    const steps = screen.getByRole("region", { name: R.stepsSection });
    const layout = steps.parentElement!;
    // ≥ 48rem: ขั้นตอนกินทั้งคอลัมน์ซ้าย ข้อมูล/วัตถุดิบ/หลังทำเสร็จเรียงในคอลัมน์ขวา
    expect(layout.className).toContain("@3xl:grid-cols-[minmax(0,1fr)_20rem]");
    expect(layout.className).toContain(
      "@3xl:[grid-template-areas:'steps_info'_'steps_ing'_'steps_after']",
    );
    // 36–48rem (iPad แนวตั้ง): ข้อมูลสูตรเป็นแถบบน ขั้นตอนกับวัตถุดิบคู่กัน ไม่ต้องเลื่อนสลับไปมา
    expect(layout.className).toContain(
      "@xl:[grid-template-areas:'info_info'_'steps_ing'_'after_after']",
    );
    // มือถือ: เรียงตามลำดับอ่าน
    expect(layout.className).toContain(
      "[grid-template-areas:'info'_'ing'_'steps'_'after']",
    );
    expect(steps.className).toContain("[grid-area:steps]");
    // เลื่อนดูวัตถุดิบด้านข้างแล้วขั้นที่ทำอยู่ไม่หลุดจอ
    expect(steps.className).toContain("@xl:sticky");
    const info = layout.firstElementChild!;
    expect(info).toContainElement(gallery());
    expect(info.className).toContain("[grid-area:info]");
  });

  it("การจัดจาน/การเก็บรักษาอยู่หลังขั้นตอน (จอแคบ = ท้ายหน้า) · จอกว้างอยู่ใต้ข้อมูลสูตรในคอลัมน์ขวา", () => {
    renderForm(
      <RecipeCookView
        recipe={
          {
            ...withPhotos,
            plating_instructions: "Plate it",
            storage_instructions: "Keep cold",
          } as unknown as Recipe
        }
      />,
    );
    const steps = screen.getByRole("region", { name: R.stepsSection });
    const plating = screen.getByText("Plate it");
    expect(screen.getByText("Keep cold")).toBeInTheDocument();
    expect(
      steps.compareDocumentPosition(plating) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    const after = steps.nextElementSibling!;
    expect(after).toContainElement(plating);
    expect(after.className).toContain("[grid-area:after]");
  });

  it("มีวิดีโอแต่ไม่มีรูป → แกลเลอรีมีแค่วิดีโอ ไม่มีแถบรูปย่อ", () => {
    const { container } = renderForm(<RecipeCookView recipe={recipe} />);
    expect(container.querySelector("iframe")).toHaveAttribute("src", EMBED);
    expect(screen.queryByRole("list", { name: R.cookImages })).toBeNull();
    // ยังแบ่งคอลัมน์ให้แกลเลอรีข้างข้อมูลสรุป
    expect(
      container
        .querySelector("iframe")
        ?.closest('[class*="@lg/info:grid-cols-[15rem"]'),
    ).not.toBeNull();
  });

  // ผู้ใช้สั่ง 2026-11-26: "รูปใหญ่เอาออกไปก็ได้ เหลือแค่ช่องรูปเล็ก" + iPad ให้รูปขึ้นบนแทนลงล่าง
  it("ขั้นที่มีรูป → แค่รูปย่อในการ์ดของขั้น (บนข้อความเมื่อการ์ดแคบ ขวาเมื่อกว้าง) กดแล้วเปิด popup", () => {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
    }));
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
    const card = screen.getByRole("article");
    expect(list!.closest("article")).toBe(card);
    expect(card).toHaveTextContent("Step 1 text");
    // ข้อความซ้าย รูปย่อขวาเมื่อการ์ดกว้าง ≥ 32rem (ผู้ใช้สั่ง 2026-11-16 "ขั้นตอนซ้าย รูปขวา")
    expect(
      card.querySelector('[class*="@lg/steps:grid-cols-[minmax(0,1fr)_auto]"]'),
    ).toContainElement(list!);
    // การ์ดแคบ = รูปย่อขึ้นก่อนข้อความ (order-first) กลับลำดับเดิมเมื่อการ์ดกว้าง
    const wrapper = list!.parentElement!;
    expect(wrapper).toHaveClass("order-first", "@lg/steps:order-none");
    // ไม่มีกรอบรูปใหญ่ของขั้นแล้ว — มีแค่ปุ่มรูปย่อ
    expect(list!.querySelector("[aria-current]")).toBeNull();
    expect(
      card.querySelectorAll('img[src="https://files.test/s1-b.jpg"]'),
    ).toHaveLength(1);

    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(list!.querySelectorAll("button")[1]);
    const dialog = screen.getByRole("dialog");
    expect(
      dialog.querySelector('img[src="https://files.test/s1-b.jpg"]'),
    ).not.toBeNull();
  });

  it("ไปขั้นที่ไม่มีรูป → ไม่มีรูปของขั้น การ์ดขั้นเต็มแถว", () => {
    stepImagesById = { s1: [stepImg("a", 0, "https://files.test/s1-a.jpg")] };
    renderForm(<RecipeCookView recipe={recipe} />);
    goNext();
    const card = screen.getByRole("article");
    expect(card).toHaveTextContent("Step 2 text");
    expect(card.querySelector(".cursor-zoom-in")).toBeNull();
    expect(card.querySelector('[class*="grid-cols"]')).toBeNull();
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

  it("ไม่มีลิสต์ขั้นตอนทั้งหมดด้านล่างแล้ว — ใช้ปุ่มเลขเลือกขั้นแทน", () => {
    renderForm(<RecipeCookView recipe={recipe} />);
    const steps = screen.getByRole("region", { name: R.stepsSection });
    expect(steps.querySelector("ol")).toBeNull();
    // ขั้นที่ไม่ได้เปิดและไม่ใช่ขั้นถัดไปไม่โผล่เป็นข้อความบนจอ (มีแค่ title ของปุ่มเลข)
    expect(screen.queryByText("Title 3")).toBeNull();
    expect(screen.queryByText("Title 4")).toBeNull();
  });

  // ผู้ใช้เสนอ 2026-11-17: "เอาปุ่มขั้นตอนที่เป็นตัวเลขลงไปข้างล่าง แล้วให้มันลอยไว้ ไม่ว่าขั้นตอนจะยาวแค่ไหนก็จะไม่เจอปัญหาปุ่มตก"
  it("แถบเลขอยู่ก้นการ์ดขั้นและลอยติดก้นจอ (sticky) · การ์ดไม่ตัดแบบ overflow-hidden ที่ทำให้ sticky ไม่เกาะจอ", () => {
    renderForm(<RecipeCookView recipe={recipe} />);
    const card = screen.getByRole("article");
    const nav = pager();
    expect(card).toContainElement(nav);
    const bar = nav.parentElement!;
    expect(bar.className).toContain("sticky");
    expect(bar.className).toContain("bottom-0");
    expect(bar).toBe(card.lastElementChild);
    expect(card.className).toContain("overflow-clip");
    expect(card.className).not.toContain("overflow-hidden");
    // หน้าที่มีคอลัมน์ข้าง: การ์ดสูงไม่เกินกล่องเลื่อนของแอป ข้อความยาวเลื่อนในการ์ด
    expect(card.className).toContain("@xl/page:max-h-(--cook-stage-max-h)");
    expect(card.firstElementChild?.className).toContain("overflow-y-auto");
  });

  it("เหนือแถวเลขบอกชื่อขั้นถัดไป กดแล้วไปขั้นนั้น · ขั้นสุดท้ายบอกว่าเป็นขั้นสุดท้าย", () => {
    renderForm(<RecipeCookView recipe={recipe} />);
    const caption = () =>
      screen.getByRole("button", {
        name: R.cookNextStep.replace("{title}", "Title 2"),
      });
    fireEvent.click(caption());
    expect(screen.getByRole("article")).toHaveTextContent("Step 2 text");
    expect(goTo(2)).toHaveAttribute("aria-current", "step");

    fireEvent.click(goTo(4));
    expect(screen.getByText(R.cookLastStep)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Next · / })).toBeNull();
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

  // iPad: ปัดนิ้วบนการ์ดขั้นแทนการกดปุ่มเลข (2026-11-17)
  const swipe = (dx: number, dy = 0) => {
    const card = screen.getByRole("article");
    fireEvent.touchStart(card, { touches: [{ clientX: 300, clientY: 200 }] });
    fireEvent.touchEnd(card, {
      changedTouches: [{ clientX: 300 + dx, clientY: 200 + dy }],
    });
  };

  it("ปัดซ้ายบนการ์ดขั้น = ขั้นถัดไป · ปัดขวา = ขั้นก่อนหน้า · ไม่เลยขั้นแรก/ขั้นสุดท้าย", () => {
    renderForm(<RecipeCookView recipe={recipe} />);
    swipe(-120);
    expect(screen.getByRole("article")).toHaveTextContent("Step 2 text");
    expect(goTo(2)).toHaveAttribute("aria-current", "step");
    swipe(120);
    expect(screen.getByRole("article")).toHaveTextContent("Step 1 text");
    swipe(120);
    expect(screen.getByRole("article")).toHaveTextContent("Step 1 text");
    fireEvent.click(goTo(4));
    swipe(-120);
    expect(screen.getByRole("article")).toHaveTextContent("Step 4 text");
  });

  it("ลากสั้น หรือลากแนวตั้งเป็นหลัก (เลื่อนหน้า) → ไม่เปลี่ยนขั้น", () => {
    renderForm(<RecipeCookView recipe={recipe} />);
    swipe(-30);
    expect(screen.getByRole("article")).toHaveTextContent("Step 1 text");
    swipe(-90, 200);
    expect(screen.getByRole("article")).toHaveTextContent("Step 1 text");
  });
});

describe("RecipeCookView — หัวหน้า + วัตถุดิบ", () => {
  const R = en.operationPlan.recipe;
  const line = (id: string, n: number, name: string) => ({
    id,
    sequence_no: n,
    deleted_at: null,
    ingredient_type: "product",
    qty: 1,
    note: null,
    product: { id: `p-${id}`, code: `P-${id}`, name },
    ingredient_unit: { id: "u", name: "KG" },
  });
  const recipe = {
    ...RECIPE,
    category: { id: "c", name: "Main Courses" },
    cuisine: { id: "q", name: "Thai" },
    ingredients: [line("a", 1, "Shrimp"), line("b", 2, "Lime")],
  } as unknown as Recipe;

  it("ชื่อสูตรเป็นหัวหน้า + บรรทัดรอง รหัส · หมวดหมู่ · ประเภทอาหาร", () => {
    renderForm(<RecipeCookView recipe={recipe} />);
    const header = screen
      .getByRole("heading", { level: 1, name: RECIPE.name })
      .closest("header")!;
    expect(header).toHaveTextContent("RCP-001");
    expect(within(header).getByTitle(en.field.category)).toHaveTextContent(
      "Main Courses",
    );
    expect(within(header).getByTitle(en.field.cuisine)).toHaveTextContent(
      "Thai",
    );
    // ปุ่มพิมพ์/แก้ไขอยู่หัวเดียวกัน
    expect(
      within(header).getByRole("button", { name: en.common.print }),
    ).toBeInTheDocument();
    expect(
      within(header).getByRole("link", { name: R.editRecipe }),
    ).toBeInTheDocument();
  });

  it("ตัวเลขสรุป: มีทั้งเวลาเตรียมและเวลาทำ = เวลารวมเป็นค่าหลัก แยกเตรียม/ทำเป็นบรรทัดรอง", () => {
    renderForm(<RecipeCookView recipe={recipe} />);
    const total = screen.getByText(en.field.totalTime).closest("div")!;
    expect(total).toHaveTextContent(R.cookMinutes.replace("{min}", "30"));
    expect(total).toHaveTextContent(
      R.cookTimeSplit.replace("{prep}", "10").replace("{cook}", "20"),
    );
  });

  it("ติ๊กวัตถุดิบ → ขึ้นจำนวนที่เช็กแล้ว · กดล้าง → เอาติ๊กออกทั้งหมด", () => {
    renderForm(<RecipeCookView recipe={recipe} />);
    expect(
      screen.queryByRole("button", { name: R.cookClearChecks }),
    ).toBeNull();
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "0",
    );
    fireEvent.click(screen.getByRole("checkbox", { name: "Shrimp" }));
    expect(
      screen.getByText(
        R.cookChecked.replace("{n}", "1").replace("{total}", "2"),
      ),
    ).toBeInTheDocument();
    // แถบความคืบหน้าใต้หัววัตถุดิบ — หยิบไปแล้วครึ่งหนึ่ง
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "50",
    );

    fireEvent.click(screen.getByRole("button", { name: R.cookClearChecks }));
    expect(screen.getByRole("checkbox", { name: "Shrimp" })).not.toBeChecked();
    expect(
      screen.queryByRole("button", { name: R.cookClearChecks }),
    ).toBeNull();
  });
});
