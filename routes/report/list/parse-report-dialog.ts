interface LabelNode {
  type: "label";
  name: string;
  text: string;
  visible: boolean;
}

export interface LookupNode {
  type: "lookup";
  name: string;
  dataSource: string;
  items: string[];
  values: string[];
  value: string;
  multi: boolean; // Multi="true" → render as checkbox group, submit comma-joined values
  colSpan: number;
  /** ค่า attribute Label บน control เอง — null = ไม่มี (ใช้ <Label> ข้างหน้าแบบเดิม) */
  selfLabel: string | null;
}

export interface DateNode {
  type: "date";
  name: string;
  value: string;
  colSpan: number;
  /** ค่า attribute Label บน control เอง — null = ไม่มี (ใช้ <Label> ข้างหน้าแบบเดิม) */
  selfLabel: string | null;
}

type DialogNode = LabelNode | LookupNode | DateNode;

/** เพดานคอลัมน์ของ dialog — modal กว้างได้จำกัด เกินนี้ Lookup จะแคบจนอ่านไม่ออก */
export const MAX_COLS = 4;

/** <Group> — กล่องจัด layout ที่ผู้เขียนกำหนดเอง ข้างในไม่จับคู่ From/To อัตโนมัติ */
export interface GroupCell {
  kind: "group";
  colSpan: number;
  /** หัวข้อจาก <Group Label> (trim แล้ว) — "" = ไม่แสดง */
  label: string;
  fields: SingleField[];
}

export type DialogCell = FormField | GroupCell;

export interface ParsedDialog {
  cols: number;
  cells: DialogCell[];
  /** ข้อความจาก <Note Text> ระดับบนสุด แสดงใต้ช่อง filter (ไม่ใช่ filter ไม่ถูกส่งไป) — ใช้ resolveNoteText ก่อนแสดง */
  notes: string[];
}

const pad2 = (n: number): string => String(n).padStart(2, "0");

/**
 * แทน token ในข้อความ <Note> ด้วยค่าจริงตอนเปิด dialog — ตอนนี้มี `@today` → วันที่วันนี้ dd/MM/yyyy
 * (รูปเดียวกับวันที่ในรายงาน) เช่น Slow Moving: `Today = @today` → `Today = 20/10/2026`
 */
export function resolveNoteText(text: string, now: Date = new Date()): string {
  const today = `${pad2(now.getDate())}/${pad2(now.getMonth() + 1)}/${now.getFullYear()}`;
  return text.replaceAll("@today", today);
}

const INT = /^\s*\d+\s*$/;

/** จำนวนเต็ม ≥ 1 หรือ undefined ถ้าไม่ใช่ — ค่าผิดทุกแบบถอยไปค่าเริ่มต้น ไม่ throw */
const readPositiveInt = (raw: string | null): number | undefined => {
  if (raw === null || !INT.test(raw)) return undefined;
  const n = Number.parseInt(raw, 10);
  return n >= 1 ? n : undefined;
};

const readCols = (el: Element): number =>
  Math.min(readPositiveInt(el.getAttribute("Cols")) ?? 1, MAX_COLS);

const readSpan = (el: Element, cols: number): number =>
  Math.min(readPositiveInt(el.getAttribute("ColSpan")) ?? 1, cols);

export interface RangeField {
  kind: "range";
  label: string;
  from: LookupNode | DateNode;
  to: LookupNode | DateNode;
  colSpan: number;
}

export interface SingleField {
  kind: "single";
  label: string;
  control: LookupNode | DateNode;
  colSpan: number;
}

export type FormField = RangeField | SingleField;

const attr = (el: Element, name: string): string => {
  return el.getAttribute(name) ?? "";
};

// Map @variable DataSource names to micro-report lookup types
const dataSourceMap: Record<string, string> = {
  "@product_list": "product",
  "@category_list": "category",
  "@subcategory_list": "sub-category",
  "@itemgroup_list": "item-group",
  "@location_list": "location",
  "@location_inventory_list": "location-inventory",
  "@location_direct_list": "location-direct",
  "@location_consigment_list": "location-consignment",
  "@location_count_list": "location-count",
  "@vendor_list": "vendor",
  "@period_list": "period",
};

function resolveDataSource(raw: string): string {
  if (!raw) return raw;
  const mapped = dataSourceMap[raw.toLowerCase()] ?? dataSourceMap[raw];
  return mapped ?? raw;
}

const isControl = (
  node: DialogNode | undefined,
): node is LookupNode | DateNode => {
  return node?.type === "lookup" || node?.type === "date";
};

const isToLabel = (node: DialogNode | undefined): boolean => {
  if (node?.type !== "label") return false;
  return !node.visible || node.text === "to";
};

/**
 * คู่ control ชื่อ `<X>From` กับ `<X>To` — dialog ปัจจุบันมีป้ายของทั้งสองฝั่ง ("Location From" /
 * "Location To") ซึ่ง isToLabel ไม่จับ จึงเคยขึ้นเป็นสี่แถวแยกกัน ชื่อ control คือสิ่งที่ micro-data ใช้จับคู่
 * ช่วงอยู่แล้ว (<X>From → >=, <X>To → <=)
 */
