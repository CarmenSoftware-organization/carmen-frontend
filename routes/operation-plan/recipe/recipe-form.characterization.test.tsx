import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, fireEvent, screen } from "@testing-library/react";
import en from "@/messages/en.json";
import type { Recipe } from "@/types/recipe";
import {
  fakeMutation,
  firstPayload,
  renderForm,
  submitForm,
} from "@/lib/test-utils/form-characterization";

const navigate = vi.fn();
const createMut = fakeMutation({ data: { id: "rec-new" } });
const updateMut = fakeMutation();
const deleteMut = fakeMutation();
const syncStepsMut = fakeMutation();
const replaceIngredientsMut = fakeMutation({
  items: [],
  total_ingredient_cost: 0,
});
const previewIngredientsMut = fakeMutation({
  items: [],
  total_ingredient_cost: 0,
});

vi.mock("react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router")>()),
  useNavigate: () => navigate,
}));

vi.mock("./use-recipe", () => ({
  useCreateRecipe: () => createMut,
  useUpdateRecipe: () => updateMut,
  useDeleteRecipe: () => deleteMut,
}));
// หลังหัวสูตรบันทึกสำเร็จ ฟอร์มจะ sync ขั้นตอนทำต่อ แล้วค่อยกลับหน้ารายการ
vi.mock("./use-recipe-steps-sync", () => ({
  useSyncRecipeSteps: () => syncStepsMut,
}));
// วัตถุดิบบันทึกก่อนหัวสูตร (เฉพาะเมื่อเปลี่ยน) — fixture ไม่มีวัตถุดิบ จึงไม่ถูกเรียก
vi.mock("./use-recipe-ingredients", () => ({
  useReplaceIngredients: () => replaceIngredientsMut,
  usePreviewIngredientCosts: () => ({
    ...previewIngredientsMut,
    reset: vi.fn(),
  }),
}));
// รูปของขั้นตอนดึงแยกต่อขั้น — ป้อนเองแทน query
let savedStepImages: {
  id: string;
  url: string;
  alt_text: null;
  caption: null;
  sort_order: number;
  is_primary: boolean;
}[] = [];
vi.mock("./use-recipe-step-images", () => ({
  useRecipeStepImages: () => ({ data: savedStepImages, isError: false }),
}));
vi.mock("./use-recipe-gallery", () => ({
  useRecipeGallery: () => ({
    isDirty: false,
    files: [],
    manifest: [],
    count: 0,
    items: [],
    buildPayload: () => ({ files: [], manifest: [] }),
    add: vi.fn(),
    remove: vi.fn(),
    reset: vi.fn(),
  }),
}));
// FormToolbar ปิดปุ่ม Edit เมื่อไม่มีสิทธิ์ — เทสต์นี้สนใจเส้นทางหลัง save
// ไม่ใช่ permission ให้ผ่านหมดไปเลย
vi.mock("@/hooks/use-can", () => ({
  useCan: () => ({
    can: () => true,
    canAny: () => true,
    canAll: () => true,
    guard: (_p: unknown, fn: () => void) => fn,
    isAdmin: true,
    permissions: [],
    canWrite: true,
  }),
}));

const { RecipeForm } = await import("./recipe-form");

// ฟิลด์ครบชุดของ Recipe ยาวกว่า 30 ตัวและไม่มีผลกับเส้นทางหลัง save —
// ใส่เท่าที่ getDefaultValues ใช้จริงแล้ว cast ท่าเดียวกับ fixture อื่นในโปรเจกต์
const RECIPE = {
  id: "rec-1",
  doc_version: 8,
  code: "R-001",
  name: "Tom Yum",
  description: null,
  note: null,
  is_active: true,
  category_id: "cat-1",
  cuisine_id: "cui-1",
  difficulty: "easy",
  base_yield: 1,
  base_yield_unit: "PCS",
  // status เป็น required ใน schema — ไม่ใส่แล้ว handleSubmit ไม่เรียก onSubmit
  status: "draft",
  prep_time: 0,
  cook_time: 0,
  total_ingredient_cost: 0,
  labor_cost: 0,
  overhead_cost: 0,
  cost_per_portion: 0,
  selling_price: 0,
  suggested_price: 0,
  gross_margin: 0,
  gross_margin_percentage: 0,
  actual_food_cost_percentage: 0,
  target_food_cost_percentage: 0,
  labor_cost_percentage: 0,
  overhead_percentage: 0,
  allergens: null,
  tags: null,
  carbon_footprint: 0,
  deduct_from_stock: false,
  default_variant_id: null,
} as unknown as Recipe;

