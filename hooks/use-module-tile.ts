import { useLocation } from "react-router";
import { moduleList, type ModuleDto } from "@/constant/module-list";

export function useModuleTile(): {
  name?: string;
  parentName?: string;
} {
  const pathname = useLocation().pathname;
  const parent = moduleList.find(
    (m) => pathname === m.path || pathname.startsWith(m.path + "/"),
  );
  if (!parent) return {};
  // โมดูลที่ยืมภาพของโมดูลแม่ (GL/AP/AR/Asset → accounting) ใช้ tile ของตัวโมดูลเอง
  // ในชุดสีของแม่ — palette รู้จักแค่ "accounting" และ leaf ส่วนใหญ่ไม่มีภาพ sub-tile
  if (parent.tileParent) {
    return { name: parent.name, parentName: parent.tileParent };
  }

  let best: ModuleDto | undefined;
  for (const sub of parent.subModules ?? []) {
    if (
      (pathname === sub.path || pathname.startsWith(sub.path + "/")) &&
      (!best || sub.path.length > best.path.length)
    ) {
      best = sub;
    }
  }
  return { name: best?.name, parentName: parent.name };
}
