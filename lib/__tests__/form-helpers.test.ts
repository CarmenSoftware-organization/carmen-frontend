import { describe, it, expect } from "vitest";
import {
  arrayToText,
  textToArray,
  objectToText,
  textToObject,
  createKeyValueRow,
  objectToKeyValues,
  keyValuesToObject,
  buildItemChanges,
  stableStringify,
} from "../form-helpers";

// ─── arrayToText / textToArray ───────────────────────────────────────────────

describe("arrayToText", () => {
  it("returns empty string for null/undefined/empty", () => {
    expect(arrayToText(null)).toBe("");
    expect(arrayToText(undefined)).toBe("");
    expect(arrayToText([])).toBe("");
  });

  it("joins items with newline", () => {
    expect(arrayToText(["a", "b", "c"])).toBe("a\nb\nc");
  });
});

describe("textToArray", () => {
  it("returns null for empty/whitespace-only string", () => {
    expect(textToArray("")).toBeNull();
    expect(textToArray("   \n  \n  ")).toBeNull();
  });

  it("splits by newline, trims, and filters empty lines", () => {
    expect(textToArray("a\n  b \n\nc")).toEqual(["a", "b", "c"]);
  });
});

// ─── objectToText / textToObject ─────────────────────────────────────────────

describe("objectToText", () => {
  it("returns empty string for null/undefined/empty object", () => {
    expect(objectToText(null)).toBe("");
    expect(objectToText(undefined)).toBe("");
    expect(objectToText({})).toBe("");
  });

  it("returns formatted JSON", () => {
    expect(objectToText({ a: 1 })).toBe('{\n  "a": 1\n}');
  });
});

describe("textToObject", () => {
  it("returns null for empty/whitespace string", () => {
    expect(textToObject("")).toBeNull();
    expect(textToObject("   ")).toBeNull();
  });

  it("returns null for invalid JSON", () => {
    expect(textToObject("{invalid}")).toBeNull();
  });

  it("parses valid JSON", () => {
    expect(textToObject('{"a":1}')).toEqual({ a: 1 });
  });
});

// ─── Key-value helpers ───────────────────────────────────────────────────────

describe("createKeyValueRow", () => {
  it("creates row with unique _id", () => {
    const r1 = createKeyValueRow("k", "v");
    const r2 = createKeyValueRow();
    expect(r1.key).toBe("k");
    expect(r1.value).toBe("v");
    expect(r2.key).toBe("");
    expect(r2.value).toBe("");
    expect(r1._id).not.toBe(r2._id);
  });
});

describe("objectToKeyValues", () => {
  it("returns empty array for null/undefined/empty", () => {
    expect(objectToKeyValues(null)).toEqual([]);
    expect(objectToKeyValues(undefined)).toEqual([]);
    expect(objectToKeyValues({})).toEqual([]);
  });

  it("converts object entries to rows", () => {
    const rows = objectToKeyValues({ name: "Alice", age: 30 });
    expect(rows).toHaveLength(2);
    expect(rows[0].key).toBe("name");
    expect(rows[0].value).toBe("Alice");
    expect(rows[1].key).toBe("age");
    expect(rows[1].value).toBe("30");
  });

  it("converts null value to empty string", () => {
    const rows = objectToKeyValues({ x: null });
    expect(rows[0].value).toBe("");
  });
});

describe("keyValuesToObject", () => {
  it("returns null when no keys have content", () => {
    expect(keyValuesToObject([])).toBeNull();
    expect(keyValuesToObject([createKeyValueRow("", "v")])).toBeNull();
  });

  it("converts numeric string values to numbers", () => {
    const result = keyValuesToObject([createKeyValueRow("qty", "42")]);
    expect(result).toEqual({ qty: 42 });
  });

  it("converts boolean string values", () => {
    const result = keyValuesToObject([
      createKeyValueRow("a", "true"),
      createKeyValueRow("b", "false"),
    ]);
    expect(result).toEqual({ a: true, b: false });
  });

  it("keeps non-numeric strings as-is", () => {
    const result = keyValuesToObject([createKeyValueRow("name", "hello")]);
    expect(result).toEqual({ name: "hello" });
  });

  it("treats empty value as empty string", () => {
    const result = keyValuesToObject([createKeyValueRow("k", "")]);
    expect(result).toEqual({ k: "" });
  });
});

