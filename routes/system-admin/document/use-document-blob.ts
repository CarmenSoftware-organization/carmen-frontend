import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useBuCode } from "@/hooks/use-bu-code";
import { httpClient } from "@/lib/http-client";
import { API_ENDPOINTS } from "@/constant/api-endpoints";
import { QUERY_KEYS } from "@/constant/query-keys";

/**
 * ดึงเนื้อไฟล์ผ่าน `GET /documents/:token/download` (api_name `documents.download`) เป็น Blob
 *
 * ทำไมไม่ใช้ presigned URL: URL นั้นชี้ host ของ storage ตรง ๆ ซึ่งในเครื่อง dev อาจเป็น host
 * ภายในที่เบราว์เซอร์เข้าไม่ถึง และ CSP `frame-src` อนุญาตแค่ `'self' blob:` — PDF ใน iframe
 * จะโดนบล็อกบน production ส่วน blob ผ่าน gateway ใช้ได้ทุก env และทุกชนิด (รูป/PDF/ข้อความ)
 *
 * เก็บ Blob (ไม่ใช่ object URL) ใน cache — URL สร้าง/คืนที่ component ผ่าน `useObjectUrl`
 * staleTime Infinity: เนื้อไฟล์ของ token เดิมไม่เปลี่ยน (แทนที่ = token ใหม่)
 * ไม่ใช้ key ขึ้นต้น QUERY_KEYS.DOCUMENTS โดยตั้งใจ — invalidate รายการหลังลบ/อัปโหลด
 * จะได้ไม่โหลดรูปทั้งหน้าซ้ำ
 *
 * @param fileToken - token ของไฟล์ (มี prefix `BU/` ได้)
 * @param enabled - false = ยังไม่โหลด (เช่น tile ยังไม่เข้า viewport)
 */
export function useDocumentBlob(fileToken: string | undefined, enabled = true) {
  const buCode = useBuCode();
  return useQuery<Blob>({
    queryKey: [QUERY_KEYS.DOCUMENTS + "-blob", buCode, fileToken],
    queryFn: async () => {
      const id = fileToken!.includes("/")
        ? fileToken!.split("/").pop()!
        : fileToken!;
      const res = await httpClient.get(
        `${API_ENDPOINTS.DOCUMENTS(buCode!)}/${id}/download`,
      );
      if (!res.ok) throw new Error("Failed to download document");
      return res.blob();
    },
    staleTime: Infinity,
    gcTime: 5 * 60 * 1000,
    retry: false,
    enabled: !!buCode && !!fileToken && enabled,
  });
}

/**
 * object URL ของ Blob — คืนหน่วยความจำ (revoke) เมื่อ blob เปลี่ยนหรือ unmount
 * @param blob - Blob ที่จะเปิด (undefined = ยังไม่มี)
 * @returns URL สำหรับ `src` หรือ undefined
 */
export function useObjectUrl(blob: Blob | undefined) {
  // เก็บคู่ blob↔url แล้ว derive ตอน render — blob เปลี่ยนแล้ว url เก่าไม่หลุดออกไปแม้แต่เฟรมเดียว
  const [entry, setEntry] = useState<{ blob: Blob; url: string }>();
  useEffect(() => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    // setState ใน callback ของ microtask ไม่ใช่ตัว effect ตรง ๆ (กฎ set-state-in-effect)
    queueMicrotask(() => setEntry({ blob, url }));
    return () => URL.revokeObjectURL(url);
  }, [blob]);
  return blob && entry?.blob === blob ? entry.url : undefined;
}
