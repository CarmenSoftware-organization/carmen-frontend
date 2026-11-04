import type { PaginatedResponse, ParamsDto } from "@/types/params";
import type {
  JournalVoucher,
  JournalVoucherAction,
  JournalVoucherInput,
} from "@/types/journal-voucher";

export type JournalVoucherCommand =
  | "submit"
  | "approve"
  | "reject"
  | "reschedule"
  | "reverse"
  | "void";

export interface JournalVoucherRepository {
  list(
    buCode: string,
    params?: ParamsDto,
  ): Promise<PaginatedResponse<JournalVoucher>>;
  get(buCode: string, id: string): Promise<JournalVoucher | null>;
  create(buCode: string, input: JournalVoucherInput): Promise<JournalVoucher>;
  update(
    buCode: string,
    id: string,
    docVersion: number,
    input: JournalVoucherInput,
  ): Promise<JournalVoucher>;
  action(
    buCode: string,
    id: string,
    action: JournalVoucherCommand,
    input: JournalVoucherAction,
  ): Promise<JournalVoucher>;
  copy(buCode: string, id: string): Promise<JournalVoucher>;
  /** ลบใบ draft (backend soft-delete; ใบที่พ้น draft ตอบ 409) */
  remove(buCode: string, id: string): Promise<void>;
}
