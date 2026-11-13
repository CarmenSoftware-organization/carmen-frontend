import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  ChangePasswordDto,
  UpdateProfileDto,
  UserProfile,
} from "@/types/profile";
import { API_ENDPOINTS } from "@/constant/api-endpoints";
import { QUERY_KEYS } from "@/constant/query-keys";
import { ApiError } from "@/lib/api-error";
import { httpClient } from "@/lib/http-client";

export const profileQueryKey = [QUERY_KEYS.PROFILE] as const;

export function useProfile() {
  const query = useQuery<UserProfile>({
    queryKey: profileQueryKey,
    queryFn: async () => {
      const res = await httpClient.get(API_ENDPOINTS.PROFILE);

      if (!res.ok) throw new Error("Failed to fetch profile");

      const json = await res.json();
      return json.data;
    },
    staleTime: Infinity,
    retry: 1,
  });

  // backend ยืนยัน "BU ปัจจุบัน" จาก is_default เท่านั้น — ถ้าไม่มีแถวไหนตั้งไว้
  // `/api/business-units` ตอบ 404 "No current business unit set for user"
  // fallback เป็นตัวแรกจึงเป็นของสำหรับ "แสดงผล" ล้วน ๆ ไม่ใช่คำตอบว่า BU ไหน
  // active จริง ใครที่ต้องรู้ความจริงข้อนี้ (เช่น bu-switcher ที่ปิดปุ่มของ BU
  // ที่ active อยู่) ต้องอ่าน `hasDefaultBu` ไม่ใช่เดาจากการที่ `defaultBu` มีค่า
  const assignedDefaultBu = query.data?.business_unit.find((b) => b.is_default);
  const hasDefaultBu = !!assignedDefaultBu;
  const defaultBu = assignedDefaultBu ?? query.data?.business_unit[0];

  const userId = query.data?.id;
  const aliasName = query.data?.alias_name;
  const userInfo = query.data?.user_info;
  const fullName = userInfo
    ? [userInfo.firstname, userInfo.middlename, userInfo.lastname]
        .map((p) => p?.trim())
        .filter((p): p is string => !!p)
        .join(" ")
    : "";
  const avatarUrl = query.data?.avatar_url ?? null;
  const signatureUrl = query.data?.signature_url ?? null;
  // Interface entitlement is per-BU — read the current (default) BU's list.
  const enabledInterfaces = defaultBu?.enabled_interfaces;
  const buCode = defaultBu?.code;
  const buLogoUrl = defaultBu?.logo_url ?? null;

  const defaultCurrencyId = defaultBu?.config?.default_currency_id;
  const defaultCurrencyCode =
    defaultBu?.config?.default_currency?.code ?? "THB";
  const defaultCurrencyDecimalPlaces =
    defaultBu?.config?.default_currency?.decimal_places ?? 2;
  const dateFormat = defaultBu?.config?.date_format ?? "DD/MM/YYYY";
  const dateTimeFormat =
    defaultBu?.config?.date_time_format ?? "DD/MM/YYYY HH:mm";
  const amountFormat = defaultBu?.config?.amount_format;

  const allBuCode = query.data?.business_unit.map((b) => b.code);
  const currentPeriod = defaultBu?.current_period;
  const hasDepartment = defaultBu?.department != null;
  const isProfileReady = query.isSuccess && !!buCode && !!defaultBu;

  if (import.meta.env.DEV && query.isSuccess && query.data) {
    if (query.data.business_unit.length === 0) {
      console.warn("[useProfile] business_unit array is empty");
    }
    if (!hasDefaultBu && query.data.business_unit.length > 0) {
      console.warn(
        "[useProfile] no business unit has is_default=true — showing the first one; /api/business-units stays 404 until one is set",
      );
    }
    if (defaultBu && !defaultBu.config) {
      console.warn(
        "[useProfile] Default BU config is missing:",
        defaultBu.code,
      );
    }
  }

  return {
    ...query,
    defaultBu,
    hasDefaultBu,
    buCode,
    defaultCurrencyId,
    defaultCurrencyCode,
    defaultCurrencyDecimalPlaces,
    dateFormat,
    dateTimeFormat,
    amountFormat,
    allBuCode,
    userId,
    hasDepartment,
    aliasName,
    fullName,
    avatarUrl,
    signatureUrl,
    buLogoUrl,
    currentPeriod,
    isProfileReady,
    enabledInterfaces,
  };
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation<unknown, ApiError, UpdateProfileDto>({
    mutationFn: async (data) => {
      const res = await httpClient.patch(API_ENDPOINTS.PROFILE_UPDATE, data);
      if (!res.ok) {
        let serverMessage: string | undefined;
        try {
          const err = await res.json();
          serverMessage = err.message;
        } catch {
          // JSON parse failed
        }
        throw await ApiError.from(
          res,
          serverMessage || "Failed to update profile",
        );
      }
      return res.json();
    },
    onSuccess: (_res, saved) => {
      // เขียนค่าที่เพิ่งบันทึกลง cache ทันที แล้วค่อย refetch — ถ้ารอ refetch อย่างเดียว ฟอร์มที่ผูก
      // `values` กับ profile จะถือค่าเก่าเป็น default อยู่ช่วงหนึ่ง (1–3 วินาที): ผู้ใช้แก้ค่ากลับเป็น
      // ค่าเดิมในช่วงนั้นฟอร์มมองว่า "ไม่ได้แก้" ปุ่ม Save จึง disabled และค่าที่พิมพ์ไม่ถูกบันทึก
      queryClient.setQueryData<UserProfile>(profileQueryKey, (old) =>
        old
          ? {
              ...old,
              alias_name: saved.alias_name,
              user_info: {
                ...old.user_info,
                firstname: saved.firstname,
                middlename: saved.middlename,
                lastname: saved.lastname,
                telephone: saved.telephone,
              },
            }
          : old,
      );
      queryClient.invalidateQueries({ queryKey: profileQueryKey });
    },
  });
}

