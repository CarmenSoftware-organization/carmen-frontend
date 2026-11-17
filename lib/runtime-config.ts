export interface RuntimeConfig {
  BACKEND_URL: string;
  X_APP_ID: string;
  WS_URL?: string;
  /**
   * สวิตช์ shadow-mode ของ FE สำหรับการล็อก UI ตาม license — mirror ของสวิตช์
   * `license.enforcement_enabled` บน backend (default `false` ที่นั่นเช่นกัน)
   *
   * **ทำไมต้องมีสวิตช์แยกฝั่ง FE เลย ทั้งที่ backend มีของตัวเองอยู่แล้ว:**
   * `GET /api/user/profile` **ไม่ส่งค่าสวิตช์ของ backend มาให้ FE เลย** (ยืนยันจากซอร์ส
   * เฟส A — `isEnforcementEnabled()` ไม่ถูกเรียกใน `getUserProfile`) ดังนั้น FE ไม่มีทาง
   * รู้ว่า backend เปิด enforcement จริงไหมจาก response ปกติ ถ้า FE ล็อก UI ตามข้อมูล
   * `license` ตรง ๆ โดยไม่มีสวิตช์นี้ — วันที่ backend เฟส A deploy ก่อนที่ BU ทุกตัวจะถูก
   * backfill สัญญา (สถานะ `state:"none", features:[]` ชั่วคราว) ทุกโมดูลของทุกคนจะถูกล็อก
   * ทั้งแอปทันที ทั้งที่ backend เองยังปล่อยผ่านทุกอย่างอยู่ (shadow mode)
   *
   * **อย่าลบสวิตช์นี้ทิ้งแม้จะดูซ้ำซ้อนกับ backend** — มันมีไว้กันลำดับ deploy ผิดพลาด
   * ระหว่าง FE/BE โดยเฉพาะ ไม่ใช่ของตกค้างที่ "ทำความสะอาด" ได้ เปิดพร้อมกับตอนที่
   * ยืนยันแล้วว่า backend เปิด enforcement จริงและข้อมูล license ของทุก BU ถูก
   * backfill ครบแล้วเท่านั้น
   *
   * Default `false` เมื่อไม่มีใน config.json (shadow mode เหมือน backend)
   */
  LICENSE_ENFORCEMENT?: boolean;
  /**
   * สวิตช์ส่ง telemetry (error + trace) ขึ้น SigNoz ผ่าน gateway
   *
   * ปลายทางไม่ต้องตั้งเพราะมันคือ `${BACKEND_URL}/telemetry/v1` เสมอ — SPA ไม่ยิง
   * เข้า OTLP ของ SigNoz ตรง ๆ เพราะ endpoint นั้นไม่มี authentication เลย
   *
   * **ไม่ตั้ง = ปิด และ SDK จะไม่ถูกดาวน์โหลดลงเครื่องผู้ใช้ด้วยซ้ำ** (`main.tsx`
   * import แบบ dynamic) environment ที่ไม่ได้เปิดจึงไม่จ่ายค่า bundle เลย
   *
   * ⚠️ `public/config*.json` ของทุก environment ถูก gitignore — ต้องเติมคีย์นี้
   * **ด้วยมือ** เหมือน `LICENSE_ENFORCEMENT` ไม่งั้น deploy แล้วเงียบสนิทโดยไม่มี error
   */
  OTEL_ENABLED?: boolean;
  /**
   * ชื่อ environment ที่ติดไปกับทุก trace/error (facet "Deployment Environment"
   * ของ SigNoz) — ไม่ตั้ง = `"dev"`
   *
   * ค่านี้เคย hardcode เป็น `"dev"` ในโค้ด ทุก environment จึงรายงานตัวเองว่าเป็น dev
   * แล้ว error ของ prod กับของเครื่อง dev กองรวมกันใน facet เดียวโดยแยกไม่ออกว่า
   * อันไหนกระทบลูกค้าจริง — ตั้งให้ตรงกับ environment เสมอเมื่อเปิด `OTEL_ENABLED`
   */
  OTEL_ENVIRONMENT?: string;
  /**
   * สวิตช์เปิดช่อง dimension รายบรรทัดในเอกสารซื้อ/คลัง (PR · PO · GRN · SR · IA)
   * — gate ตัวแรกของ `useLineDimensionsEnabled()` ก่อนเช็ก license / dimension active
   *
   * ฟีเจอร์นี้ยังไม่พร้อมให้ลูกค้าใช้ (ตัดสิน 2026-11-17) จึง **ไม่ตั้ง = ปิด** แล้วเปิด
   * เฉพาะ local/dev เพื่อให้ทีมยังทดสอบได้ ปิดอยู่ = ไม่แสดงช่อง ไม่ส่ง `dimensions`
   * ใน payload (ค่าที่บันทึกไว้แล้วจึงไม่ถูกแตะ) และไม่ยิง query gl-dimension
   *
   * ⚠️ `public/config*.json` ถูก gitignore — ต้องเติมคีย์นี้ **ด้วยมือ** ใน env ที่จะเปิด
   * ลืมเติม = ฟีเจอร์ซ่อนเงียบ ๆ โดยไม่มี error (ด้านที่ปลอดภัย)
   */
  LINE_DIMENSIONS_ENABLED?: boolean;
}

let config: RuntimeConfig | null = null;

export async function loadRuntimeConfig(): Promise<RuntimeConfig> {
  const res = await fetch("/config.json", { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load /config.json (${res.status})`);
  const json = (await res.json()) as Partial<RuntimeConfig>;
  if (typeof json.BACKEND_URL !== "string") {
    throw new Error("config.json missing BACKEND_URL");
  }
  if (typeof json.X_APP_ID !== "string" || !json.X_APP_ID) {
    throw new Error("config.json missing or empty X_APP_ID");
  }
  config = {
    BACKEND_URL: json.BACKEND_URL.replace(/\/+$/, ""),
    X_APP_ID: json.X_APP_ID,
    ...(typeof json.WS_URL === "string" && json.WS_URL
      ? { WS_URL: json.WS_URL }
      : {}),
    ...(typeof json.LICENSE_ENFORCEMENT === "boolean"
      ? { LICENSE_ENFORCEMENT: json.LICENSE_ENFORCEMENT }
      : {}),
    ...(typeof json.OTEL_ENABLED === "boolean"
      ? { OTEL_ENABLED: json.OTEL_ENABLED }
      : {}),
    ...(typeof json.OTEL_ENVIRONMENT === "string" && json.OTEL_ENVIRONMENT
      ? { OTEL_ENVIRONMENT: json.OTEL_ENVIRONMENT }
      : {}),
    ...(typeof json.LINE_DIMENSIONS_ENABLED === "boolean"
      ? { LINE_DIMENSIONS_ENABLED: json.LINE_DIMENSIONS_ENABLED }
      : {}),
  };
  return config;
}

export function getRuntimeConfig(): RuntimeConfig {
  if (!config) {
    throw new Error(
      "Runtime config not loaded — call loadRuntimeConfig() first",
    );
  }
  return config;
}

export function setRuntimeConfigForTests(value: RuntimeConfig | null): void {
  config = value;
}
