export type PricelistExternalTaxProfileOption = {
  id: string;
  name: string;
  // อัตราภาษี (%) — ใช้เซ็ต tax_rate ของแถวเมื่อ vendor เลือก tax profile
  tax_rate: number;
  is_active: boolean;
};

export type PricelistExternalDto = {
  id: string;
  pricelist_no: string;
  name: string;
  status: "draft" | "submitted" | "active" | "inactive" | "expired";
  vendor: { id: string | null; name: string | null };
  // โรงแรมผู้ขอเสนอราคา (ผู้ยื่นเอกสารให้ vendor กรอก)
  hotel: { name: string; address: string } | null;
  currency_id: string;
  currency_code: string;
  effective_from_date: string;
  effective_to_date: string;
  description: string | null;
  note: string | null;
  tb_pricelist_detail: PricelistExternalDetailDto[];
};

export type MoqTierDto = {
  id: string;
  minimum_quantity: number;
  price: number;
  lead_time_days?: number;
  /** flag ที่เก็บไว้ของ tier เดิม (มาจาก server) — tier ใหม่ไม่มี = สืบทอดจากแถวแม่ตอนบันทึก */
  is_tax_included?: boolean;
};

export type PricelistExternalDetailDto = {
  id: string;
  sequence_no: number;
  product_id: string;
  product_code: string;
  product_name: string;
  unit_id: string | null;
  unit_name: string | null;
  moq_qty: number;
  price_without_tax: number;
  tax_amt: number;
  price: number;
  tax_profile_id: string;
  tax_profile_name: string | null;
  tax_rate: number;
  /** ราคาที่กรอกรวม VAT แล้ว (Inc VAT) */
  is_tax_included?: boolean;
  lead_time_days: number;
  is_active: boolean;
  is_preferred: boolean;
  note: string | null;
  moq_tiers?: MoqTierDto[];
};