export function useUploadUserAvatar() {
  const queryClient = useQueryClient();
  return useMutation<unknown, ApiError, File>({
    mutationFn: async (file) => {
      // Field name follows the BU-logo precedent (resource name = `avatar`).
      // Adjust if backend rejects with a different field-name expectation.
      const formData = new FormData();
      const ext = file.name?.split(".").pop() || "png";
      formData.append("avatar", file, `avatar.${ext}`);
      const res = await httpClient.post(API_ENDPOINTS.PROFILE_AVATAR, formData);
      if (!res.ok) {
        let serverMessage: string | undefined;
        try {
          const err = await res.json();
          serverMessage = err.message;
        } catch {
          // JSON parse failed
        }
        throw await ApiError.from(
          res,
          serverMessage || "Failed to upload avatar",
        );
      }
      return res.json().catch(() => ({}));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: profileQueryKey });
    },
  });
}

export function useDeleteUserAvatar() {
  const queryClient = useQueryClient();
  return useMutation<unknown, ApiError, void>({
    mutationFn: async () => {
      const res = await httpClient.delete(API_ENDPOINTS.PROFILE_AVATAR);
      if (!res.ok) {
        let serverMessage: string | undefined;
        try {
          const err = await res.json();
          serverMessage = err.message;
        } catch {
          // JSON parse failed
        }
        throw await ApiError.from(
          res,
          serverMessage || "Failed to remove avatar",
        );
      }
      return res.json().catch(() => ({}));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: profileQueryKey });
    },
  });
}

export function useUploadBuLogo() {
  const queryClient = useQueryClient();
  return useMutation<unknown, ApiError, { buId: string; file: File }>({
    mutationFn: async ({ buId, file }) => {
      // Backend expects `UploadLogoBodyDto` — field name is `logo` (not `file`),
      // accepts jpeg/png/webp.
      const formData = new FormData();
      const ext = file.name?.split(".").pop() || "png";
      formData.append("logo", file, `logo.${ext}`);
      const res = await httpClient.post(
        API_ENDPOINTS.BUSINESS_UNIT_LOGO(buId),
        formData,
      );
      if (!res.ok) {
        let serverMessage: string | undefined;
        try {
          const err = await res.json();
          serverMessage = err.message;
        } catch {
          // JSON parse failed
        }
        throw await ApiError.from(
          res,
          serverMessage || "Failed to upload BU logo",
        );
      }
      return res.json().catch(() => ({}));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: profileQueryKey });
    },
  });
}