const isNamedPair = (
  from: LookupNode | DateNode,
  to: DialogNode | undefined,
): boolean =>
  isControl(to) &&
  to.type === from.type &&
  from.name.endsWith("From") &&
  to.name === `${from.name.slice(0, -"From".length)}To`;

export function parseReportDialog(xml: string): ParsedDialog {
  const doc = new DOMParser().parseFromString(xml, "text/xml");
  const dialogEl = doc.querySelector("Dialog");
  if (!dialogEl) return { cols: 1, cells: [], notes: [] };

  const cols = readCols(dialogEl);
  const cells: DialogCell[] = [];
  const notes: string[] = [];
  let run: Element[] = [];
  const flush = () => {
    if (run.length) cells.push(...groupFields(parseNodes(run, cols)));
    run = [];
  };
  for (const child of Array.from(dialogEl.children)) {
    if (child.tagName === "Note") {
      const text = attr(child, "Text").trim();
      if (text) notes.push(text);
      continue;
    }
    if (child.tagName !== "Group") {
      run.push(child);
      continue;
    }
    flush();
    const fields = groupFields(
      parseNodes(groupChildren(child), cols),
      false,
    ) as SingleField[];
    if (fields.length > 0) {
      cells.push({
        kind: "group",
        colSpan: readSpan(child, cols),
        label: (child.getAttribute("Label") ?? "").trim(),
        fields,
      });
    }
  }
  flush();
  return { cols, cells, notes };
}

/** Group ซ้อน Group ไม่รองรับ — ยกลูกของกลุ่มในขึ้นมาแทนที่ เพื่อไม่ให้ field หาย */
const groupChildren = (group: Element): Element[] =>
  Array.from(group.children).flatMap((c) =>
    c.tagName === "Group" ? groupChildren(c) : [c],
  );

/** รวมทุก field เป็น list แบนสำหรับงานที่ไม่สนใจ layout (data source, period, ส่งค่า filter) */
export function flattenFields(cells: DialogCell[]): FormField[] {
  return cells.flatMap((c) => (c.kind === "group" ? c.fields : [c]));
}

const parseNodes = (elements: Element[], cols: number): DialogNode[] => {
  const nodes: DialogNode[] = [];

  for (const child of elements) {
    const tag = child.tagName;

    if (tag === "Label") {
      nodes.push({
        type: "label",
        name: attr(child, "Name"),
        text: attr(child, "Text"),
        visible: child.getAttribute("Visible") !== "false",
      });
    } else if (tag === "Lookup") {
      const rawItems = attr(child, "Items");
      const rawValues = attr(child, "Values");
      nodes.push({
        type: "lookup",
        name: attr(child, "Name"),
        dataSource: resolveDataSource(attr(child, "DataSource")),
        items: rawItems ? rawItems.split("~") : [],
        values: rawValues ? rawValues.split("~") : [],
        value: attr(child, "Value"),
        multi: attr(child, "Multi") === "true",
        colSpan: readSpan(child, cols),
        selfLabel: child.getAttribute("Label"),
      });
    } else if (tag === "Date") {
      nodes.push({
        type: "date",
        name: attr(child, "Name"),
        value: attr(child, "Value"),
        colSpan: readSpan(child, cols),
        selfLabel: child.getAttribute("Label"),
      });
    }
  }

  return nodes;
};

const groupFields = (nodes: DialogNode[], pairRanges = true): FormField[] => {
  const fields: FormField[] = [];
  let i = 0;

  while (i < nodes.length) {
    const node = nodes[i];

    // control ที่มี Label ในตัวเป็น field เดี่ยวเสมอ — ไม่หยิบ <Label> ข้างหน้า ไม่จับคู่ช่วง
    if (isControl(node) && node.selfLabel !== null) {
      fields.push({
        kind: "single",
        label: node.selfLabel.trim() || node.name,
        control: node,
        colSpan: node.colSpan,
      });
      i++;
      continue;
    }

    if (node.type !== "label" || !node.visible) {
      i++;
      continue;
    }

    const next = nodes[i + 1];
    if (!isControl(next) || next.selfLabel !== null) {
      i++;
      continue;
    }

    const afterControl = nodes[i + 2];
    const toControl = nodes[i + 3];

    const isPaired =
      (isToLabel(afterControl) && isControl(toControl)) ||
      (afterControl?.type === "label" && isNamedPair(next, toControl));
    if (pairRanges && isPaired && isControl(toControl) && toControl.selfLabel === null) {
      fields.push({
        kind: "range",
        label: node.text,
        from: next,
        to: toControl,
        colSpan: next.colSpan,
      });
      i += 4;
    } else {
      fields.push({
        kind: "single",
        label: node.text,
        control: next,
        colSpan: next.colSpan,
      });
      i += 2;
    }
  }

  return fields;
};
