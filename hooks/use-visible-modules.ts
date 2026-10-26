import { useCan } from "@/hooks/use-can";
import {
  isModuleLocked,
  licenseFeatureOf,
  useLicense,
} from "@/hooks/use-license";
import { moduleList, type ModuleDto } from "@/constant/module-list";
import type { Permission } from "@/constant/permissions";
import { usePosStatus } from "@/hooks/use-pos-status";

export interface ModuleWithAccess extends ModuleDto {
  denied: boolean;
  locked: boolean;
  subModules?: ModuleWithAccess[];
}

/**
 * ตรรกะบริสุทธิ์ของ annotate สาย non-admin — export ไว้ unit test ตรง ๆ
 * (ตามแบบ `resolveLicense` ใน use-license.ts) โดยไม่ต้อง mock useCan/useLicense
 */
export function annotate(
  modules: ModuleDto[],
  can: (permission: Permission) => boolean,
  isLicensed: (featureKey: string) => boolean,
  isHidden: (featureKey: string) => boolean = () => false,
  isExpired: (featureKey: string) => boolean = () => false,
  posEnabled = true,
): ModuleWithAccess[] {
  const out: ModuleWithAccess[] = [];
  for (const mod of modules) {
    const { subModules, ...rest } = mod;
    if (subModules && subModules.length > 0) {
      const subs = annotate(
        subModules,
        can,
        isLicensed,
        isHidden,
        isExpired,
        posEnabled,
      );
      // ลูกถูกซ่อนหมด → หัวข้อกลุ่มไม่มีอะไรให้พาไป ซ่อนทั้งก้อน (กติกาเดียวกับ denied/locked
      // ที่ parent เป็น true เมื่อลูกเป็น true หมด)
      if (subs.length === 0) continue;
      out.push({
        ...rest,
        subModules: subs,
        denied: subs.every((s) => s.denied),
        // parent locked ก็ต่อเมื่อ child locked หมด — กติกาเดียวกับ denied
        locked: subs.every((s) => s.locked),
      });
      continue;
    }
    // leaf ที่ต้องมี POS interface — BU ไม่มี POS ตัดออกเหมือน hidden feature
    if (mod.requiresPosInterface && !posEnabled) continue;
    const feature = licenseFeatureOf(mod);
    // ตัดออกจากผลลัพธ์ ไม่ใช่ทำเครื่องหมาย — node ที่ยังอยู่ในลิสต์คือ node ที่รอให้ใคร
    // สักคนเผลอ render (leaf ที่ไม่มี feature key อยู่นอกขอบเขต license ห้ามซ่อน)
    if (feature && isHidden(feature)) continue;
    out.push({
      ...rest,
      subModules: undefined,
      denied: !!mod.permission && !can(mod.permission),
      locked: isModuleLocked(mod, isLicensed, isExpired),
    });
  }
  return out;
}

/**
 * Admin ข้าม permission ได้ทุกอย่าง แต่ **ข้าม license ไม่ได้**
 * จึงยัง annotate locked ตามปกติ ต่างจาก denied ที่บังคับเป็น false
 *
 * **admin ก็ข้าม `hidden` ไม่ได้เช่นกัน** — ของที่แพลตฟอร์มปลดระวางแล้วไม่ควรมีใครเห็น
 * ไม่ว่าจะสิทธิ์ระดับไหน (hidden ไม่มีแนวคิดเรื่อง role เลย เหมือน locked)
 *
 * Export ไว้ unit test ตรง ๆ เช่นเดียวกับ `annotate` — เคสบังคับที่สุดคือ
 * "admin + ไม่มี license → ยัง locked" ซึ่งเป็นบั๊กที่ทำให้ licensing ไร้ความหมาย
 * ถ้าฟังก์ชันนี้คืน `locked: false` เสมอ
 */
