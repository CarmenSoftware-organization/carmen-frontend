import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useBuCode } from "@/hooks/use-bu-code";
import { createConfigCrud } from "@/hooks/use-config-crud";
import { httpClient } from "@/lib/http-client";
import { ApiError } from "@/lib/api-error";
import type {
  ApMasterBase,
  ApMasterDimension,
  ApMasterDependencies,
  ApMasterAccountMapping,
} from "@/types/accounting-master";
import type { ParamsDto } from "@/types/params";

type ApiDimension = Omit<
  ApMasterDimension,
  "dimension_id" | "dimension_value_id"
> & {
  gl_dimension_id: string;
  gl_dimension_value_id: string;
};

// These master APIs use GL-prefixed lookup references, unlike document dimensions.
export function masterDimensionsPayload(
  dimensions: readonly ApMasterDimension[],
) {
  return dimensions
    .filter((ref) => !!ref.dimension_value_id)
    .map((ref) => ({
      gl_dimension_id: ref.dimension_id,
      gl_dimension_value_id: ref.dimension_value_id!,
    }));
}

export function normalizeMaster<T extends ApMasterBase>(
  row: T & { dimensions?: ApiDimension[] },
): T {
  return row.dimensions
    ? {
        ...row,
        dimensions: row.dimensions.map(
          ({ gl_dimension_id, gl_dimension_value_id, ...labels }) => ({
            ...labels,
            dimension_id: gl_dimension_id,
            dimension_value_id: gl_dimension_value_id,
          }),
        ),
      }
    : row;
}

export async function readMasterData<T>(url: string): Promise<T> {
  const res = await httpClient.get(url);
  if (!res.ok)
    throw await ApiError.from(res, "Failed to load accounting master");
  const json = await res.json();
  return json.data;
}

export function createApMasterCrud<T extends ApMasterBase, TPayload>(
  endpoint: (bu: string) => string,
  queryKey: string,
) {
  const crud = createConfigCrud<T & { dimensions?: ApiDimension[] }, TPayload>({
    endpoint,
    queryKey,
    label: queryKey,
  });
  function useList(params?: ParamsDto, options?: { enabled?: boolean }) {
    return crud.useList(params, {
      ...options,
      select: (page) => ({ ...page, data: page.data.map(normalizeMaster<T>) }),
    });
  }
  function useWrite<
    TVars extends { id?: string; doc_version?: number } = TPayload & {
      id?: string;
      doc_version?: number;
    },
  >(mode: "create" | "update" | "delete") {
    const client = useQueryClient();
    const bu = useBuCode();
    return useMutation({
      meta: { skipGlobalErrorToast: true },
      onError: (error: Error) => {
        if (!dependencyDetails(error)) toast.error(error.message);
      },
      mutationFn: async (data: TVars) => {
        if (!bu) throw new Error("Missing business unit");
        const { id, ...payload } = data;
        const url = endpoint(bu);
        const res =
          mode === "create"
            ? await httpClient.post(url, payload)
            : mode === "update"
              ? await httpClient.put(`${url}/${id}`, payload)
              : await httpClient.delete(
                  `${url}/${id}?doc_version=${data.doc_version}`,
                );
        if (!res.ok)
          throw await ApiError.from(res, `Failed to ${mode} accounting master`);
        return res.status === 204 ? undefined : res.json();
      },
      onSuccess: () => client.invalidateQueries({ queryKey: [queryKey, bu] }),
    });
  }
  function useDeleteVersioned() {
    return useWrite<{ id: string; doc_version: number }>("delete");
  }

  // The list's custom delete dialog supplies doc_version; never use id-only deletion.
  function useDelete() {
    return {
      isPending: false,
      mutate: () => {
        throw new Error("Deletion requires the selected record version");
      },
    };
  }
  return {
    endpoint,
    queryKey,
    useList,
    useCreate: () => useWrite("create"),
    useUpdate: () => useWrite("update"),
    useDelete,
    useDeleteVersioned,
  };
}

export function readMasterDependencies(endpoint: string, id: string) {
  return readMasterData<ApMasterDependencies>(`${endpoint}/${id}/dependencies`);
}

export function useMasterAccountMapping(
  endpoint: (bu: string) => string,
  accountId: string | null,
) {
  const bu = useBuCode();
  return useQuery({
    queryKey: ["ap-master-account-mapping", endpoint(bu ?? ""), accountId],
    enabled: !!bu && !!accountId,
    queryFn: async (): Promise<ApMasterAccountMapping> => {
      const data = await readMasterData<
        Omit<ApMasterAccountMapping, "dimensions"> & {
          dimensions: (Omit<
            ApMasterAccountMapping["dimensions"][number],
            "dimension_id"
          > & { gl_dimension_id: string })[];
        }
      >(`${endpoint(bu!)}/account-mapping/${accountId}`);
      return {
        ...data,
        dimensions: data.dimensions.map(({ gl_dimension_id, ...rule }) => ({
          ...rule,
          dimension_id: gl_dimension_id,
        })),
      };
    },
  });
}

export function dependencyDetails(
  error: unknown,
): ApMasterDependencies | undefined {
  if (
    !(error instanceof ApiError) ||
    !error.details ||
    typeof error.details !== "object"
  )
    return undefined;
  const data = error.details as Partial<ApMasterDependencies>;
  if (!Array.isArray(data.references)) return undefined;
  return {
    is_used: data.is_used ?? true,
    can_deactivate: data.can_deactivate ?? false,
    can_delete: data.can_delete ?? false,
    references: data.references,
  };
}
