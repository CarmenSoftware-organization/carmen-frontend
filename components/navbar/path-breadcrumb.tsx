import { Fragment } from "react";
import { Link } from "react-router";
import { useLocation } from "react-router";
import { useTranslations } from "use-intl";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { findAccountingSection, moduleList } from "@/constant/module-list";

function isIdSegment(segment: string) {
  // numeric id
  if (/^\d+$/.test(segment)) return true;
  // UUID
  if (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      segment,
    )
  )
    return true;
  // MongoDB ObjectId (24 hex chars)
  if (/^[0-9a-f]{24}$/i.test(segment)) return true;
  return false;
}

// หาจาก path เต็มก่อน แล้วค่อยถอยไปใช้ segment ท้าย — segment ซ้ำกันได้ข้ามโมดูล
// (`/product-management/category` กับ `/operation-plan/category`) ถ้าใช้ segment
// อย่างเดียว ตัวที่ลงทะเบียนทีหลังจะทับ หน้า Category สินค้าเลยขึ้น "Recipe Category"
const PATH_TO_KEY: Record<string, string> = {};
const SEGMENT_TO_KEY: Record<string, string> = {};
function addModuleSegments(modules: typeof moduleList) {
  for (const mod of modules) {
    const segment = mod.path.split("/").pop()!;
    PATH_TO_KEY[mod.path] = mod.name;
    SEGMENT_TO_KEY[segment] = mod.name;
    if (mod.subModules) {
      addModuleSegments(mod.subModules);
    }
  }
}
addModuleSegments(moduleList);

/**
 * segment ที่ไม่ใช่โมดูลแต่โผล่ใน URL จริง
 *
 * ไม่มีใน `moduleList` เลยตกไป fallback ที่แปลง kebab-case เป็น Title Case ซึ่ง
 * เป็นภาษาอังกฤษเสมอ — ภาษาไทยเลยได้ "ใบขอซื้อ > New" ปนกันครึ่งบรรทัด
 */
const EXTRA_SEGMENT_KEY: Record<string, string> = {
  new: "new",
  entry: "entry",
  review: "review",
  setting: "setting",
  notifications: "notifications",
  "from-price-list": "fromPriceList",
  history: "history",
};

/**
 * หน้า config ของ interface — `/system-admin/interface/:category/:brand`
 *
 * สอง segment ท้ายเป็น key ของ registry (`accounting`, `carmen_gl`) ไม่ใช่ชื่อโมดูล:
 * `accounting` ไปชนโมดูล Accounting ใน `SEGMENT_TO_KEY` ส่วน `carmen_gl` ตก fallback กลายเป็น
 * "Carmen_gl" (`\b\w` ไม่ตัดที่ `_`) · ชั้น category ไม่มี route ของตัวเอง จึงกดไม่ได้
 * ชื่อดึงจาก `systemAdmin.interface` ชุดเดียวกับที่หน้า list ใช้ — import registry ตรง ๆ ไม่ได้
 * เพราะ `components/` ห้าม import จาก `routes/`
 */
const INTERFACE_BASE = "/system-admin/interface";

/**
 * Breadcrumb ของหน้าปัจจุบัน
 *
 * สร้าง breadcrumb จาก `useLocation().pathname` โดยกรอง id segment ออกผ่าน
 * `isIdSegment` และแปลงแต่ละ segment เป็นคำแปลจาก `moduleList` +
 * `EXTRA_SEGMENT_KEY` (fallback เป็น segment ที่แปลง kebab-case → Title Case)
 *
 * ชั้นที่เป็นหน้าปัจจุบันเท่านั้นที่กดไม่ได้ — เปิดใบใดใบหนึ่งอยู่ (URL ลงท้าย
 * ด้วย id) ทุกชั้นเป็นลิงก์หมด เพราะไม่มีชั้นไหนแทนหน้าที่ยืนอยู่จริง จอแคบ
 * แสดงสองชั้นท้าย เพื่อให้ยังมีทางกดกลับหน้ารายการ
 *
 * @returns JSX element ของ breadcrumb
 * @example
 * ```tsx
 * <PathBreadcrumb />
 * ```
 */
