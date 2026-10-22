export interface UpdateProfileDto {
  alias_name: string;
  firstname: string;
  middlename: string;
  lastname: string;
  telephone: string;
}

export interface ChangePasswordDto {
  current_password: string;
  new_password: string;
}

export interface UserProfile {
  id: string;
  email: string;
  alias_name: string | null;
  platform_role: string;
  user_info: {
    firstname: string;
    middlename: string;
    lastname: string;
    telephone: string | null;
    avatar_file_token: string | null;
  };
  business_unit: BusinessUnit[];
  avatar_url: string | null;
  signature_url: string | null;
}

interface CurrentPeriod {
  id: string;
  period: string;
  fiscal_year: number;
  fiscal_month: number;
  start_at: string;
  end_at: string;
  status: string;
}

export interface BusinessUnit {
  id: string;
  name: string;
  code: string;
  alias_name: string;
  logo_file_token: string | null;
  is_default: boolean;
  system_level: string;
  is_active: boolean;
  /**
   * Per-BU interface entitlement — `<category>_<brand>` keys the platform licensed for this
   * business unit (e.g. `"pos_simphony"`). The UI shows ONLY the listed brands. Absent (backend
   * did not send it / platform selected none) or an empty array → the UI shows nothing.
   */
  enabled_interfaces?: string[];
  department: {
    id: string;
    name: string;
  } | null;
  hod_department: { id: string; name: string }[];
  current_period?: CurrentPeriod;
  config: BusinessUnitConfig;
  permissions: string[];
  logo_url: string | null;
  avatar_url: string | null;
}

interface BusinessUnitConfig {
  calculation_method: string;
  default_currency_id: string;
  default_currency: {
    code: string;
    name: string;
    symbol: string;
    description: string;
    decimal_places: number;
  } | null;
  hotel: ContactInfo;
  company: ContactInfo;
  tax_no: string;
  branch_no: string;
  date_format: string;
  time_format: string;
  date_time_format: string;
  long_time_format: string;
  short_time_format: string;
  timezone: string;
  amount_format: NumberFormat;
  quantity_format: NumberFormat;
  recipe_format: NumberFormat;
  description: string | null;
  info: unknown;
  is_hq: boolean;
  is_active: boolean;
}

interface ContactInfo {
  name: string;
  tel: string;
  email: string;
  address: string;
  zip_code: string;
}

interface NumberFormat {
  locales: string;
  minimumIntegerDigits: number;
}
