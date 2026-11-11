export interface AuditEntry {
  at: string;
  id: string;
  name: string;
  avatar?: string;
}

export interface Audit {
  created?: AuditEntry;
  updated?: AuditEntry;
}
