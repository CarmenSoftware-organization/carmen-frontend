import type { LucideIcon } from "lucide-react";
import { PERMISSIONS, type Permission } from "@/constant/permissions";
import {
  Boxes,
  Link2,
  BookText,
  LayoutDashboard,
  Settings2,
  Settings,
  Coins,
  Building,
  ShoppingCart,
  FileText,
  PackageCheck,
  Package,
  Box,
  Tag,
  FileCheck,
  FileInput,
  FileSpreadsheet,
  DollarSign,
  ArrowLeftRight,
  MapPin,
  Warehouse,
  Receipt,
  Rows3,
  Briefcase,
  Scale,
  SlidersHorizontal,
  Sparkles,
  Handshake,
  Building2,
  BadgeDollarSign,
  Store,
  PackagePlus,
  AlertTriangle,
  ArrowUpDown,
  Eye,
  ClipboardCheck,
  Calendar,
  Shield,
  Network,
  Cable,
  ShieldCheck,
  UserCheck,
  ChefHat,
  UtensilsCrossed,
  Layers,
  Group,
  Crosshair,
  BookOpen,
  Wrench,
  FolderTree,
  Files,
  Hash,
  Clock,
  MessageSquareText,
  Activity,
  UserRoundSearch,
  Bookmark,
  CreditCard,
  Landmark,
  Percent,
  BellRing,
  Database,
  Award,
  Leaf,
  Mail,
  MailOpen,
  FileUp,
  ClipboardList,
} from "lucide-react";

export interface ModuleDto {
  name: string;
  /**
   * leaf ที่ใช้ได้เฉพาะ BU ที่เปิด POS interface — ถ้า BU ไม่มี POS จะถูกตัดออกจากเมนูทุกที่
   * (`useVisibleModules`) และ `RouteGuard` แสดง `PosNotEnabled` เมื่อเข้าทาง URL ตรง
   */
  requiresPosInterface?: boolean;
  path: string;
  icon: LucideIcon;
  subModules?: ModuleDto[];
  separatorBefore?: boolean;
  /**
   * Permission code required to see this module
   * ใช้ reference จาก `PERMISSIONS` แทน string literal (เพื่อ type safety)
   * Undefined = visible to everyone (parent groups, dashboard, etc.)
   * Admin bypasses regardless
   */
  permission?: Permission;
  /**
   * License feature key ของ leaf นี้ — ระบุตรง ๆ เมื่อ key ที่คำนวณจาก `permission`
   * ไม่ตรงกับ catalog ของ backend
   *
   * **ทำไมต้องมีฟิลด์นี้:** resource ของ *permission* (RBAC) กับของ *license feature*
   * **ไม่ใช่ตัวเดียวกันเสมอ** เช่น Company Profile ใช้ permission
   * `system_admin.business_unit.view` แต่ license ผูกกับ module key `system_admin`
   * เพราะ `/api/business-units` ไม่แมตช์ `LICENSE_ROUTE_FEATURES` เลย; หน้า Report
   * Schedule ใช้ `report.schedule.view` แต่ feature ที่ผูกไว้คือ `report.list`
   * การปล่อยให้คำนวณเองจะได้ key ที่ไม่มีอยู่ใน catalog → หน้านั้นถูกล็อกถาวรตอนเปิด
   * `LICENSE_ENFORCEMENT` และ license **ไม่มี admin bypass** จึงไม่มีใครเข้าไปแก้ได้
   *
   * ค่าที่ใส่ต้องมาจาก `LICENSE_ROUTE_FEATURES` ของ backend (map จาก URL path จริง
   * ของ endpoint ที่หน้านั้นเรียก) ไม่ใช่การเดาจากชื่อเมนู
   *
   * ลำดับการหาค่า: `licenseFeature` → `featureKeyOf(permission)` → ไม่มีเลย = ไม่ล็อก
   * (`licenseFeatureOf()` ใน `hooks/use-license.ts`)
   *
   * เพิ่ม leaf ใหม่แล้วเทสต์ `constant/module-list.license-feature.test.ts` แดง
   * แปลว่า key ที่ได้ไม่มีใน catalog — แก้ที่นี่ ห้ามแก้ fixture
   */
  licenseFeature?: string;
  /**
   * เปิดหน้านี้ได้แม้ license feature **หมดอายุ** (อยู่ใน `expired_features`) — ไม่เคยซื้อ
   * ยังล็อกตามปกติ ใช้กับหน้าที่อธิบายสถานะหมดอายุเองได้ (เช่น interface ที่ขึ้นป้ายรายแบรนด์)
   * backend ยังตอบ 403 ให้ทุกการอ่านข้อมูลของ feature นั้น หน้าจึงต้องไม่ยิงเอง
   */
  viewableWhenExpired?: boolean;
}

