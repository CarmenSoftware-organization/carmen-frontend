import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import type { RecipePreparationStep } from "@/types/recipe";
import { setRuntimeConfigForTests } from "@/lib/runtime-config";
import { stepToDraft, type StepDraft } from "./recipe-steps-sync";
import { useSyncRecipeSteps } from "./use-recipe-steps-sync";

vi.mock("@/hooks/use-profile", () => ({
  useProfile: () => ({ buCode: "BU001" }),
}));
vi.mock("@/lib/auth/auth-api", () => ({ refreshTokens: vi.fn() }));

beforeEach(() => {
  setRuntimeConfigForTests({ BACKEND_URL: "", X_APP_ID: "app-test" });
});

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(
      QueryClientProvider,
      { client: queryClient },
      children,
    );
  };
}

const STEPS = "/api/config/BU001/recipes/rec-1/preparation-steps";
const saved = (id: string, n: number) =>
  ({
    id,
    doc_version: 1,
    sequence_no: n,
    title: null,
    description: `Step ${n}`,
    duration: null,
    temperature: null,
    temperature_unit: null,
    equipment: [],
    chef_notes: null,
    safety_warnings: null,
  }) as RecipePreparationStep;
const png = (name: string) => new File(["x"], name, { type: "image/png" });
const newStep = (over: Partial<StepDraft>): StepDraft => ({
  ...stepToDraft(saved("x", 9)),
  step_id: null,
  doc_version: null,
  ...over,
});

describe("useSyncRecipeSteps — รูปของขั้นตอน", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  /** คำขอที่ยิงไป ตามลำดับ: "METHOD path" */
  const calls = () =>
    fetchMock.mock.calls.map(
      ([url, init]) => `${(init as RequestInit).method} ${url as string}`,
    );
  const bodyOf = (i: number) =>
    (fetchMock.mock.calls[i][1] as RequestInit).body as FormData;
  let statusFor: (method: string, url: string) => number;

  beforeEach(() => {
    statusFor = () => 200;
    fetchMock = vi.fn(async (url: string, init: RequestInit) => {
      const status = statusFor(init.method ?? "GET", url);
      // POST ขั้นตอนใหม่ตอบ id ของแถวที่สร้าง
      const data =
        init.method === "POST" && url === STEPS ? [{ id: "new-1" }] : {};
      return new Response(JSON.stringify({ data, message: "x" }), { status });
    });
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  const run = async (
    original: RecipePreparationStep[],
    drafts: StepDraft[],
    onImagesSynced = vi.fn(),
  ) => {
    const { result } = renderHook(() => useSyncRecipeSteps(), {
      wrapper: createWrapper(),
    });
    result.current.mutate({
      recipeId: "rec-1",
      original,
      drafts,
      onImagesSynced,
    });
    await waitFor(() => expect(result.current.isIdle).toBe(false));
    await waitFor(() => expect(result.current.isPending).toBe(false));
    return { result, onImagesSynced };
  };

  it("เปลี่ยนแต่รูป (ตัวขั้นไม่เปลี่ยน) → ลบรูปก่อน แล้วอัปโหลดไฟล์ใหม่ในคำขอเดียว field `images`", async () => {
    const s1 = saved("s1", 1);
    const { result, onImagesSynced } = await run(
      [s1],
      [
        {
          ...stepToDraft(s1),
          removed_image_ids: ["img-1"],
          image_files: [png("a.png"), png("b.png")],
        },
      ],
    );

    expect(result.current.isSuccess).toBe(true);
    expect(calls()).toEqual([
      `DELETE ${STEPS}/s1/images/img-1`,
      `POST ${STEPS}/s1/images`,
    ]);
    expect((bodyOf(1).getAll("images") as File[]).map((f) => f.name)).toEqual([
      "a.png",
      "b.png",
    ]);
    expect(onImagesSynced).toHaveBeenCalledExactlyOnceWith(0);
  });

  it("ขั้นใหม่ที่ใส่รูป → สร้างขั้นก่อน แล้วอัปโหลดเข้า id ที่เพิ่งได้", async () => {
    const { result } = await run(
      [],
      [newStep({ description: "New", image_files: [png("a.png")] })],
    );

    expect(result.current.isSuccess).toBe(true);
    expect(calls()).toEqual([`POST ${STEPS}`, `POST ${STEPS}/new-1/images`]);
  });

  it("ไม่มีอะไรเปลี่ยนทั้งขั้นและรูป → ไม่ยิงอะไรเลย", async () => {
    const s1 = saved("s1", 1);
    await run([s1], [stepToDraft(s1)]);
    expect(calls()).toEqual([]);
  });

  it("รูปที่จะลบหายไปแล้ว (404) → ถือว่าลบสำเร็จ ทำต่อ", async () => {
    statusFor = (method) => (method === "DELETE" ? 404 : 200);
    const s1 = saved("s1", 1);
    const { result, onImagesSynced } = await run(
      [s1],
      [{ ...stepToDraft(s1), removed_image_ids: ["gone"] }],
    );

    expect(result.current.isSuccess).toBe(true);
    expect(onImagesSynced).toHaveBeenCalledWith(0);
  });

  it("อัปโหลดขั้นที่ 2 ล้ม → ขั้นที่ 1 ถูกแจ้งว่าเสร็จแล้ว ขั้นที่ 2 ไม่ถูกแจ้ง (Save ซ้ำไม่อัปโหลดขั้น 1 อีก)", async () => {
    statusFor = (method, url) =>
      method === "POST" && url.includes("/s2/images") ? 400 : 200;
    const s1 = saved("s1", 1);
    const s2 = saved("s2", 2);
    const { result, onImagesSynced } = await run(
      [s1, s2],
      [
        { ...stepToDraft(s1), image_files: [png("a.png")] },
        { ...stepToDraft(s2), image_files: [png("b.png")] },
      ],
    );

    expect(result.current.isError).toBe(true);
    expect(onImagesSynced).toHaveBeenCalledExactlyOnceWith(0);
  });
});
