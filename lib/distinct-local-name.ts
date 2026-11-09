/** `\s` ใน JS ครอบ NBSP (U+00A0) ด้วย — ยุบให้เหลือช่องว่างธรรมดาตัวเดียว */
const squashSpaces = (v: string) => v.replace(/\s+/g, " ").trim();

/**
 * ชื่อรอง (ชื่อท้องถิ่น) ที่ควรแสดงใต้ชื่อหลัก — คืน `undefined` เมื่อว่างหรือซ้ำกับชื่อหลัก
 *
 * เทียบหลังยุบช่องว่าง เพราะ master สินค้าบางตัวเก็บ local_name ด้วย NBSP แทนเว้นวรรค
 * ตาเห็นเหมือนกันทุกตัวอักษรแต่ `!==` กันตรง ๆ แล้วชื่อเดียวกันขึ้นซ้ำสองบรรทัด
 */
export function distinctLocalName(
  primary: string | null | undefined,
  local: string | null | undefined,
): string | undefined {
  if (!local) return undefined;
  return squashSpaces(local) === squashSpaces(primary ?? "")
    ? undefined
    : local;
}
