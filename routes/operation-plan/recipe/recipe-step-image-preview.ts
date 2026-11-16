/**
 * URL ชั่วคราวของไฟล์ที่ยังไม่ได้อัปโหลด — สร้างครั้งเดียวต่อไฟล์ (ผูกกับตัว File ไม่ใช่กับ component
 * การ์ดขั้นจึงสลับลำดับได้โดยรูปไม่กะพริบ) · คืนหน่วยความจำด้วย `releaseStepImagePreview`
 */
const previews = new WeakMap<File, string>();
export function previewUrl(file: File): string {
  let url = previews.get(file);
  if (!url) {
    url = URL.createObjectURL(file);
    previews.set(file, url);
  }
  return url;
}
export function releaseStepImagePreview(file: File) {
  const url = previews.get(file);
  if (!url) return;
  URL.revokeObjectURL(url);
  previews.delete(file);
}