beforeEach(() => {
  vi.clearAllMocks();
});

/**
 * บันทึกพฤติกรรมปัจจุบันของ RecipeForm ไว้ก่อนยุบเข้า hook กลาง
 * — ไม่ได้บอกว่าถูก บอกว่าตอนนี้เป็นแบบนี้ ถ้า refactor แล้วเปลี่ยน ต้องเป็นเพราะตั้งใจ
 */
describe("RecipeForm — characterization", () => {
  // ฟอร์มสูตรอยู่ที่ /:id/edit แล้ว (หน้า /:id เป็นโหมดทำอาหาร) จึงเปิดมาในโหมดแก้ไขเลย
  // ไม่มีปุ่ม Edit ให้กด — ตั้งใจเปลี่ยน ไม่ใช่ regression
  async function enterEditMode() {
    expect(
      screen.queryByRole("button", { name: en.common.edit }),
    ).not.toBeInTheDocument();
  }

  it("[update] เซฟแล้วเด้งกลับหน้ารายการ", async () => {
    renderForm(<RecipeForm recipe={RECIPE} />);
    await enterEditMode();
    await act(async () => submitForm("recipe-form"));

    expect(updateMut.mutate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith("/operation-plan/recipe");
  });

  it("[update] payload แนบ id กับ doc_version ที่โหลดมา", async () => {
    renderForm(<RecipeForm recipe={RECIPE} />);
    await enterEditMode();
    await act(async () => submitForm("recipe-form"));

    expect(firstPayload(updateMut)).toMatchObject({
      id: "rec-1",
      doc_version: 8,
    });
  });

  it.todo("[create] เซฟแล้วกลับหน้ารายการ");
});

describe("RecipeForm — ลิงก์วิดีโอของสูตร (1 ลิงก์)", () => {
  const videoInput = () =>
    screen.getByLabelText(en.operationPlan.recipe.videoUrl);

  it("โหลดลิงก์ที่บันทึกไว้ แล้วเซฟส่งค่าเดิมกลับ", async () => {
    const url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
    renderForm(<RecipeForm recipe={{ ...RECIPE, video_url: url }} />);
    expect(videoInput()).toHaveValue(url);
    await act(async () => submitForm("recipe-form"));

    expect(firstPayload(updateMut)).toMatchObject({ video_url: url });
  });

  it("วางลิงก์ youtu.be → ส่งตามที่วาง (backend แปลงเป็นรูปแบบ watch?v= เอง)", async () => {
    renderForm(<RecipeForm recipe={RECIPE} />);
    fireEvent.change(videoInput(), {
      target: { value: "  https://youtu.be/dQw4w9WgXcQ?si=x  " },
    });
    await act(async () => submitForm("recipe-form"));

    expect(firstPayload(updateMut)).toMatchObject({
      video_url: "https://youtu.be/dQw4w9WgXcQ?si=x",
    });
  });

  it("ลบลิงก์ออก → ส่ง null (ล้างวิดีโอ)", async () => {
    renderForm(
      <RecipeForm
        recipe={{
          ...RECIPE,
          video_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        }}
      />,
    );
    fireEvent.change(videoInput(), { target: { value: "" } });
    await act(async () => submitForm("recipe-form"));

    expect(firstPayload(updateMut)).toMatchObject({ video_url: null });
  });

  it("ลิงก์ที่ไม่ใช่วิดีโอ YouTube → ไม่บันทึก ช่องขึ้น error", async () => {
    renderForm(<RecipeForm recipe={RECIPE} />);
    fireEvent.change(videoInput(), {
      target: { value: "https://vimeo.com/76979871" },
    });
    await act(async () => submitForm("recipe-form"));

    expect(updateMut.mutate).not.toHaveBeenCalled();
    expect(videoInput()).toHaveAttribute("aria-invalid", "true");
  });
});

describe("RecipeForm — รูปของขั้นตอน (ไม่เกิน 5 รูปต่อขั้น)", () => {
  const R = en.operationPlan.recipe;
  const STEP = {
    id: "step-1",
    doc_version: 2,
    sequence_no: 1,
    title: null,
    description: "Boil the stock",
    duration: null,
    temperature: null,
    temperature_unit: null,
    equipment: [],
    chef_notes: null,
    safety_warnings: null,
    // วิดีโอรายขั้นตอนของเดิม — ฟอร์มไม่มีช่องให้แล้ว
    videos: [{ provider: "youtube", token: "dQw4w9WgXcQ", sort_order: 0 }],
  };
  const withStep = { ...RECIPE, preparation_steps: [STEP] } as Recipe;
  const saved = (id: string, n: number) => ({
    id,
    url: `https://files.test/${id}.jpg`,
    alt_text: null,
    caption: null,
    sort_order: n,
    is_primary: n === 0,
  });
  const png = (name: string) => new File(["x"], name, { type: "image/png" });
  const fileInput = () =>
    screen.getByLabelText(new RegExp(`^${R.stepImages}`), {
      selector: "input",
    });
  const pick = (...files: File[]) =>
    fireEvent.change(fileInput(), { target: { files } });
  const syncedDrafts = () =>
    (
      firstPayload(syncStepsMut) as {
        drafts: { image_files: File[]; removed_image_ids: string[] }[];
      }
    ).drafts;
  const removeLabel = (n: number) =>
    R.removeStepImage.replace("{n}", String(n));

  beforeEach(() => {
    savedStepImages = [];
    let n = 0;
    // jsdom ไม่มี createObjectURL — ใส่ให้เฉพาะสองเมธอดนี้ ตัว URL ต้องยังเป็น constructor
    URL.createObjectURL = () => `blob:step-${n++}`;
    URL.revokeObjectURL = () => {};
  });

  it("ไม่มีช่องลิงก์วิดีโอในการ์ดขั้นแล้ว — วิดีโอมีที่ระดับสูตรช่องเดียว", () => {
    renderForm(<RecipeForm recipe={withStep} />);
    expect(screen.getAllByLabelText(R.videoUrl)).toHaveLength(1);
    expect(screen.queryByDisplayValue(/dQw4w9WgXcQ/)).toBeNull();
  });

  it("เลือกไฟล์ → ส่งไฟล์ให้ sync ขั้นตอนตอน Save", async () => {
    renderForm(<RecipeForm recipe={withStep} />);
    pick(png("a.png"), png("b.png"));
    await act(async () => submitForm("recipe-form"));

    expect(syncedDrafts()[0].image_files.map((f) => f.name)).toEqual([
      "a.png",
      "b.png",
    ]);
    expect(syncedDrafts()[0].removed_image_ids).toEqual([]);
  });

  it("ลบรูปที่บันทึกแล้ว → ส่ง id ที่ลบให้ sync รูปหายจากการ์ดทันที", async () => {
    savedStepImages = [saved("img-1", 0), saved("img-2", 1)];
    renderForm(<RecipeForm recipe={withStep} />);
    fireEvent.click(screen.getByRole("button", { name: removeLabel(1) }));
    expect(
      document.querySelector('img[src="https://files.test/img-1.jpg"]'),
    ).toBeNull();
    await act(async () => submitForm("recipe-form"));

    expect(syncedDrafts()[0].removed_image_ids).toEqual(["img-1"]);
  });

  it("มี 4 รูปแล้ว เลือกอีก 3 → รับได้แค่ 1 แล้วปุ่มเพิ่มรูปหายไป", async () => {
    savedStepImages = [0, 1, 2, 3].map((n) => saved(`img-${n}`, n));
    renderForm(<RecipeForm recipe={withStep} />);
    pick(png("a.png"), png("b.png"), png("c.png"));
    expect(screen.queryByRole("button", { name: R.addStepImage })).toBeNull();
    await act(async () => submitForm("recipe-form"));

    expect(syncedDrafts()[0].image_files.map((f) => f.name)).toEqual(["a.png"]);
  });

  it("ไฟล์ที่ไม่ใช่รูป → ไม่รับ", async () => {
    renderForm(<RecipeForm recipe={withStep} />);
    pick(new File(["x"], "a.pdf", { type: "application/pdf" }));
    await act(async () => submitForm("recipe-form"));

    expect(syncedDrafts()[0].image_files).toEqual([]);
  });
});

describe("RecipeForm — แท็บ", () => {
  const R = en.operationPlan.recipe;
  const tab = (name: string) =>
    screen.getByRole("tab", { name: new RegExp(`^${name}`) });
  const openTab = (name: string) => {
    // Radix เปลี่ยนแท็บตอน mousedown
    fireEvent.mouseDown(tab(name), { button: 0, ctrlKey: false });
  };

  it("เปิดมาที่แท็บรายละเอียด · ทุกแท็บ mount ค้างไว้ แท็บที่ไม่ได้เลือกถูกซ่อน", () => {
    renderForm(<RecipeForm recipe={RECIPE} />);
    expect(tab(R.recipeDetails)).toHaveAttribute("aria-selected", "true");

    const panels = screen.getAllByRole("tabpanel", { hidden: true });
    expect(panels).toHaveLength(4);
    expect(panels.map((panel) => panel.getAttribute("data-state"))).toEqual([
      "active",
      "inactive",
      "inactive",
      "inactive",
    ]);
    // ช่องของแท็บต้นทุนอยู่ใน DOM แล้วแม้ยังไม่เปิดแท็บ — Save ตรวจครบทุกช่อง
    expect(document.getElementById("recipe-selling-price")).not.toBeNull();
  });

  it("แก้ช่องในแท็บหนึ่งแล้วสลับไปอีกแท็บ → ค่ายังอยู่และถูกส่งตอน Save", async () => {
    renderForm(<RecipeForm recipe={RECIPE} />);
    fireEvent.change(document.getElementById("recipe-note")!, {
      target: { value: "keep me" },
    });
    openTab(R.costing);
    expect(tab(R.costing)).toHaveAttribute("aria-selected", "true");
    fireEvent.change(document.getElementById("recipe-selling-price")!, {
      target: { value: "120" },
    });
    await act(async () => submitForm("recipe-form"));

    expect(firstPayload(updateMut)).toMatchObject({
      note: "keep me",
      selling_price: 120,
    });
  });

  it("Save ไม่ผ่านเพราะช่องในแท็บอื่น → เปิดแท็บนั้น ช่องขึ้น error และแท็บมีจุดเตือน", async () => {
    renderForm(<RecipeForm recipe={RECIPE} />);
    fireEvent.change(document.getElementById("recipe-code")!, {
      target: { value: "" },
    });
    openTab(R.costing);
    await act(async () => submitForm("recipe-form"));

    expect(updateMut.mutate).not.toHaveBeenCalled();
    expect(tab(R.recipeDetails)).toHaveAttribute("aria-selected", "true");
    expect(document.getElementById("recipe-code")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(tab(R.recipeDetails)).toHaveTextContent(R.tabHasErrors);
    expect(tab(R.costing)).not.toHaveTextContent(R.tabHasErrors);
  });

  it("ชื่อสูตร (อยู่เหนือแท็บ) ผิดด้วย → ไม่สลับแท็บ", async () => {
    renderForm(<RecipeForm recipe={{ ...RECIPE, name: "" }} />);
    fireEvent.change(document.getElementById("recipe-code")!, {
      target: { value: "" },
    });
    openTab(R.costing);
    await act(async () => submitForm("recipe-form"));

    expect(updateMut.mutate).not.toHaveBeenCalled();
    expect(tab(R.costing)).toHaveAttribute("aria-selected", "true");
    expect(tab(R.recipeDetails)).toHaveTextContent(R.tabHasErrors);
  });
});

// ปุ่ม Update price (แทน Recalculate — ผู้ใช้สั่ง 2026-11-16): กดแล้วทับต้นทุนด้วยราคาจากใบราคาทันที
// ไม่มีใบราคา = 0 (server ตัดสิน) ยังไม่บันทึกจนกด Save ซึ่งส่ง recalculate + price_source "pricelist"
describe("RecipeForm — Update price จากใบราคา", () => {
  const R = en.operationPlan.recipe;
  const P = "prod-1";
  const GRAM = "unit-gram";
  const RECIPE_WITH_INGREDIENT = {
    ...RECIPE,
    ingredients: [
      {
        id: "line-1",
        sequence_no: 1,
        ingredient_type: "product",
        product_id: P,
        product: { id: P, code: "P-1", name: "Shrimp" },
        qty: 400,
        ingredient_unit_id: GRAM,
        ingredient_unit: { id: GRAM, name: "GRAM" },
        inventory_qty: 0.4,
        inventory_unit_id: "unit-kg",
        conversion_factor: 0.001,
        cost_per_unit: 70,
        wastage_percentage: 10,
        net_cost: 28,
        wastage_cost: 2.8,
        line_cost: 30.8,
        cost_source: "snapshot",
        note: null,
      },
    ],
  } as unknown as Recipe;

  const openIngredients = () =>
    fireEvent.mouseDown(
      screen.getByRole("tab", { name: new RegExp(`^${R.ingredients}`) }),
      { button: 0, ctrlKey: false },
    );

  it("ปุ่มชื่อ Update price ไม่ใช่ Recalculate", () => {
    renderForm(<RecipeForm recipe={RECIPE_WITH_INGREDIENT} />);
    openIngredients();
    expect(
      screen.getByRole("button", { name: R.updatePrice }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /recalculate/i }),
    ).not.toBeInTheDocument();
  });

  it("กดแล้วขอราคาจากใบราคาทั้งรายการทันที (ไม่มีหน้าต่างยืนยัน) และขึ้นป้ายให้กด Save", () => {
    renderForm(<RecipeForm recipe={RECIPE_WITH_INGREDIENT} />);
    openIngredients();
    fireEvent.click(screen.getByRole("button", { name: R.updatePrice }));

    expect(previewIngredientsMut.mutate).toHaveBeenCalledTimes(1);
    const vars = firstPayload(previewIngredientsMut) as {
      recipeId: string;
      priceSource: string;
      items: Record<string, unknown>[];
    };
    expect(vars.recipeId).toBe("rec-1");
    expect(vars.priceSource).toBe("pricelist");
    expect(vars.items).toHaveLength(1);
    expect(vars.items[0]).toMatchObject({ product_id: P, qty: 400 });
    // ต้นทุนที่กรอกเองไม่ถูกส่ง — ทุกบรรทัดถูกทับด้วยราคาใบราคา
    expect(vars.items[0]).not.toHaveProperty("line_cost");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByText(R.updatePriceApplied)).toBeInTheDocument();
  });

  it("กด Save หลัง Update price → บันทึกวัตถุดิบแบบคิดใหม่ทั้งชุด", async () => {
    renderForm(<RecipeForm recipe={RECIPE_WITH_INGREDIENT} />);
    openIngredients();
    fireEvent.click(screen.getByRole("button", { name: R.updatePrice }));
    await act(async () => submitForm("recipe-form"));

    expect(replaceIngredientsMut.mutate).toHaveBeenCalledTimes(1);
    expect(firstPayload(replaceIngredientsMut)).toMatchObject({
      recipeId: "rec-1",
      recalculate: true,
    });
  });
});
