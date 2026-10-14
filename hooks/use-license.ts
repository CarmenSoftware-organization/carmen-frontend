import { useProfile } from "@/hooks/use-profile";
import { getRuntimeConfig } from "@/lib/runtime-config";
import type { ModuleDto } from "@/constant/module-list";
import { useLicenseQuery } from "@/hooks/use-license-query";
import type { BusinessUnitLicense, BusinessUnitSeat } from "@/types/license";

/**
 * แปลง permission key เป็น license feature key โดยตัด action ท้ายออก
 *
 * license ถือแค่ resource (`procurement.purchase_request`)
 * ส่วน permission ถือ resource + action (`procurement.purchase_request.create`)
 * กติกาการตัดเหมือน `usePermissionPrefix()` ทุกประการ (ตัดหลังจุด**สุดท้าย**ออก)
 *
 * ⚠️ **การตัด action ถูกต้อง แต่ไม่พอ** — resource ของ permission กับ feature key ของ
 * license ไม่ตรงกันเสมอ (`system_admin.business_unit.view` → license คือ `system_admin`
 * เพราะ `/api/business-units` อยู่นอกขอบเขต license, `report.schedule.view` →
 * `report.list`) leaf ที่ไม่ตรงต้องระบุ
 * `licenseFeature` ใน `constant/module-list.ts` ตรง ๆ — **ห้ามแก้ฟังก์ชันนี้ให้ไป
 * เดา mapping เอง** เพราะมันเป็นข้อมูล ไม่ใช่ตรรกะ ใช้ `licenseFeatureOf()` แทน
 * เวลาต้องการ feature ของ leaf หนึ่ง ๆ
 *
 * @param permission - permission key เช่น "procurement.purchase_request.view"
 * @returns feature key เช่น "procurement.purchase_request"
 */
export function featureKeyOf(permission: string): string {
  const lastDot = permission.lastIndexOf(".");
  return lastDot === -1 ? permission : permission.slice(0, lastDot);
}

/**
 * หา license feature key ของ leaf หนึ่งตัวใน `moduleList`
 *
 * ลำดับ: `licenseFeature` ที่ระบุไว้ตรง ๆ → key ที่คำนวณจาก `permission` →
 * `undefined` (leaf นี้อยู่นอกขอบเขต license → ห้ามล็อก)
 *
 * ทุกจุดที่ตัดสิน `locked` ต้องเรียกผ่านฟังก์ชันนี้ตัวเดียว (sidebar, route guard,
 * module landing) เพื่อไม่ให้ทั้งสามที่คิด key คนละแบบ
 */
export function licenseFeatureOf(mod: ModuleDto): string | undefined {
  if (mod.licenseFeature) return mod.licenseFeature;
  return mod.permission ? featureKeyOf(mod.permission) : undefined;
}

/**
 * leaf นี้ถูกล็อกด้วย license ไหม — จุดเดียวที่ RouteGuard กับเมนูใช้ร่วมกัน
 *
 * leaf ที่ตั้ง `viewableWhenExpired` ไม่ล็อกเมื่อ feature แค่ **หมดอายุ** (`isExpired`)
 * ส่วนที่ไม่เคยซื้อยังล็อกตามปกติ
 */
export function isModuleLocked(
  mod: ModuleDto,
  isLicensed: (featureKey: string) => boolean,
  isExpired: (featureKey: string) => boolean = () => false,
): boolean {
  const feature = licenseFeatureOf(mod);
  if (!feature || isLicensed(feature)) return false;
  return !(mod.viewableWhenExpired && isExpired(feature));
}

