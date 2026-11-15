import type { Audit } from "./audit";

// Classification returned by the existing AP API; not Tax Profile form options.
export type TaxProfileType = "vat" | "wht";
export type WhtPndForm = "pnd_1" | "pnd_2" | "pnd_3" | "pnd_53" | "pnd_54";

export interface TaxProfile {
  id: string;
  name: string;
  tax_rate: number;
  is_active: boolean;
  doc_version: number;
  tax_type?: TaxProfileType;
  chart_of_accounts_id?: string | null;
  wht_pnd_form?: WhtPndForm | null;
  wht_income_type?: string | null;
  audit?: Audit;
}

export interface CreateTaxProfileDto {
  name: string;
  tax_rate: number;
  is_active: boolean;
  // optimistic-concurrency token round-tripped on PATCH (omitting it → 400)
  doc_version?: number;
}
