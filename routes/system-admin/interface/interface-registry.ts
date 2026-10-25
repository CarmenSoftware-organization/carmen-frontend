import { lazy, type ComponentType, type LazyExoticComponent } from "react";
import { BookOpen, FileOutput, Hotel, ShoppingCart } from "lucide-react";
import type { LucideIcon } from "../landing-types";

export type BrandDef = {
  readonly key: string;
  readonly configKey: string;
  readonly form?: LazyExoticComponent<ComponentType>;
  /**
   * `true` = brand นี้ไม่มีสวิตช์เปิด/ปิดและปลายทาง (ระบบภายนอกดึงเองผ่าน API key)
   * หน้า list จึงแสดง "—" แทนสถานะ/ปลายทาง แทนที่จะค้างค่าเก่าที่แก้ไม่ได้แล้ว
   */
  readonly noConnection?: boolean;
};

export type InterfaceCategoryDef = {
  readonly key: string;
  readonly icon: LucideIcon;
  readonly brands: readonly BrandDef[];
  /** ฟอร์มตั้งต้นของ brand ในหมวด — ไม่มี = ทุก brand ต้องถือ `form` ของตัวเอง (ไม่งั้นหน้า detail ขึ้น "ไม่พบ") */
  readonly form?: LazyExoticComponent<ComponentType>;
};

function brands(
  category: string,
  keys: readonly string[],
): readonly BrandDef[] {
  return keys.map((key) => ({
    key,
    configKey: `interface_${category}_${key}`,
  }));
}

/**
 * รายการ interface ทั้งหมด สองชั้น — category ถือ brand, brand ถือ config
 *
 * registry เก็บแค่ metadata (route key, config key, icon, form) ไม่เก็บ field/schema —
 * แต่ละ category ถือ form + schema ของตัวเอง เพราะหน้าตาต่างกันจริง ดู
 * docs/superpowers/specs/2026-07-16-interface-brands-visibility-design.md
 *
 * เพิ่ม brand = เพิ่ม key ใน brands() ของ category นั้น + i18n label + secret path ฝั่ง backend
 * + เพิ่มแถวใน `LICENSE_ROUTE_OVERRIDES` (`packages/prisma-shared-schema-backstage/prisma/
 * permission.route-map.ts` ของรีโป backend) — ลืมขั้นนี้แล้ว brand ใหม่จะตกไปอยู่ใต้ license
 * `configuration.app_config` เงียบ ๆ (ทุก BU มีอยู่แล้ว) แปลว่าขายแยกไม่ได้เลย และไม่มีด่านไหน
 * แดงเตือน เพราะ config key ยังอ่าน/เขียนได้ปกติ แค่ไม่ผ่าน license feature ของตัวเอง
 * เพิ่ม category = เพิ่ม entry ที่นี่ + สร้างไฟล์ form หนึ่งไฟล์ + เติมชื่อ category ใน regex ฝั่ง backend
 * (`INTERFACE_CONFIG_KEY_RE` ของ gateway และ `defaultFor`/`validateValue` ของ micro-business) —
 * ลืม regex ของ gateway แล้ว config key ของหมวดใหม่จะไม่ถูกตรวจ license ระดับ brand เลย แบบไม่มีอะไรแดง
 */
export const INTERFACE_CATEGORIES: readonly InterfaceCategoryDef[] = [
  {
    key: "accounting",
    icon: BookOpen,
    brands: [
      {
        key: "carmen_gl",
        configKey: "interface_accounting_carmen_gl",
        // Carmen 4 legacy — field set ต่างจาก accounting ทั่วไป (ดู spec 2026-07-22)
        form: lazy(() => import("./carmen-gl-interface-form")),
      },
      ...brands("accounting", ["blueledgers"]),
    ],
    form: lazy(() => import("./accounting-interface-form")),
  },
  {
    key: "pos",
    icon: ShoppingCart,
    brands: [
      {
        key: "simphony",
        configKey: "interface_pos_simphony",
        form: lazy(() => import("./pos/pos-simphony-form")),
      },
      {
        key: "micros3700",
        configKey: "interface_pos_micros3700",
        form: lazy(() => import("./pos/pos-micros3700-form")),
      },
      ...brands("pos", ["infrasys", "square"]),
    ],
    form: lazy(() => import("./pos-interface-form")),
  },
  {
    key: "pms",
    icon: Hotel,
    brands: brands("pms", ["opera", "protel"]),
    form: lazy(() => import("./pms-interface-form")),
  },
  {
    // เครื่องมือให้ระบบภายนอกดึงข้อมูลออกเอง — ไม่มีฟอร์มกลาง ทุก brand ถือฟอร์มของตัวเอง
    key: "export",
    icon: FileOutput,
    brands: [
      {
        key: "external",
        configKey: "interface_export_external",
        // โซน API ขาเข้าอย่างเดียว (API Access + เอกสาร) — ไม่มีฟอร์ม config
        form: lazy(() => import("./external-interface-form")),
        noConnection: true,
      },
    ],
  },
];

export function findCategory(
  key: string | undefined,
): InterfaceCategoryDef | undefined {
  return INTERFACE_CATEGORIES.find((def) => def.key === key);
}

export function findBrand(
  categoryKey: string | undefined,
  brandKey: string | undefined,
): BrandDef | undefined {
  return findCategory(categoryKey)?.brands.find((b) => b.key === brandKey);
}