export default function PathBreadcrumb() {
  const pathname = useLocation().pathname;
  const t = useTranslations("modules");
  const tInterface = useTranslations("systemAdmin.interface");

  /** ชื่อของชั้น interface category/brand — `undefined` = ไม่ใช่ชั้นนั้น หรือ key ไม่รู้จัก */
  const interfaceLabel = (href: string): string | undefined => {
    if (!href.startsWith(INTERFACE_BASE + "/")) return undefined;
    const [category, brand, ...rest] = href
      .slice(INTERFACE_BASE.length + 1)
      .split("/");
    if (rest.length > 0) return undefined;
    const key = brand ? `${category}.brand.${brand}` : `${category}.title`;
    return tInterface.has(key) ? tInterface(key) : undefined;
  };

  const rawSegments = pathname.split("/").filter(Boolean);
  // href ประกอบจาก segment ดิบ ไม่ใช่ segment ที่กรอง id ออกแล้ว — ไม่งั้นชั้นที่
  // อยู่หลัง id (เช่น .../physical-count/<id>/entry) จะได้ลิงก์ที่ไม่มีอยู่จริง
  const accountingSection =
    pathname === "/accounting" || pathname.startsWith("/accounting/")
      ? findAccountingSection(pathname)
      : undefined;
  const crumbs: Array<{
    segment: string;
    href: string;
    keyOverride?: string;
    labelOverride?: string;
    /** ชั้นที่ไม่มี route ของตัวเอง — แสดงเป็นข้อความ ไม่ใช่ลิงก์ */
    unroutable?: boolean;
  }> = [];
  for (let index = 0; index < rawSegments.length; index += 1) {
    const segment = rawSegments[index];
    if (isIdSegment(segment)) continue;

    const href = "/" + rawSegments.slice(0, index + 1).join("/");
    // Accounting's parent is represented by four independent launcher modules.
    // Start at the selected module instead of exposing the internal parent.
    if (
      accountingSection &&
      href === "/accounting" &&
      accountingSection.path !== "/accounting"
    ) {
      continue;
    }

    const labelOverride = interfaceLabel(href);
    crumbs.push({
      segment,
      href,
      labelOverride,
      unroutable:
        labelOverride !== undefined &&
        href.split("/").length === INTERFACE_BASE.split("/").length + 1 &&
        index < rawSegments.length - 1,
      keyOverride:
        accountingSection && href === accountingSection.path
          ? accountingSection.name
          : undefined,
    });
  }

  // กำลังเปิดใบใดใบหนึ่งอยู่ = segment ท้าย URL เป็น id ซึ่งโดนกรองทิ้งไปแล้ว
  // ชั้นสุดท้ายที่เหลือจึงไม่ใช่หน้าที่ยืนอยู่ ต้องกดกลับไปหน้ารายการได้
  const onDetailPage =
    rawSegments.length > 0 && isIdSegment(rawSegments[rawSegments.length - 1]);

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {crumbs.map(
          (
            { segment, href, keyOverride, labelOverride, unroutable },
            index,
          ) => {
            const key =
              keyOverride ??
              PATH_TO_KEY[href] ??
              SEGMENT_TO_KEY[segment] ??
              EXTRA_SEGMENT_KEY[segment];
            const label = labelOverride
              ? labelOverride
              : key
                ? t(key)
                : segment
                    .replaceAll("-", " ")
                    .replaceAll(/\b\w/g, (c) => c.toUpperCase());

            const isCurrentPage = index === crumbs.length - 1 && !onDetailPage;
            // จอแคบเก็บสองชั้นท้ายไว้ — ชั้นก่อนสุดท้ายคือทางกลับหน้ารายการ
            // ถ้าซ่อนหมดเหลือคำเดียวก็กดอะไรไม่ได้เลยบนมือถือ
            const hiddenOnMobile = index < crumbs.length - 2;

            return (
              <Fragment key={href}>
                {index > 0 && (
                  <BreadcrumbSeparator
                    className={
                      index < crumbs.length - 1 ? "hidden md:block" : ""
                    }
                  />
                )}
                <BreadcrumbItem
                  className={hiddenOnMobile ? "hidden md:block" : ""}
                >
                  {isCurrentPage ? (
                    <BreadcrumbPage>{label}</BreadcrumbPage>
                  ) : unroutable ? (
                    <span className="text-muted-foreground">{label}</span>
                  ) : (
                    <BreadcrumbLink asChild>
                      <Link to={href}>{label}</Link>
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
              </Fragment>
            );
          },
        )}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
