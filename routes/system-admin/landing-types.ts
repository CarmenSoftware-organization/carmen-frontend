import type { ComponentType, SVGProps } from "react";
import {
  Activity,
  BellRing,
  Building2,
  Cable,
  Calendar,
  Database,
  Folder,
  Gauge,
  HardDrive,
  Mail,
  MailOpen,
  Shield,
  SlidersHorizontal,
  Sparkles,
  Terminal,
  Users,
  Workflow,
} from "lucide-react";

export type LucideIcon = ComponentType<
  SVGProps<SVGSVGElement> & { size?: number | string }
>;

export type VisualKey =
  | "roles"
  | "assign"
  | "inventoryPeriod"
  | "workflows"
  | "docs"
  | "userActivity"
  | "monitor"
  | "interface"
  | "notify"
  | "code"
  | "dataset"
  | "company"
  | "settings"
  | "askAi"
  | "emailProfile"
  | "emailTemplate"
  | "storage";

export type ModuleDef = {
  readonly key: string;
  readonly visualKey: VisualKey;
  readonly href: string;
  readonly icon: LucideIcon;
};

export type ChapterDef = {
  readonly key:
    "business" | "access" | "process" | "observe" | "config" | "data";
  readonly modules: readonly ModuleDef[];
};

/**
 * ทุกหน้าในเมนูซ้ายของ System Admin ต้องมีการ์ดที่นี่ — เพิ่มหน้าใหม่ใน `constant/module-list.ts`
 * แล้วเพิ่มที่นี่ด้วย (ลูกของ Workflow ไม่นับ: หน้า Workflow มี landing ของตัวเอง)
 */
export const CHAPTERS: readonly ChapterDef[] = [
  {
    key: "business",
    modules: [
      {
        key: "companyProfile",
        visualKey: "company",
        href: "/system-admin/company-profile",
        icon: Building2,
      },
      {
        key: "defaultSetting",
        visualKey: "settings",
        href: "/system-admin/default-setting",
        icon: SlidersHorizontal,
      },
      {
        key: "askAi",
        visualKey: "askAi",
        href: "/system-admin/ask-ai",
        icon: Sparkles,
      },
    ],
  },
  {
    key: "access",
    modules: [
      {
        key: "roles",
        visualKey: "roles",
        href: "/system-admin/role",
        icon: Shield,
      },
      {
        key: "assign",
        visualKey: "assign",
        href: "/system-admin/user",
        icon: Users,
      },
    ],
  },
  {
    key: "process",
    modules: [
      {
        key: "inventoryPeriod",
        visualKey: "inventoryPeriod",
        href: "/system-admin/inventory-period",
        icon: Calendar,
      },
      {
        key: "workflows",
        visualKey: "workflows",
        href: "/system-admin/workflow",
        icon: Workflow,
      },
      {
        key: "docs",
        visualKey: "docs",
        href: "/system-admin/document",
        icon: Folder,
      },
    ],
  },
  {
    key: "observe",
    modules: [
      {
        key: "userActivity",
        visualKey: "userActivity",
        href: "/system-admin/user-activity",
        icon: Activity,
      },
      {
        key: "monitor",
        visualKey: "monitor",
        href: "/system-admin/activity-log",
        icon: Gauge,
      },
    ],
  },
  {
    key: "config",
    modules: [
      {
        key: "interface",
        visualKey: "interface",
        href: "/system-admin/interface",
        icon: Cable,
      },
      {
        key: "notifyTemplate",
        visualKey: "notify",
        href: "/system-admin/notification-template",
        icon: BellRing,
      },
      {
        key: "emailProfile",
        visualKey: "emailProfile",
        href: "/system-admin/email-profile",
        icon: Mail,
      },
      {
        key: "emailTemplate",
        visualKey: "emailTemplate",
        href: "/system-admin/email-template",
        icon: MailOpen,
      },
      {
        key: "code",
        visualKey: "code",
        href: "/system-admin/running-code",
        icon: Terminal,
      },
    ],
  },
  {
    key: "data",
    modules: [
      {
        key: "dataset",
        visualKey: "dataset",
        href: "/system-admin/dashboard-dataset",
        icon: Database,
      },
      {
        key: "storage",
        visualKey: "storage",
        href: "/system-admin/storage",
        icon: HardDrive,
      },
    ],
  },
];

export type TFn = (key: string) => string;