export function useDeleteBuLogo() {
  const queryClient = useQueryClient();
  return useMutation<unknown, ApiError, string>({
    mutationFn: async (buId) => {
      const res = await httpClient.delete(
        API_ENDPOINTS.BUSINESS_UNIT_LOGO(buId),
      );
      if (!res.ok) {
        let serverMessage: string | undefined;
        try {
          const err = await res.json();
          serverMessage = err.message;
        } catch {
          // JSON parse failed
        }
        throw await ApiError.from(
          res,
          serverMessage || "Failed to remove BU logo",
        );
      }
      return res.json().catch(() => ({}));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: profileQueryKey });
    },
  });
}

export function useUploadBuAvatar() {
  const queryClient = useQueryClient();
  return useMutation<unknown, ApiError, { buId: string; file: File }>({
    mutationFn: async ({ buId, file }) => {
      // Backend expects field name `avatar` — mirrors `useUploadUserAvatar`.
      const formData = new FormData();
      const ext = file.name?.split(".").pop() || "png";
      formData.append("avatar", file, `avatar.${ext}`);
      const res = await httpClient.post(
        API_ENDPOINTS.BUSINESS_UNIT_AVATAR(buId),
        formData,
      );
      if (!res.ok) {
        let serverMessage: string | undefined;
        try {
          const err = await res.json();
          serverMessage = err.message;
        } catch {
          // JSON parse failed
        }
        throw await ApiError.from(
          res,
          serverMessage || "Failed to upload BU avatar",
        );
      }
      return res.json().catch(() => ({}));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: profileQueryKey });
    },
  });
}

export function useDeleteBuAvatar() {
  const queryClient = useQueryClient();
  return useMutation<unknown, ApiError, string>({
    mutationFn: async (buId) => {
      const res = await httpClient.delete(
        API_ENDPOINTS.BUSINESS_UNIT_AVATAR(buId),
      );
      if (!res.ok) {
        let serverMessage: string | undefined;
        try {
          const err = await res.json();
          serverMessage = err.message;
        } catch {
          // JSON parse failed
        }
        throw await ApiError.from(
          res,
          serverMessage || "Failed to remove BU avatar",
        );
      }
      return res.json().catch(() => ({}));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: profileQueryKey });
    },
  });
}

export function useUploadUserSignature() {
  const queryClient = useQueryClient();
  return useMutation<unknown, ApiError, File>({
    mutationFn: async (file) => {
      const formData = new FormData();
      const ext = file.name?.split(".").pop() || "png";
      formData.append("signature", file, `signature.${ext}`);
      const res = await httpClient.post(
        API_ENDPOINTS.PROFILE_SIGNATURE,
        formData,
      );
      if (!res.ok) {
        let serverMessage: string | undefined;
        try {
          const err = await res.json();
          serverMessage = err.message;
        } catch {
          // JSON parse failed
        }
        throw await ApiError.from(
          res,
          serverMessage || "Failed to upload signature",
        );
      }
      return res.json().catch(() => ({}));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: profileQueryKey });
    },
  });
}

export function useDeleteUserSignature() {
  const queryClient = useQueryClient();
  return useMutation<unknown, ApiError, void>({
    mutationFn: async () => {
      const res = await httpClient.delete(API_ENDPOINTS.PROFILE_SIGNATURE);
      if (!res.ok) {
        let serverMessage: string | undefined;
        try {
          const err = await res.json();
          serverMessage = err.message;
        } catch {
          // JSON parse failed
        }
        throw await ApiError.from(
          res,
          serverMessage || "Failed to remove signature",
        );
      }
      return res.json().catch(() => ({}));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: profileQueryKey });
    },
  });
}

export function useChangePassword() {
  return useMutation<unknown, ApiError, ChangePasswordDto>({
    mutationFn: async (data) => {
      const res = await httpClient.post(
        API_ENDPOINTS.PROFILE_CHANGE_PASSWORD,
        data,
      );
      if (!res.ok) {
        let serverMessage: string | undefined;
        try {
          const err = await res.json();
          serverMessage = err.message;
        } catch {
          // JSON parse failed
        }
        throw await ApiError.from(
          res,
          serverMessage || "Failed to change password",
        );
      }
      return res.json();
    },
  });
}