export interface LicenseInfo {
  hasLicenseData: boolean;
  /**
   * ค่าจริงของสวิตช์ `LICENSE_ENFORCEMENT` (runtime config) ตอนนี้
   * ผู้บริโภคต้องเช็คตัวนี้ก่อนใช้ `state` เสมอ — เมื่อ `false` (shadow mode)
   * `state`/`canWrite`/`isLicensed` ยังรายงานค่าจริงเพื่อ debug ได้ แต่ *พฤติกรรม*
   * ของ `canWrite`/`isLicensed` จะไม่ล็อกอะไรเลยไม่ว่า `state` จะเป็นอะไร
   */
  enforced: boolean;
  state: BusinessUnitLicense["state"];
  endDate: string | null;
  canWrite: boolean;
  /**
   * feature นี้อยู่ในสัญญาไหม
   *
   * ต้องมีทั้ง resource key **และ** module key ของมันอยู่ใน `features[]` — เลียนแบบ
   * `evaluateLicense` ของ backend เป๊ะ ๆ (สัญญาข้อ 4.4) ไม่งั้นจะมีเคสที่ FE ปล่อยผ่าน
   * แล้วผู้ใช้ไปเจอ 403 จาก backend เอาข้างหน้า
   *
   * ไม่มีข้อมูล license เลย หรือสวิตช์ปิด หรือ state เป็น unresolved → true (ไม่จำกัด)
   */
  isLicensed: (featureKey: string) => boolean;
  /**
   * feature นี้ถูกปลดระวางแล้วหรือไม่ — คนละคำถามกับ `isLicensed` โดยสิ้นเชิง
   * (`isLicensed` = "BU ซื้อไหม" · `isHidden` = "แพลตฟอร์มยังขายของชิ้นนี้อยู่ไหม")
   *
   * **ไม่ผ่าน `bypass`** ต่างจาก `isLicensed`/`canWrite` ที่ปลดล็อกตัวเองเมื่อสวิตช์
   * `LICENSE_ENFORCEMENT` ปิดหรือ state เป็น `"unresolved"` — "เลิกขายแล้ว" เป็นข้อเท็จจริง
   * ของแพลตฟอร์ม ไม่ใช่ข้อกล่าวอ้างเรื่องสัญญาของลูกค้าที่ยังทยอย rollout อยู่ ถ้าผูกกับ
   * สวิตช์ ฟีเจอร์นี้จะไม่มีผลเลยสักที่เพราะสวิตช์ปิดอยู่ทุก environment
   *
   * ยัง fail-open อยู่: ไม่มี `hidden_features` (gateway เก่า) → ไม่ซ่อนอะไรเลย
   */
  isHidden: (featureKey: string) => boolean;
  /**
   * feature นี้ **เคยซื้อแต่หมดอายุ** — ไม่ผ่าน `isLicensed` แต่สายคีย์ (feature + module)
   * ครบเมื่อรวม `expired_features` เข้าไป (เช่นใบ INF หมดอายุ)
   *
   * ใช้แยกข้อความ "หมดอายุ ต่ออายุ" ออกจาก "ไม่ได้ซื้อ" และให้ leaf ที่ตั้ง
   * `viewableWhenExpired` เปิดได้ · `false` เสมอเมื่อ `isLicensed` เป็น true
   */
  isExpired: (featureKey: string) => boolean;
  seat: BusinessUnitSeat | undefined;
  /**
   * ที่นั่งที่ใช้อยู่เกิน cap ของ cluster จริง (`used > cap`) — เลียนแบบ `evaluateSeat` ฝั่ง
   * backend (`apps/backend-gateway/src/license/license.evaluator.ts`) เป๊ะ ๆ: `used === cap`
   * ยังไม่ถือว่าเกิน (เต็มพอดี), ตัดสินไม่ได้ (ไม่มี `seat`) → `false`
   *
   * ⚠️ เป็น **สัญญาณดิบ** ไม่ผ่านสวิตช์ `enforced` — ต่างจาก `canWrite`/`isLicensed` ที่ bypass
   * เองเมื่อสวิตช์ปิด ผู้บริโภค (เช่น `SeatQuotaBanner`) ต้องเช็ค `enforced` เองก่อนแสดงผล
   * แบบเดียวกับที่ `LicenseExpiredBanner` เช็ค `enforced` เองจาก `state`/`endDate` ดิบด้านบน —
   * ไม่งั้นแถบแดง "บันทึกไม่ได้" จะโผล่ตอน shadow mode ทั้งที่ backend ยังไม่บล็อกอะไรจริง
   */
  overQuota: boolean;
  /**
   * ที่นั่งที่กำลังจะหมดอายุ **และ** การหมดอายุนั้นจะทำให้คนที่ใช้อยู่จริงเกิน pool ที่เหลือ
   * (`used > cap - seats`) — ดู `evaluateExpiringSoon`-equivalent ใน `SeatQuotaBanner`
   *
   * ⚠️ **เป็น `null` เสมอในตอนนี้** — `ClusterSeat` ที่ gateway ส่งมา (`license.types.ts`)
   * มีแค่ `{ used, cap, pending_invites }` รวมทั้ง cluster เท่านั้น ไม่มีรายละเอียดว่าที่นั่ง
   * ส่วนไหนของใบไหน (`tb_business_unit_license` รายใบ) จะหมดอายุเมื่อไหร่ — ข้อมูลระดับใบ
   * เป็นของ carmen-platform (`businessUnitLicenseService`) เท่านั้น ไม่เดินทางมาถึง profile
   * ของแอปนี้ผ่าน seat block
   *
   * `endDate`/`state` ด้านบนใช้แทนไม่ได้เช่นกัน — เป็นคนละสัญญา (`tb_subscription` ของ
   * feature/module) กับที่นั่ง (`tb_business_unit_license`) การเอามาปนกันจะรายงานวันหมดอายุ
   * ผิดสัญญา อาจขึ้นแถบเหลืองอ้างอิงใบที่ไม่เกี่ยวกับที่นั่งเลย
   *
   * เก็บ field นี้ไว้ (ไม่ลบ) เพราะ `SeatQuotaBanner` ใช้ shape นี้อยู่แล้ว — พร้อมต่อสายจริง
   * ทันทีที่ backend เพิ่ม field ที่นั่งใกล้หมดอายุเข้า `ClusterSeat`
   */
  expiringSoon: SeatExpiringSoon | null;
}

