/**
 * Color theme — ผู้ใช้เลือกชุดสีหลักของแอปจากเมนูโปรไฟล์ (แยกแกนจาก light/dark)
 *
 * ทำงานด้วย class `theme-<id>` บน <html> ที่ override token สีใน
 * styles/color-themes.css — ที่นี่ถือแค่ชื่อ ค่าสีจริงอยู่ใน CSS
 *
 * รายชื่อซ้ำกับ array ใน inline script ของ index.html (import module ไม่ได้)
 * เพิ่ม/ลบธีมต้องแก้ทั้งสองที่ แล้วอัปเดต CSP hash ตาม docs/deploy.md
 */

export const COLOR_THEMES = [
  "classic",
  "blue-glass",
  "emerald",
  "teal",
  "violet",
  "graphite",
] as const;

export type ColorTheme = (typeof COLOR_THEMES)[number];

export const DEFAULT_COLOR_THEME: ColorTheme = "classic";

export const COLOR_THEME_STORAGE_KEY = "carmen.color-theme";

const isColorTheme = (value: unknown): value is ColorTheme =>
  COLOR_THEMES.includes(value as ColorTheme);

export function readStoredColorTheme(): ColorTheme {
  try {
    const raw = localStorage.getItem(COLOR_THEME_STORAGE_KEY);
    if (isColorTheme(raw)) return raw;
  } catch {
    // storage unavailable (private mode / quota)
  }
  return DEFAULT_COLOR_THEME;
}

/** ธีมที่ใช้อยู่จริงใน tab นี้ — อ่านจาก class บน <html> ไม่ใช่ localStorage */
export function readActiveColorTheme(): ColorTheme {
  const root = document.documentElement;
  const active = COLOR_THEMES.find(
    (theme) =>
      theme !== DEFAULT_COLOR_THEME && root.classList.contains(`theme-${theme}`),
  );
  return active ?? DEFAULT_COLOR_THEME;
}

/**
 * ตั้ง class บน <html> แล้วจำค่าไว้
 *
 * `classic` ไม่มี class ของตัวเอง ผู้ใช้ที่ไม่เคยเลือกจึงได้ DOM เดิมทุกประการ
 */
export function applyColorTheme(theme: ColorTheme): void {
  const root = document.documentElement;
  for (const known of COLOR_THEMES) {
    root.classList.remove(`theme-${known}`);
  }
  if (theme !== DEFAULT_COLOR_THEME) {
    root.classList.add(`theme-${theme}`);
  }
  try {
    localStorage.setItem(COLOR_THEME_STORAGE_KEY, theme);
  } catch {
    // storage unavailable — มีผลเฉพาะ session นี้
  }
}