export function getModule(path: string): ModuleDto {
  const mod = moduleList.find((m) => m.path === path);
  if (!mod) throw new Error(`Module not found: ${path}`);
  return mod;
}

/**
 * หา leaf ที่ตรงกับ pathname (รวมเส้นทาง nested เช่น /[id], /new)
 *
 * เลือก path ที่ specific สุด (ยาวสุด) — เช่น `/procurement/purchase-request/123`
 * จะ match leaf `/procurement/purchase-request` ไม่ใช่ parent `/procurement`
 *
 * ใช้ใน RouteGuard เพื่อหา permission code ของหน้าปัจจุบัน
 */
export function findRouteLeaf(pathname: string): ModuleDto | undefined {
  let best: ModuleDto | undefined;
  const walk = (mods: ModuleDto[]) => {
    for (const m of mods) {
      if (pathname === m.path || pathname.startsWith(m.path + "/")) {
        if (!best || m.path.length > best.path.length) best = m;
      }
      if (m.subModules) walk(m.subModules);
    }
  };
  walk(moduleList);
  return best;
}

/**
 * Accounting is split into four launcher modules. Their children are the
 * contextual sidebar entries shown after a launcher module is selected.
 *
 * ทุก leaf ต้องผูก `licenseFeature` — leaf ที่ไม่ผูกจะ `locked: false` เสมอ แล้วปลดล็อก
 * หัวข้อ Accounting ทั้งก้อนให้ BU ที่ไม่ได้ซื้อ (ดู module-list.license-feature.test.ts)
 */
export const accountingModuleSections: ModuleDto[] = [
  {
    name: "generalLedger",
    path: "/accounting",
    icon: BookOpen,
    subModules: [
      {
        name: "glDashboard",
        path: "/accounting",
        licenseFeature: "accounting.gl",
        icon: LayoutDashboard,
      },
      {
        name: "journalVoucher",
        path: "/accounting/journal-voucher",
        licenseFeature: "accounting.gl",
        icon: FileText,
      },
      {
        name: "templateVoucher",
        path: "/accounting/template-voucher",
        licenseFeature: "accounting.gl.jv_template",
        icon: FileSpreadsheet,
      },
      {
        name: "recurringVoucher",
        path: "/accounting/recurring-voucher",
        licenseFeature: "accounting.gl",
        icon: Clock,
      },
      {
        name: "allocationVoucher",
        path: "/accounting/allocation-voucher",
        licenseFeature: "accounting.gl",
        icon: ArrowLeftRight,
      },
      {
        name: "accountingSettings",
        path: "/accounting/settings",
        // การอ่าน gl_setting ต้องมี configuration.app_config.view — role Accounting ที่ seed ไว้ไม่มี
        // ถ้าไม่ผูกสิทธิ์ non-admin จะเห็นหน้าที่ขึ้นแต่ error
        permission: PERMISSIONS.configuration.app_config.view,
        licenseFeature: "accounting.gl",
        icon: Settings,
      },
    ],
  },
  {
    name: "accountsPayable",
    path: "/accounting/accounts-payable",
    icon: BadgeDollarSign,
    subModules: [
      {
        name: "apDashboard",
        path: "/accounting/accounts-payable",
        licenseFeature: "accounting.ap",
        icon: LayoutDashboard,
      },
      {
        name: "apInvoice",
        path: "/accounting/accounts-payable/invoice",
        licenseFeature: "accounting.ap",
        icon: FileInput,
      },
      {
        name: "apPayment",
        path: "/accounting/accounts-payable/payment",
        licenseFeature: "accounting.ap",
        icon: DollarSign,
      },
    ],
  },
  {
    name: "accountsReceivable",
    path: "/accounting/accounts-receivable",
    icon: Receipt,
    subModules: [
      {
        name: "arDashboard",
        path: "/accounting/accounts-receivable",
        licenseFeature: "accounting.ar",
        icon: LayoutDashboard,
      },
      {
        name: "arInvoice",
        path: "/accounting/accounts-receivable/invoice",
        licenseFeature: "accounting.ar",
        icon: FileText,
      },
      {
        name: "arReceipt",
        path: "/accounting/accounts-receivable/receipt",
        licenseFeature: "accounting.ar",
        icon: BadgeDollarSign,
      },
    ],
  },
  {
    name: "asset",
    path: "/accounting/asset",
    icon: Building2,
    subModules: [
      {
        name: "assetDashboard",
        path: "/accounting/asset",
        licenseFeature: "accounting.asset",
        icon: LayoutDashboard,
      },
      {
        name: "assetRegister",
        path: "/accounting/asset/register",
        licenseFeature: "accounting.asset",
        icon: Boxes,
      },
      {
        name: "assetDisposal",
        path: "/accounting/asset/disposal",
        licenseFeature: "accounting.asset",
        icon: FileInput,
      },
    ],
  },
];