export function markAll(
  modules: ModuleDto[],
  isLicensed: (featureKey: string) => boolean,
  isHidden: (featureKey: string) => boolean = () => false,
  isExpired: (featureKey: string) => boolean = () => false,
  posEnabled = true,
): ModuleWithAccess[] {
  const out: ModuleWithAccess[] = [];
  for (const mod of modules) {
    const { subModules, ...rest } = mod;
    if (subModules && subModules.length > 0) {
      const subs = markAll(
        subModules,
        isLicensed,
        isHidden,
        isExpired,
        posEnabled,
      );
      if (subs.length === 0) continue;
      out.push({
        ...rest,
        subModules: subs,
        denied: false,
        locked: subs.every((s) => s.locked),
      });
      continue;
    }
    // leaf ที่ต้องมี POS interface — BU ไม่มี POS ตัดออกเหมือน hidden feature
    if (mod.requiresPosInterface && !posEnabled) continue;
    const feature = licenseFeatureOf(mod);
    if (feature && isHidden(feature)) continue;
    out.push({
      ...rest,
      subModules: undefined,
      denied: false,
      locked: isModuleLocked(mod, isLicensed, isExpired),
    });
  }
  return out;
}

/**
 * คืน module ทั้งหมด พร้อม flag `denied`/`locked` ตามสิทธิ์และสัญญาของผู้ใช้
 *
 * - `denied` — ผู้ใช้ไม่มีสิทธิ์ RBAC เข้า leaf นี้
 *   - Admin → ทุก item `denied: false` เสมอ (admin ข้าม permission ได้)
 *   - User → leaf ที่มี `permission` แต่ไม่ได้รับสิทธิ์จะมี `denied: true`
 *   - parent: `denied: true` ก็ต่อเมื่อ child denied หมด
 * - `locked` — BU ปัจจุบันไม่ได้ซื้อ feature นี้ (license) คนละเรื่องกับ `denied`
 *   - **ไม่มี admin bypass** — admin ของ BU ที่ไม่ได้ซื้อโมดูลก็ยัง `locked: true`
 *     (license ไม่มีแนวคิดเรื่อง role เลย ต่างจาก permission)
 *   - parent: `locked: true` ก็ต่อเมื่อ child locked หมด เหมือนกติกาของ denied
 * - **ไม่มี flag `hidden`** — feature ที่ถูกปลดระวาง (`hidden_features` จาก backend) ถูก
 *   **ตัดออกจาก tree ตรงนี้เลย** ไม่ใช่ทำเครื่องหมายไว้ เพราะที่นี่เป็นทางผ่านเดียวของทุกที่
 *   ที่ render เมนู (sidebar · navbar switcher · module landing · command palette ·
 *   useLandingPath) การตัดที่นี่จุดเดียวจึงทำให้ทั้งห้าที่ถูกต้องพร้อมกันโดยไม่ต้องแก้อะไร
 *   ส่วน deep link เข้าทาง URL ตรงเป็นหน้าที่ของ `RouteGuard` ซึ่งอ่าน `moduleList` ดิบ
 *
 * Item ที่ `denied`/`locked` เป็น true ควร render เป็นปุ่มที่กดแล้วเด้ง dialog
 * แทนที่จะ navigate (ดู `dispatchPermissionDenied` ใน permission-denied-dialog)
 *
 * @param modules - tree ที่จะ annotate ถ้าไม่ส่งใช้ `moduleList` ทั้งก้อน
 */
export function useVisibleModules(
  modules: ModuleDto[] = moduleList,
): ModuleWithAccess[] {
  const { can, isAdmin } = useCan();
  const { isLicensed, isHidden, isExpired } = useLicense();
  // ระหว่างโหลดถือว่า "ยังไม่เปิด" → เมนู POS โผล่ทีหลังแทนที่จะโผล่แล้วหาย
  const { isEnabled: posEnabled } = usePosStatus();
  if (isAdmin)
    return markAll(modules, isLicensed, isHidden, isExpired, posEnabled);
  return annotate(modules, can, isLicensed, isHidden, isExpired, posEnabled);
}
