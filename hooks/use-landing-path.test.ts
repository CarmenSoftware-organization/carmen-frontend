import { describe, it, expect } from "vitest";
import type { LucideIcon } from "lucide-react";
import { firstAccessiblePath, LANDING_FALLBACK_PATH } from "./use-landing-path";
import { annotate, type ModuleWithAccess } from "./use-visible-modules";
import { moduleList, findRouteLeaf } from "@/constant/module-list";

// ใช้ dummy icon เพราะ ModuleDto ต้องการ LucideIcon แต่ที่นี่ไม่ได้ทดสอบการ render ไอคอน
const DummyIcon = (() => null) as unknown as LucideIcon;

function leaf(
  path: string,
  flags: { locked?: boolean; denied?: boolean } = {},
): ModuleWithAccess {
  return {
    name: path,
    path,
    icon: DummyIcon,
    subModules: undefined,
    locked: false,
    denied: false,
    ...flags,
  };
}

function group(path: string, subModules: ModuleWithAccess[]): ModuleWithAccess {
  return {
    name: path,
    path,
    icon: DummyIcon,
    subModules,
    // กติกาเดียวกับ annotate: parent locked/denied ก็ต่อเมื่อลูก locked/denied หมด
    locked: subModules.every((s) => s.locked),
    denied: subModules.every((s) => s.denied),
  };
}

describe("firstAccessiblePath", () => {
  it("คืน leaf ตัวแรกเมื่อมันเข้าได้อยู่แล้ว", () => {
    const path = firstAccessiblePath([leaf("/dashboard"), leaf("/report")]);
    expect(path).toBe("/dashboard");
  });

  it("ข้าม leaf ที่ locked (BU ไม่ได้ซื้อ) ไปตัวถัดไป", () => {
    const path = firstAccessiblePath([
      leaf("/dashboard", { locked: true }),
      leaf("/report"),
    ]);
    expect(path).toBe("/report");
  });

  // กรอง denied ด้วย ไม่ใช่แค่ locked — ไม่งั้นย้ายจากกับดัก license ไปกับดัก permission
  it("ข้าม leaf ที่ denied (ไม่มีสิทธิ์ RBAC) ไปตัวถัดไป", () => {
    const path = firstAccessiblePath([
      leaf("/dashboard", { denied: true }),
      leaf("/report"),
    ]);
    expect(path).toBe("/report");
  });

  it("ลงไปหาในลูกของกลุ่ม และคืนลูกตัวแรกที่เข้าได้", () => {
    const path = firstAccessiblePath([
      group("/procurement", [
        leaf("/procurement/my-approval", { locked: true }),
        leaf("/procurement/purchase-order"),
      ]),
    ]);
    expect(path).toBe("/procurement/purchase-order");
  });

  it("ข้ามทั้งกลุ่มเมื่อลูกเข้าไม่ได้สักตัว และไม่คืน path ของตัวกลุ่มเอง", () => {
    const path = firstAccessiblePath([
      group("/procurement", [
        leaf("/procurement/my-approval", { locked: true }),
        leaf("/procurement/purchase-order", { denied: true }),
      ]),
      leaf("/report"),
    ]);
    expect(path).toBe("/report");
  });

  it("เดินตามลำดับ sidebar แบบ depth-first — ลูกของกลุ่มแรกมาก่อนโมดูลถัดไป", () => {
    const path = firstAccessiblePath([
      group("/procurement", [leaf("/procurement/my-approval")]),
      leaf("/report"),
    ]);
    expect(path).toBe("/procurement/my-approval");
  });

  it("คืน fallback เมื่อไม่มีอะไรเข้าได้เลย", () => {
    const path = firstAccessiblePath([
      leaf("/dashboard", { locked: true }),
      group("/procurement", [leaf("/procurement/my-approval", { locked: true })]),
    ]);
    expect(path).toBe(LANDING_FALLBACK_PATH);
  });

  it("คืน fallback เมื่อ tree ว่าง", () => {
    expect(firstAccessiblePath([])).toBe(LANDING_FALLBACK_PATH);
  });
});

describe("LANDING_FALLBACK_PATH", () => {
  // การันตีทั้งหมดของ fallback ตั้งอยู่บนข้อเท็จจริงข้อเดียว: มันไม่อยู่ใน moduleList
  // จึงไม่มี leaf ให้ RouteGuard เอาไปเช็ค license/permission ถ้ามีคนย้ายมันเข้า
  // moduleList วันหลัง fallback จะกลายเป็นหน้าที่ถูกล็อกได้เองแบบเงียบ ๆ
  it("ไม่มี leaf ใน moduleList ที่คลุม path นี้ — RouteGuard จึงบล็อกไม่ได้", () => {
    expect(findRouteLeaf(LANDING_FALLBACK_PATH)).toBeUndefined();
  });
});

describe("firstAccessiblePath กับ moduleList จริง", () => {
  const canAll = () => true;
  const licensedAll = () => true;
  const licensedNone = () => false;

  // ตรึงข้ออ้างว่า "ขณะสวิตช์ LICENSE_ENFORCEMENT ยังปิด พฤติกรรมไม่เปลี่ยนเลย" —
  // isLicensed() คืน true ทั้งใน shadow mode และตอน state เป็น "unresolved"
  it("ทุกอย่างเข้าได้ → ได้ /dashboard เท่าเดิม", () => {
    const path = firstAccessiblePath(annotate(moduleList, canAll, licensedAll));
    expect(path).toBe("/dashboard");
  });

  it("BU ไม่ได้ซื้ออะไรเลย → ตกมาที่ fallback ไม่ใช่ /dashboard", () => {
    const path = firstAccessiblePath(
      annotate(moduleList, canAll, licensedNone),
    );
    expect(path).not.toBe("/dashboard");
    // ทุก leaf ใน moduleList ผลิต feature key ได้แล้ว (allowlist UNMAPPED_ON_PURPOSE
    // ว่างเปล่า — ดู constant/module-list.license-feature.test.ts) BU ที่ไม่มีสัญญา
    // เลยจึงไม่เหลือหน้าไหนใน moduleList ให้ไป และต้องตกมาที่ /profile ซึ่งเป็นหน้า
    // เดียวที่ RouteGuard บล็อกไม่ได้ — ก่อนหน้านี้เทสต์นี้ผ่านเพราะบังเอิญมี leaf
    // ที่ยังไม่ผูก license (เช่น /accounting/*) รับหน้าที่นี้อยู่ ซึ่งคือรูโหว่เดียวกัน
    // ที่ทำให้เมนู Procurement/Config/Accounting ยัง active ทั้งที่ไม่มี license
    expect(path).toBe(LANDING_FALLBACK_PATH);
    expect(findRouteLeaf(path)).toBeUndefined();
  });
});