export interface SeatExpiringSoon {
  seats: number;
  date: string;
}

/**
 * ตรรกะบริสุทธิ์ของ `useLicense` — แยกออกมาเพื่อ unit test ตรง ๆ โดยไม่ต้อง mock
 * `useProfile`/`useLicenseQuery`/`runtime-config` (ตามแบบ `interfaceEntitled` ใน use-interface-entitlement.ts)
 *
 * กติกาสำคัญ (อ้างอิง phase-c-backend-contract.md):
 * - `license` เป็น `undefined` (gateway รุ่นเก่ายังไม่ส่ง field) → ไม่จำกัด เสมอ ไม่ว่า `enforced`
 *   จะเป็นอะไร — ต่างจาก `state: "none"` ที่แปลว่า "ไม่เคยซื้อ" โดยตั้งใจ
 * - `enforced === false` (shadow mode ของ FE, mirror `license.enforcement_enabled` ของ backend
 *   ที่ default false เช่นกัน) → ปิดพฤติกรรมล็อกทั้งหมด แม้ `state`/`features` จะบอกว่าไม่มีสิทธิ์
 * - `state === "unresolved"` (backend อ่าน DB ไม่สำเร็จตอนประกอบ block) → ไม่ล็อกและเขียนได้
 *   เหมือนกับที่ `LicenseInterceptor` บน backend ปล่อยผ่านทั้ง request โดยไม่ดูสวิตช์เลย
 *   เมื่อเจอ BU ที่ unresolved แม้แค่ตัวเดียว — ห้าม treat เหมือน expired/inactive/none
 */
