/**
 * ลิงก์วิดีโอ YouTube — ใช้กับวิดีโอของแต่ละขั้นตอนของสูตร
 * (`preparation_step.videos[0].token` เก็บแค่รหัสวิดีโอ ไม่ใช่ลิงก์)
 *
 * กติกาเดียวกับ backend (`RecipeVideoUrlSchema` ใน gateway): รับลิงก์วิดีโอ YouTube ทุกรูปแบบ
 * (watch?v= · youtu.be · shorts · embed · live · m. · music. · youtube-nocookie) แล้ว backend
 * เก็บเป็น `https://www.youtube.com/watch?v=<id>` รูปแบบเดียว · เว็บอื่นไม่รับ เพราะหน้าสูตร
 * ฝังได้เฉพาะ player ของ YouTube (`frame-src` ใน CSP เปิดไว้แค่ youtube-nocookie.com)
 */

// รหัสวิดีโอ YouTube = 11 ตัวจาก [A-Za-z0-9_-]
const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const WATCH_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
]);
const PATH_HOSTS = new Set([
  ...WATCH_HOSTS,
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
]);
const PATH_PREFIXES = new Set(["shorts", "embed", "live", "v"]);

/** เป็นรหัสวิดีโอ YouTube ที่ใช้ได้ (11 ตัวจาก [A-Za-z0-9_-]) — gateway บังคับรูปเดียวกัน */
export function isYoutubeVideoId(id: unknown): id is string {
  return typeof id === "string" && YOUTUBE_ID.test(id);
}

/** รหัสวิดีโอจากลิงก์ YouTube — ไม่ใช่ลิงก์วิดีโอ YouTube (หรือว่าง) คืน null */
export function parseYoutubeVideoId(
  raw: string | null | undefined,
): string | null {
  const text = raw?.trim();
  if (!text) return null;
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const host = url.hostname.toLowerCase();
  const segments = url.pathname.split("/").filter(Boolean);
  let id: string | null = null;
  if (host === "youtu.be") id = segments[0] ?? null;
  else if (
    WATCH_HOSTS.has(host) &&
    segments.length === 1 &&
    segments[0] === "watch"
  )
    id = url.searchParams.get("v");
  else if (
    PATH_HOSTS.has(host) &&
    segments.length >= 2 &&
    PATH_PREFIXES.has(segments[0])
  )
    id = segments[1];
  return isYoutubeVideoId(id) ? id : null;
}

/** ลิงก์หน้าดูวิดีโอแบบมาตรฐาน (watch?v=<id>) — ที่ช่องวิดีโอของขั้นตอนแสดงจาก token ที่เก็บไว้ */
export function youtubeWatchUrl(id: string): string {
  return `https://www.youtube.com/watch?v=${id}`;
}

/**
 * URL ของ player ที่ฝังในหน้า — โดเมน nocookie ไม่ตั้ง cookie จนกว่าผู้ใช้กดเล่น
 * `rel=0` = วิดีโอแนะนำตอนจบมาจากช่องเดียวกันเท่านั้น
 */
export function youtubeEmbedUrl(id: string): string {
  return `https://www.youtube-nocookie.com/embed/${id}?rel=0`;
}

/** ภาพตัวอย่าง 320×180 ของวิดีโอ (img-src ใน CSP รับ https: อยู่แล้ว) */
export function youtubeThumbnailUrl(id: string): string {
  return `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;
}
