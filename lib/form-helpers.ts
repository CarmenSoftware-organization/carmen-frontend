import type { FieldValues, UseFormReturn } from "react-hook-form";

/**
 * `setValueAs` สำหรับช่องตัวเลขที่ spread `register()` แล้ว override `onChange` เอง
 *
 * `onBlur` ที่ติดมากับ `register()` คือ handler ตัวเดียวกับ `onChange` ภายใน RHF — มัน
 * อ่านค่าดิบจาก DOM (string `"10"`) เขียนทับ number ที่ `onChange` เพิ่ง `setValue`
 * ไว้ทันทีที่โฟกัสหลุด ฟอร์มที่ Save ด้วย `draftSaveHandler` (ไม่ผ่าน zod) จึงส่ง
 * string ไปชน `z.number()` ฝั่ง backend → 400 "expected number, received string"
 *
 * ว่าง/ไม่ใช่ตัวเลข → 0 ให้ตรงกับที่ `onChange` ทำ (`valueAsNumber` ของ RHF ให้ NaN
 * กับช่องว่าง แล้วขอบแดงค้างแม้พิมพ์ 0 กลับ)
 *
 * @example
 * ```tsx
 * <InputSuffixQty {...form.register(name, { setValueAs: coerceNumberInput })} onChange={…} />
 * ```
 */
export function coerceNumberInput(v: unknown): number {
  const n = Number(v);
  return v === "" || Number.isNaN(n) ? 0 : n;
}

/**
 * Scroll และ focus ไปยัง field แรกที่มี validation error
 *
 * Query DOM หา element ที่มี `aria-invalid="true"` หรือ `data-invalid="true"`
 * แล้ว scroll ให้อยู่ตรงกลางจอแบบ smooth จากนั้น focus input ภายใน
 *
 * Retry ข้ามหลายเฟรม (`maxAttempts`) เพื่อรองรับ field ที่อยู่ใน section ซึ่งเพิ่ง
 * ถูก auto-expand หลัง submit (เช่น expanded row ของ PR/PO) — ตัว field จะ render
 * ช้ากว่า callback นี้ 1-2 เฟรม ถ้า query ครั้งเดียวจะหาไม่เจอ
 *
 * ใช้คู่กับ react-hook-form: `form.handleSubmit(onValid, scrollToFirstInvalidField)`
 *
 * @param options - ตัวเลือก scroll behavior + selector + จำนวนเฟรมที่ retry
 * @example
 * ```tsx
 * <form onSubmit={form.handleSubmit(onSubmit, () => scrollToFirstInvalidField())}>
 * ```
 */
