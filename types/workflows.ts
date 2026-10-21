export enum WORKFLOW_TYPE {
  PR = "purchase_request",
  PO = "purchase_order",
  SR = "store_requisition",
}

enum enum_sla_unit {
  minutes = "minutes",
  hours = "hours",
  days = "days",
}

export type SlaUnit = `${enum_sla_unit}`;
export type Role = "create" | "approve" | "purchase" | "issue";
type CreatorAccess = "only_creator" | "all_department";

type OperatorType = "eq" | "lt" | "gt" | "lte" | "gte" | "between";
type ActionType = "SKIP_STAGE" | "NEXT_STAGE";
type NotificationChannel = "Email" | "System";
type NotificationEventTrigger =
  | "onSubmit"
  | "onApprove"
  | "onReject"
  | "onSendBack"
  | "onSLA";

export interface Product {
  id: string;
  code: string;
  name: string;
  local_name?: string;
  description?: string | null;
  product_status_type?: string;
  inventory_unit: { id: string; name: string };
  product_item_group: {
    id: string;
    name: string;
  };
  product_sub_category: {
    id: string;
    name: string;
  };
  product_category: {
    id: string;
    name: string;
  };
}

interface NotificationChannelConfig {
  is_active: boolean;
  notification_template_id: string;
}

export interface RecipientNotification {
  is_active: boolean;
  is_notification: boolean;
  notification_channel: {
    app: NotificationChannelConfig;
    email: NotificationChannelConfig;
  };
}

export interface Recipients {
  requestor: RecipientNotification;
  current_approve: RecipientNotification;
  next_step: RecipientNotification;
}

export interface Action {
  is_active: boolean;
  recipients: Recipients;
  template?: string;
}

interface AvailableActions {
  submit: Action;
  approve: Action;
  reject: Action;
  sendback: Action;
}

export type HiddenPriceField = "price_per_unit" | "total_price";

/**
 * ฟิลด์ราคาถูกซ่อนหรือไม่ — ตัดสินจาก `hidden_fields` ที่ backend ส่งมาเท่านั้น
 * ห้ามเดาจากค่า null (null อาจเป็นข้อมูลว่างจริง)
 */
export function isPriceHidden(
  hidden: readonly HiddenPriceField[] | undefined,
  field: HiddenPriceField,
): boolean {
  return hidden?.includes(field) ?? false;
}

interface HideFields {
  price_per_unit: boolean;
  total_price: boolean;
}

interface SLAWarningNotification {
  recipients: {
    requestor: boolean;
    current_approve: boolean;
  };
  template?: string;
}

export interface Department {
  id: string;
  code?: string;
  name: string;
}

export interface User {
  user_id: string;
  firstname: string;
  middlename: string;
  lastname: string;
  email: string;
  department: Department;
  initials?: string;
}

export interface Stage {
  name: string;
  description?: string;
  sla: string;
  sla_unit: SlaUnit;
  role: Role;
  creator_access?: CreatorAccess;
  available_actions: AvailableActions;
  hide_fields: HideFields;
  is_show_signature?: boolean;
  assigned_users?: User[];
  is_hod?: boolean;
  sla_warning_notification?: SLAWarningNotification;
}

interface RoutingCondition {
  field: string;
  operator: OperatorType;
  value: string[];
  min_value?: string;
  max_value?: string;
}

interface RoutingAction {
  type: ActionType;
  parameters: {
    target_stage: string;
  };
}

export interface RoutingRule {
  id: number;
  name: string;
  description: string;
  trigger_stage: string;
  condition: RoutingCondition;
  action: RoutingAction;
}

export interface AuditEntry {
  at: string;
  id: string;
  name: string;
}

export interface AuditInfo {
  created?: AuditEntry;
  updated?: AuditEntry;
}

export interface WorkflowDto {
  id: string;
  name: string;
  stages: number;
  rules: number;
  workflow_type: string;
  is_active: boolean;
  description?: string;
  data?: WorkflowData;
  audit?: AuditInfo;
  can_create?: boolean;
}

export interface Workflow {
  id: string;
  doc_version?: number;
  name: string;
  workflow_type: string;
  data: WorkflowData;
  is_active: boolean;
  description: string;
  note: null;
  info: object;
  dimension: object;
  audit?: AuditInfo;
}

interface WorkflowNotification {
  id: number;
  event?: string;
  event_trigger?: NotificationEventTrigger;
  description?: string;
  recipients?: string[];
  channels?: NotificationChannel[];
}

export interface Template {
  id: number;
  name: string;
  event_trigger: NotificationEventTrigger;
  description?: string;
  subject_line: string;
  content: string;
}

interface WorkflowData {
  document_reference_pattern: string;
  inherit_signature_from_pr?: boolean;
  stages: Stage[];
  routing_rules: RoutingRule[];
  notifications: WorkflowNotification[];
  notification_templates: Template[];
  products: Product[];
}