/** Specific accounting prefixes win; General Ledger handles the root routes. */
export function findAccountingSection(pathname: string): ModuleDto {
  return (
    accountingModuleSections
      .slice(1)
      .find(
        (section) =>
          pathname === section.path || pathname.startsWith(section.path + "/"),
      ) ?? accountingModuleSections[0]
  );
}

export const moduleList: ModuleDto[] = [
  {
    name: "dashboard",
    path: "/dashboard",
    licenseFeature: "dashboard.widget", // app:dashboard-widgets (/api/me/dashboard-widgets)
    icon: LayoutDashboard,
  },
  {
    name: "procurement",
    path: "/procurement",
    icon: ShoppingCart,
    subModules: [
      {
        // กล่องอนุมัติรวม PR/PO/SR ยิง /api/my-pending ซึ่งไม่อยู่ใน
        // LICENSE_ROUTE_FEATURES จึงไม่มีคีย์ระดับ resource ให้ผูก — ใช้คีย์ระดับ
        // module ของ Procurement แทน
        //
        // เกณฑ์คือ "backend ไม่มีคีย์ให้ผูกจริง ๆ" ไม่ใช่ "ยังไม่ได้หา" — ถ้า catalog
        // มีคีย์ระดับ resource อยู่ ต้องผูกคีย์นั้น ไม่งั้นเมนูเปิดได้แต่ API ตอบ 403
        // (เคยเกิดกับ /config/shelf ที่เคยถูกยกเป็นตัวอย่างตรงนี้)
        name: "myApproval",
        path: "/procurement/my-approval",
        licenseFeature: "procurement",
        icon: FileCheck,
      },
      {
        name: "purchaseRequest",
        path: "/procurement/purchase-request",
        licenseFeature: "procurement.purchase_request", // app:purchase-requests
        icon: ShoppingCart,
      },
      {
        name: "purchaseRequestTemplate",
        path: "/procurement/purchase-request-template",
        icon: FileSpreadsheet,
        permission: PERMISSIONS.procurement.purchase_request_template.view,
      },
      {
        name: "purchaseOrder",
        path: "/procurement/purchase-order",
        licenseFeature: "procurement.purchase_order", // app:purchase-orders
        icon: Receipt,
        separatorBefore: false,
      },
      {
        name: "goodsReceiveNote",
        path: "/procurement/goods-receive-note",
        icon: PackageCheck,
        separatorBefore: false,
        permission: PERMISSIONS.procurement.goods_received_note.view,
      },
      {
        name: "creditNote",
        path: "/procurement/credit-note",
        icon: FileInput,
        permission: PERMISSIONS.procurement.credit_note.view,
      },
    ],
  },
  {
    name: "productManagement",
    path: "/product-management",
    icon: Package,
    subModules: [
      {
        name: "productCategory",
        path: "/product-management/category",
        icon: Tag,
        permission: PERMISSIONS.product_management.category.view,
      },
      {
        name: "product",
        path: "/product-management/product",
        icon: Box,
        permission: PERMISSIONS.product_management.product.view,
      },
      {
        // licenseFeature ชี้ product_management มาตั้งแต่แรก — ย้ายมาให้ตรงกัน
        // permission ย้ายตามด้วย (เดิม configuration.view)
        name: "eco",
        path: "/product-management/eco",
        licenseFeature: "product_management.master_eco_label", // config:product-master-eco-labels
        icon: Leaf,
        separatorBefore: true,
        permission: PERMISSIONS.product_management.master_eco_label.view,
      },
    ],
  },
  {
    name: "vendorManagement",
    path: "/vendor-management",
    icon: Handshake,
    subModules: [
      {
        name: "vendor",
        path: "/vendor-management/vendor",
        icon: Building2,
        permission: PERMISSIONS.vendor_management.vendor.view,
      },
      {
        name: "priceList",
        path: "/vendor-management/price-list",
        icon: BadgeDollarSign,
        separatorBefore: false,
        permission: PERMISSIONS.vendor_management.price_list.view,
      },
      {
        name: "priceListTemplate",
        path: "/vendor-management/price-list-template",
        licenseFeature: "vendor_management.price_list_template", // app:pricelist-templates
        icon: FileSpreadsheet,
        permission: PERMISSIONS.vendor_management.price_list_template.view,
      },
      {
        name: "requestPriceList",
        path: "/vendor-management/request-price-list",
        licenseFeature: "vendor_management.request_price_list", // app:request-for-pricings
        icon: FileSpreadsheet,
        permission: PERMISSIONS.vendor_management.request_price_list.view,
      },
      {
        // licenseFeature ชี้ vendor_management มาตั้งแต่แรก — ย้ายมาอยู่ใต้เมนูนี้
        // ให้ตรงกับที่ backend จัดหมวดไว้ · permission ย้ายตามด้วย (เดิม
        // configuration.view) คนที่มีสิทธิ์ config แต่ไม่มี vendor_management
        // จะไม่เห็นเมนูนี้อีก — เป็นผลที่ตั้งใจ ไม่ใช่ผลข้างเคียง
        name: "certification",
        path: "/vendor-management/certification",
        licenseFeature: "vendor_management.vendor_master_certificate", // config:vendor-master-certificates
        icon: Award,
        separatorBefore: true,
        permission:
          PERMISSIONS.vendor_management.vendor_master_certificate.view,
      },
    ],
  },
  {
    name: "storeOperations",
    path: "/store-operation",
    // ไม่ใช้ Store — เมนูลูก storeRequisition ใช้ไอคอนนั้นแล้ว ใช้ซ้ำจะแยกแม่กับลูกไม่ออก
    icon: Boxes,
    subModules: [
      {
        name: "storeRequisition",
        path: "/store-operation/store-requisition",
        licenseFeature: "store_operations.store_requisition", // app:store-requisitions
        icon: Store,
      },
      {
        name: "stockReplenishment",
        path: "/store-operation/stock-replenishment",
        licenseFeature: "store_operations.stock_replenishment", // app:stock-replenishment
        icon: PackagePlus,
        permission: PERMISSIONS.inventory_management.stock_in.view,
      },
      {
        name: "wastageReporting",
        path: "/store-operation/wastage-reporting",
        licenseFeature: "store_operations.wastage_reporting", // app:wastage-reporting
        icon: AlertTriangle,
        permission: PERMISSIONS.inventory_management.stock_out.view,
      },
    ],
  },
  {
    name: "inventoryManagement",
    path: "/inventory-management",
    icon: Warehouse,
    subModules: [
      {
        name: "inventoryAdjustment",
        path: "/inventory-management/inventory-adjustment",
        licenseFeature: "inventory_management.inventory_adjustment", // app:inventory-adjustments
        icon: ArrowUpDown,
        permission: PERMISSIONS.inventory_management.inventory_adjustment.view,
      },
      {
        name: "transaction",
        path: "/inventory-management/transaction",
        licenseFeature: "inventory_management.transaction", // app:inventory-transactions
        icon: Receipt,
        permission: PERMISSIONS.inventory_management.transaction.view,
      },
      {
        name: "physicalCount",
        path: "/inventory-management/physical-count",
        icon: ClipboardCheck,
        permission: PERMISSIONS.inventory_management.physical_count.view,
      },
      {
        name: "spotCheck",
        path: "/inventory-management/spot-check",
        icon: Eye,
        permission: PERMISSIONS.inventory_management.spot_check.view,
      },
      {
        name: "periodEnd",
        path: "/inventory-management/period-end",
        icon: Calendar,
        separatorBefore: true,
        permission: PERMISSIONS.inventory_management.period_end.view,
      },
    ],
  },
  {
    name: "operationPlan",
    path: "/operation-plan",
    icon: ChefHat,
    subModules: [
      {
        name: "operationRecipe",
        path: "/operation-plan/recipe",
        licenseFeature: "operation_plan.recipe", // config:recipes
        icon: BookOpen,
        permission: PERMISSIONS.operation_plan.recipe.view,
      },
      {
        name: "operationCategory",
        path: "/operation-plan/category",
        licenseFeature: "operation_plan.category", // config:recipe-categories
        icon: Layers,
        permission: PERMISSIONS.operation_plan.category.view,
      },
      {
        name: "operationCuisine",
        path: "/operation-plan/cuisine",
        licenseFeature: "operation_plan.cuisine", // config:recipe-cuisines
        icon: UtensilsCrossed,
        permission: PERMISSIONS.operation_plan.cuisine.view,
      },
      {
        name: "operationEquipment",
        path: "/operation-plan/equipment",
        licenseFeature: "operation_plan.equipment", // config:recipe-equipment
        icon: Wrench,
        permission: PERMISSIONS.operation_plan.equipment.view,
      },
      {
        name: "operationEquipmentCategory",
        path: "/operation-plan/equipment-category",
        licenseFeature: "operation_plan.equipment_category", // config:recipe-equipment-categories
        icon: FolderTree,
        permission: PERMISSIONS.operation_plan.equipment_category.view,
      },
      {
        name: "importPos",
        path: "/operation-plan/import-pos",
        licenseFeature: "interface.pos", // app:pos-sales
        icon: FileUp,
        separatorBefore: true,
        requiresPosInterface: true,
        // ไม่ระบุ permission — สิทธิ์จริงตรวจที่ backend
      },
      {
        name: "salesConsumption",
        path: "/operation-plan/sales-consumption",
        licenseFeature: "interface.pos", // app:pos-sales
        icon: ClipboardList,
        requiresPosInterface: true,
        permission: PERMISSIONS.inventory_management.stock_out.view,
      },
    ],
  },
  {
    name: "report",
    path: "/report",
    icon: Files,
    subModules: [
      {
        name: "reportList",
        path: "/report/list",
        licenseFeature: "report.list", // app:reports
        icon: Files,
        permission: PERMISSIONS.report.list.view,
      },
      {
        name: "reportSchedule",
        path: "/report/schedules",
        licenseFeature: "report.list", // app:reports (/api/{bu}/reports/schedules -> segment 'reports')
        icon: Calendar,
        permission: PERMISSIONS.report.schedule.view,
      },
      {
        name: "reportHistory",
        path: "/report/history",
        licenseFeature: "report.list", // app:reports (/api/{bu}/reports/history -> segment 'reports')
        icon: Clock,
        permission: PERMISSIONS.report.history.view,
      },
    ],
  },
  {
    name: "accounting",
    path: "/accounting",
    icon: BookOpen,
    subModules: accountingModuleSections,
  },
  {
    name: "config",
    path: "/config",
    icon: Settings2,
    subModules: [
      {
        name: "costCenter",
        path: "/config/cost-center",
        licenseFeature: "configuration.cost_center",
        icon: Crosshair,
        permission: PERMISSIONS.configuration.cost_center.view,
      },
      {
        name: "costCenterGroup",
        path: "/config/cost-center-group",
        licenseFeature: "configuration.cost_center_group",
        icon: Group,
        permission: PERMISSIONS.configuration.cost_center_group.view,
      },
      {
        name: "chartOfAccounts",
        path: "/config/chart-of-accounts",
        licenseFeature: "configuration.chart_of_accounts", // config:chart-of-accounts
        icon: BookText,
      },
      {
        name: "accountGrouping",
        path: "/config/account-grouping",
        licenseFeature: "configuration.chart_of_accounts", // จัดกลุ่มผังบัญชี — ใช้คีย์เดียวกับหน้า chart-of-accounts
        icon: FolderTree,
      },
      {
        // คีย์ license นี้ผูกกับ endpoint จริงแล้ว (api/:bu_code/account-mapping) — LicenseInterceptor + permission configuration.chart_of_account_mapping
        name: "chartOfAccountMapping",
        path: "/config/chart-of-account-mapping",
        licenseFeature: "configuration.chart_of_account_mapping",
        icon: Link2,
      },
      {
        name: "jvPrefix",
        path: "/config/jv-prefix",
        licenseFeature: "accounting.config.gl", // config:prefix-jv
        icon: Bookmark,
        separatorBefore: true,
      },
      {
        name: "dimension",
        path: "/config/dimension",
        licenseFeature: "configuration.dimension",
        icon: Layers,
      },
      {
        name: "bankAccount",
        path: "/config/bank-account",
        licenseFeature: "accounting.config.gl",
        icon: Landmark,
      },
      {
        name: "glPeriod",
        path: "/config/gl-period",
        licenseFeature: "accounting.config.gl",
        icon: Calendar,
      },
      {
        name: "paymentType",
        path: "/config/payment-type",
        licenseFeature: "accounting.config.ap",
        icon: CreditCard,
      },
      {
        name: "whtServiceType",
        path: "/config/wht-service-type",
        licenseFeature: "accounting.config.ap",
        icon: Percent,
      },
      {
        name: "whtForm",
        path: "/config/wht-form",
        licenseFeature: "accounting.config.ap",
        icon: FileSpreadsheet,
      },
      {
        name: "assetCategory",
        path: "/config/asset-category",
        licenseFeature: "accounting.config.asset",
        icon: Building2,
      },
      {
        name: "titleMaster",
        path: "/config/title-master",
        licenseFeature: "accounting.config", // master ของงานบัญชี (อ่านจาก accounting-master-mock)
        icon: UserRoundSearch,
      },
      {
        name: "storeLocation",
        path: "/config/location",
        icon: Building,
        separatorBefore: true,
        permission: PERMISSIONS.configuration.location.view,
      },
      {
        name: "shelf",
        path: "/config/shelf",
        licenseFeature: "configuration.location_shelf",
        icon: Rows3,
        permission: PERMISSIONS.configuration.location_shelf.view,
      },
      {
        name: "department",
        path: "/config/department",
        icon: Warehouse,
        permission: PERMISSIONS.configuration.department.view,
      },
      {
        name: "deliveryPoint",
        path: "/config/delivery-point",
        icon: MapPin,
        permission: PERMISSIONS.configuration.delivery_point.view,
      },
      {
        name: "unit",
        path: "/config/unit",
        licenseFeature: "configuration.unit", // config:units
        icon: Scale,
        permission: PERMISSIONS.configuration.unit.view,
      },
      {
        name: "adjustmentType",
        path: "/config/adjustment-type",
        icon: SlidersHorizontal,
        permission: PERMISSIONS.configuration.adjustment_type.view,
      },
      {
        name: "businessType",
        path: "/config/business-type",
        icon: Briefcase,
        permission: PERMISSIONS.configuration.business_type.view,
      },
      {
        name: "creditNoteReason",
        path: "/config/credit-note-reason",
        licenseFeature: "configuration.credit_note_reason", // app:credit-note-reasons
        icon: MessageSquareText,
        permission: PERMISSIONS.configuration.credit_note_reason.view,
      },
      {
        name: "currency",
        path: "/config/currency",
        icon: DollarSign,
        separatorBefore: true,
        permission: PERMISSIONS.configuration.currency.view,
      },
      {
        name: "exchangeRate",
        path: "/config/exchange-rate",
        icon: ArrowLeftRight,
        permission: PERMISSIONS.configuration.exchange_rate.view,
      },
      {
        name: "taxProfile",
        path: "/config/tax-profile",
        icon: Receipt,
        permission: PERMISSIONS.configuration.tax_profile.view,
      },
      {
        name: "creditTerm",
        path: "/config/credit-term",
        licenseFeature: "configuration.credit_term", // config:credit-terms
        icon: Clock,
        permission: PERMISSIONS.configuration.credit_term.view,
      },
      {
        name: "extraCost",
        path: "/config/extra-cost",
        licenseFeature: "configuration.extra_cost_type", // config:extra-cost-types
        icon: Coins,
        permission: PERMISSIONS.configuration.extra_cost_type.view,
      },
    ],
  },
  {
    name: "systemAdmin",
    path: "/system-admin",
    icon: Shield,
    subModules: [
      {
        name: "companyProfile",
        path: "/system-admin/company-profile",
        // `/api/business-units` ไม่แมตช์ LICENSE_ROUTE_FEATURES เลย (backend fail-open)
        // จึงไม่มี resource key ที่ "ถูก" ให้ใช้ — ใช้ module key ของกลุ่มที่หน้านี้อยู่
        // ซึ่งล็อกเฉพาะ BU ที่ไม่ได้ซื้อ System Admin ทั้งโมดูล (over-lock น้อยที่สุด)
        licenseFeature: "system_admin",
        icon: Briefcase,
        permission: PERMISSIONS.system_admin.business_unit.view,
      },
      {
        name: "defaultSetting",
        path: "/system-admin/default-setting",
        // เหมือน companyProfile — ยิง `/api/business-units` + `/api-system/...`
        // ซึ่งอยู่นอกขอบเขต license ทั้งคู่
        licenseFeature: "system_admin",
        icon: SlidersHorizontal,
        permission: PERMISSIONS.system_admin.business_unit.view,
      },
      {
        name: "askAi",
        path: "/system-admin/ask-ai",
        licenseFeature: "system_admin",
        icon: Sparkles,
        permission: PERMISSIONS.system_admin.business_unit.view,
      },
      {
        name: "inventoryPeriod",
        path: "/system-admin/inventory-period",
        licenseFeature: "system_admin.inventory_period", // app:inventory-periods
        icon: Calendar,
        separatorBefore: true,
        permission: PERMISSIONS.system_admin.inventory_period.view,
      },
      {
        name: "workflow",
        path: "/system-admin/workflow",
        licenseFeature: "system_admin.workflow", // config:workflows
        icon: Network,
        permission: PERMISSIONS.system_admin.workflow.view,
        // สามชนิดเอกสารเป็น route จริงของตัวเอง เพราะแต่ละชนิดยิงคนละ endpoint
        // (`GET /config/{bu}/workflows/{slug}`) ไม่ใช่กรองจากชุดเดียวกัน
        //
        // ตัวที่สี่ไม่ใช่ชนิดเอกสาร — เป็นคลังถ้อยคำที่ workflow เหล่านี้ส่งออกไป
        // (เทมเพลตทุกอันผูกกับการเปลี่ยนสถานะ: Submitted/Approved/Rejected/Sendback)
        // จึงอยู่ท้ายสุด: สามอันแรกตอบว่า "เอกสารไหนมี workflow" อันที่สี่ตอบว่า
        // "แล้วมันพูดว่าอะไร" · ชั้นนี้ไม่ผ่าน `useVisibleModules` (ดู side-main.tsx
        // ที่กรองแค่ชั้นสอง) `licenseFeature` ของมันจึงไม่ถูกบังคับใน sidebar อีก
        // ตัวบังคับจริงคือ `LicenseInterceptor` ที่ gateway อยู่แล้ว
        subModules: [
          {
            name: "workflowPurchaseRequest",
            path: "/system-admin/workflow/purchase-request",
            licenseFeature: "system_admin.workflow",
            icon: ShoppingCart,
            permission: PERMISSIONS.system_admin.workflow.purchase_request.view,
          },
          {
            name: "workflowPurchaseOrder",
            path: "/system-admin/workflow/purchase-order",
            licenseFeature: "system_admin.workflow",
            icon: Receipt,
            permission: PERMISSIONS.system_admin.workflow.purchase_order.view,
          },
          {
            name: "workflowStoreRequisition",
            path: "/system-admin/workflow/store-requisition",
            licenseFeature: "system_admin.workflow",
            icon: Store,
            permission:
              PERMISSIONS.system_admin.workflow.store_requisition.view,
          },
          {
            name: "notificationTemplate",
            path: "/system-admin/notification-template",
            licenseFeature: "configuration.notification_template", // config:notification-templates
            icon: BellRing,
            permission: PERMISSIONS.configuration.notification_template.view,
          },
        ],
      },
      {
        name: "interface",
        path: "/system-admin/interface",
        // ย้ายจาก `configuration.app_config` (2026-09-20) — Interface ขายแยกผ่านใบ INF
        // (`tb_business_unit_interface_license`) ไม่ใช่กลุ่มของสัญญา ดู spec
        // docs/superpowers/specs/2026-09-20-app-config-license-split-design.md
        licenseFeature: "interface",
        // ใบ INF หมดอายุ → หน้า list ขึ้นป้าย "หมดอายุ" รายแบรนด์ และไม่ยิง config ที่ 403
        // (`canReadConfig` ใน use-interface-entitlement.ts) แทนการล็อกทั้งหน้าว่า "ไม่ได้ซื้อ"
        viewableWhenExpired: true,
        // **ไม่มี `permission` โดยตั้งใจ** — backend ไม่มี resource `interface` ใน
        // permission catalog เลย (เป็น `LICENSE_ONLY_RESOURCES`) หน้านี้คุมด้วยใบ INF
        // อย่างเดียว การใส่คีย์ที่ไม่มีอยู่จริงกลับเข้ามาเท่ากับปิดหน้านี้ถาวรสำหรับ non-admin
        icon: Cable,
      },
      {
        name: "emailProfile",
        path: "/system-admin/email-profile",
        licenseFeature: "configuration.email_profile",
        icon: Mail,
        permission: PERMISSIONS.system_admin.config_email.view,
      },
      {
        name: "emailTemplate",
        path: "/system-admin/email-template",
        licenseFeature: "configuration.email_template",
        icon: MailOpen,
        permission: PERMISSIONS.system_admin.config_email.view,
      },
      {
        name: "role",
        path: "/system-admin/role",
        licenseFeature: "system_admin.role", // config:application-roles
        icon: ShieldCheck,
        separatorBefore: true,
        permission: PERMISSIONS.system_admin.role.view,
      },
      {
        name: "user",
        path: "/system-admin/user",
        licenseFeature: "system_admin.user", // app:users
        icon: UserCheck,
        permission: PERMISSIONS.system_admin.user.view,
      },
      {
        name: "runningCode",
        path: "/system-admin/running-code",
        licenseFeature: "system_admin.running_code", // config:running-codes
        icon: Hash,
        separatorBefore: true,
        permission: PERMISSIONS.system_admin.running_code.view,
      },
      {
        name: "document",
        path: "/system-admin/document",
        licenseFeature: "system_admin.document", // app:documents
        icon: FileCheck,
        permission: PERMISSIONS.system_admin.document.view,
      },
      {
        name: "userActivity",
        path: "/system-admin/user-activity",
        licenseFeature: "system_admin.activity_log", // app:activity-logs
        icon: UserRoundSearch,
        separatorBefore: true,
        permission: PERMISSIONS.system_admin.user_activity.view,
      },
      {
        name: "activityLog",
        path: "/system-admin/activity-log",
        licenseFeature: "system_admin.activity_log", // app:activity-logs
        icon: Activity,
        permission: PERMISSIONS.system_admin.activity_log.view,
      },
      {
        name: "dashboardDataset",
        path: "/system-admin/dashboard-dataset",
        licenseFeature: "dashboard.dataset", // app:dashboard-lab / app:datasets
        icon: Database,
        // เส้นคั่นเคยมาจาก notificationTemplate ที่เคยอยู่เหนือมัน — ย้ายตัวนั้นไป
        // ใต้ workflow แล้ว ถ้าไม่ถือเส้นเอง มันจะไหลไปติดกลุ่ม activity
        separatorBefore: true,
        permission: PERMISSIONS.dashboard.dataset.view,
      },
    ],
  },
];
