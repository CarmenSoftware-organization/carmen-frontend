import { readdirSync } from "node:fs";
import { join } from "node:path";
import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";
import tseslint from "typescript-eslint";

/**
 * โมดูลใต้ routes/ อ่านจากดิสก์ ไม่ต้องมานั่งไล่เติมลิสต์เองตอนเพิ่มโมดูลใหม่
 * (routes/*.tsx ที่อยู่ระดับบนสุด เช่น router.tsx ไม่นับ — มันคือคนต่อสาย
 * ให้ทุกโมดูล เลยต้อง import ข้ามได้)
 */
const ROUTE_MODULES = readdirSync(join(import.meta.dirname, "routes"), {
  withFileTypes: true,
})
  .filter((e) => e.isDirectory() && e.name !== "__tests__")
  .map((e) => e.name);

/** กัน import ของ Next หลุดเข้ามาหลัง migrate */
const NEXT_IMPORTS = {
  group: [
    "next",
    "next/*",
    "next-intl",
    "next-intl/*",
    "nextjs-toploader",
  ],
  message: "Use react-router or use-intl instead — this is a Vite SPA.",
};

/**
 * เส้นแบ่งโมดูล: routes/<A>/ ห้ามยื่นมือไปหยิบของใน routes/<B>/
 *
 * ตอนเขียน rule นี้ทั้งโปรเจกต์ไม่มี import ข้ามโมดูลเลยสักจุด — เขียนเพื่อ
 * ล็อกสภาพนั้นไว้ ไม่ใช่เพื่อไล่แก้ ของที่สองโมดูลต้องใช้ร่วมกันมีบ้านอยู่แล้ว:
 * components/ (UI), hooks/ (data ข้ามโมดูล), lib/, types/, constant/
 *
 * ครอบเฉพาะรูปแบบ alias `@/routes/...` ซึ่งเป็นวิธีเดียวที่โปรเจกต์นี้เขียน
 * จริง ๆ ส่วน relative แบบ `../../<โมดูลอื่น>/x` ไม่ได้กัน เพราะเขียนแล้ว
 * false positive กับ sub-folder ของ feature (เช่น pr-item-cells/) และวันนี้
 * มี 0 จุด ถ้าวันหนึ่งมีคนเขียนขึ้นมาค่อยว่ากัน
 */
const crossModule = (own) => ({
  group: ["@/routes/*/**", `!@/routes/${own}/**`],
  message: `routes/${own}/ importing another module — put the shared bit in components/, hooks/, lib/ or types/ instead.`,
});

/**
 * ชั้นล่างห้ามพึ่งชั้นบน: ของกลางอย่าง components/ hooks/ lib/ ต้องไม่ import
 * จาก routes/ ไม่งั้น "ของกลาง" ก็ผูกกับ feature เดียวไปโดยปริยาย
 * (main.tsx ยกเว้น — มันคือ entry ที่ต่อ router)
 */
const NO_FEATURE_IMPORTS = {
  group: ["@/routes/**"],
  message:
    "Shared layer must not import from routes/ — move the shared piece down into components/, hooks/, lib/ or types/.",
};

export default tseslint.config(
  { ignores: ["dist", "node_modules", "public", "**/.remember", ".superpowers"] },
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
      reactHooks.configs["recommended-latest"],
      reactRefresh.configs.vite,
    ],
    languageOptions: { globals: globals.browser },
    rules: {
      // อนุญาต underscore-prefixed args/vars ที่ตั้งใจไม่ใช้ (เช่น mock mutationFn _data/_id)
      // — ตรงกับ convention ของโค้ดเดิมที่ port มาจาก Next app
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      // react-refresh/only-export-components เป็น HMR-only hint ไม่ใช่ correctness rule.
      // shadcn/ui primitives + feature components หลายตัว export ทั้ง component และ
      // variant/hook/helper ร่วมไฟล์ (canonical pattern) — ลดเป็น warn เพื่อไม่ต้อง
      // แตกไฟล์ vendored code โดยไม่จำเป็น (ดู DONE_WITH_CONCERNS task 11)
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
      "no-restricted-imports": ["error", { patterns: [NEXT_IMPORTS] }],
    },
  },
  // App source รันในเบราว์เซอร์เท่านั้น — ห้ามอ้าง `process` (ReferenceError ตอน runtime;
  // tsc มอง @types/node เลยจับไม่ได้, vitest รันใน Node เลยไม่ crash → ต้องกันที่ lint)
  // ใช้ import.meta.env.* หรือ lib/runtime-config แทน
  {
    files: [
      "components/**/*.{ts,tsx}",
      "hooks/**/*.{ts,tsx}",
      "lib/**/*.{ts,tsx}",
      "routes/**/*.{ts,tsx}",
      "constant/**/*.{ts,tsx}",
      "types/**/*.{ts,tsx}",
      "i18n/**/*.{ts,tsx}",
      "main.tsx",
    ],
    ignores: ["**/__tests__/**", "**/*.test.{ts,tsx}"],
    rules: {
      "no-restricted-globals": [
        "error",
        {
          name: "process",
          message:
            "Browser-only SPA — `process` does not exist at runtime. Use import.meta.env.* or lib/runtime-config.",
        },
      ],
    },
  },
  // ชั้นของกลาง — ห้าม import จาก routes/
  {
    files: [
      "components/**/*.{ts,tsx}",
      "hooks/**/*.{ts,tsx}",
      "lib/**/*.{ts,tsx}",
      "constant/**/*.{ts,tsx}",
      "types/**/*.{ts,tsx}",
      "i18n/**/*.{ts,tsx}",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        { patterns: [NEXT_IMPORTS, NO_FEATURE_IMPORTS] },
      ],
    },
  },
  // หนึ่งบล็อกต่อหนึ่งโมดูลใต้ routes/ — แต่ละโมดูลเห็นแค่ของตัวเอง
  ...ROUTE_MODULES.map((own) => ({
    files: [`routes/${own}/**/*.{ts,tsx}`],
    rules: {
      "no-restricted-imports": [
        "error",
        { patterns: [NEXT_IMPORTS, crossModule(own)] },
      ],
    },
  })),
);