export const scrollToFirstInvalidField = (options?: {
  block?: ScrollLogicalPosition;
  behavior?: ScrollBehavior;
  selector?: string;
  maxAttempts?: number;
}): void => {
  const {
    block = "center",
    behavior = "smooth",
    selector = '[aria-invalid="true"], [data-invalid="true"]',
    maxAttempts = 12,
  } = options ?? {};

  if (typeof document === "undefined") return;

  // retry ทีละเฟรม: field ที่ผิดอาจอยู่ใน row ที่เพิ่งถูก auto-expand
  // (setExpanded → re-render → mount expand) ซึ่งช้ากว่า callback นี้
  let attempts = 0;
  const tick = () => {
    const el = document.querySelector<HTMLElement>(selector);
    if (el) {
      el.scrollIntoView({ behavior, block });
      const focusable = el.matches(
        "input, textarea, button, select, [tabindex]",
      )
        ? el
        : el.querySelector<HTMLElement>(
            "input, textarea, button, select, [tabindex]",
          );
      focusable?.focus({ preventScroll: true });
      return;
    }
    attempts += 1;
    if (attempts < maxAttempts) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
};

export const arrayToText = (value: string[] | null | undefined): string => {
  if (!value || value.length === 0) return "";
  return value.join("\n");
};

export const textToArray = (value: string): string[] | null => {
  const items = value
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  return items.length > 0 ? items : null;
};

export function objectToText(
  value: Record<string, unknown> | null | undefined,
): string {
  if (!value || Object.keys(value).length === 0) return "";
  return JSON.stringify(value, null, 2);
}

export function textToObject(value: string): Record<string, unknown> | null {
  if (!value.trim()) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

// ── Key-value pair helpers ──

export interface KeyValueRow {
  _id: string;
  key: string;
  value: string;
}

let _kvId = 0;

function kvId(): string {
  return `kv_${++_kvId}`;
}

export function createKeyValueRow(key = "", value = ""): KeyValueRow {
  return { _id: kvId(), key, value };
}

export function objectToKeyValues(
  value: Record<string, unknown> | null | undefined,
): KeyValueRow[] {
  if (!value || Object.keys(value).length === 0) return [];
  return Object.entries(value).map(([k, v]) =>
    // ค่าซ้อน (object/array) ต้องเป็น JSON — String() ได้ "[object Object]" แล้วเซฟทับของจริง
    createKeyValueRow(
      k,
      v !== null && typeof v === "object" ? JSON.stringify(v) : String(v ?? ""),
    ),
  );
}

// ── Item changes helpers (add / update / remove) ──

export interface ItemChanges<P> {
  add?: P[];
  update?: (P & { id: string })[];
  remove?: { id: string }[];
}

/**
 * เปรียบเทียบ items ปัจจุบันกับ default values เพื่อสร้าง payload { add, update, remove } สำหรับ API
 *
 * ตรวจว่า item ไหน "update" โดยเทียบ **mapped payload ตาม id** (เอา item ปัจจุบันกับ
 * default ที่ id เดียวกันมา map แล้วเทียบผลลัพธ์ที่จะส่งจริง) — เป็นการเทียบแบบ
 * order-independent จึงไม่พังเมื่อมีการ add/remove/reorder แถว
 *
 * เดิมใช้ `dirtyFields[index]` ของ react-hook-form ซึ่ง index-based: พอ add แถวใหม่
 * แทรกหน้าแถวที่แก้ไว้ dirty marker ไม่ shift ตาม → แถวที่แก้เลื่อน index แล้วถูกมองว่า
 * "ไม่ dirty" → update หลุดหาย (เห็นผลว่า "ต้อง refresh ถึงจะ update"). เทียบค่าที่จะส่ง
 * จริงตัดปัญหานี้ทิ้ง และไม่มี false-negative
 *
 * @param currentItems - items ปัจจุบันจาก form values (เช่น `values.items`)
 * @param defaultItems - items เดิมจาก default values (เช่น `defaultValues.items`)
 * @param mapFn - ฟังก์ชันแปลง form item เป็นรูปแบบ API payload (index = ตำแหน่งจริงใน array)
 * @returns ItemChanges ที่มี add, update, remove (เฉพาะที่มีข้อมูล)
 * @example
 * ```ts
 * const details = buildItemChanges(
 *   values.items,
 *   defaultValues.items,
 *   (item, i) => ({ sequence_no: i + 1, product_id: item.product_id, qty: item.qty }),
 * );
 * // { add: [...], update: [...], remove: [...] }
 * ```
 */
export function buildItemChanges<T extends { id?: string | null }, P>(
  currentItems: T[],
  defaultItems: T[],
  mapFn: (item: T, index: number) => P,
): ItemChanges<P> {
  const newItems = currentItems.filter((item) => !item.id);
  const existingItems = currentItems.filter(
    (item): item is T & { id: string } => !!item.id,
  );

  const currentIds = new Set(existingItems.map((item) => item.id));
  const removedItems = defaultItems
    .filter(
      (item): item is T & { id: string } =>
        !!item.id && !currentIds.has(item.id),
    )
    .map((item) => ({ id: item.id }));

  // เทียบ payload ที่จะส่งจริง (map แล้ว) ของ item ปัจจุบัน vs default ที่ id เดียวกัน
  // ต่างเมื่อไหร่ = update — ครอบทั้งค่าที่แก้และตำแหน่ง (sequence) ที่เปลี่ยน
  const updatedItems = existingItems.filter((item) => {
    const defaultItem = defaultItems.find((d) => d.id === item.id);
    if (!defaultItem) return true;
    const curPayload = mapFn(item, currentItems.indexOf(item));
    const defPayload = mapFn(defaultItem, defaultItems.indexOf(defaultItem));
    return JSON.stringify(curPayload) !== JSON.stringify(defPayload);
  });

  const result: ItemChanges<P> = {};
  if (newItems.length > 0) {
    result.add = newItems.map((item) =>
      mapFn(item, currentItems.indexOf(item)),
    );
  }
  if (updatedItems.length > 0) {
    result.update = updatedItems.map((item) => ({
      id: item.id,
      ...mapFn(item, currentItems.indexOf(item)),
    }));
  }
  if (removedItems.length > 0) {
    result.remove = removedItems;
  }
  return result;
}

export function keyValuesToObject(
  rows: KeyValueRow[],
): Record<string, unknown> | null {
  const filtered = rows.filter((r) => r.key.trim());
  if (filtered.length === 0) return null;
  const result: Record<string, unknown> = {};
  for (const row of filtered) {
    const k = row.key.trim();
    const v = row.value.trim();
    const num = Number(v);
    if (v !== "" && !Number.isNaN(num)) {
      result[k] = num;
    } else if (v === "true") {
      result[k] = true;
    } else if (v === "false") {
      result[k] = false;
    } else if (/^[[{]/.test(v)) {
      // คู่กับ objectToKeyValues ที่ stringify ค่าซ้อน — parse ไม่ผ่านก็เก็บเป็นข้อความตามที่พิมพ์
      try {
        result[k] = JSON.parse(v);
      } catch {
        result[k] = v;
      }
    } else {
      result[k] = v;
    }
  }
  return result;
}

/**
 * นับว่ามีกี่รายการที่ยังกรอกไม่ครบ จาก error ของ react-hook-form
 *
 * ใช้คู่กับ toast ตอน validate ไม่ผ่าน — ปุ่มที่กดแล้วเงียบหรือเลื่อนหน้าเฉย ๆ
 * ทำให้คนกรอกต้องไล่เดาเองว่าขาดอะไร ตัวเลขนี้บอกขนาดของงานที่เหลือ ส่วนช่องที่
 * ผิดจริงมีข้อความของตัวเองติดอยู่แล้ว
 *
 * @param errors - `form.formState.errors` หรือ argument ของ onInvalid
 * @param key - ชื่อ field array (default `items`)
 * @returns จำนวนแถวที่มี error — 0 แปลว่าผิดที่ระดับเอกสาร ไม่ใช่ในรายการ
 * @example
 * ```ts
 * const count = countInvalidItems(errors);
 * toast.warning(count > 0 ? tv("incompleteItems", { count }) : tv("incompleteDocument"));
 * ```
 */
export function countInvalidItems(
  errors: Record<string, unknown> | undefined,
  key = "items",
): number {
  const itemErrors = errors?.[key];
  return Array.isArray(itemErrors) ? itemErrors.filter(Boolean).length : 0;
}

/**
 * `onSubmit` ของ `<form>` ที่ **ข้าม validation** — ใช้กับปุ่ม Save ของเอกสารที่ยัง
 * เป็นร่าง (PR/PO/GRN/CN/SR)
 *
 * Save = "เก็บที่กรอกไว้ก่อน" ไม่ใช่ "ส่ง/ยืนยัน" คนกรอกอาจยังไม่รู้ผู้ขาย ยังไม่รู้
 * ราคา แล้วอยากปิดจอไปทำอย่างอื่นก่อน บังคับให้ครบก่อนบันทึก = เขาต้องกรอกมั่วให้
 * ผ่าน หรือไม่ก็ทิ้งทั้งใบ · ตัวที่ยังบังคับครบคือปุ่ม Submit/Commit ซึ่งเป็นจุดที่
 * เอกสารพ้นมือคนกรอกไปแล้วจริง ๆ (เทมเพลต PR ไม่ใช้ตัวนี้ — มันไม่มีขั้นที่สอง
 * ให้ไปตรวจ บันทึกคือจบ)
 *
 * ค่าที่ส่งคือ `form.getValues()` ดิบ ๆ ไม่ผ่าน zod — ทุกช่องตัวเลขในโมดูลพวกนี้
 * `setValue` เป็น `number` ตั้งแต่ `onChange` อยู่แล้ว ไม่ได้พึ่ง `z.coerce`
 * ถ้าเพิ่มช่องใหม่ที่ปล่อยค่าเป็น string ต้อง coerce ที่ตัวช่องเอง
 *
 * กับดัก: override แค่ `onChange` ของ `register()` ยังไม่พอ — `onBlur` ที่ spread มา
 * ด้วยคือ handler ตัวเดียวกันใน RHF มันอ่านค่าดิบจาก DOM (`"10"`) เขียนทับ number
 * ที่ `onChange` เพิ่ง set ไว้ทันทีที่โฟกัสหลุด แล้ว Save ก็ส่ง string ไป 400 ต้อง
 * `register(name, { setValueAs: coerceNumberInput })` ให้ตัว register coerce เอง
 *
 * @param form - instance ของ react-hook-form
 * @param save - ตัวบันทึกจริง รับ values ของฟอร์ม
 * @example
 * ```tsx
 * <form onSubmit={draftSaveHandler(form, onSubmit)}>
 * ```
 */
export function draftSaveHandler<T extends FieldValues>(
  form: UseFormReturn<T>,
  save: (values: T) => void | Promise<void>,
) {
  return (e: React.FormEvent) => {
    e.preventDefault();
    void save(form.getValues());
  };
}