// ─── buildItemChanges ────────────────────────────────────────────────────────

interface TestItem {
  id?: string | null;
  name: string;
  qty: number;
}

interface TestPayload {
  name: string;
  qty: number;
}

const mapFn = (item: TestItem): TestPayload => ({
  name: item.name,
  qty: item.qty,
});

describe("buildItemChanges", () => {
  it("returns empty object when nothing changed", () => {
    const items: TestItem[] = [{ id: "1", name: "A", qty: 1 }];
    const defaults: TestItem[] = [{ id: "1", name: "A", qty: 1 }];

    const result = buildItemChanges(items, defaults, mapFn);
    expect(result).toEqual({});
  });

  it("detects new items (no id)", () => {
    const items: TestItem[] = [
      { id: "1", name: "A", qty: 1 },
      { name: "B", qty: 2 },
      { id: null, name: "C", qty: 3 },
    ];
    const defaults: TestItem[] = [{ id: "1", name: "A", qty: 1 }];

    const result = buildItemChanges(items, defaults, mapFn);
    expect(result.add).toEqual([
      { name: "B", qty: 2 },
      { name: "C", qty: 3 },
    ]);
    expect(result.update).toBeUndefined();
    expect(result.remove).toBeUndefined();
  });

  it("detects removed items (in defaults but not in current)", () => {
    const items: TestItem[] = [{ id: "1", name: "A", qty: 1 }];
    const defaults: TestItem[] = [
      { id: "1", name: "A", qty: 1 },
      { id: "2", name: "B", qty: 2 },
      { id: "3", name: "C", qty: 3 },
    ];

    const result = buildItemChanges(items, defaults, mapFn);
    expect(result.remove).toEqual([{ id: "2" }, { id: "3" }]);
    expect(result.add).toBeUndefined();
  });

  it("detects updated items by mapped-value comparison", () => {
    const items: TestItem[] = [
      { id: "1", name: "A-updated", qty: 1 },
      { id: "2", name: "B", qty: 2 },
    ];
    const defaults: TestItem[] = [
      { id: "1", name: "A", qty: 1 },
      { id: "2", name: "B", qty: 2 },
    ];

    const result = buildItemChanges(items, defaults, mapFn);
    expect(result.update).toEqual([{ id: "1", name: "A-updated", qty: 1 }]);
    expect(result.add).toBeUndefined();
    expect(result.remove).toBeUndefined();
  });

  it("detects an item whose value changed", () => {
    const items: TestItem[] = [
      { id: "1", name: "A-changed", qty: 1 },
      { id: "2", name: "B", qty: 2 },
    ];
    const defaults: TestItem[] = [
      { id: "1", name: "A", qty: 1 },
      { id: "2", name: "B", qty: 2 },
    ];

    const result = buildItemChanges(items, defaults, mapFn);
    expect(result.update).toEqual([{ id: "1", name: "A-changed", qty: 1 }]);
  });

  it("treats existing item not in defaults as updated (fallback)", () => {
    const items: TestItem[] = [{ id: "99", name: "new-existing", qty: 5 }];
    const defaults: TestItem[] = [];

    const result = buildItemChanges(items, defaults, mapFn);
    expect(result.update).toEqual([{ id: "99", name: "new-existing", qty: 5 }]);
  });

  // Regression: adding a new row that shifts an already-edited existing row must
  // not drop the edit. The old index-based dirtyFields check silently lost it.
  it("keeps an edited existing item when a new row is prepended before it", () => {
    const items: TestItem[] = [
      { name: "NEW", qty: 9 }, // prepended add (no id) → pushes id:1 to index 1
      { id: "1", name: "A-edited", qty: 1 },
    ];
    const defaults: TestItem[] = [{ id: "1", name: "A", qty: 1 }];

    const result = buildItemChanges(items, defaults, mapFn);
    expect(result.add).toEqual([{ name: "NEW", qty: 9 }]);
    expect(result.update).toEqual([{ id: "1", name: "A-edited", qty: 1 }]);
    expect(result.remove).toBeUndefined();
  });

  it("handles mixed add + update + remove in one call", () => {
    const items: TestItem[] = [
      { id: "1", name: "A-updated", qty: 10 }, // updated
      // id "2" removed
      { name: "D", qty: 4 }, // added
    ];
    const defaults: TestItem[] = [
      { id: "1", name: "A", qty: 1 },
      { id: "2", name: "B", qty: 2 },
    ];

    const result = buildItemChanges(items, defaults, mapFn);

    expect(result.add).toEqual([{ name: "D", qty: 4 }]);
    expect(result.update).toEqual([{ id: "1", name: "A-updated", qty: 10 }]);
    expect(result.remove).toEqual([{ id: "2" }]);
  });

  it("returns empty object when all items are unchanged", () => {
    const items: TestItem[] = [
      { id: "1", name: "A", qty: 1 },
      { id: "2", name: "B", qty: 2 },
    ];

    const result = buildItemChanges(items, items, mapFn);
    expect(result).toEqual({});
  });

  it("handles empty arrays", () => {
    const result = buildItemChanges<TestItem, TestPayload>([], [], mapFn);
    expect(result).toEqual({});
  });

  it("handles all items removed", () => {
    const defaults: TestItem[] = [
      { id: "1", name: "A", qty: 1 },
      { id: "2", name: "B", qty: 2 },
    ];

    const result = buildItemChanges([], defaults, mapFn);
    expect(result.remove).toEqual([{ id: "1" }, { id: "2" }]);
    expect(result.add).toBeUndefined();
    expect(result.update).toBeUndefined();
  });

  it("handles all items are new", () => {
    const items: TestItem[] = [
      { name: "X", qty: 1 },
      { name: "Y", qty: 2 },
    ];

    const result = buildItemChanges(items, [], mapFn);
    expect(result.add).toEqual([
      { name: "X", qty: 1 },
      { name: "Y", qty: 2 },
    ]);
    expect(result.update).toBeUndefined();
    expect(result.remove).toBeUndefined();
  });
});