export function resolveLicense(
  license: BusinessUnitLicense | undefined,
  enforced: boolean,
): LicenseInfo {
  const hasLicenseData = license != null;
  const state = license?.state ?? "active";
  const endDate = license?.end_date ?? null;
  const seat = license?.seat;

  // ปิดพฤติกรรมล็อกทั้งหมดเมื่อสวิตช์ปิด (shadow mode) หรือ backend ยังตัดสินไม่ได้
  const bypass = !enforced || state === "unresolved";

  // backend ต้องเจอทั้ง match.feature และ match.module ใน features[] จึงจะผ่าน
  // (license.evaluator.ts ขั้นที่ 4) — module คือส่วนหน้าจุด**แรก** ไม่ใช่จุดสุดท้าย
  // ตามที่ license-route-resolver.ts:69-70 ตัด
  const chainIn = (keys: readonly string[], featureKey: string) => {
    const dot = featureKey.indexOf(".");
    const moduleKey = dot === -1 ? featureKey : featureKey.slice(0, dot);
    return keys.includes(featureKey) && keys.includes(moduleKey);
  };
  const isLicensed = (featureKey: string) =>
    bypass || license == null || chainIn(license.features, featureKey);

  return {
    hasLicenseData,
    enforced,
    state,
    endDate,
    canWrite: bypass || state === "active",
    isLicensed,
    isExpired: (featureKey: string) =>
      license != null &&
      !isLicensed(featureKey) &&
      chainIn(
        [...license.features, ...(license.expired_features ?? [])],
        featureKey,
      ),
    // ไม่แตะ `bypass` โดยตั้งใจ — ดูเหตุผลเต็มที่ doc ของ isHidden ใน LicenseInfo
    isHidden: (featureKey: string) =>
      (license?.hidden_features ?? []).includes(featureKey),
    seat,
    // ล้อ evaluateSeat ฝั่ง backend เป๊ะ ๆ: used > cap เท่านั้น — ไม่ผ่าน `bypass`/`enforced`
    // โดยตั้งใจ (ดู doc ของ overQuota ใน LicenseInfo ด้านบน)
    overQuota: seat != null && seat.used > seat.cap,
    // ยังไม่มีข้อมูลระดับใบให้คำนวณ (ดู doc ของ expiringSoon ใน LicenseInfo ด้านบน)
    expiringSoon: null,
  };
}

/**
 * Hook อ่าน license ของ BU ปัจจุบัน
 *
 * ⚠️ **ห้ามใส่ admin bypass** — `useCan()` มี `isAdmin → true` ทุกกรณี (use-can.ts)
 * แต่ license ต้องไม่มี เพราะ admin ของ BU ที่ไม่ได้ซื้อโมดูลก็ยังใช้ไม่ได้
 * นี่คือความต่างที่พลาดง่ายที่สุดเวลาลอก useCan มาแก้ เพราะโครงเหมือนกันทุกบรรทัด
 *
 * @example
 * const { isLicensed, canWrite, enforced } = useLicense();
 * if (enforced && !isLicensed("procurement.purchase_request")) { ... }
 */
export function useLicense(): LicenseInfo {
  const { defaultBu } = useProfile();
  const { data } = useLicenseQuery();
  // license มาแยก endpoint แล้ว จึงต้องประกอบเองว่า BU ปัจจุบันคือใบไหน — ระหว่างที่
  // ก้อนใดก้อนหนึ่งยังไม่มา `license` เป็น undefined ซึ่ง `resolveLicense` แปลว่า
  // "ไม่จำกัด" (fail-open) เหมือนกรณี gateway รุ่นเก่าทุกประการ · ProfileGate รอทั้งสอง
  // ก้อนก่อน render อยู่แล้ว ช่วงนั้นจึงไม่ถูกวาดออกจอ
  const license = defaultBu ? data?.business_unit[defaultBu.id] : undefined;
  return resolveLicense(license, isEnforcementEnabled());
}

/**
 * อ่านสวิตช์ `LICENSE_ENFORCEMENT` แบบไม่ throw
 *
 * `getRuntimeConfig()` โยน error เมื่อยังไม่ได้เรียก `loadRuntimeConfig()` ซึ่งเกิดจริง
 * ในเทสต์ทุกตัวที่ render อะไรก็ตามที่แตะ `useCan()`/`useLicense()` (และในเบราว์เซอร์
 * ถ้ามีคอมโพเนนต์ไหน render ก่อน boot เสร็จ) — ผลลัพธ์ของ catch คือ `false` ซึ่ง
 * **เหมือนกับกรณีไม่มีคีย์นี้ใน config.json ทุกประการ** (shadow mode ไม่ล็อกอะไรเลย)
 * จึงไม่เปลี่ยนพฤติกรรมจริงสักกรณีเดียว แค่ปิดกับดักที่บังคับให้เทสต์ทุกตัวต้องจำ
 * `setRuntimeConfigForTests()`
 */
function isEnforcementEnabled(): boolean {
  try {
    return getRuntimeConfig().LICENSE_ENFORCEMENT ?? false;
  } catch {
    return false;
  }
}
