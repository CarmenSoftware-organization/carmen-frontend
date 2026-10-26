export const resolveNextPath = (next: string | null): string => {
  const fallback = "/dashboard";
  if (!next) return fallback;
  if (!next.startsWith("/")) return fallback;
  if (next.startsWith("//") || next.startsWith("/\\")) return fallback;
  // browser ตัด tab/CR/LF ทิ้งจาก URL — `/<TAB>/evil.com` จึงกลายเป็น `//evil.com` ได้
  // (ตรงกับ resolveNextPath ของ carmen-backstage — แก้ที่หนึ่งต้องแก้อีกที่ด้วย)
  for (let i = 0; i < next.length; i += 1) {
    const code = next.charCodeAt(i);
    if (code < 0x20 || code === 0x7f) return fallback;
  }
  return next;
};

/**
 * URL ของหน้า login สำหรับ session ที่ต้อง login ใหม่ พร้อม `?next=` ของหน้าที่กำลังจะออกไป
 * เพื่อให้ login เสร็จแล้วกลับมาที่เดิมทันที · `/` (ซึ่ง redirect ไป /dashboard อยู่แล้ว) และ
 * path ที่ resolveNextPath ไม่ยอมรับ → `/login` เปล่า · logout เองใช้ `/login` เปล่าตามเดิม
 * @param path - pathname + search + hash ของหน้าที่กำลังออก
 */
export const loginPathFor = (path: string): string => {
  const pathname = path.split(/[?#]/, 1)[0];
  if (pathname === "/" || resolveNextPath(path) !== path) return "/login";
  return `/login?${new URLSearchParams({ next: path }).toString()}`;
};
