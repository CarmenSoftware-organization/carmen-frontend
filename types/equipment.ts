interface EquipmentAuditEntry {
  at: string;
  id: string;
  name: string;
}

interface EquipmentAudit {
  created: EquipmentAuditEntry;
  updated: EquipmentAuditEntry;
}

export interface Equipment {
  id: string;
  code: string;
  name: string;
  description: string | null;
  category_id: string | null;
  category_name: string | null;
  brand: string | null;
  model: string | null;
  serial_no: string | null;
  capacity: string | null;
  power_rating: string | null;
  station: string | null;
  operation_instructions: string | null;
  safety_notes: string | null;
  cleaning_instructions: string | null;
  maintenance_schedule: string | null;
  last_maintenance_date: string | null;
  next_maintenance_date: string | null;
  note: string | null;
  is_active: boolean;
  is_portable: boolean;
  available_qty: number;
  total_qty: number;
  usage_count: number;
  attachments: unknown[] | null;
  manuals_urls: string[] | null;
  info: Record<string, unknown> | null;
  doc_version: number;
  average_usage_time: number;
  category: Record<string, unknown> | null;
  image_url: string | null;
  audit: EquipmentAudit;
}

export interface CreateEquipmentVars extends CreateEquipmentDto {
  image?: File | null;
}

export interface UpdateEquipmentVars extends CreateEquipmentDto {
  id: string;
  image?: File | null;
  remove_image?: boolean;
}

export interface CreateEquipmentDto {
  doc_version?: number;
  code: string;
  name: string;
  description: string | null;
  category_id: string | null;
  brand: string | null;
  model: string | null;
  serial_no: string | null;
  capacity: string | null;
  power_rating: string | null;
  station: string | null;
  operation_instructions: string | null;
  safety_notes: string | null;
  cleaning_instructions: string | null;
  maintenance_schedule: string | null;
  last_maintenance_date: string | null;
  next_maintenance_date: string | null;
  note: string | null;
  is_active: boolean;
  is_portable: boolean;
  available_qty: number;
  total_qty: number;
  usage_count: number;
  average_usage_time: number;
}
