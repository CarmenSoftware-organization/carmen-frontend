export interface Report {
  Id: number;
  PermissionName: string;
  ReportGroup: string;
  ReportName: string;
  Description: string;
  Dialog: string;
  IsSystem: boolean;
  UserModified: string;
  LastModify: string;
  _templateId?: string;
  _content?: string;
  _columns?: string[];
  _templateType?: "form" | "list";
  _hasExport?: boolean;
}

export interface ReportTemplate {
  id: string;
  name: string;
  description?: string;
  report_group: string;
  dialog: string;
  content: string;
  columns: string[];
  is_standard: boolean;
  is_active: boolean;
  template_type?: "form" | "list";
  has_export?: boolean;
}

export interface RunReportPayload {
  template_id: string;
  filters: Record<string, string>;
}

export interface RunReportResponse {
  url: string;
}

export interface ReportPeriodInfo {
  period: string;
  start_at: string;
  end_at: string;
}

export interface ReportListLookupItem {
  code: string;
  name: string;
}

export type ReportListLookupMap = Record<string, ReportListLookupItem[]>;

export type ReportPeriodMap = Record<string, ReportPeriodInfo | undefined>;
