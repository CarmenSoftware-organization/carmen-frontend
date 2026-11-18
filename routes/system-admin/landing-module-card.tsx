import { LandingCard } from "@/components/share/landing/landing-card";
import type { ModuleWithAccess } from "@/hooks/use-visible-modules";
import { type ModuleDef, type TFn } from "./landing-types";
import { ModuleVisual } from "./landing-visuals";

/**
 * การ์ดของเครื่องมือหนึ่งตัวบน landing ของ System Admin — แปลชื่อ/คำอธิบายจาก
 * `systemAdmin.landing.modules.<key>` แล้วส่งให้ `LandingCard` กลาง (โครงการ์ด สิทธิ์
 * และเหตุผลที่ไม่มีตัวเลขตายตัวอยู่ที่นั่น)
 */
export function LandingModuleCard({
  mod,
  access,
  t,
}: {
  readonly mod: ModuleDef;
  readonly access?: ModuleWithAccess;
  readonly t: TFn;
}) {
  return (
    <LandingCard
      href={mod.href}
      title={t(`modules.${mod.key}.name`)}
      description={t(`modules.${mod.key}.one`)}
      icon={mod.icon}
      visual={<ModuleVisual visualKey={mod.visualKey} />}
      access={access}
    />
  );
}