describe("stableStringify", () => {
  it("ignores key order at every level", () => {
    expect(stableStringify({ b: 1, a: { d: 2, c: 3 } })).toBe(
      stableStringify({ a: { c: 3, d: 2 }, b: 1 }),
    );
  });

  // config ของ BU จาก jsonb เทียบกับค่าที่ผ่าน zod: ค่าเท่ากัน ลำดับ key ต่างกัน
  it("treats a jsonb-ordered item and a schema-ordered item as equal", () => {
    const fromJsonb = [{ key: "k", label: "L", value: "v", datatype: "enum" }];
    const fromZod = [{ key: "k", label: "L", datatype: "enum", value: "v" }];
    expect(JSON.stringify(fromJsonb)).not.toBe(JSON.stringify(fromZod));
    expect(stableStringify(fromJsonb)).toBe(stableStringify(fromZod));
  });

  it("still sees a changed value or a changed array order", () => {
    expect(stableStringify({ a: 1 })).not.toBe(stableStringify({ a: 2 }));
    expect(stableStringify([1, 2])).not.toBe(stableStringify([2, 1]));
  });

  it("matches JSON.stringify for primitives and null", () => {
    for (const v of [1, "x", true, null]) {
      expect(stableStringify(v)).toBe(JSON.stringify(v));
    }
  });
});
