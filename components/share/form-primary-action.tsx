import {
  createContext,
  useContext,
  useLayoutEffect,
  useState,
  type ReactNode,
} from "react";

/**
 * ปุ่มหลัก (พื้นน้ำเงิน) มีได้ตัวเดียวต่อหน้า — หน้าเอกสารที่มีปุ่ม workflow ใน
 * footer (Submit / Approve / Commit) ปุ่มนั้นคือขั้นถัดไปของใบ ส่วน Edit/Save บนหัว
 * เป็นแค่การแก้ใบ จึงลดเป็น outline (Submit บันทึกให้ด้วยอยู่แล้ว)
 *
 * footer เป็นคนบอก ไม่ใช่ให้หัวคำนวณเอง — เงื่อนไขว่าปุ่มไหนโผล่ (role · stage ·
 * flag ของ workflow) อยู่ใน footer ของแต่ละโมดูล ลอกมาไว้สองที่เมื่อไรก็เพี้ยนกัน
 * ปุ่ม workflow หาย (ใบจบแล้ว / อ่านอย่างเดียว) = หัวกลับเป็นปุ่มหลักเอง
 */
interface FormPrimaryState {
  readonly claimed: boolean;
  readonly setClaimed: (claimed: boolean) => void;
}

const FormPrimaryContext = createContext<FormPrimaryState | null>(null);

export function FormPrimaryProvider({
  children,
}: {
  readonly children: ReactNode;
}) {
  const [claimed, setClaimed] = useState(false);
  return (
    <FormPrimaryContext value={{ claimed, setClaimed }}>
      {children}
    </FormPrimaryContext>
  );
}

/** footer เรียก — `active` = มีปุ่ม workflow ที่มองเห็นและกดได้อยู่ตอนนี้ */
export function useClaimFormPrimary(active: boolean) {
  const setClaimed = useContext(FormPrimaryContext)?.setClaimed;
  // layout effect ไม่ใช่ effect — ไม่งั้นหัวจะวาดเป็นน้ำเงินหนึ่งเฟรมแล้วค่อยกระพริบเป็น outline
  useLayoutEffect(() => {
    if (!setClaimed) return;
    setClaimed(active);
    return () => setClaimed(false);
  }, [setClaimed, active]);
}

/** FormToolbar เรียก — นอก FormPageShell ไม่มี provider = false (ปุ่มหลักตามเดิม) */
export function useFormPrimaryClaimed(): boolean {
  return useContext(FormPrimaryContext)?.claimed ?? false;
}
