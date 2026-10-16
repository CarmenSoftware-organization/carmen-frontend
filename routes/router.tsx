import { createBrowserRouter, Navigate } from "react-router";
import { RequireAuth } from "@/components/auth/require-auth";
import LandingRedirect from "./landing-redirect";
import AppRoot from "./app-root";
import RootLayout from "./root-layout";
import { RouteErrorBoundaryAdapter } from "./module-error-boundary-adapter";
import { RootErrorBoundary } from "./root-error-boundary";

const ProtectedShell = () => (
  <RequireAuth>
    <RootLayout />
  </RequireAuth>
);

export const router = createBrowserRouter([
  {
    Component: AppRoot,
    ErrorBoundary: RootErrorBoundary,
    children: [
      { path: "/login", lazy: () => import("./login/login.route") },
      // ปลายทางของ Google sign-in — public เพราะมาถึงโดยยังไม่มี token (token อยู่ใน URL fragment)
      {
        path: "/login/callback",
        lazy: () => import("./login/auth-callback.route"),
      },
      { path: "/register", lazy: () => import("./register/register.route") },
      {
        path: "/register/verify",
        lazy: () => import("./register/register-verify.route"),
      },
      // กู้คืนรหัสผ่าน — public เพราะคนที่ใช้เส้นทางนี้เข้าระบบไม่ได้อยู่แล้ว
      // ปลายทางของลิงก์ในอีเมลมาจาก platform config คีย์ `password_reset.base_url` ต้องตั้งให้
      // ชี้มาที่ `/reset-password` ของแอปนี้ ไม่งั้นลิงก์จะพาไปที่อื่นทั้งที่โค้ดทั้งสองฝั่งถูกต้อง
      {
        path: "/forgot-password",
        lazy: () => import("./forgot-password/forgot-password.route"),
      },
      {
        path: "/reset-password",
        lazy: () => import("./reset-password/reset-password.route"),
      },
      // เอกสารกฎหมาย — public ทั้งคู่ ต้องอ่านได้ก่อนกดสมัคร
      { path: "/terms", lazy: () => import("./legal/terms.route") },
      { path: "/privacy", lazy: () => import("./legal/privacy.route") },
      // หน้ารับคำเชิญ — public เพราะผู้ถูกเชิญอาจยังไม่มีบัญชี และสมัครจบได้ในลิงก์นี้เลย
      // สอง path ชี้คอมโพเนนต์เดียวกัน: backend ต่อ token เป็น `?token=` ท้าย Base URL ที่ผู้ดูแล
      // ตั้งไว้ ส่วนรูปแบบ path เป็นสิ่งที่คนตั้งค่ามักเดาว่าใช่ รับทั้งคู่จึงไม่มีลิงก์ไหนตายเพราะรูปแบบ
      {
        path: "/invitations",
        lazy: () => import("./invitation/invitation.route"),
      },
      {
        path: "/invitations/:token",
        lazy: () => import("./invitation/invitation.route"),
      },
      // Public price-list route — vendor ภายนอกเปิดจากลิงก์ในอีเมล (ไม่ต้อง auth)
      {
        path: "/pl/:url_token",
        lazy: () => import("./external/pl/price-list-external.route"),
      },
      {
        Component: ProtectedShell,
        children: [
          { index: true, element: <LandingRedirect /> },
          {
            path: "dashboard",
            lazy: () => import("./dashboard/dashboard.route"),
            ErrorBoundary: RouteErrorBoundaryAdapter,
          },
          {
            path: "profile",
            lazy: () => import("./profile/profile.route"),
            ErrorBoundary: RouteErrorBoundaryAdapter,
          },
          {
            path: "profile/setting",
            lazy: () => import("./profile/profile-setting.route"),
            ErrorBoundary: RouteErrorBoundaryAdapter,
          },
          {
            path: "notifications",
            lazy: () => import("./notifications/notifications.route"),
            ErrorBoundary: RouteErrorBoundaryAdapter,
          },
          // หน้าอ้างอิง design system — เครื่องมือของทีมพัฒนา ไม่ใช่โมดูลใช้งาน
          // จึงไม่อยู่ใน constant/module-list.ts (ไม่ขึ้นเมนู ไม่ผูก permission
          // และไม่ผูก license feature) แต่ยังอยู่หลัง auth เพราะไม่มีเหตุให้เปิด public
          {
            path: "design-system",
            lazy: () => import("./design-system/design-system.route"),
            ErrorBoundary: RouteErrorBoundaryAdapter,
          },
          {
            path: "config",
            ErrorBoundary: RouteErrorBoundaryAdapter,
            children: [
              { index: true, lazy: () => import("./config/config.route") },
              {
                path: "chart-of-accounts",
                lazy: () =>
                  import("./config/chart-of-accounts/chart-of-accounts.route"),
              },
              {
                path: "chart-of-accounts/new",
                lazy: () => import("./config/chart-of-accounts/coa-new.route"),
              },
              {
                path: "chart-of-accounts/:id",
                lazy: () => import("./config/chart-of-accounts/coa-edit.route"),
              },
              {
                path: "account-grouping",
                lazy: () =>
                  import("./config/account-grouping/account-grouping.route"),
              },
              {
                path: "jv-prefix",
                lazy: () => import("./config/jv-prefix/jv-prefix.route"),
              },
              {
                path: "dimension",
                lazy: () => import("./config/dimension/dimension.route"),
              },
              {
                path: "cost-center-group",
                lazy: () =>
                  import("./config/cost-center-group/cost-center-group.route"),
              },
              {
                path: "cost-center",
                lazy: () => import("./config/cost-center/cost-center.route"),
              },
              {
                path: "bank-account",
                lazy: () => import("./config/bank-account/bank-account.route"),
              },
              {
                path: "gl-period",
                lazy: () => import("./config/gl-period/gl-period.route"),
              },
              {
                path: "payment-type",
                lazy: () => import("./config/payment-type/payment-type.route"),
              },
              {
                path: "wht-service-type",
                lazy: () =>
                  import("./config/wht-service-type/wht-service-type.route"),
              },
              {
                path: "wht-form",
                lazy: () => import("./config/wht-form/wht-form.route"),
              },
              {
                path: "asset-category",
                lazy: () =>
                  import("./config/asset-category/asset-category.route"),
              },
              {
                path: "title-master",
                lazy: () => import("./config/title-master/title-master.route"),
              },
              {
                path: "chart-of-account-mapping",
                lazy: () =>
                  import("./config/chart-of-account-mapping/coam.route"),
              },
              // path เดิมก่อนเปลี่ยนชื่อหน้า — คง redirect ไว้ให้ bookmark เก่าไม่ 404
              // ถอดออกได้หลังปล่อยไปแล้วหนึ่งรอบ release
              {
                path: "account-mapping",
                element: (
                  <Navigate to="/config/chart-of-account-mapping" replace />
                ),
              },
              { path: "unit", lazy: () => import("./config/unit/unit.route") },
              {
                path: "currency",
                lazy: () => import("./config/currency/currency.route"),
              },
              {
                path: "adjustment-type",
                lazy: () =>
                  import("./config/adjustment-type/adjustment-type.route"),
              },
              {
                path: "business-type",
                lazy: () =>
                  import("./config/business-type/business-type.route"),
              },
              {
                path: "credit-note-reason",
                lazy: () =>
                  import("./config/credit-note-reason/credit-note-reason.route"),
              },
              {
                path: "credit-term",
                lazy: () => import("./config/credit-term/credit-term.route"),
              },
              {
                path: "delivery-point",
                lazy: () =>
                  import("./config/delivery-point/delivery-point.route"),
              },
              {
                path: "exchange-rate",
                lazy: () =>
                  import("./config/exchange-rate/exchange-rate.route"),
              },
              {
                path: "extra-cost",
                lazy: () => import("./config/extra-cost/extra-cost.route"),
              },
              {
                path: "tax-profile",
                lazy: () => import("./config/tax-profile/tax-profile.route"),
              },
              {
                path: "department",
                lazy: () => import("./config/department/department.route"),
              },
              {
                path: "department/new",
                lazy: () => import("./config/department/department-new.route"),
              },
              {
                path: "department/:id",
                lazy: () => import("./config/department/department-edit.route"),
              },
              {
                path: "location",
                lazy: () => import("./config/location/location.route"),
              },
              {
                path: "location/new",
                lazy: () => import("./config/location/location-new.route"),
              },
              {
                path: "location/:id",
                lazy: () => import("./config/location/location-edit.route"),
              },
              {
                path: "shelf",
                lazy: () => import("./config/shelf/shelf.route"),
              },
            ],
          },
          {
            path: "procurement",
            ErrorBoundary: RouteErrorBoundaryAdapter,
            children: [
              {
                index: true,
                lazy: () => import("./procurement/procurement.route"),
              },
              {
                path: "purchase-request-template",
                lazy: () =>
                  import("./procurement/purchase-request-template/purchase-request-template.route"),
              },
              {
                path: "purchase-request-template/new",
                lazy: () =>
                  import("./procurement/purchase-request-template/purchase-request-template-new.route"),
              },
              {
                path: "purchase-request-template/:id",
                lazy: () =>
                  import("./procurement/purchase-request-template/purchase-request-template-edit.route"),
              },
              {
                path: "credit-note",
                lazy: () =>
                  import("./procurement/credit-note/credit-note.route"),
              },
              {
                path: "credit-note/new",
                lazy: () =>
                  import("./procurement/credit-note/credit-note-new.route"),
              },
              {
                path: "credit-note/:id",
                lazy: () =>
                  import("./procurement/credit-note/credit-note-edit.route"),
              },
              {
                path: "goods-receive-note",
                lazy: () =>
                  import("./procurement/goods-receive-note/goods-receive-note.route"),
              },
              {
                path: "goods-receive-note/new",
                lazy: () =>
                  import("./procurement/goods-receive-note/goods-receive-note-new.route"),
              },
              {
                path: "goods-receive-note/from-po",
                lazy: () =>
                  import("./procurement/goods-receive-note/from-po/from-po.route"),
              },
              {
                path: "goods-receive-note/:id",
                lazy: () =>
                  import("./procurement/goods-receive-note/goods-receive-note-edit.route"),
              },
              {
                path: "purchase-order",
                lazy: () =>
                  import("./procurement/purchase-order/purchase-order.route"),
              },
              {
                path: "purchase-order/new",
                lazy: () =>
                  import("./procurement/purchase-order/purchase-order-new.route"),
              },
              {
                path: "purchase-order/from-price-list",
                lazy: () =>
                  import("./procurement/purchase-order/from-price-list/from-price-list.route"),
              },
              {
                path: "purchase-order/from-pr",
                lazy: () =>
                  import("./procurement/purchase-order/from-pr/from-pr.route"),
              },
              {
                path: "purchase-order/:id",
                lazy: () =>
                  import("./procurement/purchase-order/purchase-order-edit.route"),
              },
              {
                path: "purchase-request",
                lazy: () =>
                  import("./procurement/purchase-request/purchase-request.route"),
              },
              {
                path: "purchase-request/new",
                lazy: () =>
                  import("./procurement/purchase-request/purchase-request-new.route"),
              },
              {
                path: "purchase-request/from-template",
                lazy: () =>
                  import("./procurement/purchase-request/from-template/from-template.route"),
              },
              {
                path: "purchase-request/:id",
                lazy: () =>
                  import("./procurement/purchase-request/purchase-request-edit.route"),
              },
              {
                path: "my-approval",
                lazy: () =>
                  import("./procurement/my-approval/my-approval.route"),
              },
              // path เดิมก่อนเปลี่ยนชื่อหน้า — คง redirect ไว้ให้ bookmark เก่าไม่ 404
              // ถอดออกได้หลังปล่อยไปแล้วหนึ่งรอบ release
              {
                path: "approval",
                element: <Navigate to="/procurement/my-approval" replace />,
              },
            ],
          },
          {
            path: "inventory-management",
            ErrorBoundary: RouteErrorBoundaryAdapter,
            children: [
              {
                index: true,
                lazy: () =>
                  import("./inventory-management/inventory-management.route"),
              },
              {
                path: "inventory-adjustment",
                lazy: () =>
                  import("./inventory-management/inventory-adjustment/inventory-adjustment.route"),
              },
              {
                path: "inventory-adjustment/new",
                lazy: () =>
                  import("./inventory-management/inventory-adjustment/inventory-adjustment-new.route"),
              },
              {
                path: "inventory-adjustment/:id",
                lazy: () =>
                  import("./inventory-management/inventory-adjustment/inventory-adjustment-edit.route"),
              },
              {
                path: "transaction",
                lazy: () =>
                  import("./inventory-management/transaction/transaction.route"),
              },
              {
                path: "physical-count",
                lazy: () =>
                  import("./inventory-management/physical-count/physical-count.route"),
              },
              {
                path: "physical-count/new",
                lazy: () =>
                  import("./inventory-management/physical-count/physical-count-new.route"),
              },
              {
                path: "physical-count/:id",
                lazy: () =>
                  import("./inventory-management/physical-count/physical-count-edit.route"),
              },
              {
                path: "physical-count/:id/entry",
                lazy: () =>
                  import("./inventory-management/physical-count/physical-count-entry.route"),
              },
              {
                path: "physical-count/:id/review",
                lazy: () =>
                  import("./inventory-management/physical-count/physical-count-review.route"),
              },
              {
                path: "spot-check",
                lazy: () =>
                  import("./inventory-management/spot-check/spot-check.route"),
              },
              {
                path: "spot-check/location/:location_id",
                lazy: () =>
                  import("./inventory-management/spot-check/spot-check-by-location.route"),
              },
              {
                path: "spot-check/:id",
                lazy: () =>
                  import("./inventory-management/spot-check/spot-check-edit.route"),
              },
              {
                path: "spot-check/:id/review",
                lazy: () =>
                  import("./inventory-management/spot-check/spot-check-review.route"),
              },
              {
                path: "period-end",
                lazy: () =>
                  import("./inventory-management/period-end/period-end.route"),
              },
              {
                path: "period-end/review",
                lazy: () =>
                  import("./inventory-management/period-end/period-end-review.route"),
              },
            ],
          },
          {
            path: "vendor-management",
            ErrorBoundary: RouteErrorBoundaryAdapter,
            children: [
              {
                index: true,
                lazy: () =>
                  import("./vendor-management/vendor-management.route"),
              },
              {
                path: "certification",
                lazy: () =>
                  import("./vendor-management/certification/certification.route"),
              },
              {
                path: "vendor",
                lazy: () => import("./vendor-management/vendor/vendor.route"),
              },
              {
                path: "vendor/new",
                lazy: () =>
                  import("./vendor-management/vendor/vendor-new.route"),
              },
              {
                path: "vendor/:id",
                lazy: () =>
                  import("./vendor-management/vendor/vendor-edit.route"),
              },
              {
                path: "price-list",
                lazy: () =>
                  import("./vendor-management/price-list/price-list.route"),
              },
              {
                path: "price-list/new",
                lazy: () =>
                  import("./vendor-management/price-list/price-list-new.route"),
              },
              {
                path: "price-list/:id",
                lazy: () =>
                  import("./vendor-management/price-list/price-list-edit.route"),
              },
              {
                path: "price-list-template",
                lazy: () =>
                  import("./vendor-management/price-list-template/price-list-template.route"),
              },
              {
                path: "price-list-template/new",
                lazy: () =>
                  import("./vendor-management/price-list-template/price-list-template-new.route"),
              },
              {
                path: "price-list-template/:id",
                lazy: () =>
                  import("./vendor-management/price-list-template/price-list-template-edit.route"),
              },
              {
                path: "request-price-list",
                lazy: () =>
                  import("./vendor-management/request-price-list/request-price-list.route"),
              },
              {
                path: "request-price-list/new",
                lazy: () =>
                  import("./vendor-management/request-price-list/request-price-list-new.route"),
              },
              {
                path: "request-price-list/:id",
                lazy: () =>
                  import("./vendor-management/request-price-list/request-price-list-edit.route"),
              },
            ],
          },
          {
            path: "store-operation",
            ErrorBoundary: RouteErrorBoundaryAdapter,
            children: [
              {
                index: true,
                lazy: () => import("./store-operation/store-operation.route"),
              },
              {
                path: "store-requisition",
                lazy: () =>
                  import("./store-operation/store-requisition/store-requisition.route"),
              },
              {
                path: "store-requisition/new",
                lazy: () =>
                  import("./store-operation/store-requisition/store-requisition-new.route"),
              },
              {
                path: "store-requisition/:id",
                lazy: () =>
                  import("./store-operation/store-requisition/store-requisition-edit.route"),
              },
              {
                path: "wastage-reporting",
                lazy: () =>
                  import("./store-operation/wastage-reporting/wastage-reporting.route"),
              },
              {
                path: "stock-replenishment",
                lazy: () =>
                  import("./store-operation/stock-replenishment/stock-replenishment.route"),
              },
            ],
          },
          {
            path: "operation-plan",
            ErrorBoundary: RouteErrorBoundaryAdapter,
            children: [
              {
                index: true,
                lazy: () => import("./operation-plan/operation-plan.route"),
              },
              {
                path: "category",
                lazy: () => import("./operation-plan/category/category.route"),
              },
              {
                path: "category/new",
                lazy: () =>
                  import("./operation-plan/category/category-new.route"),
              },
              {
                path: "category/:id",
                lazy: () =>
                  import("./operation-plan/category/category-edit.route"),
              },
              {
                path: "cuisine",
                lazy: () => import("./operation-plan/cuisine/cuisine.route"),
              },
              {
                path: "cuisine/new",
                lazy: () =>
                  import("./operation-plan/cuisine/cuisine-new.route"),
              },
              {
                path: "cuisine/:id",
                lazy: () =>
                  import("./operation-plan/cuisine/cuisine-edit.route"),
              },
              {
                path: "recipe",
                lazy: () => import("./operation-plan/recipe/recipe.route"),
              },
              {
                path: "recipe/new",
                lazy: () => import("./operation-plan/recipe/recipe-new.route"),
              },
              {
                path: "recipe/:id",
                lazy: () => import("./operation-plan/recipe/recipe-cook.route"),
              },
              {
                path: "recipe/:id/edit",
                lazy: () => import("./operation-plan/recipe/recipe-edit.route"),
              },
              {
                path: "equipment",
                lazy: () =>
                  import("./operation-plan/equipment/equipment.route"),
              },
              {
                path: "equipment/new",
                lazy: () =>
                  import("./operation-plan/equipment/equipment-new.route"),
              },
              {
                path: "equipment/:id",
                lazy: () =>
                  import("./operation-plan/equipment/equipment-edit.route"),
              },
              {
                path: "recipe-equipment-category",
                lazy: () =>
                  import("./operation-plan/recipe-equipment-category/recipe-equipment-category.route"),
              },
              {
                path: "equipment-category",
                lazy: () =>
                  import("./operation-plan/equipment-category/equipment-category.route"),
              },
            ],
          },
          {
            path: "product-management",
            ErrorBoundary: RouteErrorBoundaryAdapter,
            children: [
              {
                index: true,
                lazy: () =>
                  import("./product-management/product-management.route"),
              },
              {
                path: "eco",
                lazy: () => import("./product-management/eco/eco.route"),
              },
              {
                path: "category",
                lazy: () =>
                  import("./product-management/category/category.route"),
              },
              {
                path: "product",
                lazy: () =>
                  import("./product-management/product/product.route"),
              },
              {
                path: "product/new",
                lazy: () =>
                  import("./product-management/product/product-new.route"),
              },
              {
                path: "product/:id",
                lazy: () =>
                  import("./product-management/product/product-edit.route"),
              },
            ],
          },
          {
            path: "system-admin",
            ErrorBoundary: RouteErrorBoundaryAdapter,
            children: [
              {
                index: true,
                lazy: () => import("./system-admin/system-admin.route"),
              },
              {
                path: "role",
                lazy: () => import("./system-admin/role/role.route"),
              },
              {
                path: "role/new",
                lazy: () => import("./system-admin/role/role-new.route"),
              },
              {
                path: "role/:id",
                lazy: () => import("./system-admin/role/role-edit.route"),
              },
              {
                path: "notification-template",
                lazy: () =>
                  import("./system-admin/notification-template/notification-template.route"),
              },
              {
                path: "notification-template/new",
                lazy: () =>
                  import("./system-admin/notification-template/notification-template-new.route"),
              },
              {
                path: "notification-template/:id",
                lazy: () =>
                  import("./system-admin/notification-template/notification-template-edit.route"),
              },
              {
                path: "inventory-period",
                lazy: () =>
                  import("./system-admin/inventory-period/inventory-period.route"),
              },
              // เดิมหน้านี้อยู่ที่ /system-admin/period — กัน bookmark เก่าพัง
              {
                path: "period",
                element: (
                  <Navigate to="/system-admin/inventory-period" replace />
                ),
              },
              {
                path: "user-activity",
                lazy: () =>
                  import("./system-admin/user-activity/user-activity.route"),
              },
              {
                path: "user",
                lazy: () => import("./system-admin/user/user.route"),
              },
              {
                path: "user/:id",
                lazy: () => import("./system-admin/user/user-edit.route"),
              },
              {
                path: "document",
                lazy: () => import("./system-admin/document/document.route"),
              },
              {
                path: "activity-log",
                lazy: () =>
                  import("./system-admin/activity-log/activity-log.route"),
              },
              {
                path: "workflow",
                element: (
                  <Navigate
                    to="/system-admin/workflow/purchase-request"
                    replace
                  />
                ),
              },
              // สามเส้นนี้ต้องมาก่อน `workflow/:id` — react-router จัดลำดับ static
              // เหนือ dynamic ให้อยู่แล้ว แต่เขียนติดกันไว้จะได้เห็นความสัมพันธ์
              {
                path: "workflow/purchase-request",
                lazy: () =>
                  import("./system-admin/workflow/workflow-doc-type.route"),
              },
              {
                path: "workflow/purchase-order",
                lazy: () =>
                  import("./system-admin/workflow/workflow-doc-type.route"),
              },
              {
                path: "workflow/store-requisition",
                lazy: () =>
                  import("./system-admin/workflow/workflow-doc-type.route"),
              },
              {
                path: "workflow/new",
                lazy: () =>
                  import("./system-admin/workflow/workflow-new.route"),
              },
              {
                path: "workflow/:id",
                lazy: () =>
                  import("./system-admin/workflow/workflow-edit.route"),
              },
              {
                path: "running-code",
                lazy: () =>
                  import("./system-admin/running-code/running-code.route"),
              },
              {
                path: "dashboard-dataset",
                lazy: () =>
                  import("./system-admin/dashboard-dataset/dashboard-dataset.route"),
              },
              {
                path: "company-profile",
                lazy: () =>
                  import("./system-admin/company-profile/company-profile.route"),
              },
              {
                path: "default-setting",
                lazy: () =>
                  import("./system-admin/default-setting/default-setting.route"),
              },
              {
                path: "interface",
                lazy: () => import("./system-admin/interface/interface.route"),
              },
              {
                path: "interface/:category/:brand",
                lazy: () =>
                  import("./system-admin/interface/interface-detail.route"),
              },
              {
                path: "email-profile",
                lazy: () =>
                  import("./system-admin/email-profile/email-profile.route"),
              },
              {
                path: "email-template",
                lazy: () =>
                  import("./system-admin/email-template/email-template.route"),
              },
              {
                path: "business-setting",
                element: (
                  <Navigate to="/system-admin/company-profile" replace />
                ),
              },
            ],
          },
          {
            path: "report",
            ErrorBoundary: RouteErrorBoundaryAdapter,
            children: [
              { index: true, lazy: () => import("./report/report.route") },
              {
                path: "list",
                lazy: () => import("./report/list/report-list.route"),
              },
              {
                path: "schedules",
                lazy: () => import("./report/schedules/report-schedules.route"),
              },
              {
                path: "history",
                lazy: () => import("./report/history/report-history.route"),
              },
            ],
          },
          {
            path: "accounting",
            ErrorBoundary: RouteErrorBoundaryAdapter,
            children: [
              {
                index: true,
                lazy: () =>
                  import("./accounting/dashboard/accounting-dashboard.route"),
              },
              {
                path: "journal-voucher",
                lazy: () =>
                  import("./accounting/journal-voucher/journal-voucher-list.route"),
              },
              {
                path: "journal-voucher/:id",
                lazy: () =>
                  import("./accounting/journal-voucher/journal-voucher-form.route"),
              },
              {
                path: "template-voucher",
                lazy: () =>
                  import("./accounting/documents/accounting-document-list.route"),
              },
              {
                path: "template-voucher/:id",
                lazy: () =>
                  import("./accounting/documents/accounting-document-detail.route"),
              },
              {
                path: "recurring-voucher",
                lazy: () =>
                  import("./accounting/documents/accounting-document-list.route"),
              },
              {
                path: "recurring-voucher/:id",
                lazy: () =>
                  import("./accounting/documents/accounting-document-detail.route"),
              },
              {
                path: "allocation-voucher",
                lazy: () =>
                  import("./accounting/documents/accounting-document-list.route"),
              },
              {
                path: "allocation-voucher/:id",
                lazy: () =>
                  import("./accounting/documents/accounting-document-detail.route"),
              },
              {
                path: "accounts-payable",
                lazy: () =>
                  import("./accounting/accounts-payable/ap-dashboard.route"),
              },
              {
                path: "accounts-payable/invoice",
                lazy: () =>
                  import("./accounting/accounts-payable/invoice/ap-invoice-list.route"),
              },
              {
                path: "accounts-payable/invoice/:id",
                lazy: () =>
                  import("./accounting/accounts-payable/invoice/ap-invoice-detail.route"),
              },
              {
                path: "accounts-payable/payment",
                lazy: () =>
                  import("./accounting/accounts-payable/payment/ap-payment-list.route"),
              },
              {
                path: "accounts-payable/payment/:id",
                lazy: () =>
                  import("./accounting/accounts-payable/payment/ap-payment-detail.route"),
              },
              {
                path: "accounts-payable/payment-approvals",
                element: (
                  <Navigate
                    to="/accounting/accounts-payable/payment?lifecycle=submitted"
                    replace
                  />
                ),
              },
              {
                path: "accounts-receivable",
                lazy: () =>
                  import("./accounting/dashboard/accounting-dashboard.route"),
              },
              {
                path: "accounts-receivable/invoice",
                lazy: () =>
                  import("./accounting/accounts-receivable/ar-invoice-list.route"),
              },
              {
                path: "accounts-receivable/invoice/:id",
                lazy: () =>
                  import("./accounting/accounts-receivable/ar-invoice-detail.route"),
              },
              {
                path: "accounts-receivable/receipt",
                lazy: () =>
                  import("./accounting/documents/accounting-document-list.route"),
              },
              {
                path: "accounts-receivable/receipt/:id",
                lazy: () =>
                  import("./accounting/documents/accounting-document-detail.route"),
              },
              {
                path: "financial-reports",
                lazy: () =>
                  import("./accounting/documents/accounting-document-list.route"),
              },
              {
                path: "financial-reports/:id",
                lazy: () =>
                  import("./accounting/documents/accounting-document-detail.route"),
              },
              {
                path: "asset",
                lazy: () =>
                  import("./accounting/dashboard/accounting-dashboard.route"),
              },
              {
                path: "asset/register",
                lazy: () =>
                  import("./accounting/documents/accounting-document-list.route"),
              },
              {
                path: "asset/register/:id",
                lazy: () =>
                  import("./accounting/documents/accounting-document-detail.route"),
              },
              {
                path: "asset/disposal",
                lazy: () =>
                  import("./accounting/documents/accounting-document-list.route"),
              },
              {
                path: "asset/disposal/:id",
                lazy: () =>
                  import("./accounting/documents/accounting-document-detail.route"),
              },
            ],
          },
        ],
      },
      { path: "*", lazy: () => import("./not-found/not-found.route") },
    ],
  },
]);
