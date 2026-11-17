import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { useMemo } from "react";
import { useTranslations } from "use-intl";
import { toast } from "sonner";
import { useBuCode } from "@/hooks/use-bu-code";
import { ApiError, ERROR_CODES } from "@/lib/api-error";
import type { ParamsDto } from "@/types/params";
import {
  MOCK_ACCOUNTS,
  MOCK_COST_CENTERS,
  enrichMockMaster,
  initialMockMasters,
  mockDependencies,
  mockMasterKind,
  mockMasterPage,
  type MockMasterRow,
} from "./ap-master-mock-data";
import type {
  ApMasterAccountMapping,
  ApMasterDependencies,
} from "@/types/accounting-master";

// shortcut: Session-only fixtures; switch to live contracts after master API release.
export function createApMasterMockCrud<
  T extends MockMasterRow,
  TPayload extends Partial<T>,
>(endpoint: (bu: string) => string, queryKey: string) {
  const kind = mockMasterKind(endpoint(""));
  const key = (bu: string | undefined) => ["ap-master-mockup", bu, kind];
  const rows = (client: QueryClient, bu: string | undefined) =>
    client.getQueryData<T[]>(key(bu)) ?? (initialMockMasters(kind) as T[]);

  function useList(params?: ParamsDto, options?: { enabled?: boolean }) {
    const bu = useBuCode();
    const client = useQueryClient();
    const source = useQuery({
      queryKey: key(bu),
      queryFn: async () => rows(client, bu),
      initialData: () => rows(client, bu),
      staleTime: Infinity,
      gcTime: Infinity,
      enabled: options?.enabled,
    });
    const { page, perpage, sort, filter, search } = params ?? {};
    const data = useMemo(
      () =>
        mockMasterPage(source.data, { page, perpage, sort, filter, search }),
      [source.data, page, perpage, sort, filter, search],
    );
    return { ...source, data };
  }
  function useWrite(mode: "create" | "update") {
    const client = useQueryClient();
    const bu = useBuCode();
    const t = useTranslations("config.apMaster");
    return useMutation({
      meta: { skipGlobalErrorToast: true },
      onError: (error: Error) => {
        if (!dependencyDetails(error)) toast.error(error.message);
      },
      mutationFn: async (
        data: TPayload & { id?: string; doc_version?: number },
      ) => {
        const currentRows = rows(client, bu);
        const previous =
          mode === "update"
            ? currentRows.find((row) => row.id === data.id)
            : undefined;
        if (mode === "update" && !previous) throw new Error(t("mockNotFound"));
        if (previous && previous.doc_version !== data.doc_version)
          throw new Error(t("mockVersionConflict"));
        const code = String(data.code ?? previous?.code ?? "")
          .trim()
          .toUpperCase();
        if (!code) throw new Error(t("mockCodeRequired"));
        if (previous && code !== previous.code)
          throw new Error(t("mockCodeImmutable"));
        if (
          currentRows.some(
            (row) => row.code === code && row.id !== previous?.id,
          )
        )
          throw new Error(t("mockDuplicateCode"));
        if (previous?.is_active && data.is_active === false) {
          const dependencies = mockDependencies(kind, previous.code);
          if (!dependencies.can_deactivate)
            throw new ApiError(
              ERROR_CODES.VALIDATION_ERROR,
              t("dependencyDescription"),
              422,
              false,
              dependencies,
            );
        }
        const next = enrichMockMaster({
          ...previous,
          ...data,
          code,
          description: String(
            data.description ?? previous?.description ?? "",
          ).trim(),
          id: previous?.id ?? crypto.randomUUID(),
          doc_version: (previous?.doc_version ?? -1) + 1,
        } as unknown as T);
        client.setQueryData(
          key(bu),
          previous
            ? currentRows.map((row) => (row.id === next.id ? next : row))
            : [...currentRows, next],
        );
        return { id: next.id, doc_version: next.doc_version };
      },
    });
  }
  function useDeleteVersioned() {
    const client = useQueryClient();
    const bu = useBuCode();
    const t = useTranslations("config.apMaster");
    return useMutation({
      meta: { skipGlobalErrorToast: true },
      onError: (error: Error) => {
        if (!dependencyDetails(error)) toast.error(error.message);
      },
      mutationFn: async ({
        id,
        doc_version,
      }: {
        id: string;
        doc_version: number;
      }) => {
        const currentRows = rows(client, bu);
        const previous = currentRows.find((row) => row.id === id);
        if (!previous) throw new Error(t("mockNotFound"));
        if (previous.doc_version !== doc_version)
          throw new Error(t("mockVersionConflict"));
        const dependencies = mockDependencies(kind, previous.code);
        if (!dependencies.can_delete)
          throw new ApiError(
            ERROR_CODES.VALIDATION_ERROR,
            t("dependencyDescription"),
            422,
            false,
            dependencies,
          );
        client.setQueryData(
          key(bu),
          currentRows.filter((row) => row.id !== id),
        );
      },
    });
  }
  // ConfigListTemplate requires an id-only adapter; these pages use a custom
  // confirmation that preserves the selected record's version instead.
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

export async function readMasterDependencies(
  endpoint: string,
  id: string,
): Promise<ApMasterDependencies> {
  const kind = mockMasterKind(endpoint);
  return mockDependencies(
    kind,
    initialMockMasters(kind).find((row) => row.id === id)?.code ?? "",
  );
}

export function useMasterAccountMapping(
  endpoint: (bu: string) => string,
  accountId: string | null,
) {
  void endpoint;
  const selected = MOCK_ACCOUNTS.find((item) => item.id === accountId);
  const data: ApMasterAccountMapping | undefined = selected
    ? {
        account: selected,
        is_require_cost_center: false,
        cost_centers: MOCK_COST_CENTERS,
        default_cost_center_id: selected.cost_center_id,
        dimensions: selected.dimensions.map((item) => ({
          dimension_id: item.dimension_id,
          code: item.dimension_code!,
          name: item.dimension_name!,
          requirement: "optional",
        })),
      }
    : undefined;
  return { data, isLoading: false, error: null };
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
