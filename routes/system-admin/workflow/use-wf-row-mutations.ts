import { useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";
import { useBuCode } from "@/hooks/use-bu-code";
import { useCreateWorkflow, useUpdateWorkflow } from "./use-wf-mutations";
import { httpClient } from "@/lib/http-client";
import { ApiError } from "@/lib/api-error";
import { useErrorToast } from "@/hooks/use-error-toast";
import { API_ENDPOINTS } from "@/constant/api-endpoints";
import type { Workflow, WorkflowDto } from "@/types/workflows";
import {
  getWorkflowFormDefaults,
  WorkflowDataParseError,
  type WorkflowCreateModel,
} from "./wf-form-schema";

interface MutateOptions<T> {
  readonly mutate: (
    payload: T,
    cb: { onSuccess: (res: unknown) => void; onError: (err: Error) => void },
  ) => void;
}

const runMutation = <T>(
  mutation: MutateOptions<T>,
  payload: T,
  successMessage: string,
): Promise<unknown> =>
  new Promise<unknown>((resolve, reject) => {
    mutation.mutate(payload, {
      onSuccess: (res) => {
        toast.success(successMessage);
        resolve(res);
      },
      onError: (err: Error) => reject(err),
    });
  });

export function useWfRowMutations() {
  const buCode = useBuCode();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const updateWorkflow = useUpdateWorkflow();
  const createWorkflow = useCreateWorkflow();
  const t = useTranslations("systemAdmin.workflow");
  const errorToast = useErrorToast();

  const fetchDetail = async (id: string): Promise<Workflow> => {
    if (!buCode) throw new Error("Missing buCode");
    const res = await httpClient.get(
      `${API_ENDPOINTS.WORKFLOWS(buCode)}/${id}`,
    );
    if (!res.ok) throw await ApiError.from(res, "Failed to fetch workflow");
    const json = await res.json();
    return json.data as Workflow;
  };

  const handle = async <T>(
    workflow: Pick<WorkflowDto, "id">,
    runner: (detail: Workflow) => Promise<T>,
  ) => {
    try {
      setPendingId(workflow.id);
      let detail: Workflow;
      try {
        detail = await fetchDetail(workflow.id);
      } catch (err) {
        // ดึงเองด้วย httpClient ไม่ได้ผ่าน MutationCache → toast เองตรงนี้
        errorToast(err);
        return;
      }
      await runner(detail);
    } catch (err) {
      // ข้อมูลคนละ shape — บอกให้ชัด ไม่ใช่โยน message ดิบของ schema ใส่หน้าผู้ใช้
      // error อื่นมาจาก mutation ซึ่ง toast ขึ้นจาก MutationCache กลางแล้ว
      if (err instanceof WorkflowDataParseError)
        toast.error(t("incompatibleData"));
    } finally {
      setPendingId(null);
    }
  };

  const toggleActive = (workflow: WorkflowDto) =>
    handle(workflow, async (detail) => {
      const next = !workflow.is_active;
      const defaults = getWorkflowFormDefaults(detail);
      const payload: WorkflowCreateModel & {
        id: string;
        doc_version?: number;
      } = {
        ...defaults,
        id: workflow.id,
        is_active: next,
        // detail is freshly GET-fetched above — its doc_version is current
        doc_version: detail.doc_version,
      };
      await runMutation(
        updateWorkflow,
        payload,
        next ? t("activateSuccess") : t("deactivateSuccess"),
      );
    });

  // onCreated ได้ id ของสำเนา — หน้า detail ใช้พาไปเปิดตัวใหม่ ส่วนหน้า list ไม่ส่ง (อยู่หน้าเดิม)
  const duplicate = (
    workflow: Pick<WorkflowDto, "id">,
    onCreated?: (id: string) => void,
  ) =>
    handle(workflow, async (detail) => {
      const defaults = getWorkflowFormDefaults(detail);
      const newId = crypto.randomUUID();
      const payload: WorkflowCreateModel = {
        ...defaults,
        id: newId,
        name: `${detail.name} ${t("copySuffix")}`,
      };
      const res = await runMutation(
        createWorkflow,
        payload,
        t("duplicateSuccess"),
      );
      // shape เดียวกับ wf-new-form — backend คืน data.id ถ้าไม่มีก็ใช้ id ที่ส่งไป
      const data = res as { data?: { id?: string } } | undefined;
      onCreated?.(data?.data?.id ?? newId);
    });

  return { pendingId, toggleActive, duplicate };
}
