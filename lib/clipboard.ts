/**
 * เขียนข้อความลง clipboard — คืน false เมื่อ clipboard ถูกบล็อก (ไม่ throw)
 *
 * @param text - ข้อความที่จะคัดลอก
 * @returns true เมื่อคัดลอกสำเร็จ
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
