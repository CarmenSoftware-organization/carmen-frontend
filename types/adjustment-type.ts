import z from "zod";
import type { Audit } from "./audit";

export enum ADJUSTMENT_TYPE {
  // Backend persists/validates these as lowercase enum values
  // ('stock_in' | 'stock_out'); sending uppercase yields a 400 on create/update.
  STOCK_IN = "stock_in",
  STOCK_OUT = "stock_out",
}

export const ADJUSTMENT_TYPE_OPTIONS = [
  { label: "Stock In", value: ADJUSTMENT_TYPE.STOCK_IN },
  { label: "Stock Out", value: ADJUSTMENT_TYPE.STOCK_OUT },
] as const;

export const adjustmentTypeSchema = z.object({
  code: z.string().min(1, "Code is required"),
  name: z.string().min(1, "Name is required"),
  type: z.enum(ADJUSTMENT_TYPE, { error: "Type is required" }),
  description: z.string(),
  note: z.string(),
  is_active: z.boolean(),
  // uuid ของ tb_chart_of_accounts — null = ไม่ผูกบัญชี
  chart_of_accounts_id: z.string().nullable(),
});

export type AdjustmentTypeFormValues = z.infer<typeof adjustmentTypeSchema>;

export interface AdjustmentType extends AdjustmentTypeFormValues {
  id: string;
  doc_version?: number;
  audit?: Audit;
}

export interface CreateAdjustmentTypeDto {
  code: string;
  name: string;
  type: ADJUSTMENT_TYPE;
  description: string;
  note: string;
  is_active: boolean;
  chart_of_accounts_id: string | null;
  // Optimistic-concurrency token; required by the backend on update (PUT).
  doc_version?: number;
}
